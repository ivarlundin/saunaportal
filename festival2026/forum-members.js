const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_BUCKET = "festival2026-deltagare";

let members = [];
let featuredId = null;

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
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
            <rect width="80" height="80" fill="#000080" />
            <text x="40" y="51" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="#ffffff">${letter}</text>
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

    slot.hidden = false;
    slot.innerHTML = `
        <div class="featured-copy">
            <h2 id="featured-title">Utvald medlem</h2>
            <p class="featured-name">${escapeHtml(featured.name || "Deltagare")}</p>
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
        renderFeatured();
    });
}

function renderRoster() {
    const roster = document.getElementById("members-roster");
    const lead = document.getElementById("members-lead");
    const query = (
        document.getElementById("members-query")?.value || ""
    ).trim().toLowerCase();

    if (lead) {
        lead.textContent = members.length
            ? `${members.length} medlemmar. En är utvald här uppe, resten ligger nedanför.`
            : "Inga medlemmar ännu.";
    }

    renderFeatured();

    const visible = members.filter(member => {
        if (!query) {
            return true;
        }

        return `${member.name || ""} ${member.alias || ""}`
            .toLowerCase()
            .includes(query);
    });

    if (!roster) {
        return;
    }

    if (!visible.length) {
        roster.innerHTML = `<p class="roster-empty">Ingen medlem matchar sökningen.</p>`;
        return;
    }

    roster.innerHTML = visible.map(member => `
        <article class="roster-card">
            <img src="${getAvatarUrl(member.photo_path, member.name)}" alt="">
            <div class="roster-copy">
                <strong>${escapeHtml(member.name || "Deltagare")}</strong>
                <small>@${escapeHtml(member.alias || "")}</small>
                <small>${escapeHtml(memberSinceLabel(member.created_at))}</small>
                <div class="roster-details">
                    ${memberFacts(member)}
                </div>
            </div>
        </article>
    `).join("");
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
            created_at
        `)
        .order("name", { ascending: true });

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
    renderRoster();
}

document.getElementById("members-query")?.addEventListener("input", renderRoster);

loadMembers();
