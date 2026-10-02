// SaunaFestival 2026 — live omröstning (omrostning.html)

const OMROSTNING_SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const OMROSTNING_SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const OMROSTNING_SESSION_KEY =
    "sauna_festival_participant_id";

const POLL_TABLE = "festival2026_omrostning_polls";
const RESPONSE_TABLE = "festival2026_omrostning_responses";

const supabaseClient =
    window.supabase?.createClient(
        OMROSTNING_SUPABASE_URL,
        OMROSTNING_SUPABASE_KEY
    ) || null;

let participantId = null;
let isAdmin = false;
let livePolls = [];
let myResponses = new Map();
let adminPolls = [];
let adminTab = "compose";

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
    const el = document.getElementById("omrostning-status");
    if (!el) {
        return;
    }

    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError && message));
}

function getPollOptions(poll) {
    const raw = poll?.options;
    if (!raw) {
        return [];
    }

    if (Array.isArray(raw)) {
        return raw.map(String).filter(Boolean);
    }

    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function statusLabel(status) {
    if (status === "live") {
        return "Live";
    }

    if (status === "closed") {
        return "Stängd";
    }

    return "Utkast";
}

async function loadParticipant() {
    participantId = localStorage.getItem(OMROSTNING_SESSION_KEY);

    if (!participantId || !supabaseClient) {
        setStatus("Logga in via startsidan för att rösta.", true);
        return;
    }

    const { data, error } = await supabaseClient
        .from("festival2026_deltagare")
        .select("id, name, alias, is_forum_admin")
        .eq("id", participantId)
        .maybeSingle();

    if (error || !data) {
        setStatus("Kunde inte hämta din profil.", true);
        participantId = null;
        return;
    }

    isAdmin = Boolean(data.is_forum_admin);
    document
        .getElementById("omrostning-admin")
        ?.toggleAttribute("hidden", !isAdmin);

    if (isAdmin) {
        document.getElementById("omrostning-intro").textContent =
            "Skapa utkast, publicera när det är dags, och följ resultaten. Deltagare ser live-omröstningar efter Uppdatera.";
    }
}

async function loadLivePolls() {
    if (!supabaseClient) {
        setStatus("Supabase saknas.", true);
        return;
    }

    setStatus("Laddar omröstningar...");

    const { data, error } = await supabaseClient
        .from(POLL_TABLE)
        .select("id, title, options, allow_text_response, status, updated_at")
        .eq("status", "live")
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("Could not load live polls:", error);
        setStatus(
            "Kunde inte ladda omröstningar. Kör omrostning.sql i Supabase.",
            true
        );
        livePolls = [];
        renderLivePolls();
        return;
    }

    livePolls = data || [];

    if (participantId && livePolls.length) {
        const pollIds = livePolls.map(poll => poll.id);
        const { data: responses, error: responseError } = await supabaseClient
            .from(RESPONSE_TABLE)
            .select("poll_id, option_index, text_response")
            .eq("participant_id", participantId)
            .in("poll_id", pollIds);

        myResponses = new Map();

        if (!responseError && responses) {
            responses.forEach(row => {
                myResponses.set(row.poll_id, row);
            });
        }
    } else {
        myResponses = new Map();
    }

    renderLivePolls();

    if (!livePolls.length) {
        setStatus("Inga aktiva omröstningar just nu.");
    } else {
        setStatus(`${livePolls.length} aktiv${livePolls.length === 1 ? "" : "a"} omröstning${livePolls.length === 1 ? "" : "ar"}.`);
    }
}

function renderLivePolls() {
    const list = document.getElementById("omrostning-poll-list");
    if (!list) {
        return;
    }

    if (!participantId) {
        list.innerHTML =
            '<p class="omrostning-empty">Logga in på festivalen för att delta.</p>';
        return;
    }

    if (!livePolls.length) {
        list.innerHTML =
            '<p class="omrostning-empty">Ingen omröstning är live. Tryck Uppdatera igen om du väntar på start.</p>';
        return;
    }

    list.innerHTML = livePolls
        .map(poll => renderLivePollCard(poll))
        .join("");

    list.querySelectorAll("[data-action='submit-vote']").forEach(button => {
        button.addEventListener("click", () => {
            submitVote(button.dataset.pollId);
        });
    });
}

