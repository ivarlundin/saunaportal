// ==========================================
// SAUNA FESTIVAL 2026 - FORUM
// ==========================================

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const SESSION_KEY =
    "sauna_festival_participant_id";

const STORAGE_BUCKET =
    "festival2026-deltagare";

const MENTION_SEEN_COOKIE =
    "sauna_festival_mention_seen_at";

let participantId = null;
let participants = [];
let posts = [];
let feedMode = "latest";
let feedOffset = 0;
let feedHasMore = true;
let feedLoading = false;
let mentionNoticeChecked = false;
let activeReplyTargetId = null;
let activeReplyDraft = "";
let pendingScrollTarget = null;
let deleteFeedReloadTimer = null;

const FEED_PAGE_SIZE = 12;
const DELETE_FEED_RELOAD_MS = 25000;

const FORUM_CACHE_STORAGE_KEY =
    "sauna_festival_forum_cache_v1";

const FORUM_MEMBERS_CACHE_MS = 10 * 60 * 1000;
const FORUM_FEED_CACHE_MS = 3 * 60 * 1000;
const FORUM_BADGES_CACHE_MS = 5 * 60 * 1000;

const SEMINARIUM_PIN_PATTERN = /seminarium/i;
const SEMINARIUM_PIN_ALIAS = "ivve";
const NEWCOMER_BADGE_MS = 2 * 24 * 60 * 60 * 1000;

const REACTION_TYPES = [
    { key: "thumbs_up", emoji: "👍", label: "Tumme upp" },
    { key: "thumbs_down", emoji: "👎🏼", label: "Tumme ner" },
    { key: "eyes", emoji: "👀", label: "Ögon" },
    { key: "cool", emoji: "😎", label: "Cool" }
];

let participantBadges = new Map();


function readForumCacheStore() {

    try {

        const raw = sessionStorage.getItem(
            FORUM_CACHE_STORAGE_KEY
        );

        return raw ? JSON.parse(raw) : {};

    } catch (error) {

        console.warn("Could not read forum cache:", error);
        return {};

    }

}


function writeForumCacheStore(nextStore) {

    try {

        sessionStorage.setItem(
            FORUM_CACHE_STORAGE_KEY,
            JSON.stringify(nextStore)
        );

    } catch (error) {

        console.warn("Could not write forum cache:", error);

    }

}


function patchForumCache(patch) {

    writeForumCacheStore({
        ...readForumCacheStore(),
        ...patch
    });

}


function isForumCacheEntryFresh(entry, maxAgeMs) {

    if (!entry?.cachedAt) {
        return false;
    }

    return Date.now() - entry.cachedAt < maxAgeMs;

}


function invalidateForumCache() {

    sessionStorage.removeItem(FORUM_CACHE_STORAGE_KEY);

}


function stripAuthorsForCache(feedPosts) {

    return feedPosts.map(post => ({
        id: post.id,
        participant_id: post.participant_id,
        body: post.body,
        created_at: post.created_at,
        reactions: post.reactions || [],
        comments: (post.comments || []).map(comment => ({
            id: comment.id,
            participant_id: comment.participant_id,
            body: comment.body,
            created_at: comment.created_at,
            is_child_post: comment.is_child_post,
            reactions: comment.reactions || []
        }))
    }));

}


function hydrateFeedFromCache(cachedPosts) {

    return cachedPosts.map(post => ({
        ...post,
        author: participants.find(
            participant => participant.id === post.participant_id
        ),
        comments: (post.comments || []).map(comment => ({
            ...comment,
            author: participants.find(
                participant =>
                    participant.id === comment.participant_id
            )
        }))
    }));

}


function getFeedCacheKey() {

    return feedMode === "popular"
        ? "feedPopular"
        : "feedLatest";

}


function saveFeedCache() {

    patchForumCache({
        [getFeedCacheKey()]: {
            cachedAt: Date.now(),
            posts: stripAuthorsForCache(posts),
            feedOffset,
            feedHasMore
        }
    });

}


function tryRestoreFeedFromCache() {

    const cached =
        readForumCacheStore()[getFeedCacheKey()];

    if (!isForumCacheEntryFresh(cached, FORUM_FEED_CACHE_MS)) {
        return false;
    }

    if (!Array.isArray(cached.posts)) {
        return false;
    }

    posts = hydrateFeedFromCache(cached.posts);
    feedOffset = cached.feedOffset ?? posts.length;
    feedHasMore = Boolean(cached.feedHasMore);
    feedLoading = false;

    renderPosts();
    setFeedStatus(
        feedHasMore
            ? ""
            : "Du är längst ner."
    );

    return true;

}


