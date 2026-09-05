// Shared SaunaPortal profile widget

(() => {
    const SUPABASE_URL = "https://nicpgzkkyktzphkyzhfl.supabase.co";
    const SUPABASE_KEY = "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";
    const SESSION_KEY = "sauna_festival_participant_id";
    const STORAGE_BUCKET = "festival2026-deltagare";

    function createInitialAvatar(name) {
        const letter = (name || "S").trim().charAt(0).toUpperCase() || "S";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#000080"/><text x="80" y="100" text-anchor="middle" font-family="Arial" font-size="72" font-weight="bold" fill="white">${letter}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getPhotoUrl(photoPath) {
        if (!photoPath || !window.supabase) {
            return null;
        }

        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(photoPath);
        return data?.publicUrl || null;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.clear();
        window.location.href = "index.html";
    }

    function createWidget() {
        if (document.getElementById("festival-profile-widget")) {
            return;
        }

        const widget = document.createElement("div");
        widget.id = "festival-profile-widget";
        widget.className = "festival-profile-widget";
        widget.innerHTML = `
            <button type="button" id="festival-profile-button" class="festival-profile-button" aria-label="Öppna profil" aria-expanded="false">
                <img id="festival-profile-avatar" class="festival-profile-avatar" alt="">
                <span class="festival-profile-name">
                    <strong id="festival-profile-name">-</strong>
                    <small id="festival-profile-alias">-</small>
                </span>
            </button>
            <div id="festival-profile-panel" class="festival-profile-panel" hidden>
                <div class="festival-profile-panel-header">
                    <img id="festival-profile-panel-avatar" class="festival-profile-panel-avatar" alt="">
                    <div>
                        <h2 id="festival-profile-panel-name">-</h2>
                        <p id="festival-profile-panel-alias">-</p>
                    </div>
                </div>
                <div class="festival-profile-status">
                    <span class="festival-status-dot"></span>
                    <span>Registrerad på festivalen</span>
                </div>
                <div class="festival-profile-stats">
                    <div class="festival-profile-stat"><span>Bastuolja</span><strong id="festival-profile-oil">-</strong></div>
                    <div class="festival-profile-stat"><span>Favorittemp.</span><strong><span id="festival-profile-temperature">-</span> °C</strong></div>
                    <div class="festival-profile-stat"><span>Motto</span><strong id="festival-profile-motto">-</strong></div>
                </div>
                <button type="button" id="festival-profile-logout" class="secondary-button full-width">Logga ut</button>
            </div>
        `;

        document.body.appendChild(widget);

        const button = document.getElementById("festival-profile-button");
        const panel = document.getElementById("festival-profile-panel");

        button?.addEventListener("click", event => {
            event.stopPropagation();
            const open = panel.hidden;
            panel.hidden = !open;
            button.setAttribute("aria-expanded", String(open));
        });

        panel?.addEventListener("click", event => event.stopPropagation());
        document.addEventListener("click", () => {
            if (panel) {
                panel.hidden = true;
            }
            button?.setAttribute("aria-expanded", "false");
        });
        document.getElementById("festival-profile-logout")?.addEventListener("click", logout);
    }

    async function loadProfile() {
        const participantId = localStorage.getItem(SESSION_KEY);
        if (!participantId || !window.supabase) {
            return;
        }

        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await client
            .from("festival2026_deltagare")
            .select("id, name, alias, sauna_oil, favorite_temperature, motto, photo_path")
            .eq("id", participantId)
            .single();

        if (error || !data) {
            return;
        }

        const photoUrl = getPhotoUrl(data.photo_path) || createInitialAvatar(data.name || data.alias);
        const avatar = document.getElementById("festival-profile-avatar");
        const panelAvatar = document.getElementById("festival-profile-panel-avatar");

        [avatar, panelAvatar].forEach(image => {
            if (image) {
                image.src = photoUrl;
                image.alt = data.name || "Profilbild";
            }
        });

        document.getElementById("festival-profile-name").textContent = data.name || "Deltagare";
        document.getElementById("festival-profile-alias").textContent = data.alias ? `@${data.alias}` : "";
        document.getElementById("festival-profile-panel-name").textContent = data.name || "Deltagare";
        document.getElementById("festival-profile-panel-alias").textContent = data.alias ? `@${data.alias}` : "";
        document.getElementById("festival-profile-oil").textContent = data.sauna_oil || "Ej angivet";
        document.getElementById("festival-profile-temperature").textContent = data.favorite_temperature ?? "-";
        document.getElementById("festival-profile-motto").textContent = data.motto || "Inget motto ännu.";
        document.getElementById("festival-profile-widget").classList.add("visible");
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (window.saunaFestival) {
            return;
        }

        createWidget();
        loadProfile();
    });
})();