function renderLivePollCard(poll) {
    const options = getPollOptions(poll);
    const mine = myResponses.get(poll.id);
    const hasOptions = options.length >= 2;
    const allowText = Boolean(poll.allow_text_response);

    const optionsHtml = hasOptions
        ? `<ol class="omrostning-poll-options">
            ${options
                .map((label, index) => {
                    const checked =
                        mine && Number(mine.option_index) === index
                            ? "checked"
                            : "";
                    return `<li class="omrostning-poll-option">
                        <label>
                            <input
                                type="radio"
                                name="poll-${poll.id}"
                                value="${index}"
                                ${checked}
                            >
                            <span>${escapeHtml(label)}</span>
                        </label>
                    </li>`;
                })
                .join("")}
        </ol>`
        : "";

    const textHtml = allowText
        ? `<div class="omrostning-text-field">
            <label for="poll-text-${poll.id}">Ditt svar</label>
            <textarea
                id="poll-text-${poll.id}"
                maxlength="1000"
                placeholder="Skriv här…"
            >${escapeHtml(mine?.text_response || "")}</textarea>
        </div>`
        : "";

    const votedNote =
        mine
            ? '<p class="omrostning-voted-note">Du har skickat ett svar. Du kan ändra och skicka igen.</p>'
            : "";

    return `<article class="omrostning-poll-card" data-poll-id="${poll.id}">
        <h2>${escapeHtml(poll.title)}</h2>
        ${optionsHtml}
        ${textHtml}
        ${votedNote}
        <div class="omrostning-poll-actions">
            <button type="button" class="primary-button" data-action="submit-vote" data-poll-id="${poll.id}">
                Skicka svar
            </button>
        </div>
    </article>`;
}

async function submitVote(pollId) {
    if (!participantId) {
        setStatus("Du måste vara inloggad.", true);
        return;
    }

    const poll = livePolls.find(row => row.id === pollId);
    if (!poll) {
        return;
    }

    const options = getPollOptions(poll);
    let optionIndex = null;

    if (options.length >= 2) {
        const selected = document.querySelector(
            `input[name="poll-${pollId}"]:checked`
        );
        if (!selected) {
            setStatus("Välj ett alternativ.", true);
            return;
        }

        optionIndex = Number(selected.value);
    }

    const textEl = document.getElementById(`poll-text-${pollId}`);
    const textValue = textEl ? textEl.value.trim() : "";

    setStatus("Sparar ditt svar...");

    const { error } = await supabaseClient.rpc("submit_omrostning_response", {
        acting_participant_id: participantId,
        target_poll_id: pollId,
        selected_option_index: optionIndex,
        response_text: textValue || null
    });

    if (error) {
        console.error("Could not submit vote:", error);
        setStatus(
            error.message?.includes("omrostning")
                ? "Svaret kunde inte sparas. Kör omrostning.sql i Supabase."
                : "Svaret kunde inte sparas.",
            true
        );
        return;
    }

    setStatus("Tack! Ditt svar är registrerat.");
    await loadLivePolls();
}

async function loadAdminPolls() {
    if (!isAdmin || !participantId) {
        return;
    }

    const { data, error } = await supabaseClient.rpc(
        "list_omrostning_polls_admin",
        { acting_participant_id: participantId }
    );

    if (error) {
        console.error("Could not load admin polls:", error);
        document.getElementById("omrostning-admin-list").innerHTML =
            '<p class="omrostning-empty">Kunde inte ladda adminlistan. Kör omrostning.sql.</p>';
        return;
    }

    adminPolls = data || [];
    renderAdminList();
}

