const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_BUCKET = "festival2026-deltagare";

let members = [];

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
            <rect width="80" height="80" fill="#8a3b12" />
            <text x="40" y="51" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="#fff8ea">${letter}</text>
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

function renderRoster() {
    const roster = document.getElementById("members-roster");
    const lead = document.getElementById("members-lead");
    const query = (
        document.getElementById("members-query")?.value || ""
    ).trim().toLowerCase();

    if (lead) {
        lead.textContent = members.length
            ? `${members.length} personer i laget. Öppna ett kort för olja, temperatur, motto och när de gick med.`
            : "Inga medlemmar ännu.";
    }

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

    const openId = roster.querySelector(".roster-card.is-open")?.dataset.memberId;

    roster.innerHTML = visible.map(member => {
        const isOpen = member.id === openId;

        return `
            <article class="roster-card${isOpen ? " is-open" : ""}" data-member-id="${member.id}">
                <button type="button" class="roster-toggle" aria-expanded="${isOpen ? "true" : "false"}">
                    <img src="${getAvatarUrl(member.photo_path, member.name)}" alt="">
                    <span class="roster-copy">
                        <strong>${escapeHtml(member.name || "Deltagare")}</strong>
                        <small>@${escapeHtml(member.alias || "")}</small>
                        <small>${escapeHtml(memberSinceLabel(member.created_at))}</small>
                    </span>
                    <span class="roster-action">${isOpen ? "Dölj" : "Läs mer"}</span>
                </button>
                <div class="roster-details"${isOpen ? "" : " hidden"}>
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
                </div>
            </article>
        `;
    }).join("");
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
    renderRoster();
}

document.getElementById("members-query")?.addEventListener("input", renderRoster);

document.getElementById("members-roster")?.addEventListener("click", event => {
    const toggle = event.target.closest(".roster-toggle");

    if (!toggle) {
        return;
    }

    const card = toggle.closest(".roster-card");
    const willOpen = !card.classList.contains("is-open");

    card.parentElement?.querySelectorAll(".roster-card.is-open").forEach(openCard => {
        if (openCard === card) {
            return;
        }

        openCard.classList.remove("is-open");
        openCard.querySelector(".roster-details")?.setAttribute("hidden", "");
        openCard.querySelector(".roster-toggle")?.setAttribute("aria-expanded", "false");
        const action = openCard.querySelector(".roster-action");
        if (action) {
            action.textContent = "Läs mer";
        }
    });

    card.classList.toggle("is-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
    card.querySelector(".roster-details")?.toggleAttribute("hidden", !willOpen);

    const action = card.querySelector(".roster-action");
    if (action) {
        action.textContent = willOpen ? "Dölj" : "Läs mer";
    }
});

loadMembers();
