const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_BUCKET = "festival2026-deltagare";

const NEWCOMER_BADGE_MS = 2 * 24 * 60 * 60 * 1000;

let members = [];
let featuredId = null;
let activityBadgesById = new Map();
let rosterHasCourseFields = false;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
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

    const letter = (name || "S").trim().charAt(0).toUpperCase() || "S";

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" fill="#000080" />
            <text x="32" y="41" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#ffffff">${letter}</text>
        </svg>
    `)}`;
}

function formatJoinDate(dateValue) {
    if (!dateValue) {
        return "Okänt datum";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Okänt datum";
    }

    return new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "long"
    }).format(date);
}

function memberSinceLabel(dateValue) {
    if (!dateValue) {
        return "Gick med vid okänt datum";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Gick med vid okänt datum";
    }

    const days = Math.floor((Date.now() - date.getTime()) / 86400000);

    if (days < 1) {
        return "Gick med idag";
    }

    if (days < 14) {
        return `Ny i bastun · ${days} dagar`;
    }

    return `Med sedan ${formatJoinDate(dateValue)}`;
}

function memberHasNotTakenCourse(member) {
    if (!rosterHasCourseFields) {
        return false;
    }

    return !member.course_started && !member.course_completed;
}

function getActivityBadges(memberId) {
    return activityBadgesById.get(memberId) || [];
}

function getStatusSortRank(memberId) {
    const badges = getActivityBadges(memberId);

    if (badges.some(badge => badge.key === "champion")) {
        return 0;
    }

    if (badges.some(badge => badge.key === "top")) {
        return 1;
    }

    if (badges.some(badge => badge.key === "nykomling")) {
        return 2;
    }

    return 3;
}

function compareMembers(first, second, sortMode) {
    if (sortMode === "status") {
        const rankDiff =
            getStatusSortRank(first.id) - getStatusSortRank(second.id);

        if (rankDiff !== 0) {
            return rankDiff;
        }
    }

    if (sortMode === "joined-desc" || sortMode === "joined-asc") {
        const firstTime = first.created_at
            ? new Date(first.created_at).getTime()
            : 0;
        const secondTime = second.created_at
            ? new Date(second.created_at).getTime()
            : 0;
        const timeDiff = secondTime - firstTime;

        if (timeDiff !== 0) {
            return sortMode === "joined-desc" ? timeDiff : -timeDiff;
        }
    }

    return String(first.name || "")
        .localeCompare(String(second.name || ""), "sv", {
            sensitivity: "base"
        });
}

