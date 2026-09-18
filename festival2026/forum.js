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

let participantId = null;
let participants = [];
let posts = [];
let feedMode = "latest";
let feedOffset = 0;
let feedHasMore = true;
let feedLoading = false;

const FEED_PAGE_SIZE = 12;

const SEMINARIUM_PIN_PATTERN = /seminarium/i;
const SEMINARIUM_PIN_ALIAS = "ivve";


function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

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


async function loadMembers() {

    const { data, error } = await supabaseClient
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
        .order("name", { ascending: true });

    if (error) {
        throw error;
    }

    participants = data || [];

    window.forumPresence?.setMembers(
        participants,
        participantId
    );

    renderCurrentUser();
    renderMembers();

}


async function loadPosts({ reset = false } = {}) {

    if (feedLoading || (!feedHasMore && !reset)) {
        return;
    }

    if (reset) {
        posts = [];
        feedOffset = 0;
        feedHasMore = true;
        renderPosts();
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

    if (!posts.length) {
        feed.innerHTML =
            "<p class=\"forum-empty\">Inga inlägg ännu. Skriv det första.</p>";
        return;
    }

    feed.innerHTML = posts
        .map(post => renderPost(post))
        .join("");

    // Reaktioner
    feed.querySelectorAll(".reaction-button").forEach(button => {

        button.addEventListener("click", () => {

            toggleReaction(
                button.dataset.postId
            );

        });

    });

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

}


function renderPost(post, isComment = false) {

    const author = post.author || {
        name: "Okänd medlem",
        alias: ""
    };

    const likes = (post.reactions || []).filter(
        reaction => reaction.reaction === "thumbs_up"
    );

    const hasLiked = likes.some(
        reaction => reaction.participant_id === participantId
    );

    const comments = isComment
        ? ""
        : (post.comments || [])
            .map(comment => renderPost(comment, true))
            .join("");

    const isPinned =
        !isComment && isPinnedSeminariumPost(post);

    return `
        <article class="post-card ${isComment ? "comment-card" : ""}${isPinned ? " post-card-pinned" : ""}">
            ${
                isPinned
                    ? `<div class="post-pin-badge">Pinad · seminarium</div>`
                    : ""
            }
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

                    <small>
                        @${escapeHtml(author.alias)}
                        ·
                        ${formatDate(post.created_at)}
                    </small>

                </div>

            </div>
            <p class="post-body">${escapeHtml(post.body).replaceAll("\n", "<br>")}</p>
            <div class="post-actions">
                <button type="button" class="reaction-button ${hasLiked ? "active" : ""}" data-post-id="${post.id}" ${participantId ? "" : "disabled"}>
                    <span aria-hidden="true">👍</span>
                    <span>${likes.length}</span>
                </button>
            </div>
            <form class="comment-form" data-parent-id="${post.id}">
                <input
                    type="text"
                    name="comment"
                    maxlength="1000"
                    placeholder="Skriv en kommentar..."
                    ${participantId ? "" : "disabled"}
                    required
                >
                <button type="submit" class="secondary-button" ${participantId ? "" : "disabled"}>Kommentera</button>
            </form>
            ${comments ? `<div class="post-comments">${comments}</div>` : ""}
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


async function toggleReaction(postId) {

    if (!participantId) {
        setStatus("Du måste vara registrerad för att reagera.", true);
        return;
    }

    const post = findPost(postId);

    if (!post) {
        return;
    }

    const existingReaction = post.reactions.find(
        reaction =>
            reaction.participant_id === participantId &&
            reaction.reaction === "thumbs_up"
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
                    reaction: "thumbs_up"
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

    // Uppdatera bara knappen som klickades
    const button = document.querySelector(
        `.reaction-button[data-post-id="${postId}"]`
    );

    if (!button) {
        return;
    }

    const likes = post.reactions.filter(
        reaction =>
            reaction.reaction === "thumbs_up"
    );

    const hasLiked = likes.some(
        reaction =>
            reaction.participant_id === participantId
    );

    button.classList.toggle(
        "active",
        hasLiked
    );

    const count = button.querySelector("span:last-child");

    if (count) {
        count.textContent = likes.length;
    }

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

    const { error } = await supabaseClient
        .from("festival2026_forum_posts")
        .insert({
            participant_id: participantId,
            body
        });

    submitButton.disabled = false;

    if (error) {
        console.error("Could not create post:", error);
        setStatus("Inlägget kunde inte publiceras.", true);
        return;
    }

    bodyInput.value = "";
    setStatus("Inlägget är publicerat.");
    await loadPosts({
        reset: true
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

    const { error } = await supabaseClient
        .from("festival2026_forum_posts")
        .insert({
            participant_id: participantId,
            body,
            is_child_post: parentId
        });

    submitButton.disabled = false;

    if (error) {
        console.error("Could not create comment:", error);
        setStatus("Kommentaren kunde inte publiceras.", true);
        return;
    }

    input.value = "";
    setStatus("Kommentaren är publicerad.");

    await loadPosts({
        reset: true
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
        await loadMembers();
        await loadPosts({
            reset: true
        });
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

    document
        .getElementById("forum-logout")
        ?.addEventListener("click", logoutForumUser);


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
                    reset: true
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