function renderAdminList() {
    const list = document.getElementById("omrostning-admin-list");
    if (!list) {
        return;
    }

    if (!adminPolls.length) {
        list.innerHTML =
            '<p class="omrostning-empty">Inga omröstningar ännu.</p>';
        return;
    }

    list.innerHTML = adminPolls
        .map(poll => {
            const badgeClass =
                poll.status === "live"
                    ? "is-live"
                    : poll.status === "closed"
                        ? "is-closed"
                        : "is-draft";

            return `<article class="omrostning-admin-item" data-poll-id="${poll.id}">
                <header>
                    <h3>${escapeHtml(poll.title)}</h3>
                    <span class="omrostning-status-badge ${badgeClass}">${statusLabel(poll.status)}</span>
                </header>
                <div class="omrostning-admin-toolbar">
                    <button type="button" class="secondary-button" data-admin-action="edit" data-poll-id="${poll.id}">
                        Redigera
                    </button>
                    ${poll.status !== "live"
                        ? `<button type="button" class="primary-button" data-admin-action="live" data-poll-id="${poll.id}">Gå live</button>`
                        : ""}
                    ${poll.status === "live"
                        ? `<button type="button" class="secondary-button" data-admin-action="close" data-poll-id="${poll.id}">Stäng</button>`
                        : ""}
                    <button type="button" class="secondary-button" data-admin-action="results" data-poll-id="${poll.id}">
                        Visa resultat
                    </button>
                </div>
                <div id="omrostning-results-${poll.id}" class="omrostning-results" hidden></div>
            </article>`;
        })
        .join("");

    list.querySelectorAll("[data-admin-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.adminAction;
            const pollId = button.dataset.pollId;

            if (action === "edit") {
                loadPollIntoForm(pollId);
                setAdminTab("compose");
            } else if (action === "live") {
                setPollStatus(pollId, "live");
            } else if (action === "close") {
                setPollStatus(pollId, "closed");
            } else if (action === "results") {
                showPollResults(pollId);
            }
        });
    });
}

function loadPollIntoForm(pollId) {
    const poll = adminPolls.find(row => row.id === pollId);
    if (!poll) {
        return;
    }

    document.getElementById("omrostning-edit-id").value = poll.id;
    document.getElementById("omrostning-title").value = poll.title || "";
    document.getElementById("omrostning-allow-text").checked =
        Boolean(poll.allow_text_response);

    const options = getPollOptions(poll);
    const list = document.getElementById("omrostning-options-list");
    list.innerHTML = "";

    const count = Math.max(2, options.length || 2);
    for (let i = 0; i < count; i += 1) {
        addOptionInput(options[i] || "");
    }
}

function resetAdminForm() {
    document.getElementById("omrostning-edit-id").value = "";
    document.getElementById("omrostning-title").value = "";
    document.getElementById("omrostning-allow-text").checked = false;

    const list = document.getElementById("omrostning-options-list");
    list.innerHTML = "";
    addOptionInput("");
    addOptionInput("");
}

function addOptionInput(value = "") {
    const list = document.getElementById("omrostning-options-list");
    const row = document.createElement("div");
    row.className = "omrostning-option-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "omrostning-option-input";
    input.maxLength = 120;
    input.placeholder = "Alternativ";
    input.value = value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary-button omrostning-remove-option";
    removeButton.setAttribute("aria-label", "Ta bort alternativ");
    removeButton.textContent = "×";

    row.append(input, removeButton);
    list.appendChild(row);

    row.querySelector(".omrostning-remove-option")?.addEventListener("click", () => {
        const inputs = list.querySelectorAll(".omrostning-option-input");
        if (inputs.length <= 2) {
            return;
        }

        row.remove();
    });
}

function collectFormOptions() {
    return [
        ...document.querySelectorAll(".omrostning-option-input")
    ]
        .map(input => input.value.trim())
        .filter(Boolean);
}

async function savePoll(status) {
    if (!isAdmin || !participantId) {
        return;
    }

    const title = document.getElementById("omrostning-title").value.trim();
    const options = collectFormOptions();
    const allowText = document.getElementById("omrostning-allow-text").checked;
    const editId = document.getElementById("omrostning-edit-id").value || null;

    if (!title) {
        setStatus("Skriv en fråga.", true);
        return;
    }

    if (options.length < 2 && !allowText) {
        setStatus("Lägg till minst två alternativ eller aktivera fritext.", true);
        return;
    }

    setStatus("Sparar...");

    const { data, error } = await supabaseClient.rpc(
        "save_omrostning_poll_admin",
        {
            acting_participant_id: participantId,
            poll_id: editId,
            poll_title: title,
            poll_options: options,
            allow_text_response: allowText,
            poll_status: status
        }
    );

    if (error) {
        console.error("Could not save poll:", error);
        setStatus(
            "Kunde inte spara. Kör omrostning.sql i Supabase.",
            true
        );
        return;
    }

    if (data?.id) {
        document.getElementById("omrostning-edit-id").value = data.id;
    }

    setStatus(
        status === "live"
            ? "Omröstningen är live! Deltagare kan trycka Uppdatera."
            : "Utkast sparat."
    );

    await loadAdminPolls();
    await loadLivePolls();
}