function renderMemberBadges(member) {
    const badges = [...getActivityBadges(member.id)];

    if (memberHasNotTakenCourse(member)) {
        badges.push({
            key: "no-course",
            label: "Ej tagit kurs"
        });
    }

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

function pickFeaturedMember() {
    if (!members.length) {
        featuredId = null;
        return null;
    }

    const index = Math.floor(Math.random() * members.length);
    featuredId = members[index].id;
    return members[index];
}

function memberFacts(member) {
    return `
        <div>
            <span>Gick med</span>
            <strong>${escapeHtml(formatJoinDate(member.created_at))}</strong>
        </div>
        <div>
            <span>Bastuolja</span>
            <strong>${escapeHtml(member.sauna_oil || "Ej angivet")}</strong>
        </div>
        <div>
            <span>Favorittemp.</span>
            <strong>${escapeHtml(String(member.favorite_temperature ?? "–"))} °C</strong>
        </div>
        <div class="roster-motto">
            <span>Motto</span>
            <strong>${escapeHtml(member.motto || "Inget motto ännu.")}</strong>
        </div>
    `;
}

function renderFeatured() {
    const slot = document.getElementById("featured-member");

    if (!slot) {
        return;
    }

    const featured = members.find(member => member.id === featuredId) || pickFeaturedMember();

    if (!featured) {
        slot.hidden = true;
        slot.innerHTML = "";
        return;
    }

    const badgesHtml = renderMemberBadges(featured);

    slot.hidden = false;
    slot.innerHTML = `
        <div class="featured-copy">
            <h2 id="featured-title">Utvald medlem</h2>
            <p class="featured-name-row">
                <span class="featured-name">${escapeHtml(featured.name || "Deltagare")}</span>
                ${badgesHtml}
            </p>
            <p class="featured-alias">@${escapeHtml(featured.alias || "")}</p>
            <p class="featured-since">${escapeHtml(memberSinceLabel(featured.created_at))}</p>
            <div class="roster-details featured-facts">
                ${memberFacts(featured)}
            </div>
            <button type="button" id="featured-another" class="featured-another">Visa en annan medlem</button>
        </div>
        <img
            class="featured-photo"
            src="${getAvatarUrl(featured.photo_path, featured.name)}"
            alt=""
        >
    `;

    document.getElementById("featured-another")?.addEventListener("click", () => {
        pickFeaturedMember();
        renderRoster();
    });
}

function renderRoster() {
    const roster = document.getElementById("members-roster");
    const lead = document.getElementById("members-lead");
    const query = (
        document.getElementById("members-query")?.value || ""
    ).trim().toLowerCase();
    const sortMode =
        document.getElementById("members-sort")?.value || "alpha";

    if (lead) {
        lead.textContent = members.length
            ? `${members.length} medlemmar. En är utvald här uppe — sök och sortera listan nedanför.`
            : "Inga medlemmar ännu.";
    }

    renderFeatured();

    const visible = members
        .filter(member => {
            if (!query) {
                return true;
            }

            return `${member.name || ""} ${member.alias || ""}`
                .toLowerCase()
                .includes(query);
        })
        .sort((first, second) => compareMembers(first, second, sortMode));

    if (!roster) {
        return;
    }

    if (!visible.length) {
        roster.innerHTML = `<p class="roster-empty">Ingen medlem matchar sökningen.</p>`;
        return;
    }

    roster.innerHTML = visible.map(member => {
        const badgesHtml = renderMemberBadges(member);

        return `
        <article class="roster-card">
            <img class="roster-avatar" src="${getAvatarUrl(member.photo_path, member.name)}" alt="">
            <div class="roster-copy">
                <span class="roster-name-row">
                    <strong>${escapeHtml(member.name || "Deltagare")}</strong>
                    ${badgesHtml}
                </span>
                <small>@${escapeHtml(member.alias || "")}</small>
                <small class="roster-meta">${escapeHtml(memberSinceLabel(member.created_at))}</small>
                <div class="roster-details">
                    ${memberFacts(member)}
                </div>
            </div>
        </article>
    `;
    }).join("");
}

async function loadActivityBadges() {
    activityBadgesById = new Map();

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

    members.forEach(member => {
        const badges = [];

        if (member.created_at) {
            const createdAt = new Date(member.created_at);

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

        const rank = rankById.get(member.id);

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
            activityBadgesById.set(member.id, badges);
        }
    });
}

async function loadMembers() {
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
            course_started,
            course_completed
        `)
        .order("name", { ascending: true });

    rosterHasCourseFields = !error;

    if (error) {
        ({ data, error } = await supabaseClient
            .from("festival2026_deltagare")
            .select(`
                id,
                name,
                alias,
                sauna_oil,
                favorite_temperature,
                motto,
                photo_path,
                created_at
            `)
            .order("name", { ascending: true }));
    }

    if (error) {
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
        document.getElementById("members-lead").textContent =
            "Medlemmarna kunde inte laddas just nu.";
        return;
    }

    members = data || [];
    pickFeaturedMember();
    await loadActivityBadges();
    renderRoster();
}

document.getElementById("members-query")?.addEventListener("input", renderRoster);
document.getElementById("members-sort")?.addEventListener("change", renderRoster);

loadMembers();
