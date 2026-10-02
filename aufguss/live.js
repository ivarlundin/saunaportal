// Aufguss participant view — signup + live schedule
// Entry: live.html?name=...&id=...  → stored in cookie; no logout UI.

(() => {
  const cfg = window.AUFGUSS_CONFIG;
  const supabase = window.aufgussCreateClient();

  const lockView = document.getElementById("lock-view");
  const appView = document.getElementById("app-view");

  let participant = null;
  let night = null;
  let slots = [];
  let mySignupSlotIds = new Set();
  let pollTimer = null;
  let refreshing = false;
  let lastViewKey = "";
  /** DEBUG: null = use night.status; otherwise force signup_open | closed */
  let debugStatusOverride = null;
  let showPastSlots = false;

  /**
   * DEBUG: pin "now" to a local HH:MM on today's date (null = real clock).
   * Set back to null before shipping.
   */
  const DEBUG_NOW_HHMM = "19:40";

  if (DEBUG_NOW_HHMM) {
    console.warn(
      `%c************************************************************\n` +
        `*  DEBUG CLOCK ACTIVE — now is pinned to ${DEBUG_NOW_HHMM} local  *\n` +
        `*  Set DEBUG_NOW_HHMM = null in live.js before shipping  *\n` +
        `************************************************************`,
      "color:#c00;font-weight:bold;font-size:14px"
    );
  }

  function nowMs() {
    if (!DEBUG_NOW_HHMM) return Date.now();
    const [hh, mm] = DEBUG_NOW_HHMM.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d.getTime();
  }

  function effectiveStatus() {
    return debugStatusOverride || night?.status || "draft";
  }

  function slotWindow(slot) {
    const start = new Date(slot.starts_at).getTime();
    const end = start + (Number(slot.duration_minutes) || 15) * 60 * 1000;
    return { start, end };
  }

  function mySlotsSorted() {
    return slots
      .filter((s) => mySignupSlotIds.has(s.id))
      .slice()
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  function partitionMySlots(mine, now) {
    const past = [];
    const upcoming = [];
    for (const slot of mine) {
      const { end } = slotWindow(slot);
      if (end < now) past.push(slot);
      else upcoming.push(slot);
    }
    const hero = upcoming[0] || null;
    const coming = upcoming.slice(1);
    return { past, hero, coming };
  }

  function setMsg(text, kind) {
    const el = document.getElementById("live-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-ok", kind === "ok");
  }

  function readUrlParticipant() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || "").trim();
    const name = (params.get("name") || "").trim();
    if (id && name) {
      return { id, name };
    }
    return null;
  }

  function resolveParticipant() {
    const fromUrl = readUrlParticipant();
    if (fromUrl) {
      window.aufgussWriteParticipantCookie(fromUrl.id, fromUrl.name);
      // Keep URL clean after cookie is set, but stay logged in via cookie.
      // Only strip query if we successfully wrote the cookie — user asked
      // that exit requires a new URL passthrough (no logout).
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
      return fromUrl;
    }
    return window.aufgussReadParticipantCookie();
  }

  function showLock() {
    lockView.hidden = false;
    appView.hidden = true;
  }

  function showApp() {
    lockView.hidden = true;
    appView.hidden = false;
    document.getElementById("who-ami").textContent = participant.name;
  }

  async function loadNight() {
    const { data, error } = await supabase
      .from("aufguss_nights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    night = data?.[0] || null;
  }

  async function loadSlots() {
    if (!night) {
      slots = [];
      mySignupSlotIds = new Set();
      return;
    }

    const { data, error } = await supabase
      .from("aufguss_slots_enriched")
      .select("*")
      .eq("night_id", night.id)
      .order("starts_at", { ascending: true });

    if (error) throw error;
    slots = data || [];

    const { data: mine, error: mineError } = await supabase
      .from("aufguss_signups")
      .select("slot_id")
      .eq("participant_id", participant.id);

    if (mineError) throw mineError;
    mySignupSlotIds = new Set((mine || []).map((r) => r.slot_id));
  }

  function findUpcoming() {
    const now = nowMs();
    return (
      slots.find((s) => {
        const start = new Date(s.starts_at).getTime();
        const end = start + (Number(s.duration_minutes) || 15) * 60 * 1000;
        return end >= now;
      }) || null
    );
  }

  function slotActionHtml(slot, signupOpen, full, isMine) {
    if (signupOpen) {
      if (isMine) {
        return `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel" data-slot-id="${slot.id}">Avanmäl</button>`;
      }
      if (full) return `<span class="capacity">Fullt</span>`;
      return `<button type="button" class="btn btn-sm" data-action="signup" data-slot-id="${slot.id}">Anmäl dig</button>`;
    }
    if (isMine) return `<span class="badge is-open">Din plats</span>`;
    return "";
  }

  function slotState(slot, upcoming, now, closed) {
    const start = new Date(slot.starts_at).getTime();
    const end = start + (Number(slot.duration_minutes) || 15) * 60 * 1000;
    const isPast = end < now;
    const isMine = mySignupSlotIds.has(slot.id);
    const isNext = upcoming && upcoming.id === slot.id;
    const full = Number(slot.places_left) <= 0;
    return {
      isPast,
      isMine,
      isNext,
      full,
      stateClass: [
        isMine ? "is-mine" : "",
        isNext ? "is-next" : "",
        isPast && closed ? "is-past" : ""
      ]
        .filter(Boolean)
        .join(" ")
    };
  }

  function renderSignupTile(slot, upcoming, now, closed, signupOpen) {
    const st = slotState(slot, upcoming, now, closed);
    const actionHtml = slotActionHtml(slot, signupOpen, st.full, st.isMine);
    const classes = ["slot-card", st.stateClass].filter(Boolean).join(" ");
    const esc = window.aufgussEscapeHtml;

    return `
      <article class="${classes}">
        <div class="slot-top">
          <div class="slot-time">${esc(window.aufgussFormatTime(slot.starts_at))}</div>
          <div class="capacity">${slot.signup_count}/${slot.place_capacity}</div>
        </div>
        <div class="slot-main">
          <h3>${esc(slot.name)}</h3>
          <p class="slot-meta">
            <span class="slot-place">${esc(slot.place_name)}</span>
            <span class="slot-meister">${esc(slot.aufgussmeister || "—")}</span>
            <span class="intensity">${window.aufgussIntensityLabel(slot.intensity)}</span>
          </p>
        </div>
        ${actionHtml ? `<div class="slot-actions">${actionHtml}</div>` : ""}
      </article>
    `;
  }

  function renderLiveHero(slot, now) {
    const esc = window.aufgussEscapeHtml;
    return `
      <article class="live-hero">
        <div class="live-hero-top">
          <div class="live-hero-time">${esc(window.aufgussFormatTime(slot.starts_at))}</div>
          <div class="capacity">${slot.signup_count}/${slot.place_capacity}</div>
        </div>
        <h3 class="live-hero-title">${esc(slot.name)}</h3>
        <p class="slot-meta">
          <span class="slot-place">${esc(slot.place_name)}</span>
          <span class="slot-meister">${esc(slot.aufgussmeister || "—")}</span>
          <span class="intensity">${window.aufgussIntensityLabel(slot.intensity)}</span>
        </p>
      </article>
    `;
  }

  function renderSlotRow(slot) {
    const esc = window.aufgussEscapeHtml;
    return `
      <div class="live-slot-row">
        <span class="live-slot-time">${esc(window.aufgussFormatTime(slot.starts_at))}</span>
        <span class="live-slot-name">${esc(slot.name)}</span>
        <span class="live-slot-place">${esc(slot.place_name)}</span>
      </div>
    `;
  }

  function setScheduleChrome(mode) {
    const panel = document.getElementById("schedule-panel");
    panel?.classList.toggle("panel--live-flat", mode === "live");
  }

  function renderLiveView(list) {
    const mine = mySlotsSorted();
    const now = nowMs();
    const { past, hero, coming } = partitionMySlots(mine, now);

    setScheduleChrome("live");

    if (!mine.length) {
      list.innerHTML = `<div class="empty-state">Du har inga anmälda poster ännu.</div>`;
      return;
    }

    let html = `<div class="live-run">`;

    if (hero) {
      const { start, end } = slotWindow(hero);
      const isLive = now >= start && now < end;
      html += `
        <section class="live-section">
          <div class="live-section-label">${isLive ? "Nu" : "Härnäst"}</div>
          ${renderLiveHero(hero, now)}
        </section>
      `;
    } else {
      html += `<div class="empty-state live-run-done">Alla dina poster är klara.</div>`;
    }

    if (coming.length) {
      html += `
        <section class="live-section">
          <div class="live-section-label">Kommer</div>
          <div class="live-slot-list">
            ${coming.map(renderSlotRow).join("")}
          </div>
        </section>
      `;
    }

    if (past.length) {
      html += `
        <details class="live-section live-past" id="live-past" ${showPastSlots ? "open" : ""}>
          <summary class="live-section-label live-past-summary">
            Passerade
            <span class="live-past-count">${past.length}</span>
          </summary>
          <div class="live-slot-list live-slot-list--past">
            ${past.map(renderSlotRow).join("")}
          </div>
        </details>
      `;
    }

    html += `</div>`;
    list.innerHTML = html;
  }

  function renderSignupView(list) {
    const signupOpen = true;
    const closed = false;
    setScheduleChrome("signup");

    if (!slots.length) {
      list.innerHTML = `<div class="empty-state">Inga poster publicerade ännu.</div>`;
      return;
    }

    const upcoming = findUpcoming();
    const now = nowMs();
    list.innerHTML = slots
      .map((slot) => renderSignupTile(slot, upcoming, now, closed, signupOpen))
      .join("");
  }

  function renderList() {
    const list = document.getElementById("slot-list");
    const status = effectiveStatus();

    if (status === "closed") {
      renderLiveView(list);
      return;
    }

    if (status === "signup_open") {
      renderSignupView(list);
      return;
    }

    setScheduleChrome("draft");
    if (!slots.length) {
      list.innerHTML = `<div class="empty-state">Inga poster publicerade ännu.</div>`;
      return;
    }

    const upcoming = findUpcoming();
    const now = nowMs();
    list.innerHTML = slots
      .map((slot) => renderSignupTile(slot, upcoming, now, false, false))
      .join("");
  }

  function renderChrome() {
    const badge = document.getElementById("mode-badge");
    const status = effectiveStatus();
    badge.classList.remove("is-open", "is-closed");
    badge.classList.add("is-toggle");

    document.getElementById("page-title").textContent = "Aufguss-schema";
    document.getElementById("page-intro").textContent =
      "Välj vilka poster du vill vara med på. Platserna är begränsade per bastu.";

    if (status === "signup_open") {
      badge.textContent = "Anmälan öppen";
      badge.classList.add("is-open");
    } else if (status === "closed") {
      badge.textContent = "Anmälan stängd";
      badge.classList.add("is-closed");
    } else {
      badge.textContent = "Förbereds";
    }
  }

  function renderAll() {
    renderChrome();
    renderList();
  }

  function viewKey() {
    const upcoming = findUpcoming();
    const minute = Math.floor(nowMs() / 60000);
    return JSON.stringify({
      minute,
      nightId: night?.id || null,
      nightStatus: night?.status || null,
      debugStatusOverride,
      showPastSlots,
      mine: [...mySignupSlotIds].sort(),
      upcomingId: upcoming?.id || null,
      slots: slots.map((s) => [
        s.id,
        s.starts_at,
        s.name,
        s.place_name,
        s.aufgussmeister,
        s.bastuolja,
        s.intensity,
        s.signup_count,
        s.place_capacity,
        s.places_left
      ])
    });
  }

  async function refresh({ force = false } = {}) {
    if (refreshing) return;
    refreshing = true;
    try {
      await loadNight();
      await loadSlots();
      const key = viewKey();
      if (!force && key === lastViewKey) return;
      lastViewKey = key;
      renderAll();
    } finally {
      refreshing = false;
    }
  }

  /**
   * Async signup — returns a result object so callers can handle
   * fully-booked / closed states without swallowing them.
   * @returns {Promise<{ok: true, signup?: object}|{ok: false, error: string, message: string}>}
   */
  async function signupForSlot(slotId) {
    if (!supabase || !participant) {
      return {
        ok: false,
        error: "not_ready",
        message: "Supabase eller deltagare saknas."
      };
    }

    const { data, error } = await supabase.rpc("aufguss_signup", {
      p_slot_id: slotId,
      p_participant_id: participant.id,
      p_participant_name: participant.name
    });

    if (error) {
      return {
        ok: false,
        error: "rpc_error",
        message: window.aufgussFormatError(error, "Kunde inte anmäla.")
      };
    }

    // New RPC returns jsonb { ok, error?, message?, signup? }
    if (data && typeof data === "object" && "ok" in data) {
      if (data.ok) {
        return { ok: true, signup: data.signup || null };
      }
      return {
        ok: false,
        error: data.error || "unknown",
        message: data.message || "Kunde inte anmäla."
      };
    }

    // Legacy RPC returned the signup row directly
    if (data && data.id) {
      return { ok: true, signup: data };
    }

    return {
      ok: false,
      error: "unknown",
      message: "Oväntat svar från servern."
    };
  }

  async function cancelSignup(slotId) {
    if (!supabase || !participant) {
      return { ok: false, error: "not_ready", message: "Supabase eller deltagare saknas." };
    }

    const { error } = await supabase.rpc("aufguss_cancel_signup", {
      p_slot_id: slotId,
      p_participant_id: participant.id
    });

    if (error) {
      return {
        ok: false,
        error: "rpc_error",
        message: window.aufgussFormatError(error, "Kunde inte avanmäla.")
      };
    }

    return { ok: true };
  }

  document.getElementById("app-view")?.addEventListener("toggle", (e) => {
    const past = e.target.closest?.("#live-past");
    if (!past || e.target !== past) return;
    showPastSlots = past.open;
  }, true);

  document.getElementById("app-view")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn || !document.getElementById("app-view")?.contains(btn)) return;
    // Only handle signup/cancel from slot actions
    if (!btn.dataset.slotId) return;
    const slotId = btn.dataset.slotId;
    const action = btn.dataset.action;

    btn.disabled = true;
    try {
      if (action === "signup") {
        const result = await signupForSlot(slotId);
        if (!result.ok) {
          setMsg(window.aufgussSignupErrorMessage(result), "error");
          // Refresh so "Fullt" / counts update after a race.
          await refresh();
          return;
        }
        setMsg("Du är anmäld.", "ok");
      }

      if (action === "cancel") {
        const result = await cancelSignup(slotId);
        if (!result.ok) {
          setMsg(result.message || "Kunde inte avanmäla.", "error");
          await refresh();
          return;
        }
        setMsg("Avanmäld.", "ok");
      }

      await refresh();
    } catch (error) {
      setMsg(window.aufgussFormatError(error, "Kunde inte uppdatera anmälan."), "error");
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("mode-badge")?.addEventListener("click", () => {
    // Toggle signup open <-> closed for local preview
    const current = effectiveStatus();
    debugStatusOverride = current === "signup_open" ? "closed" : "signup_open";
    showPastSlots = false;
    lastViewKey = "";
    renderAll();
  });

  document.getElementById("btn-refresh")?.addEventListener("click", async () => {
    try {
      await refresh({ force: true });
      setMsg("Uppdaterat.", "ok");
    } catch (error) {
      setMsg(window.aufgussFormatError(error, "Uppdatering misslyckades."), "error");
    }
  });

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (document.hidden) return;
      try {
        await refresh();
      } catch (_) {
        // keep quiet on background poll failures
      }
    }, cfg.POLL_MS || 30000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
      return;
    }
    refresh().catch(() => {});
    startPolling();
  });

  async function bootstrap() {
    participant = resolveParticipant();
    if (!participant) {
      showLock();
      return;
    }

    showApp();

    if (!supabase) {
      setMsg("Supabase kunde inte startas.", "error");
      const list = document.getElementById("slot-list");
      if (list) {
        list.innerHTML = `<div class="empty-state">Supabase kunde inte startas.</div>`;
      }
      return;
    }

    try {
      await refresh({ force: true });
      startPolling();
    } catch (error) {
      const message = window.aufgussFormatError(error, "Kunde inte ladda schemat.");
      setMsg(message, "error");
      const list = document.getElementById("slot-list");
      if (list) {
        list.innerHTML = `<div class="empty-state">${window.aufgussEscapeHtml(message)}</div>`;
      }
    }
  }

  bootstrap();
})();
