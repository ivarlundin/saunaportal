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
let adminTab = "create";

let slideshowConfig = null;
let slideshowTimer = null;
let slideshowIndex = 0;
let slideshowShowLayerA = true;

function formatOmrostningError(error, fallback) {
    const code = error?.code || "";
    const message = error?.message || "";

    if (code === "PGRST202" || /schema cache/i.test(message)) {
        return "Backend saknas — kör omrostning.sql i Supabase.";
    }

    if (/not forum admin/i.test(message)) {
        return "Endast forum-admin kan hantera omröstningar.";
    }

    return message || fallback;
}

function getVisibleLivePolls() {
    return livePolls.filter(poll => !myResponses.has(poll.id));
}

function updateEditingLabel() {
    const label = document.getElementById("omrostning-editing-label");
    const editId = document.getElementById("omrostning-edit-id")?.value;

    if (!label) {
        return;
    }

    if (!editId) {
        label.hidden = true;
        label.textContent = "";
        return;
    }

    const poll = adminPolls.find(row => row.id === editId);
    label.hidden = false;
    label.textContent = poll
        ? `Redigerar: ${poll.title}`
        : "Redigerar sparad omröstning";
}

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
    document.body.classList.toggle("omrostning-page--admin", isAdmin);
    document
        .getElementById("omrostning-admin")
        ?.toggleAttribute("hidden", !isAdmin);

    if (isAdmin) {
        document.getElementById("omrostning-intro").textContent =
            "Skapa utkast, publicera när det är dags, och följ resultaten. Deltagare ser live-omröstningar efter Uppdatera.";
    }

    syncParticipantPresentation();
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
        syncParticipantPresentation();
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
    syncParticipantPresentation();

    const visible = getVisibleLivePolls();

    const visible = getVisibleLivePolls();

    if (!livePolls.length) {
        setStatus("Inga aktiva omröstningar just nu.");
    } else if (!visible.length) {
        setStatus("Tack! Du har svarat på alla aktiva omröstningar.");
    } else {
        setStatus(
            `${visible.length} omröstning${visible.length === 1 ? "" : "ar"} väntar på ditt svar.`
        );
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

    const visiblePolls = getVisibleLivePolls();

    if (!visiblePolls.length) {
        list.innerHTML = "";
        return;
    }

    list.innerHTML = visiblePolls
        .map((poll, index) => renderLivePollCard(poll, index))
        .join("");

    list.querySelectorAll("[data-action='submit-vote']").forEach(button => {
        button.addEventListener("click", () => {
            submitVote(button.dataset.pollId);
        });
    });
}

function renderLivePollCard(poll, cardIndex = 0) {
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

    const delay = Math.min(cardIndex * 0.08, 0.32);

    return `<article class="omrostning-poll-card omrostning-poll-card--enter" data-poll-id="${poll.id}" style="animation-delay:${delay}s">
        <h2>${escapeHtml(poll.title)}</h2>
        ${optionsHtml}
        ${textHtml}
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
            formatOmrostningError(error, "Svaret kunde inte sparas."),
            true
        );
        return;
    }

    myResponses.set(pollId, {
        poll_id: pollId,
        option_index: optionIndex,
        text_response: textValue || null
    });

    setStatus("Tack! Ditt svar är registrerat.");
    renderLivePolls();
    syncParticipantPresentation();

    const visible = getVisibleLivePolls();
    if (!visible.length && livePolls.length) {
        setStatus("Tack! Du har svarat på alla aktiva omröstningar.");
    }
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
        const message = formatOmrostningError(
            error,
            "Kunde inte ladda adminlistan."
        );
        [
            "omrostning-admin-prepared-list",
            "omrostning-admin-active-list",
            "omrostning-admin-closed-list"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<p class="omrostning-empty">${escapeHtml(message)}</p>`;
            }
        });
        return;
    }

    adminPolls = data || [];
    renderAdminLists();
}

