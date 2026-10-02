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
    document.getElementById("stat-name").textContent = participant.name;
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

  function nightStatusLabel() {
    if (!night) return "Ingen kväll";
    if (night.status === "signup_open") return "Anmälan öppen";
    if (night.status === "closed") return "Live-schema";
    return "Förbereds";
  }

  function findUpcoming() {
    const now = Date.now();
    return (
      slots.find((s) => {
        const start = new Date(s.starts_at).getTime();
        const end = start + (Number(s.duration_minutes) || 15) * 60 * 1000;
        return end >= now;
      }) || null
    );
  }

  function renderUpcoming() {
    const upcoming = findUpcoming();
    const nameEl = document.getElementById("upcoming-name");
    const metaEl = document.getElementById("upcoming-meta");
    const labelEl = document.getElementById("upcoming-label");

    if (!upcoming) {
      labelEl.textContent = "Kvällen";
      nameEl.textContent = slots.length ? "Alla poster är klara" : "Inget schema ännu";
      metaEl.innerHTML = "";
      return;
    }

    const start = new Date(upcoming.starts_at).getTime();
    const now = Date.now();
    const isLive =
      now >= start &&
      now < start + (Number(upcoming.duration_minutes) || 15) * 60 * 1000;

    labelEl.textContent = isLive ? "Nu" : "Härnäst";
    nameEl.textContent = upcoming.name;
    metaEl.innerHTML = `
      <span>${window.aufgussEscapeHtml(window.aufgussFormatTime(upcoming.starts_at))}</span>
      <span>${window.aufgussEscapeHtml(upcoming.place_name)}</span>
      <span>${window.aufgussEscapeHtml(upcoming.aufgussmeister || "—")}</span>
      <span class="intensity" title="Intensitet">${window.aufgussIntensityLabel(upcoming.intensity)}</span>
    `;
  }

  function renderList() {
    const list = document.getElementById("slot-list");
    const heading = document.getElementById("list-heading");
    const signupOpen = night?.status === "signup_open";
    const closed = night?.status === "closed";

    heading.textContent = signupOpen ? "Anmäl dig" : "Kvällens schema";

    if (!slots.length) {
      list.innerHTML = `<div class="empty-state">Inga poster publicerade ännu.</div>`;
      return;
    }

    const upcoming = findUpcoming();
    const now = Date.now();

    list.innerHTML = slots
      .map((slot, index) => {
        const start = new Date(slot.starts_at).getTime();
        const end = start + (Number(slot.duration_minutes) || 15) * 60 * 1000;
        const isPast = end < now;
        const isMine = mySignupSlotIds.has(slot.id);
        const isNext = upcoming && upcoming.id === slot.id;
        const full = Number(slot.places_left) <= 0;
        const classes = [
          "slot-card",
          isMine ? "is-mine" : "",
          isNext ? "is-next" : "",
          isPast && closed ? "is-past" : ""
        ]
          .filter(Boolean)
          .join(" ");

        let actionHtml = "";
        if (signupOpen) {
          if (isMine) {
            actionHtml = `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel" data-slot-id="${slot.id}">Avanmäl</button>`;
          } else if (full) {
            actionHtml = `<span class="capacity">Fullt</span>`;
          } else {
            actionHtml = `<button type="button" class="btn btn-sm" data-action="signup" data-slot-id="${slot.id}">Anmäl dig</button>`;
          }
        } else if (isMine) {
          actionHtml = `<span class="badge is-open">Din plats</span>`;
        }

        return `
          <article class="${classes}" style="animation-delay:${Math.min(index, 8) * 0.04}s">
            <div class="slot-time">${window.aufgussEscapeHtml(window.aufgussFormatTime(slot.starts_at))}</div>
            <div class="slot-main">
              <h3>${window.aufgussEscapeHtml(slot.name)}</h3>
              <p>
                ${window.aufgussEscapeHtml(slot.place_name)}
                · ${window.aufgussEscapeHtml(slot.aufgussmeister || "—")}
                · ${window.aufgussEscapeHtml(slot.bastuolja || "—")}
                · <span class="intensity">${window.aufgussIntensityLabel(slot.intensity)}</span>
              </p>
            </div>
            <div class="slot-actions">
              <div class="capacity">${slot.signup_count}/${slot.place_capacity}</div>
              ${actionHtml}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderChrome() {
    const title = night?.title || "Aufguss";
    document.getElementById("page-title").textContent = title;
    document.getElementById("stat-bookings").textContent = String(mySignupSlotIds.size);
    document.getElementById("stat-status").textContent = nightStatusLabel();

    const badge = document.getElementById("mode-badge");
    badge.classList.remove("is-open", "is-closed");
    if (night?.status === "signup_open") {
      badge.textContent = "Anmälan öppen";
      badge.classList.add("is-open");
      document.getElementById("page-intro").textContent =
        "Välj vilka poster du vill vara med på. Platserna är begränsade per bastu.";
    } else if (night?.status === "closed") {
      badge.textContent = "Live-schema";
      badge.classList.add("is-closed");
      document.getElementById("page-intro").textContent =
        "Anmälan är stängd. Följ schemats nästa post och var du ska vara.";
    } else {
      badge.textContent = "Förbereds";
      document.getElementById("page-intro").textContent =
        "Schemat är inte öppet för anmälan ännu.";
    }
  }

  function renderAll() {
    renderChrome();
    renderUpcoming();
    renderList();
  }

  async function refresh() {
    await loadNight();
    await loadSlots();
    renderAll();
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

  document.getElementById("slot-list")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
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

  document.getElementById("btn-refresh")?.addEventListener("click", async () => {
    try {
      await refresh();
      setMsg("Uppdaterat.", "ok");
    } catch (error) {
      setMsg(window.aufgussFormatError(error, "Uppdatering misslyckades."), "error");
    }
  });

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        await refresh();
      } catch (_) {
        // keep quiet on background poll failures
      }
    }, cfg.POLL_MS);
  }

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
      await refresh();
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