async function setPollStatus(pollId, status) {
    setStatus("Uppdaterar status...");

    const { error } = await supabaseClient.rpc(
        "set_omrostning_poll_status_admin",
        {
            acting_participant_id: participantId,
            poll_id: pollId,
            new_status: status
        }
    );

    if (error) {
        console.error("Could not set status:", error);
        setStatus("Kunde inte ändra status.", true);
        return;
    }

    setStatus(
        status === "live"
            ? "Omröstningen är live."
            : status === "closed"
                ? "Omröstningen är stängd."
                : "Status uppdaterad."
    );

    await loadAdminPolls();
    await loadLivePolls();
}

async function showPollResults(pollId) {
    const container = document.getElementById(`omrostning-results-${pollId}`);
    if (!container) {
        return;
    }

    container.hidden = false;
    container.innerHTML = "<p>Laddar resultat…</p>";

    const poll = adminPolls.find(row => row.id === pollId);
    const options = getPollOptions(poll);

    const { data, error } = await supabaseClient
        .from(RESPONSE_TABLE)
        .select("option_index, text_response, participant_id")
        .eq("poll_id", pollId);

    if (error) {
        container.innerHTML =
            "<p>Kunde inte ladda svar.</p>";
        return;
    }

    const rows = data || [];
    const counts = options.map(() => 0);

    rows.forEach(row => {
        const idx = Number(row.option_index);
        if (Number.isFinite(idx) && idx >= 0 && idx < counts.length) {
            counts[idx] += 1;
        }
    });

    const totalVotes = counts.reduce((sum, n) => sum + n, 0);
    const optionStats = options.length
        ? `<ol>${options
            .map((label, index) => {
                const count = counts[index];
                const pct =
                    totalVotes > 0
                        ? Math.round((count / totalVotes) * 100)
                        : 0;
                return `<li><strong>${escapeHtml(label)}</strong> — ${count} (${pct}%)</li>`;
            })
            .join("")}</ol>`
        : "";

    const textAnswers = rows
        .filter(row => row.text_response && String(row.text_response).trim())
        .map(row => `<li>${escapeHtml(row.text_response)}</li>`)
        .join("");

    const textCount = rows.filter(
        row => row.text_response && String(row.text_response).trim()
    ).length;

    const textBlock = textAnswers
        ? `<div class="omrostning-text-answers">
            <strong>Fritextsvar (${textCount})</strong>
            <ul>${textAnswers}</ul>
        </div>`
        : "";

    container.innerHTML = `
        <strong>Resultat</strong> — ${rows.length} svar totalt
        ${optionStats}
        ${textBlock}
    `;
}

function setAdminTab(tab) {
    adminTab = tab;

    document
        .querySelectorAll("[data-admin-tab]")
        .forEach(button => {
            const active = button.dataset.adminTab === tab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });

    document
        .getElementById("omrostning-admin-compose")
        ?.toggleAttribute("hidden", tab !== "compose");

    document
        .getElementById("omrostning-admin-manage")
        ?.toggleAttribute("hidden", tab !== "manage");

    if (tab === "manage") {
        loadAdminPolls();
    }
}

function setupAdminUi() {
    document
        .getElementById("omrostning-add-option")
        ?.addEventListener("click", () => addOptionInput(""));

    document
        .getElementById("omrostning-reset-form")
        ?.addEventListener("click", resetAdminForm);

    document
        .getElementById("omrostning-admin-form")
        ?.addEventListener("submit", event => {
            event.preventDefault();
            savePoll("draft");
        });

    document
        .getElementById("omrostning-go-live")
        ?.addEventListener("click", () => {
            savePoll("live");
        });

    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.addEventListener("click", () => {
            setAdminTab(button.dataset.adminTab);
        });
    });
}

async function refreshAll() {
    await loadLivePolls();

    if (isAdmin && adminTab === "manage") {
        await loadAdminPolls();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!supabaseClient) {
        setStatus("Supabase-klienten kunde inte startas.", true);
        return;
    }

    setupAdminUi();
    resetAdminForm();

    document
        .getElementById("omrostning-refresh")
        ?.addEventListener("click", refreshAll);

    await loadParticipant();
    await loadLivePolls();

    if (isAdmin) {
        await loadAdminPolls();
    }
});