function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeRegExp(value) {

    return String(value || "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}


const MENTION_ALIAS_CHAR =
    /[\p{L}\p{N}_.\- ]/u;


function isMentionAliasChar(character) {

    return Boolean(character && MENTION_ALIAS_CHAR.test(character));

}


function isValidMentionStart(body, atIndex) {

    if (atIndex <= 0) {
        return true;
    }

    return !isMentionAliasChar(body[atIndex - 1]);

}


function isValidMentionEnd(body, endIndex) {

    if (endIndex >= body.length) {
        return true;
    }

    return !isMentionAliasChar(body[endIndex]);

}


function getKnownAliasesByLength() {

    return participants
        .map(participant => (participant.alias || "").trim())
        .filter(Boolean)
        .sort((first, second) => second.length - first.length);

}


function findKnownAliasAtMention(body, atIndex) {

    if (body[atIndex] !== "@") {
        return null;
    }

    if (!isValidMentionStart(body, atIndex)) {
        return null;
    }

    for (const alias of getKnownAliasesByLength()) {

        const candidate = body.slice(
            atIndex + 1,
            atIndex + 1 + alias.length
        );

        if (candidate.toLowerCase() !== alias.toLowerCase()) {
            continue;
        }

        const endIndex = atIndex + 1 + alias.length;

        if (!isValidMentionEnd(body, endIndex)) {
            continue;
        }

        return alias;

    }

    return null;

}


function getCookie(name) {

    const prefix = `${name}=`;
    const parts = document.cookie.split(";");

    for (const part of parts) {

        const trimmed = part.trim();

        if (trimmed.startsWith(prefix)) {
            return decodeURIComponent(
                trimmed.slice(prefix.length)
            );
        }

    }

    return "";

}


function setCookie(name, value, maxAgeSeconds) {

    document.cookie =
        `${name}=${encodeURIComponent(value)};` +
        ` Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;

}


function getMentionSeenAt() {

    const raw = getCookie(MENTION_SEEN_COOKIE);

    if (!raw) {
        return null;
    }

    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;

}


function markMentionsSeen(atDate = new Date()) {

    setCookie(
        MENTION_SEEN_COOKIE,
        atDate.toISOString(),
        60 * 60 * 24 * 365
    );

}


function formatPostBody(body) {

    const parts = [];
    let index = 0;

    while (index < body.length) {

        const matchedAlias = findKnownAliasAtMention(body, index);

        if (matchedAlias) {
            parts.push({
                type: "mention",
                value: matchedAlias
            });
            index += 1 + matchedAlias.length;
            continue;
        }

        const nextAt = body.indexOf("@", index);
        let end;

        if (nextAt === -1) {
            end = body.length;
        } else if (nextAt === index) {
            // Unmatched @ — must advance or the loop never finishes.
            end = index + 1;
        } else {
            end = nextAt;
        }

        parts.push({
            type: "text",
            value: body.slice(index, end)
        });

        index = end;

    }

    return parts.map(part => {

        if (part.type === "mention") {
            return `<span class="forum-mention">@${escapeHtml(part.value)}</span>`;
        }

        return escapeHtml(part.value)
            .replaceAll("\n", "<br>");

    }).join("");

}


function bodyMentionsAlias(body, alias) {

    const trimmedAlias = (alias || "").trim();

    if (!body || !trimmedAlias) {
        return false;
    }

    const needle = `@${trimmedAlias}`;
    let searchFrom = 0;

    while (searchFrom < body.length) {

        const atIndex = body.toLowerCase().indexOf(
            needle.toLowerCase(),
            searchFrom
        );

        if (atIndex === -1) {
            return false;
        }

        const endIndex = atIndex + needle.length;

        if (
            isValidMentionStart(body, atIndex) &&
            isValidMentionEnd(body, endIndex)
        ) {
            return true;
        }

        searchFrom = atIndex + 1;

    }

    return false;

}


function getCurrentParticipant() {

    return participants.find(
        participant => participant.id === participantId
    ) || null;

}


function isForumAdmin() {

    return Boolean(getCurrentParticipant()?.is_forum_admin);

}


function getAvatarUrl(photoPath, name) {

    if (photoPath) {

        const { data } = supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(photoPath);

        if (data?.publicUrl) {
            return data.publicUrl;
        }

    }

    const letter =
        (name || "S").trim().charAt(0).toUpperCase() || "S";

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
            <rect width="80" height="80" fill="#0000aa" />
            <text x="40" y="51" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="#fff">${letter}</text>
        </svg>
    `)}`;

}


function formatDate(dateValue) {

    return new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(dateValue));

}


function setStatus(message, isError = false) {

    const status =
        document.getElementById("post-status");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("error", isError);

}


function setFeedStatus(message) {

    const status =
        document.getElementById("feed-status");

    if (status) {
        status.textContent = message;
    }

}


function isPinnedSeminariumPost(post) {

    const alias =
        (post?.author?.alias || "").trim().toLowerCase();

    return (
        alias === SEMINARIUM_PIN_ALIAS &&
        SEMINARIUM_PIN_PATTERN.test(post?.body || "")
    );

}


function pinSeminariumPosts(postsList) {

    const pinned = [];
    const rest = [];

    postsList.forEach(post => {

        if (isPinnedSeminariumPost(post)) {
            pinned.push(post);
        } else {
            rest.push(post);
        }

    });

    return [...pinned, ...rest];

}


function findMentionTargetsInLoadedPosts(alias) {

    const seenAt = getMentionSeenAt();
    const mentions = [];

    posts.forEach(post => {

        if (
            post.participant_id !== participantId &&
            bodyMentionsAlias(post.body, alias) &&
            (!seenAt || new Date(post.created_at) > seenAt)
        ) {

            mentions.push({
                threadId: post.id,
                targetId: post.id,
                createdAt: post.created_at
            });

        }

        (post.comments || []).forEach(comment => {

            if (
                comment.participant_id !== participantId &&
                bodyMentionsAlias(comment.body, alias) &&
                (!seenAt || new Date(comment.created_at) > seenAt)
            ) {

                mentions.push({
                    threadId: post.id,
                    targetId: comment.id,
                    createdAt: comment.created_at
                });

            }

        });

    });

    mentions.sort(
        (first, second) =>
            new Date(second.createdAt) -
            new Date(first.createdAt)
    );

    return mentions;

}


function ensureMentionNoticeElement() {

    let notice =
        document.getElementById("mention-notice");

    if (notice) {
        return notice;
    }

    const feedSection =
        document.querySelector(".feed-section") ||
        document.querySelector(".forum-main");

    if (!feedSection) {
        return null;
    }

    notice = document.createElement("div");
    notice.id = "mention-notice";
    notice.className = "mention-notice";
    notice.hidden = true;
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");

    notice.innerHTML = `
        <div class="mention-notice-copy">
            <strong>Du har blivit omnämnd i en tråd</strong>
            <p id="mention-notice-text"></p>
        </div>
        <div class="mention-notice-actions">
            <button
                type="button"
                id="mention-notice-open"
                class="primary-button"
            >
                Visa tråd
            </button>
            <button
                type="button"
                id="mention-notice-dismiss"
                class="secondary-button"
            >
                Stäng
            </button>
        </div>
    `;

    feedSection.insertBefore(
        notice,
        feedSection.firstChild
    );

    document
        .getElementById("mention-notice-dismiss")
        ?.addEventListener("click", () => {
            dismissMentionNotice();
        });

    return notice;

}


function hideMentionNotice() {

    const notice =
        document.getElementById("mention-notice");

    if (notice) {
        notice.hidden = true;
    }

}


function dismissMentionNotice() {

    markMentionsSeen(new Date());
    hideMentionNotice();

}


function queueScrollToPost(threadId, targetId) {

    if (!threadId || !targetId) {
        return;
    }

    pendingScrollTarget = {
        threadId: String(threadId),
        targetId: String(targetId)
    };

}


async function applyPendingScrollTarget() {

    if (!pendingScrollTarget) {
        return;
    }

    const { threadId, targetId } = pendingScrollTarget;
    pendingScrollTarget = null;

    expandPinnedCard(
        document.getElementById(`forum-post-${threadId}`)
    );

    await openForumPostTarget(threadId, targetId);

}


function scrollToMentionTarget(threadId, targetId) {

    const threadCard = document.getElementById(
        `forum-post-${threadId}`
    );

    const targetCard = document.getElementById(
        `forum-post-${targetId}`
    );

    const card = targetCard || threadCard;

    if (!card) {
        return false;
    }

    expandPinnedCard(
        card.closest(".post-card-pinned") ||
        (card.classList.contains("post-card-pinned")
            ? card
            : threadCard)
    );

    card.classList.add("post-card-mention-target");
    card.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    window.setTimeout(() => {
        card.classList.remove("post-card-mention-target");
    }, 2400);

    return true;

}


async function openForumPostTarget(threadId, targetId) {

    if (scrollToMentionTarget(threadId, targetId)) {
        return true;
    }

    setFeedStatus("Letar upp tråden...");

    while (feedHasMore) {

        const postCountBefore = posts.length;

        await loadPosts();

        if (scrollToMentionTarget(threadId, targetId)) {
            setFeedStatus("");
            return true;
        }

        if (posts.length === postCountBefore) {
            break;
        }

    }

    setFeedStatus("");
    return false;

}


async function openMentionThread(threadId, targetId) {

    markMentionsSeen(new Date());
    hideMentionNotice();

    const found = await openForumPostTarget(
        threadId,
        targetId
    );

    if (!found) {
        setStatus(
            "Tråden hittades inte bland laddade inlägg just nu.",
            true
        );
    }

}


function showMentionNotice(mentions) {

    if (!mentions.length) {
        return;
    }

    const notice = ensureMentionNoticeElement();

    if (!notice) {
        return;
    }

    const latest = mentions[0];
    const text =
        document.getElementById("mention-notice-text");

    const openButton =
        document.getElementById("mention-notice-open");

    if (text) {

        text.textContent = mentions.length === 1
            ? "Klicka för att gå till tråden där du omnämns."
            : `Du har ${mentions.length} nya omnämnanden. Visa det senaste.`;

    }

    if (openButton) {

        openButton.onclick = () => {

            openMentionThread(
                latest.threadId,
                latest.targetId
            );

        };

    }

    notice.hidden = false;

}


async function fetchUnseenMentions(alias) {

    const seenAt = getMentionSeenAt();

    let query = supabaseClient
        .from("festival2026_forum_posts")
        .select("id, body, created_at, is_child_post, participant_id")
        .ilike("body", `%@${alias}%`)
        .neq("participant_id", participantId)
        .order("created_at", { ascending: false })
        .limit(30);

    if (seenAt) {
        query = query.gt(
            "created_at",
            seenAt.toISOString()
        );
    }

    const { data, error } = await query;

    if (error) {
        console.error(
            "Could not fetch mention notifications:",
            error
        );
        return findMentionTargetsInLoadedPosts(alias);
    }

    return (data || [])
        .filter(row => bodyMentionsAlias(row.body, alias))
        .map(row => ({
            threadId: row.is_child_post || row.id,
            targetId: row.id,
            createdAt: row.created_at
        }));

}


async function checkMentionNotifications() {

    if (mentionNoticeChecked || !participantId) {
        return;
    }

    const currentUser = getCurrentParticipant();

    if (!currentUser?.alias) {
        return;
    }

    mentionNoticeChecked = true;

    const mentions = await fetchUnseenMentions(
        currentUser.alias
    );

    if (mentions.length) {
        showMentionNotice(mentions);
    }

}


function renderCurrentUser() {

    const currentUser = participants.find(
        participant => participant.id === participantId
    );

    const profile =
        document.getElementById("current-user-profile");

    if (!currentUser || !profile) {
        return;
    }

    const avatar =
        document.getElementById("current-user-avatar");

    const name =
        document.getElementById("current-user-name");

    const alias =
        document.getElementById("current-user-alias");

    if (avatar) {
        avatar.src = getAvatarUrl(
            currentUser.photo_path,
            currentUser.name
        );
        avatar.alt = currentUser.name || "Din profilbild";
    }

    if (name) {
        name.textContent = currentUser.name;
    }

    if (alias) {
        alias.textContent = `@${currentUser.alias}`;
    }

    profile.hidden = false;

}


async function loadMembers({
    preferCache = false,
    forceNetwork = false
} = {}) {

    if (preferCache && !forceNetwork) {

        const cached = readForumCacheStore().members;

        if (
            isForumCacheEntryFresh(
                cached,
                FORUM_MEMBERS_CACHE_MS
            ) &&
            Array.isArray(cached.data)
        ) {

            participants = cached.data;

            window.forumPresence?.setMembers(
                participants,
                participantId
            );

            await loadActivityBadges({
                preferCache: true
            });

            renderCurrentUser();
            renderMembers();
            return;

        }

    }

    let { data, error } = await supabaseClient
        .from("festival2026_deltagare")
        .select(`
            id,
            name,
            alias,
            sauna_oil,
            favorite_temperature,
            motto,
            photo_path,
            created_at,
            is_forum_admin
        `)
        .order("name", { ascending: true });

    if (error) {

        // Fallback if created_at or is_forum_admin is missing in older schemas.
        ({ data, error } = await supabaseClient
            .from("festival2026_deltagare")
            .select(`
                id,
                name,
                alias,
                sauna_oil,
                favorite_temperature,
                motto,
                photo_path
            `)
            .order("name", { ascending: true }));

    }

    if (error) {
        throw error;
    }

    participants = data || [];

    patchForumCache({
        members: {
            cachedAt: Date.now(),
            data: participants
        }
    });

    window.forumPresence?.setMembers(
        participants,
        participantId
    );

    await loadActivityBadges({
        preferCache: false
    });

    renderCurrentUser();
    renderMembers();

}


async function loadActivityBadges({
    preferCache = false
} = {}) {

    if (preferCache) {

        const cached = readForumCacheStore().badges;

        if (
            isForumCacheEntryFresh(
                cached,
                FORUM_BADGES_CACHE_MS
            ) &&
            Array.isArray(cached.data)
        ) {

            participantBadges = new Map(cached.data);
            return;

        }

    }

    participantBadges = new Map();

    const { data, error } = await supabaseClient
        .from("festival2026_forum_posts")
        .select("participant_id");

    if (error) {
        console.error("Could not load post counts for badges:", error);
    }

    const counts = new Map();

    (data || []).forEach(row => {

        if (!row.participant_id) {
            return;
        }

        counts.set(
            row.participant_id,
            (counts.get(row.participant_id) || 0) + 1
        );

    });

    const ranked = [...counts.entries()]
        .filter(([, count]) => count > 0)
        .sort((first, second) => {

            if (second[1] !== first[1]) {
                return second[1] - first[1];
            }

            return String(first[0]).localeCompare(String(second[0]));

        });

    const posterCount = ranked.length;
    const top10Cutoff = Math.max(1, Math.ceil(posterCount * 0.1));
    const top50Cutoff = Math.max(1, Math.ceil(posterCount * 0.5));

    const rankById = new Map(
        ranked.map(([id], index) => [id, index + 1])
    );

    const now = Date.now();

    participants.forEach(participant => {

        const badges = [];

        if (participant.created_at) {

            const createdAt = new Date(participant.created_at);

            if (
                !Number.isNaN(createdAt.getTime()) &&
                now - createdAt.getTime() < NEWCOMER_BADGE_MS
            ) {
                badges.push({
                    key: "nykomling",
                    label: "Nykomling"
                });
            }

        }

        const rank = rankById.get(participant.id);

        if (rank) {

            if (rank <= top10Cutoff) {
                badges.push({
                    key: "champion",
                    label: "SaunaChampion™"
                });
            } else if (rank <= top50Cutoff) {
                badges.push({
                    key: "top",
                    label: "Topp medlem"
                });
            }

        }

        if (badges.length) {
            participantBadges.set(participant.id, badges);
        }

    });

    patchForumCache({
        badges: {
            cachedAt: Date.now(),
            data: [...participantBadges.entries()]
        }
    });

}


function renderParticipantBadges(participantOrId) {

    const id =
        typeof participantOrId === "object"
            ? participantOrId?.id
            : participantOrId;

    const badges = participantBadges.get(id) || [];

    if (!badges.length) {
        return "";
    }

    return `
        <span class="member-badges">
            ${badges.map(badge => `
                <span class="member-badge member-badge-${badge.key}">
                    ${escapeHtml(badge.label)}
                </span>
            `).join("")}
        </span>
    `;

}


async function loadPosts({
    reset = false,
    preferCache = false,
    forceNetwork = false
} = {}) {

    if (feedLoading || (!feedHasMore && !reset)) {
        return;
    }

    if (reset && preferCache && !forceNetwork) {

        if (tryRestoreFeedFromCache()) {

            checkMentionNotifications();

            if (pendingScrollTarget) {
                window.requestAnimationFrame(() => {
                    applyPendingScrollTarget();
                });
            }

            return;

        }

    }

    if (reset) {
        posts = [];
        feedOffset = 0;
        feedHasMore = true;
        if (!pendingScrollTarget) {
            renderPosts();
        }
    }

    feedLoading = true;
    setFeedStatus("Laddar fler inlägg...");

    const { data: postData, error: postError } = await supabaseClient
        .from("festival2026_forum_posts")
        .select("id, participant_id, body, created_at, is_child_post")
        .is("is_child_post", null)
        .order("created_at", { ascending: false })
        .range(feedOffset, feedOffset + FEED_PAGE_SIZE - 1);

    if (postError) {
        feedLoading = false;
        throw postError;
    }

    const page = postData || [];
    feedOffset += page.length;
    feedHasMore = page.length === FEED_PAGE_SIZE;

    if (!page.length) {
        feedLoading = false;
        setFeedStatus(posts.length ? "Du är längst ner." : "Inga inlägg ännu.");
        renderPosts();
        checkMentionNotifications();

        if (pendingScrollTarget) {
            window.requestAnimationFrame(() => {
                applyPendingScrollTarget();
            });
        }

        saveFeedCache();
        return;
    }

    const postIds = page.map(post => post.id);

    const { data: childData, error: childError } = await supabaseClient
        .from("festival2026_forum_posts")
        .select("id, participant_id, body, created_at, is_child_post")
        .in("is_child_post", postIds)
        .order("created_at", { ascending: true });

    if (childError) {
        feedLoading = false;
        throw childError;
    }

    const allPosts = [
        ...page,
        ...(childData || [])
    ];

    const allPostIds = allPosts.map(post => post.id);

    const { data: reactionData, error: reactionError } = await supabaseClient
        .from("festival2026_forum_reactions")
        .select("id, post_id, participant_id, reaction")
        .in("post_id", allPostIds);

    if (reactionError) {
        feedLoading = false;
        throw reactionError;
    }

    const reactionsByPost = new Map();

    (reactionData || []).forEach(reaction => {

        const current =
            reactionsByPost.get(reaction.post_id) || [];

        current.push(reaction);
        reactionsByPost.set(reaction.post_id, current);

    });

    const commentsByPost = new Map();

    (childData || []).forEach(comment => {

        const current =
            commentsByPost.get(comment.is_child_post) || [];

        current.push({
            ...comment,
            author: participants.find(
                participant => participant.id === comment.participant_id
            ),
            reactions: reactionsByPost.get(comment.id) || []
        });

        commentsByPost.set(comment.is_child_post, current);

    });

    const nextPosts = page.map(post => ({
        ...post,
        author: participants.find(
            participant => participant.id === post.participant_id
        ),
        reactions: reactionsByPost.get(post.id) || [],
        comments: commentsByPost.get(post.id) || []
    }));

    posts = [...posts, ...nextPosts];

    if (feedMode === "popular") {
        posts.sort((first, second) => {
            const reactionDifference =
                second.reactions.length - first.reactions.length;

            if (reactionDifference !== 0) {
                return reactionDifference;
            }

            return new Date(second.created_at) - new Date(first.created_at);
        });
    }

    // Admin (@ivve) seminarium posts stay pinned above the rest of the feed.
    posts = pinSeminariumPosts(posts);

    renderPosts();
    feedLoading = false;
    setFeedStatus(
        feedHasMore
            ? ""
            : "Du är längst ner."
    );

    checkMentionNotifications();

    if (pendingScrollTarget) {
        window.requestAnimationFrame(() => {
            applyPendingScrollTarget();
        });
    }

    saveFeedCache();

}


function renderMembers() {

    const list =
        document.getElementById("members-list");

    const count =
        document.getElementById("member-count");

    if (count) {
        count.textContent = participants.length;
    }

    if (!list) {
        return;
    }

    if (!participants.length) {
        list.innerHTML =
            "<p class=\"forum-empty\">Inga medlemmar ännu.</p>";

        return;
    }

    list.innerHTML = participants.map(participant => `
        <div class="member-item">
            <img
                src="${getAvatarUrl(
                    participant.photo_path,
                    participant.name
                )}"
                alt=""
            >

            <span>
                <strong>
                    ${escapeHtml(participant.name)}
                </strong>

                <small>
                    @${escapeHtml(participant.alias)}
                </small>

                ${renderParticipantBadges(participant)}

                ${
                    window.forumPresence?.isOnline(
                        participant.id
                    )
                        ? `<small class="member-online">
                            <span
                                class="online-dot"
                                aria-hidden="true"
                            ></span>
                            Online
                        </small>`
                        : ""
                }
            </span>
        </div>
    `).join("");


    // Uppdatera "Visa alla"-knappen efter att
    // medlemslistan faktiskt har renderats.
    window.requestAnimationFrame(() => {

        const expandButton =
            document.getElementById("members-expand");

        if (!expandButton) {
            return;
        }

        if (window.innerWidth > 700) {
            expandButton.hidden = true;
            return;
        }

        const hasOverflow =
            list.scrollHeight >
            list.clientHeight + 5;

        expandButton.hidden =
            !hasOverflow;

    });

}

function createUserPopup() {

    if (document.getElementById("forum-user-popup")) {
        return;
    }

    const popup = document.createElement("div");

    popup.id = "forum-user-popup";
    popup.className = "forum-user-popup";
    popup.hidden = true;

    popup.innerHTML = `
        <div class="forum-user-popup-overlay"></div>

        <div
            class="forum-user-popup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-user-popup-name"
        >

            <button
                type="button"
                class="forum-user-popup-close"
                aria-label="Stäng"
            >
                ×
            </button>

            <div class="forum-user-popup-header">

                <img
                    id="forum-user-popup-avatar"
                    class="forum-user-popup-avatar"
                    alt=""
                >

                <div>
                    <h2 id="forum-user-popup-name"></h2>
                    <div id="forum-user-popup-badges" class="member-badges"></div>
                    <p id="forum-user-popup-alias"></p>
                </div>

            </div>

            <div class="forum-user-popup-info">

                <div>
                    <span>Bastuolja</span>
                    <strong id="forum-user-popup-oil"></strong>
                </div>

                <div>
                    <span>Favorittemp.</span>
                    <strong>
                        <span id="forum-user-popup-temperature"></span> °C
                    </strong>
                </div>

                <div class="forum-user-popup-motto">
                    <span>Motto</span>
                    <strong id="forum-user-popup-motto"></strong>
                </div>

            </div>

        </div>
    `;

    document.body.appendChild(popup);

    const closeButton =
        popup.querySelector(".forum-user-popup-close");

    const overlay =
        popup.querySelector(".forum-user-popup-overlay");

    closeButton?.addEventListener(
        "click",
        closeUserPopup
    );

    overlay?.addEventListener(
        "click",
        closeUserPopup
    );

}


let pendingDeletePostId = null;


function removePostFromLocalState(postId) {

    const topLevelIndex = posts.findIndex(
        post => post.id === postId
    );

    if (topLevelIndex >= 0) {
        posts.splice(topLevelIndex, 1);
        return "thread";
    }

    for (const post of posts) {

        const comments = post.comments || [];
        const commentIndex = comments.findIndex(
            comment => comment.id === postId
        );

        if (commentIndex >= 0) {
            comments.splice(commentIndex, 1);
            return "comment";
        }

    }

    return null;

}


function removePostFromDom(postId) {

    document
        .getElementById(`forum-post-${postId}`)
        ?.remove();

}


function scheduleDeleteFeedReload() {

    if (deleteFeedReloadTimer) {
        window.clearTimeout(deleteFeedReloadTimer);
    }

    deleteFeedReloadTimer = window.setTimeout(async () => {

        deleteFeedReloadTimer = null;

        await loadActivityBadges();
        renderMembers();
        await loadPosts({
            reset: true,
            forceNetwork: true
        });

        setStatus("Forumet är uppdaterat.");

    }, DELETE_FEED_RELOAD_MS);

}


function createForumDeleteModal() {

    if (document.getElementById("forum-delete-modal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "forum-delete-modal";
    modal.className = "forum-delete-modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="forum-delete-modal-overlay"></div>
        <div
            class="forum-delete-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forum-delete-modal-title"
        >
            <h2 id="forum-delete-modal-title">Ta bort inlägg?</h2>
            <p>Är du säker? Detta går inte att ångra.</p>
            <div class="forum-delete-modal-actions">
                <button
                    type="button"
                    class="secondary-button forum-delete-cancel"
                >
                    Avbryt
                </button>
                <button
                    type="button"
                    class="primary-button forum-delete-confirm"
                >
                    Ta bort
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".forum-delete-cancel")
        ?.addEventListener("click", closeForumDeleteModal);

    modal.querySelector(".forum-delete-modal-overlay")
        ?.addEventListener("click", closeForumDeleteModal);

    modal.querySelector(".forum-delete-confirm")
        ?.addEventListener("click", () => {
            confirmForumDelete();
        });

}


function closeForumDeleteModal() {

    const modal =
        document.getElementById("forum-delete-modal");

    if (!modal) {
        return;
    }

    modal.hidden = true;
    pendingDeletePostId = null;

    document.body.classList.remove(
        "forum-delete-modal-open"
    );

}


function openForumDeleteConfirm(postId) {

    if (!postId || !isForumAdmin()) {
        return;
    }

    createForumDeleteModal();

    pendingDeletePostId = postId;

    const modal =
        document.getElementById("forum-delete-modal");

    if (!modal) {
        return;
    }

    modal.hidden = false;

    document.body.classList.add(
        "forum-delete-modal-open"
    );

}


async function confirmForumDelete() {

    const postId = pendingDeletePostId;

    if (!postId || !isForumAdmin()) {
        closeForumDeleteModal();
        return;
    }

    const confirmButton =
        document.querySelector(".forum-delete-confirm");

    if (confirmButton) {
        confirmButton.disabled = true;
    }

    setStatus("Tar bort...");

    const { error } = await supabaseClient.rpc(
        "delete_forum_post_as_admin",
        {
            target_post_id: postId,
            acting_participant_id: participantId
        }
    );

    if (confirmButton) {
        confirmButton.disabled = false;
    }

    closeForumDeleteModal();

    if (error) {
        console.error("Could not delete post:", error);
        setStatus(
            "Inlägget kunde inte tas bort. Kontrollera admin-behörighet i Supabase.",
            true
        );
        return;
    }

    removePostFromLocalState(postId);
    removePostFromDom(postId);
    saveFeedCache();

    setStatus(
        "Inlägget är borttaget. Forumet uppdateras om 25 sekunder — du kan fortsätta ta bort fler."
    );

    scheduleDeleteFeedReload();

}


function openUserPopup(participantIdToOpen) {

    const participant =
        participants.find(
            participant =>
                participant.id === participantIdToOpen
        );

    if (!participant) {
        return;
    }

    createUserPopup();

    const popup =
        document.getElementById(
            "forum-user-popup"
        );

    const avatar =
        document.getElementById(
            "forum-user-popup-avatar"
        );

    const name =
        document.getElementById(
            "forum-user-popup-name"
        );

    const alias =
        document.getElementById(
            "forum-user-popup-alias"
        );

    const oil =
        document.getElementById(
            "forum-user-popup-oil"
        );

    const temperature =
        document.getElementById(
            "forum-user-popup-temperature"
        );

    const motto =
        document.getElementById(
            "forum-user-popup-motto"
        );

    const photoUrl =
        getAvatarUrl(
            participant.photo_path,
            participant.name
        );

    if (avatar) {
        avatar.src = photoUrl;
        avatar.alt =
            participant.name || "Profilbild";
    }

    if (name) {
        name.textContent =
            participant.name || "Deltagare";
    }

    const badges =
        document.getElementById(
            "forum-user-popup-badges"
        );

    if (badges) {
        const rendered = renderParticipantBadges(participant);
        const temp = document.createElement("div");
        temp.innerHTML = rendered;
        badges.innerHTML =
            temp.querySelector(".member-badges")?.innerHTML || "";
    }

    if (alias) {
        alias.textContent =
            participant.alias
                ? `@${participant.alias}`
                : "";
    }

    if (oil) {
        oil.textContent =
            participant.sauna_oil ||
            "Ej angivet";
    }

    if (temperature) {
        temperature.textContent =
            participant.favorite_temperature ??
            "-";
    }

    if (motto) {
        motto.textContent =
            participant.motto ||
            "Inget motto ännu.";
    }

    popup.hidden = false;

    document.body.classList.add(
        "forum-popup-open"
    );

}


function closeUserPopup() {

    const popup =
        document.getElementById(
            "forum-user-popup"
        );

    if (!popup) {
        return;
    }

    popup.hidden = true;

    document.body.classList.remove(
        "forum-popup-open"
    );

}

function renderPosts() {

    const feed =
        document.getElementById("post-feed");

    if (!feed) {
        return;
    }

    const activeForm =
        document.querySelector(".comment-form.is-replying");

    if (activeForm) {
        activeReplyDraft =
            activeForm.querySelector("input[name='comment']")
                ?.value || "";
    }

    if (!posts.length) {
        feed.innerHTML =
            "<p class=\"forum-empty\">Inga inlägg ännu. Skriv det första.</p>";
        return;
    }

    feed.innerHTML = posts
        .map(post => renderPost(post))
        .join("");

    setupPostEngagements(feed);

    // Kommentarer
    feed.querySelectorAll(".comment-form").forEach(form => {

        form.addEventListener(
            "submit",
            createComment
        );

    });

    // Klick på avatar för att öppna användarpopup
    feed.querySelectorAll(".forum-user-button").forEach(button => {

        button.addEventListener("click", () => {

            openUserPopup(
                button.dataset.participantId
            );

        });

    });

    // Klick på användarnamn för att öppna användarpopup
    feed.querySelectorAll(".forum-user-name").forEach(button => {

        button.addEventListener("click", () => {

            openUserPopup(
                button.dataset.participantId
            );

        });

    });

    // Expandera pinade inlägg från preview
    feed.querySelectorAll(".pinned-expand-button").forEach(button => {

        button.addEventListener("click", () => {

            const card = button.closest(".post-card-pinned");

            if (!card) {
                return;
            }

            card.classList.remove("is-collapsed");
            card.classList.add("is-expanded");
            button.hidden = true;

        });

    });

    setupPostMenus(feed);
    restoreActiveReplyContext();

}


function closeAllPostMenus(exceptMenu = null) {

    document
        .querySelectorAll(".post-menu.is-open")
        .forEach(menu => {

            if (menu === exceptMenu) {
                return;
            }

            menu.classList.remove("is-open");

            const dropdown =
                menu.querySelector(".post-menu-dropdown");

            if (dropdown) {
                dropdown.hidden = true;
            }

            const toggle =
                menu.querySelector(".post-menu-toggle");

            toggle?.setAttribute("aria-expanded", "false");

        });

}


function setupPostMenus(feed) {

    feed.querySelectorAll(".post-menu-toggle").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            const menu = button.closest(".post-menu");
            const dropdown =
                menu?.querySelector(".post-menu-dropdown");

            if (!menu || !dropdown) {
                return;
            }

            const willOpen = dropdown.hidden;

            closeAllPostMenus(menu);

            dropdown.hidden = !willOpen;
            menu.classList.toggle("is-open", willOpen);
            button.setAttribute(
                "aria-expanded",
                String(willOpen)
            );

        });

    });

    feed.querySelectorAll("[data-action='reply']").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();
            closeAllPostMenus();
            startThreadReply(button);

        });

    });

    feed.querySelectorAll("[data-action='delete']").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();
            closeAllPostMenus();
            openForumDeleteConfirm(button.dataset.postId);

        });

    });

    feed.querySelectorAll(".reply-context-clear").forEach(button => {

        button.addEventListener("click", () => {
            clearReplyContext(
                button.closest(".comment-form")
            );
        });

    });

}


function findThreadIdForPost(postId) {

    for (const post of posts) {

        if (post.id === postId) {
            return post.id;
        }

        if (
            (post.comments || []).some(
                comment => comment.id === postId
            )
        ) {
            return post.id;
        }

    }

    return null;

}


function expandPinnedCard(card) {

    if (!card?.classList.contains("post-card-pinned")) {
        return;
    }

    card.classList.remove("is-collapsed");
    card.classList.add("is-expanded");

    const expandButton =
        card.querySelector(".pinned-expand-button");

    if (expandButton) {
        expandButton.hidden = true;
    }

}


function getThreadCommentForm(threadId) {

    const threadCard = document.getElementById(
        `forum-post-${threadId}`
    );

    if (threadCard) {

        const form = threadCard.querySelector(
            `.comment-form[data-parent-id="${threadId}"]`
        );

        if (form) {
            return form;
        }

    }

    return document.querySelector(
        `.post-card:not(.comment-card) .comment-form[data-parent-id="${threadId}"]`
    );

}


function clearReplyContext(form) {

    if (!form) {
        return;
    }

    activeReplyTargetId = null;
    activeReplyDraft = "";
    form.classList.remove("is-replying");

    const context =
        form.querySelector(".reply-context");

    if (context) {
        context.hidden = true;
    }

    const aliasNode =
        form.querySelector(".reply-context-alias");

    const snippetNode =
        form.querySelector(".reply-context-snippet");

    if (aliasNode) {
        aliasNode.textContent = "";
    }

    if (snippetNode) {
        snippetNode.textContent = "";
    }

}


function restoreActiveReplyContext() {

    if (!activeReplyTargetId) {
        return;
    }

    const target = findPost(activeReplyTargetId);

    if (!target) {
        activeReplyTargetId = null;
        activeReplyDraft = "";
        return;
    }

    const threadId =
        findThreadIdForPost(activeReplyTargetId);

    const form = getThreadCommentForm(threadId);

    if (!form) {
        return;
    }

    const alias =
        target.author?.alias || "";

    const snippet =
        String(target.body || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120);

    applyReplyContext(form, {
        alias,
        snippet,
        targetId: activeReplyTargetId
    });

    const input =
        form.querySelector("input[name='comment']");

    if (input && activeReplyDraft) {
        input.value = activeReplyDraft;
    }

}


function applyReplyContext(form, { alias, snippet, targetId }) {

    activeReplyTargetId = targetId;
    form.classList.add("is-replying");

    const context =
        form.querySelector(".reply-context");

    const aliasNode =
        form.querySelector(".reply-context-alias");

    const snippetNode =
        form.querySelector(".reply-context-snippet");

    if (aliasNode) {
        aliasNode.textContent = alias
            ? `@${alias}`
            : "";
    }

    if (snippetNode) {
        snippetNode.textContent = snippet
            ? `“${snippet}${snippet.length >= 120 ? "…" : ""}”`
            : "";
    }

    if (context) {
        context.hidden = false;
    }

}


function startThreadReply(button) {

    if (!participantId) {
        setStatus(
            "Du måste vara registrerad för att svara.",
            true
        );
        return;
    }

    const targetId = button.dataset.postId;
    const threadId =
        button.dataset.threadId ||
        findThreadIdForPost(targetId);

    const alias = (button.dataset.alias || "").trim();
    const snippet =
        (button.dataset.snippet || "").trim();

    if (!threadId) {
        return;
    }

    expandPinnedCard(
        document.getElementById(`forum-post-${threadId}`)
    );

    const form = getThreadCommentForm(threadId);

    if (!form) {
        return;
    }

    document
        .querySelectorAll(".comment-form.is-replying")
        .forEach(otherForm => {

            if (otherForm !== form) {
                clearReplyContext(otherForm);
            }

        });

    applyReplyContext(form, {
        alias,
        snippet,
        targetId
    });

    const input =
        form.querySelector("input[name='comment']");

    if (input && alias) {

        const mention = `@${alias} `;
        const current = input.value.trimStart();

        if (!current.toLowerCase().startsWith(mention.toLowerCase())) {
            input.value = mention + current;
        }

        input.focus();
        input.setSelectionRange(
            input.value.length,
            input.value.length
        );

    }

    form.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


function renderPostMenu(post, threadId, isComment = false) {

    const author = post.author || {};
    const alias = author.alias || "";
    const snippet = String(post.body || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

    const showReply = isComment;
    const showDelete = isForumAdmin();

    if (!showReply && !showDelete) {
        return "";
    }

    return `
        <div class="post-menu">
            <button
                type="button"
                class="post-menu-toggle"
                aria-label="Åtgärder"
                aria-expanded="false"
                ${participantId ? "" : "disabled"}
            >
                ⋯
            </button>
            <div class="post-menu-dropdown" hidden>
                ${
                    showReply
                        ? `
                            <button
                                type="button"
                                class="post-menu-action"
                                data-action="reply"
                                data-post-id="${post.id}"
                                data-thread-id="${threadId}"
                                data-alias="${escapeHtml(alias)}"
                                data-snippet="${escapeHtml(snippet)}"
                                ${participantId && alias ? "" : "disabled"}
                            >
                                Svara
                            </button>
                        `
                        : ""
                }
                ${
                    showDelete
                        ? `
                            <button
                                type="button"
                                class="post-menu-action post-menu-action-danger"
                                data-action="delete"
                                data-post-id="${post.id}"
                            >
                                Ta bort
                            </button>
                        `
                        : ""
                }
            </div>
        </div>
    `;

}


function renderCommentForm(threadId) {

    return `
        <form class="comment-form" data-parent-id="${threadId}">
            <div class="reply-context" hidden>
                <div class="reply-context-copy">
                    <strong>
                        Svarar
                        <span class="reply-context-alias forum-mention"></span>
                    </strong>
                    <p class="reply-context-snippet"></p>
                </div>
                <button
                    type="button"
                    class="reply-context-clear"
                    aria-label="Avbryt svar"
                >
                    ×
                </button>
            </div>
            <div class="comment-form-row">
                <input
                    type="text"
                    name="comment"
                    maxlength="1000"
                    placeholder="Skriv en kommentar..."
                    ${participantId ? "" : "disabled"}
                    required
                >
                <button type="submit" class="secondary-button" ${participantId ? "" : "disabled"}>Kommentera</button>
            </div>
        </form>
    `;

}


function getReactionCountMap(post) {

    const counts = new Map();

    (post.reactions || []).forEach(reaction => {

        counts.set(
            reaction.reaction,
            (counts.get(reaction.reaction) || 0) + 1
        );

    });

    return counts;

}


function getViewerReactionKey(post) {

    const match = (post.reactions || []).find(
        reaction => reaction.participant_id === participantId
    );

    return match?.reaction || null;

}


function renderReactionChip(post, reactionType, count) {

    const hasReacted = (post.reactions || []).some(
        reaction =>
            reaction.participant_id === participantId &&
            reaction.reaction === reactionType.key
    );

    return `
        <button
            type="button"
            class="reaction-chip ${hasReacted ? "active" : ""}"
            data-post-id="${post.id}"
            data-reaction="${reactionType.key}"
            aria-label="${reactionType.label}, ${count}"
            ${participantId ? "" : "disabled"}
        >
            <span aria-hidden="true">${reactionType.emoji}</span>
            <span class="reaction-chip-count">${count}</span>
        </button>
    `;

}


function renderReactionPickerButton(post, reactionType, count) {

    const hasReacted = (post.reactions || []).some(
        reaction =>
            reaction.participant_id === participantId &&
            reaction.reaction === reactionType.key
    );

    return `
        <button
            type="button"
            class="reaction-button ${hasReacted ? "active" : ""}"
            data-post-id="${post.id}"
            data-reaction="${reactionType.key}"
            aria-label="${reactionType.label}"
            ${participantId ? "" : "disabled"}
        >
            <span aria-hidden="true">${reactionType.emoji}</span>
            <span>${count}</span>
        </button>
    `;

}


function renderPostEngagement(post) {

    const counts = getReactionCountMap(post);
    const activeTypes = REACTION_TYPES.filter(
        reactionType => (counts.get(reactionType.key) || 0) > 0
    );

    const viewerReactionKey = getViewerReactionKey(post);
    const viewerReaction = REACTION_TYPES.find(
        reactionType => reactionType.key === viewerReactionKey
    );

    const expandLabel = viewerReaction
        ? `(+${viewerReaction.emoji})`
        : "(+)";

    return `
        <div
            class="post-engagement is-collapsed"
            data-post-id="${post.id}"
        >
            <div class="reaction-bar">
                <button
                    type="button"
                    class="reaction-expand-toggle"
                    aria-expanded="false"
                    aria-label="Visa alla reaktioner"
                    ${participantId ? "" : "disabled"}
                >
                    ${expandLabel}
                </button>
                <div class="reaction-bar-summary">
                    ${
                        activeTypes.length
                            ? activeTypes
                                .map(reactionType =>
                                    renderReactionChip(
                                        post,
                                        reactionType,
                                        counts.get(reactionType.key)
                                    )
                                )
                                .join("")
                            : `<span class="reaction-bar-empty">Inga reaktioner ännu</span>`
                    }
                </div>
            </div>
            <div class="reaction-picker" hidden>
                ${REACTION_TYPES.map(reactionType =>
                    renderReactionPickerButton(
                        post,
                        reactionType,
                        counts.get(reactionType.key) || 0
                    )
                ).join("")}
            </div>
        </div>
    `;

}


function setPostEngagementExpanded(engagement, expanded) {

    if (!engagement) {
        return;
    }

    engagement.classList.toggle("is-expanded", expanded);
    engagement.classList.toggle("is-collapsed", !expanded);

    const toggle =
        engagement.querySelector(".reaction-expand-toggle");

    const picker =
        engagement.querySelector(".reaction-picker");

    toggle?.setAttribute("aria-expanded", String(expanded));

    if (picker) {
        picker.hidden = !expanded;
    }

}


function refreshPostEngagement(postId) {

    const post = findPost(postId);

    if (!post) {
        return;
    }

    const engagement = document.querySelector(
        `.post-engagement[data-post-id="${postId}"]`
    );

    if (!engagement) {
        return;
    }

    const wasExpanded =
        engagement.classList.contains("is-expanded");

    engagement.outerHTML = renderPostEngagement(post);

    const nextEngagement = document.querySelector(
        `.post-engagement[data-post-id="${postId}"]`
    );

    if (nextEngagement) {
        setPostEngagementExpanded(nextEngagement, wasExpanded);
        bindPostEngagement(nextEngagement);
    }

}


function bindPostEngagement(engagement) {

    if (!engagement || engagement.dataset.bound === "true") {
        return;
    }

    engagement.dataset.bound = "true";

    const toggle =
        engagement.querySelector(".reaction-expand-toggle");

    toggle?.addEventListener("click", () => {

        const expanded =
            !engagement.classList.contains("is-expanded");

        setPostEngagementExpanded(engagement, expanded);

    });

    engagement.querySelectorAll(
        ".reaction-chip, .reaction-button"
    ).forEach(button => {

        button.addEventListener("click", () => {

            toggleReaction(
                button.dataset.postId,
                button.dataset.reaction
            );

        });

    });

}


function setupPostEngagements(root) {

    root.querySelectorAll(".post-engagement").forEach(engagement => {
        bindPostEngagement(engagement);
    });

}


function renderPostComments(post) {

    const allComments = post.comments || [];

    if (!allComments.length) {
        return "";
    }

    return `
        <div class="post-comments">
            ${allComments
                .map(comment => renderPost(comment, true))
                .join("")}
        </div>
    `;

}


function renderPost(post, isComment = false) {

    const author = post.author || {
        name: "Okänd medlem",
        alias: ""
    };

    const isPinned =
        !isComment && isPinnedSeminariumPost(post);

    const threadId = isComment
        ? findThreadIdForPost(post.id) || post.is_child_post
        : post.id;

    const comments = isComment
        ? ""
        : renderPostComments(post);

    const replyCount = (post.comments || []).length;

    const expandLabel = replyCount
        ? `Se alla (${replyCount})`
        : "Visa tråd";

    const showPostMenu = isComment || isForumAdmin();

    return `
        <article
            class="post-card ${isComment ? "comment-card" : ""}${isPinned ? " post-card-pinned is-collapsed" : ""}"
            id="forum-post-${post.id}"
        >
            ${
                isPinned
                    ? `<div class="post-pin-badge">Pinad · seminarium</div>`
                    : ""
            }
            <div class="post-card-top">
                <div class="post-author">

                    <button
                        type="button"
                        class="forum-user-button"
                        data-participant-id="${author.id}"
                        aria-label="Visa profil för ${escapeHtml(author.name)}"
                    >
                        <img
                            src="${getAvatarUrl(author.photo_path, author.name)}"
                            alt=""
                        >
                    </button>

                    <div>

                        <button
                            type="button"
                            class="forum-user-name"
                            data-participant-id="${author.id}"
                        >
                            ${escapeHtml(author.name)}
                        </button>

                        ${renderParticipantBadges(author)}

                        <small>
                            @${escapeHtml(author.alias)}
                            ·
                            ${formatDate(post.created_at)}
                        </small>

                    </div>

                </div>
                ${
                    showPostMenu
                        ? renderPostMenu(post, threadId, isComment)
                        : ""
                }
            </div>
            <div class="${isPinned ? "pinned-preview-shell" : ""}">
                <p class="post-body">${formatPostBody(post.body)}</p>
                ${
                    isPinned
                        ? `
                            <div class="pinned-preview-fade" aria-hidden="true"></div>
                            <button
                                type="button"
                                class="pinned-expand-button"
                            >
                                ${expandLabel}
                            </button>
                        `
                        : ""
                }
            </div>
            ${
                isComment
                    ? `
                        <div class="comment-engagement">
                            ${renderPostEngagement(post)}
                        </div>
                    `
                    : `
                        <div class="${isPinned ? "pinned-expanded-content" : ""}">
                            <div class="post-actions">
                                ${renderPostEngagement(post)}
                            </div>
                            ${renderCommentForm(post.id)}
                            ${comments}
                        </div>
                    `
            }
        </article>
    `;

}


function findPost(postId) {

    for (const post of posts) {

        if (post.id === postId) {
            return post;
        }

        const comment = (post.comments || []).find(
            childPost => childPost.id === postId
        );

        if (comment) {
            return comment;
        }

    }

    return null;

}


async function toggleReaction(postId, reactionType) {

    if (!participantId) {
        setStatus("Du måste vara registrerad för att reagera.", true);
        return;
    }

    const isAllowedReaction = REACTION_TYPES.some(
        type => type.key === reactionType
    );

    if (!isAllowedReaction) {
        return;
    }

    const post = findPost(postId);

    if (!post) {
        return;
    }

    const existingReaction = post.reactions.find(
        reaction =>
            reaction.participant_id === participantId &&
            reaction.reaction === reactionType
    );

    let error;

    if (existingReaction) {

        ({ error } = await supabaseClient
            .from("festival2026_forum_reactions")
            .delete()
            .eq("id", existingReaction.id));

        if (!error) {
            post.reactions =
                post.reactions.filter(
                    reaction =>
                        reaction.id !== existingReaction.id
                );
        }

    } else {

        const { data, error: insertError } =
            await supabaseClient
                .from("festival2026_forum_reactions")
                .insert({
                    post_id: postId,
                    participant_id: participantId,
                    reaction: reactionType
                })
                .select()
                .single();

        error = insertError;

        if (!error && data) {
            post.reactions.push(data);
        }

    }

    if (error) {
        console.error("Could not update reaction:", error);
        setStatus("Reaktionen kunde inte sparas.", true);
        return;
    }

    refreshPostEngagement(postId);
    saveFeedCache();

}

async function createPost(event) {

    event.preventDefault();

    const bodyInput =
        document.getElementById("post-body");

    const body = bodyInput?.value.trim();

    if (!participantId) {
        setStatus("Du måste vara registrerad för att skriva inlägg.", true);
        return;
    }

    if (!body) {
        setStatus("Skriv något innan du publicerar.", true);
        return;
    }

    const submitButton =
        event.currentTarget.querySelector("button[type='submit']");

    submitButton.disabled = true;
    setStatus("Publicerar...");

    const { data, error } = await supabaseClient
        .from("festival2026_forum_posts")
        .insert({
            participant_id: participantId,
            body
        })
        .select("id")
        .single();

    submitButton.disabled = false;

    if (error) {
        console.error("Could not create post:", error);
        setStatus("Inlägget kunde inte publiceras.", true);
        return;
    }

    bodyInput.value = "";
    setStatus("Inlägget är publicerat.");

    if (data?.id) {
        queueScrollToPost(data.id, data.id);
    }

    invalidateForumCache();

    await loadActivityBadges();
    renderMembers();
    await loadPosts({
        reset: true,
        forceNetwork: true
    });

}


async function createComment(event) {

    event.preventDefault();

    if (!participantId) {
        setStatus("Du måste vara registrerad för att kommentera.", true);
        return;
    }

    const form = event.currentTarget;
    const input = form.querySelector("input[name='comment']");
    const body = input?.value.trim();
    const parentId = form.dataset.parentId;
    const submitButton = form.querySelector("button[type='submit']");

    if (!body || !parentId) {
        return;
    }

    submitButton.disabled = true;

    const { data, error } = await supabaseClient
        .from("festival2026_forum_posts")
        .insert({
            participant_id: participantId,
            body,
            is_child_post: parentId
        })
        .select("id")
        .single();

    submitButton.disabled = false;

    if (error) {
        console.error("Could not create comment:", error);
        setStatus("Kommentaren kunde inte publiceras.", true);
        return;
    }

    input.value = "";
    clearReplyContext(form);
    activeReplyTargetId = null;
    setStatus("Kommentaren är publicerad.");

    if (data?.id) {
        queueScrollToPost(parentId, data.id);
    }

    invalidateForumCache();

    await loadActivityBadges();
    renderMembers();
    await loadPosts({
        reset: true,
        forceNetwork: true
    });

}

function setupMembersExpand() {

    const membersList =
        document.getElementById("members-list");

    const expandButton =
        document.getElementById("members-expand");

    if (!membersList || !expandButton) {
        return;
    }

    function updateButton() {

        if (window.innerWidth > 700) {
            expandButton.hidden = true;
            membersList.classList.remove("is-expanded");
            return;
        }

        const hasOverflow =
            membersList.scrollHeight >
            membersList.clientHeight + 5;

        expandButton.hidden =
            !hasOverflow;

        if (
            membersList.classList.contains("is-expanded")
        ) {
            expandButton.textContent =
                "Visa färre ↑";
        } else {
            expandButton.textContent =
                "Visa alla ↓";
        }

    }

    expandButton.addEventListener("click", () => {

        const expanded =
            membersList.classList.toggle(
                "is-expanded"
            );

        expandButton.textContent =
            expanded
                ? "Visa färre ↑"
                : "Visa alla ↓";

    });

    window.addEventListener(
        "resize",
        updateButton
    );

    // Kör efter att medlemmarna hunnit renderas
    window.requestAnimationFrame(
        updateButton
    );

}


async function openDeepLinkedPost() {

    const params = new URLSearchParams(window.location.search);
    let postId = params.get("post");

    if (!postId && window.location.hash.startsWith("#forum-post-")) {
        postId = window.location.hash.replace("#forum-post-", "");
    }

    if (!postId) {
        return;
    }

    let threadId = findThreadIdForPost(postId);

    if (!threadId) {

        const { data } = await supabaseClient
            .from("festival2026_forum_posts")
            .select("id, is_child_post")
            .eq("id", postId)
            .maybeSingle();

        if (!data) {
            return;
        }

        threadId = data.is_child_post || data.id;

    }

    await openForumPostTarget(threadId, postId);

}


async function loadForum() {

    participantId =
        localStorage.getItem(SESSION_KEY);

    const form =
        document.getElementById("post-form");

    if (!participantId) {
        form?.querySelector("textarea")?.setAttribute("disabled", "true");
        form?.querySelector("button[type='submit']")?.setAttribute("disabled", "true");
        setStatus("Registrera dig i SaunaPortal för att skriva och reagera.");
    }

    try {
        await loadMembers({
            preferCache: true
        });
        await loadPosts({
            reset: true,
            preferCache: true
        });
        await openDeepLinkedPost();
    } catch (error) {
        console.error("Could not load forum:", error);
        document.getElementById("post-feed").innerHTML =
            "<p class=\"forum-empty\">Forumet kunde inte laddas just nu.</p>";
    }

}


function logoutForumUser() {

    localStorage.removeItem(SESSION_KEY);
    sessionStorage.clear();
    window.location.href = "index.html";

}

document.addEventListener("DOMContentLoaded", () => {

    document.body.classList.remove(
        "forum-popup-open",
        "forum-delete-modal-open"
    );

    document
        .getElementById("forum-logout")
        ?.addEventListener("click", logoutForumUser);


    document.addEventListener("click", event => {

        if (!event.target.closest(".post-menu")) {
            closeAllPostMenus();
        }

    });


    window.forumPresence?.subscribe(() => {

        renderMembers();

    });


    document
        .getElementById("post-form")
        ?.addEventListener("submit", createPost);


    document
        .querySelectorAll("[data-feed-tab]")
        .forEach(tab => {

            tab.addEventListener("click", () => {

                feedMode =
                    tab.dataset.feedTab || "latest";


                document
                    .querySelectorAll("[data-feed-tab]")
                    .forEach(otherTab => {

                        const isActive =
                            otherTab === tab;


                        otherTab.classList.toggle(
                            "active",
                            isActive
                        );


                        otherTab.setAttribute(
                            "aria-selected",
                            String(isActive)
                        );

                    });


                loadPosts({
                    reset: true,
                    preferCache: true
                });

            });

        });


    const sentinel =
        document.getElementById("feed-sentinel");


    if (
        sentinel &&
        "IntersectionObserver" in window
    ) {

        const observer =
            new IntersectionObserver(
                entries => {

                    if (
                        entries.some(
                            entry => entry.isIntersecting
                        )
                    ) {

                        loadPosts();

                    }

                },
                {
                    rootMargin: "500px"
                }
            );


        observer.observe(sentinel);

    }


    setupMembersExpand();


    loadForum();

});