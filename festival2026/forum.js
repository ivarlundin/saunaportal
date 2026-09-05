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


async function loadMembers() {

    const { data, error } = await supabaseClient
        .from("festival2026_deltagare")
        .select("id, name, alias, photo_path")
        .order("name", { ascending: true });

    if (error) {
        throw error;
    }

    participants = data || [];
    renderMembers();

}


async function loadPosts() {

    const { data: postData, error: postError } = await supabaseClient
        .from("festival2026_forum_posts")
        .select("id, participant_id, body, created_at")
        .order("created_at", { ascending: false });

    if (postError) {
        throw postError;
    }

    const { data: reactionData, error: reactionError } = await supabaseClient
        .from("festival2026_forum_reactions")
        .select("id, post_id, participant_id, reaction");

    if (reactionError) {
        throw reactionError;
    }

    const reactionsByPost = new Map();

    (reactionData || []).forEach(reaction => {

        const current =
            reactionsByPost.get(reaction.post_id) || [];

        current.push(reaction);
        reactionsByPost.set(reaction.post_id, current);

    });

    posts = (postData || []).map(post => ({
        ...post,
        author: participants.find(
            participant => participant.id === post.participant_id
        ),
        reactions: reactionsByPost.get(post.id) || []
    }));

    renderPosts();

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
        list.innerHTML = "<p class=\"forum-empty\">Inga medlemmar ännu.</p>";
        return;
    }

    list.innerHTML = participants.map(participant => `
        <div class="member-item">
            <img src="${getAvatarUrl(participant.photo_path, participant.name)}" alt="">
            <span>
                <strong>${escapeHtml(participant.name)}</strong>
                <small>@${escapeHtml(participant.alias)}</small>
            </span>
        </div>
    `).join("");

}


function renderPosts() {

    const feed =
        document.getElementById("post-feed");

    if (!feed) {
        return;
    }

    if (!posts.length) {
        feed.innerHTML = "<p class=\"forum-empty\">Inga inlägg ännu. Skriv det första.</p>";
        return;
    }

    feed.innerHTML = posts.map(post => {

        const author = post.author || {
            name: "Okänd medlem",
            alias: ""
        };

        const likes = post.reactions.filter(
            reaction => reaction.reaction === "thumbs_up"
        );

        const hasLiked = likes.some(
            reaction => reaction.participant_id === participantId
        );

        return `
            <article class="post-card">
                <div class="post-author">
                    <img src="${getAvatarUrl(author.photo_path, author.name)}" alt="">
                    <div>
                        <strong>${escapeHtml(author.name)}</strong>
                        <small>@${escapeHtml(author.alias)} · ${formatDate(post.created_at)}</small>
                    </div>
                </div>
                <p class="post-body">${escapeHtml(post.body).replaceAll("\n", "<br>")}</p>
                <button type="button" class="reaction-button ${hasLiked ? "active" : ""}" data-post-id="${post.id}" ${participantId ? "" : "disabled"}>
                    <span aria-hidden="true">👍</span>
                    <span>${likes.length}</span>
                </button>
            </article>
        `;

    }).join("");

    feed.querySelectorAll(".reaction-button").forEach(button => {
        button.addEventListener("click", () => toggleReaction(button.dataset.postId));
    });

}


async function toggleReaction(postId) {

    if (!participantId) {
        setStatus("Du måste vara registrerad för att reagera.", true);
        return;
    }

    const post = posts.find(item => item.id === postId);

    const existingReaction = post?.reactions.find(
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

    } else {

        ({ error } = await supabaseClient
            .from("festival2026_forum_reactions")
            .insert({
                post_id: postId,
                participant_id: participantId,
                reaction: "thumbs_up"
            }));

    }

    if (error) {
        console.error("Could not update reaction:", error);
        setStatus("Reaktionen kunde inte sparas.", true);
        return;
    }

    await loadPosts();

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
    await loadPosts();

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
        await loadPosts();
    } catch (error) {
        console.error("Could not load forum:", error);
        document.getElementById("post-feed").innerHTML =
            "<p class=\"forum-empty\">Forumet kunde inte laddas just nu.</p>";
    }

}


document.addEventListener("DOMContentLoaded", () => {

    document
        .getElementById("post-form")
        ?.addEventListener("submit", createPost);

    document
        .getElementById("refresh-posts")
        ?.addEventListener("click", loadForum);

    loadForum();

});