function renderAdminPollCard(poll) {
    const badgeClass =
        poll.status === "live"
            ? "is-live"
            : poll.status === "closed"
                ? "is-closed"
                : "is-draft";

    const optionPreview = getPollOptions(poll);
    const meta = optionPreview.length
        ? `${optionPreview.length} alternativ`
        : poll.allow_text_response
            ? "Endast fritext"
            : "Inga alternativ";

    return `<article class="omrostning-admin-item" data-poll-id="${poll.id}">
        <header>
            <div class="omrostning-admin-item-title">
                <h3>${escapeHtml(poll.title)}</h3>
                <small>${escapeHtml(meta)}</small>
            </div>
            <span class="omrostning-status-badge ${badgeClass}">${statusLabel(poll.status)}</span>
        </header>
        <div class="omrostning-admin-toolbar">
            ${poll.status === "draft"
                ? `<button type="button" class="secondary-button" data-admin-action="edit" data-poll-id="${poll.id}">Redigera</button>
                   <button type="button" class="primary-button" data-admin-action="live" data-poll-id="${poll.id}">Gå live</button>`
                : ""}
            ${poll.status === "live"
                ? `<button type="button" class="secondary-button" data-admin-action="close" data-poll-id="${poll.id}">Stäng</button>`
                : ""}
            <button type="button" class="secondary-button" data-admin-action="results" data-poll-id="${poll.id}">
                Resultat
            </button>
        </div>
        <div id="omrostning-results-${poll.id}" class="omrostning-results" hidden></div>
    </article>`;
}

function renderAdminListInto(containerId, polls, emptyMessage) {
    const list = document.getElementById(containerId);
    if (!list) {
        return;
    }

    if (!polls.length) {
        list.innerHTML = `<p class="omrostning-empty omrostning-empty-inline">${escapeHtml(emptyMessage)}</p>`;
        return;
    }

    list.innerHTML = polls.map(renderAdminPollCard).join("");
}

function bindAdminListActions(root) {
    root.querySelectorAll("[data-admin-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.adminAction;
            const pollId = button.dataset.pollId;

            if (action === "edit") {
                loadPollIntoForm(pollId);
                setAdminTab("create");
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

function updateAdminTabCounts() {
    const drafts = adminPolls.filter(poll => poll.status === "draft");
    const live = adminPolls.filter(poll => poll.status === "live");
    const closed = adminPolls.filter(poll => poll.status === "closed");

    const setCount = (id, count) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = count > 0 ? String(count) : "";
        }
    };

    setCount("omrostning-count-prepared", drafts.length);
    setCount("omrostning-count-active", live.length);
    setCount("omrostning-count-closed", closed.length);
}

function renderAdminLists() {
    const drafts = adminPolls.filter(poll => poll.status === "draft");
    const live = adminPolls.filter(poll => poll.status === "live");
    const closed = adminPolls.filter(poll => poll.status === "closed");

    updateAdminTabCounts();
    updateEditingLabel();

    renderAdminListInto(
        "omrostning-admin-prepared-list",
        drafts,
        "Inga förberedda utkast. Skapa en under Skapa ny."
    );

    renderAdminListInto(
        "omrostning-admin-active-list",
        live,
        "Ingen omröstning pågår just nu."
    );

    renderAdminListInto(
        "omrostning-admin-closed-list",
        closed,
        "Inga stängda omröstningar ännu."
    );

    [
        "omrostning-admin-prepared-list",
        "omrostning-admin-active-list",
        "omrostning-admin-closed-list"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            bindAdminListActions(el);
        }
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

    updateEditingLabel();
    document.getElementById("omrostning-admin-create")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAdminForm() {
    document.getElementById("omrostning-edit-id").value = "";
    document.getElementById("omrostning-title").value = "";
    document.getElementById("omrostning-allow-text").checked = false;

    const list = document.getElementById("omrostning-options-list");
    list.innerHTML = "";
    addOptionInput("");
    addOptionInput("");
    updateEditingLabel();
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
            formatOmrostningError(error, "Kunde inte spara."),
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
    updateEditingLabel();

    if (status === "live") {
        setAdminTab("active");
    } else {
        setAdminTab("prepared");
    }
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

    if (status === "live") {
        setAdminTab("active");
    } else if (status === "closed") {
        setAdminTab("prepared");
    }
}

function formatParticipantMeta(participant) {
    if (!participant) {
        return "Okänd deltagare";
    }

    const name = participant.name || "Deltagare";
    const alias = participant.alias
        ? `@${participant.alias}`
        : "";

    return alias ? `${name} · ${alias}` : name;
}

function formatResponseDate(iso) {
    if (!iso) {
        return "";
    }

    try {
        return new Intl.DateTimeFormat("sv-SE", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(new Date(iso));
    } catch (error) {
        return "";
    }
}

function getResponseDisplayText(row, options) {
    const parts = [];
    const idx = Number(row.option_index);

    if (
        Number.isFinite(idx) &&
        idx >= 0 &&
        idx < options.length
    ) {
        parts.push(options[idx]);
    }

    const text = row.text_response
        ? String(row.text_response).trim()
        : "";

    if (text) {
        parts.push(text);
    }

    if (!parts.length) {
        return "—";
    }

    return parts.join(" — ");
}

async function loadParticipantsById(ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    const map = new Map();

    if (!uniqueIds.length) {
        return map;
    }

    const { data, error } = await supabaseClient
        .from("festival2026_deltagare")
        .select("id, name, alias")
        .in("id", uniqueIds);

    if (error) {
        console.error("Could not load participants for results:", error);
        return map;
    }

    (data || []).forEach(row => {
        map.set(row.id, row);
    });

    return map;
}

function renderResponseFeedCards(rows, options, participantMap) {
    if (!rows.length) {
        return `<p class="omrostning-empty omrostning-empty-inline">Inga svar ännu.</p>`;
    }

    return `<div class="omrostning-response-feed">
        ${rows
            .map(row => {
                const answer = getResponseDisplayText(row, options);
                const meta = formatParticipantMeta(
                    participantMap.get(row.participant_id)
                );
                const when = formatResponseDate(row.created_at);
                const whenLine = when
                    ? `<span class="omrostning-response-when">${escapeHtml(when)}</span>`
                    : "";

                return `<article class="omrostning-response-card">
                    <p class="omrostning-response-answer">${escapeHtml(answer)}</p>
                    <p class="omrostning-response-meta">
                        <span class="omrostning-response-who">${escapeHtml(meta)}</span>
                        ${whenLine}
                    </p>
                </article>`;
            })
            .join("")}
    </div>`;
}

function renderOptionSummaryBars(options, counts, totalVotes) {
    if (!options.length) {
        return "";
    }

    return `<div class="omrostning-results-bars">
        <h4 class="omrostning-results-heading">Sammanfattning</h4>
        <ul class="omrostning-results-bar-list">
            ${options
                .map((label, index) => {
                    const count = counts[index];
                    const pct =
                        totalVotes > 0
                            ? Math.round((count / totalVotes) * 100)
                            : 0;

                    return `<li class="omrostning-results-bar-item">
                        <div class="omrostning-results-bar-label">
                            <span>${escapeHtml(label)}</span>
                            <strong>${count} (${pct}%)</strong>
                        </div>
                        <div class="omrostning-results-bar-track" aria-hidden="true">
                            <span class="omrostning-results-bar-fill" style="width:${pct}%"></span>
                        </div>
                    </li>`;
                })
                .join("")}
        </ul>
    </div>`;
}

async function showPollResults(pollId) {
    const container = document.getElementById(`omrostning-results-${pollId}`);
    if (!container) {
        return;
    }

    const wasOpen = !container.hidden && container.dataset.loaded === "1";

    if (wasOpen) {
        container.hidden = true;
        container.dataset.loaded = "0";
        return;
    }

    container.hidden = false;
    container.innerHTML = "<p class=\"omrostning-results-loading\">Laddar resultat…</p>";

    const poll = adminPolls.find(row => row.id === pollId);
    const options = getPollOptions(poll);

    const { data, error } = await supabaseClient
        .from(RESPONSE_TABLE)
        .select("option_index, text_response, participant_id, created_at")
        .eq("poll_id", pollId)
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML =
            "<p class=\"omrostning-empty omrostning-empty-inline\">Kunde inte ladda svar.</p>";
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
    const participantMap = await loadParticipantsById(
        rows.map(row => row.participant_id)
    );

    const summary = renderOptionSummaryBars(options, counts, totalVotes);
    const feed = renderResponseFeedCards(rows, options, participantMap);

    container.innerHTML = `
        <header class="omrostning-results-header">
            <h4 class="omrostning-results-heading">Svar</h4>
            <span class="omrostning-results-total">${rows.length} totalt</span>
        </header>
        ${summary}
        <section class="omrostning-results-feed-section" aria-label="Alla svar">
            <h4 class="omrostning-results-heading">Alla svar</h4>
            ${feed}
        </section>
    `;
    container.dataset.loaded = "1";
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
        .getElementById("omrostning-admin-create")
        ?.toggleAttribute("hidden", tab !== "create");

    document
        .getElementById("omrostning-admin-prepared")
        ?.toggleAttribute("hidden", tab !== "prepared");

    document
        .getElementById("omrostning-admin-active")
        ?.toggleAttribute("hidden", tab !== "active");

    if (tab === "prepared" || tab === "active") {
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

function shouldShowWaitingRoom() {
    if (isAdmin) {
        return false;
    }

    return getVisibleLivePolls().length === 0;
}

function syncParticipantPresentation() {
    const waiting = document.getElementById("omrostning-waiting");
    const liveSection = document.getElementById("omrostning-live");
    const participant = document.getElementById("omrostning-participant");
    const showWaiting = shouldShowWaitingRoom();
    const hasActivePolls =
        !isAdmin && getVisibleLivePolls().length > 0;

    waiting?.classList.toggle("is-hidden", !showWaiting);
    liveSection?.classList.toggle("has-active-polls", hasActivePolls);
    participant?.classList.toggle("has-active-polls", hasActivePolls);
    document.body.classList.toggle(
        "omrostning-page--has-polls",
        hasActivePolls
    );

    if (showWaiting) {
        startSlideshow();
    } else {
        stopSlideshow();
    }
}

function stopSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

function getSlideshowElements() {
    return {
        slideA: document.getElementById("omrostning-slide-a"),
        slideB: document.getElementById("omrostning-slide-b"),
        frame: document.getElementById("omrostning-slideshow")
    };
}

function setSlideOnImage(image, slide) {
    if (!image || !slide) {
        return;
    }

    image.src = slide.src;
    image.alt = slide.alt || "";
}

function advanceSlideshow() {
    if (!slideshowConfig?.slides?.length) {
        return;
    }

    const { slideA, slideB, frame } = getSlideshowElements();
    if (!slideA || !slideB) {
        return;
    }

    slideshowIndex =
        (slideshowIndex + 1) % slideshowConfig.slides.length;

    const nextSlide = slideshowConfig.slides[slideshowIndex];

    if (slideshowShowLayerA) {
        setSlideOnImage(slideB, nextSlide);
        slideB.classList.add("is-visible");
        slideA.classList.remove("is-visible");
    } else {
        setSlideOnImage(slideA, nextSlide);
        slideA.classList.add("is-visible");
        slideB.classList.remove("is-visible");
    }

    slideshowShowLayerA = !slideshowShowLayerA;

    if (frame && nextSlide?.alt) {
        frame.setAttribute("aria-label", nextSlide.alt);
    }
}

function startSlideshow() {
    if (isAdmin || !slideshowConfig?.slides?.length) {
        return;
    }

    const { slideA, slideB, frame } = getSlideshowElements();
    if (!slideA || !slideB) {
        return;
    }

    if (slideshowTimer) {
        return;
    }

    slideshowIndex = 0;
    slideshowShowLayerA = true;
    setSlideOnImage(slideA, slideshowConfig.slides[0]);
    slideA.classList.add("is-visible");
    slideB.classList.remove("is-visible");
    setSlideOnImage(slideB, slideshowConfig.slides[1] || slideshowConfig.slides[0]);

    if (frame && slideshowConfig.slides[0]?.alt) {
        frame.setAttribute("aria-label", slideshowConfig.slides[0].alt);
    }

    slideshowTimer = setInterval(
        advanceSlideshow,
        slideshowConfig.intervalMs || 6000
    );
}

async function initParticipantSlideshow() {
    try {
        const response = await fetch("omrostning-slideshow.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        slideshowConfig = await response.json();
        syncParticipantPresentation();
    } catch (error) {
        console.warn("Could not load omrostning slideshow:", error);
        document.getElementById("omrostning-waiting")?.classList.add("is-hidden");
    }
}

async function refreshAll() {
    await loadLivePolls();

    if (isAdmin && (adminTab === "prepared" || adminTab === "active")) {
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

    await initParticipantSlideshow();
    await loadParticipant();
    await loadLivePolls();

    if (isAdmin) {
        await loadAdminPolls();
    }
});
