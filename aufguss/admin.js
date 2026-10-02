// Aufguss admin CMS — Schema / Inställningar with inline offsets

(() => {
  const cfg = window.AUFGUSS_CONFIG;
  const supabase = window.aufgussCreateClient();

  let night = null;
  let places = [];
  let slots = [];
  let offsets = [];
  let signupsBySlot = new Map();
  let editingSlotId = null;
  let currentView = "schema";

  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("login-status");
  const scheduleList = document.getElementById("schedule-list");
  const addPanel = document.getElementById("add-slot-panel");
  const btnAddSlot = document.getElementById("btn-add-slot");

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-ok", kind === "ok");
  }

  function isAuthed() {
    return sessionStorage.getItem(cfg.ADMIN_SESSION_KEY) === "1";
  }

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    setView("schema");
    bootstrap();
  }

  function showLogin() {
    loginView.hidden = false;
    appView.hidden = true;
  }

  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = document.getElementById("admin-password")?.value || "";
    if (value === cfg.ADMIN_PASSWORD) {
      sessionStorage.setItem(cfg.ADMIN_SESSION_KEY, "1");
      showApp();
      return;
    }
    setMsg(loginStatus, "Fel lösenord.", "error");
  });

  function setView(view) {
    currentView = view;
    const isSchema = view === "schema";
    document.getElementById("view-schema").hidden = !isSchema;
    document.getElementById("view-settings").hidden = isSchema;
    btnAddSlot.hidden = !isSchema;

    document.querySelectorAll(".admin-tab").forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  function formatTimeHHMM(iso) {
    return window.aufgussFormatTime(iso);
  }

  function formatClosesAtForInput(value) {
    if (!value) return "17:00";
    // Postgres time may arrive as "17:00:00" or "17:00:00.000000"
    const match = String(value).match(/^(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    return "17:00";
  }

  function fillPlaceSelects() {
    const select = document.getElementById("new-place");
    if (select) {
      select.innerHTML = places
        .map(
          (p) =>
            `<option value="${p.id}">${window.aufgussEscapeHtml(p.name)} (${p.capacity})</option>`
        )
        .join("");
    }
  }

  function placeOptions(selectedId) {
    return places
      .map((p) => {
        const selected = p.id === selectedId ? " selected" : "";
        return `<option value="${p.id}"${selected}>${window.aufgussEscapeHtml(p.name)}</option>`;
      })
      .join("");
  }

  function offsetAfterSlot(slotId) {
    return offsets.find((o) => o.after_slot_id === slotId) || null;
  }

  async function loadPlaces() {
    const { data, error } = await supabase
      .from("aufguss_places")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    places = data || [];
    fillPlaceSelects();
    renderPlaces();
  }

  function renderPlaces() {
    const list = document.getElementById("places-list");
    if (!list) return;

    if (!places.length) {
      list.innerHTML = `<li class="muted">Inga bastus.</li>`;
      return;
    }

    list.innerHTML = places
      .map(
        (p) => `
        <li class="admin-place-row" data-place-id="${p.id}">
          <span class="admin-place-name">${window.aufgussEscapeHtml(p.name)}</span>
          <div class="admin-place-capacity">
            <input type="number" min="1" data-field="capacity" value="${p.capacity}" aria-label="Kapacitet ${window.aufgussEscapeHtml(p.name)}">
            <span class="muted">person</span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="save-place">Spara</button>
          </div>
        </li>`
      )
      .join("");
  }

  async function loadNight() {
    const { data, error } = await supabase
      .from("aufguss_nights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    night = data?.[0] || null;

    if (!night) {
      const { data: created, error: createError } = await supabase
        .from("aufguss_nights")
        .insert({
          title: "SaunaFestival 2026 — Aufguss",
          night_date: new Date().toISOString().slice(0, 10),
          status: "signup_open",
          signup_closes_at: "17:00"
        })
        .select("*")
        .single();
      if (createError) throw createError;
      night = created;
    }

    const statusEl = document.getElementById("night-status");
    const closesEl = document.getElementById("signup-closes-at");
    if (statusEl) statusEl.value = night.status || "signup_open";
    if (closesEl) closesEl.value = formatClosesAtForInput(night.signup_closes_at);
    updateNightBadge();
  }

  function updateNightBadge() {
    const badge = document.getElementById("night-badge");
    if (!badge || !night) return;
    badge.classList.remove("is-open", "is-closed");

    const effective = window.aufgussEffectiveNightStatus(night);
    if (effective === "signup_open") {
      badge.textContent = "Anmälan öppen";
      badge.classList.add("is-open");
    } else if (effective === "closed") {
      badge.textContent = "Stängd · live";
      badge.classList.add("is-closed");
    } else {
      badge.textContent = "Setup";
    }
  }

  async function loadSlots() {
    if (!night) return;

    const { data, error } = await supabase
      .from("aufguss_slots_enriched")
      .select("*")
      .eq("night_id", night.id)
      .order("starts_at", { ascending: true });

    if (error) throw error;
    slots = data || [];

    const { data: offsetData, error: offsetError } = await supabase
      .from("aufguss_schedule_offsets")
      .select("*")
      .eq("night_id", night.id);

    if (offsetError) throw offsetError;
    offsets = offsetData || [];

    const slotIds = slots.map((s) => s.id);
    signupsBySlot = new Map();

    if (slotIds.length) {
      const { data: signups, error: signupError } = await supabase
        .from("aufguss_signups")
        .select("*")
        .in("slot_id", slotIds)
        .order("created_at", { ascending: true });

      if (signupError) throw signupError;
      for (const row of signups || []) {
        if (!signupsBySlot.has(row.slot_id)) {
          signupsBySlot.set(row.slot_id, []);
        }
        signupsBySlot.get(row.slot_id).push(row);
      }
    }

    renderSchedule();
  }

  function slotMetaText(slot) {
    const parts = [
      slot.place_name,
      `${slot.duration_minutes} min`,
      slot.bastuolja || null,
      slot.aufgussmeister || null,
      slot.intensity ? `Int. ${slot.intensity}` : null,
      `${slot.signup_count}/${slot.place_capacity}`
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function renderOffsetBar(offset) {
    return `
      <div class="admin-offset-bar" data-offset-id="${offset.id}">
        <span>Förskjutning ${offset.minutes} min</span>
        <button type="button" class="admin-offset-remove" data-action="remove-offset" aria-label="Ta bort förskjutning">×</button>
      </div>`;
  }

  function renderGap(afterSlotId) {
    return `
      <div class="admin-schedule-gap" data-after-slot-id="${afterSlotId}">
        <button type="button" class="admin-gap-add" data-action="add-offset">
          <span class="admin-gap-plus">+</span>
          Lägg till förskjutning
        </button>
        <form class="admin-gap-form" hidden>
          <label class="sr-only" for="offset-min-${afterSlotId}">Minuter</label>
          <input type="number" name="minutes" value="15" step="1" min="-180" max="180" required>
          <span class="muted">min</span>
          <button type="submit" class="btn btn-sm">Lägg till</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-offset">Avbryt</button>
        </form>
      </div>`;
  }

  function renderSlotRow(slot) {
    const editing = editingSlotId === slot.id;
    const people = signupsBySlot.get(slot.id) || [];
    const names = people
      .map((p) => `<li>${window.aufgussEscapeHtml(p.participant_name)}</li>`)
      .join("");
    const startsLocal = window.aufgussFormatDateTimeLocal(slot.starts_at);

    if (!editing) {
      return `
        <article class="admin-slot-row" data-slot-id="${slot.id}">
          <div class="admin-slot-summary">
            <div class="admin-slot-time">${window.aufgussEscapeHtml(formatTimeHHMM(slot.starts_at))}</div>
            <div class="admin-slot-main">
              <h3 class="admin-slot-name">${window.aufgussEscapeHtml(slot.name)}</h3>
              <p class="admin-slot-meta">${window.aufgussEscapeHtml(slotMetaText(slot))}</p>
            </div>
            <button type="button" class="admin-slot-edit" data-action="edit-slot" aria-label="Redigera ${window.aufgussEscapeHtml(slot.name)}">
              Redigera
            </button>
          </div>
        </article>`;
    }

    return `
      <article class="admin-slot-row is-editing" data-slot-id="${slot.id}">
        <form class="admin-slot-edit-form toolbar">
          <div class="field">
            <label>Start</label>
            <input type="datetime-local" data-field="starts_at" value="${startsLocal}" required>
          </div>
          <div class="field" style="min-width:160px;flex:1">
            <label>Namn</label>
            <input type="text" data-field="name" value="${window.aufgussEscapeHtml(slot.name)}" required>
          </div>
          <div class="field">
            <label>Plats</label>
            <select data-field="place_id">${placeOptions(slot.place_id)}</select>
          </div>
          <div class="field" style="min-width:90px">
            <label>Minuter</label>
            <input type="number" min="1" data-field="duration_minutes" value="${slot.duration_minutes}">
          </div>
          <div class="field" style="min-width:120px">
            <label>Bastuolja</label>
            <input type="text" data-field="bastuolja" value="${window.aufgussEscapeHtml(slot.bastuolja || "")}">
          </div>
          <div class="field" style="min-width:140px">
            <label>Meister</label>
            <input type="text" data-field="aufgussmeister" value="${window.aufgussEscapeHtml(slot.aufgussmeister || "")}">
          </div>
          <div class="field" style="min-width:90px">
            <label>Intensitet</label>
            <select data-field="intensity">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) =>
                    `<option value="${n}"${Number(slot.intensity) === n ? " selected" : ""}>${n}</option>`
                )
                .join("")}
            </select>
          </div>
          <button type="submit" class="btn btn-sm">Spara</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit">Avbryt</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete-slot">Ta bort</button>
        </form>
        <div class="admin-slot-signups">
          <div class="capacity">${people.length} anmälda</div>
          <ul class="signup-list">${names || "<li class='muted' style='background:transparent;border:0;padding:0'>—</li>"}</ul>
        </div>
      </article>`;
  }

  function renderSchedule() {
    if (!scheduleList) return;

    if (!slots.length) {
      scheduleList.innerHTML = `<div class="empty-state">Inga poster ännu. Tryck Lägg till för att skapa den första.</div>`;
      return;
    }

    const parts = [];
    for (const slot of slots) {
      parts.push(renderSlotRow(slot));
      const offset = offsetAfterSlot(slot.id);
      if (offset) {
        parts.push(renderOffsetBar(offset));
      } else {
        parts.push(renderGap(slot.id));
      }
    }

    scheduleList.innerHTML = parts.join("");
  }

  function rowPayload(root) {
    const get = (field) => root.querySelector(`[data-field="${field}"]`)?.value;
    const startsRaw = get("starts_at");
    return {
      name: (get("name") || "").trim(),
      place_id: get("place_id"),
      starts_at: startsRaw ? new Date(startsRaw).toISOString() : null,
      duration_minutes: Number(get("duration_minutes")) || 15,
      bastuolja: (get("bastuolja") || "").trim(),
      aufgussmeister: (get("aufgussmeister") || "").trim(),
      intensity: Number(get("intensity")) || 3
    };
  }

  function setDefaultStartTime() {
    const input = document.getElementById("new-starts");
    if (!input) return;
    const base = slots.length
      ? new Date(slots[slots.length - 1].starts_at)
      : new Date();
    if (slots.length) {
      base.setMinutes(base.getMinutes() + (Number(slots[slots.length - 1].duration_minutes) || 15));
    } else {
      base.setMinutes(0, 0, 0);
      if (base.getHours() < 18) base.setHours(19);
    }
    input.value = window.aufgussFormatDateTimeLocal(base.toISOString());
  }

  function openAddPanel() {
    addPanel.hidden = false;
    setDefaultStartTime();
    document.getElementById("new-name")?.focus();
  }

  function closeAddPanel() {
    addPanel.hidden = true;
    setMsg(document.getElementById("add-status"), "");
  }

  btnAddSlot?.addEventListener("click", () => {
    if (addPanel.hidden) openAddPanel();
    else closeAddPanel();
  });

  document.getElementById("btn-cancel-add")?.addEventListener("click", closeAddPanel);

  document.getElementById("add-slot-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("add-status");
    if (!night) return;

    const startsRaw = document.getElementById("new-starts").value;
    const payload = {
      night_id: night.id,
      name: document.getElementById("new-name").value.trim(),
      place_id: document.getElementById("new-place").value,
      starts_at: startsRaw ? new Date(startsRaw).toISOString() : null,
      duration_minutes: Number(document.getElementById("new-duration").value) || 15,
      bastuolja: document.getElementById("new-oil").value.trim(),
      aufgussmeister: document.getElementById("new-meister").value.trim(),
      intensity: Number(document.getElementById("new-intensity").value) || 3
    };

    if (!payload.name || !payload.place_id || !payload.starts_at) {
      setMsg(statusEl, "Fyll i namn, plats och starttid.", "error");
      return;
    }

    const { error } = await supabase.from("aufguss_slots").insert(payload);
    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte lägga till."), "error");
      return;
    }

    e.target.reset();
    document.getElementById("new-duration").value = "15";
    document.getElementById("new-intensity").value = "3";
    closeAddPanel();
    setMsg(document.getElementById("slots-status"), "Post tillagd.", "ok");
    await loadSlots();
  });

  scheduleList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const statusEl = document.getElementById("slots-status");

    if (btn.dataset.action === "edit-slot") {
      const row = btn.closest("[data-slot-id]");
      editingSlotId = row?.dataset.slotId || null;
      renderSchedule();
      return;
    }

    if (btn.dataset.action === "cancel-edit") {
      editingSlotId = null;
      renderSchedule();
      return;
    }

    if (btn.dataset.action === "delete-slot") {
      const row = btn.closest("[data-slot-id]");
      const slotId = row?.dataset.slotId;
      if (!slotId) return;
      if (!confirm("Ta bort denna post?")) return;
      const { error } = await supabase.from("aufguss_slots").delete().eq("id", slotId);
      if (error) {
        setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte ta bort."), "error");
        return;
      }
      editingSlotId = null;
      setMsg(statusEl, "Post borttagen.", "ok");
      await loadSlots();
      return;
    }

    if (btn.dataset.action === "add-offset") {
      const gap = btn.closest(".admin-schedule-gap");
      if (!gap) return;
      gap.querySelector(".admin-gap-add").hidden = true;
      gap.querySelector(".admin-gap-form").hidden = false;
      gap.querySelector('input[name="minutes"]')?.focus();
      return;
    }

    if (btn.dataset.action === "cancel-offset") {
      const gap = btn.closest(".admin-schedule-gap");
      if (!gap) return;
      gap.querySelector(".admin-gap-form").hidden = true;
      gap.querySelector(".admin-gap-add").hidden = false;
      return;
    }

    if (btn.dataset.action === "remove-offset") {
      const bar = btn.closest("[data-offset-id]");
      const offsetId = bar?.dataset.offsetId;
      const offset = offsets.find((o) => o.id === offsetId);
      if (!offset || !night) return;
      if (!confirm(`Ta bort förskjutning ${offset.minutes} min? Tiderna efteråt justeras tillbaka.`)) {
        return;
      }

      const { error: rpcError } = await supabase.rpc("aufguss_offset_after_slot", {
        p_night_id: night.id,
        p_after_slot_id: offset.after_slot_id,
        p_minutes: -Number(offset.minutes)
      });
      if (rpcError) {
        setMsg(statusEl, window.aufgussFormatError(rpcError, "Kunde inte ångra förskjutning."), "error");
        return;
      }

      const { error } = await supabase
        .from("aufguss_schedule_offsets")
        .delete()
        .eq("id", offset.id);
      if (error) {
        setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte ta bort markör."), "error");
        return;
      }

      setMsg(statusEl, "Förskjutning borttagen.", "ok");
      await loadSlots();
    }
  });

  scheduleList?.addEventListener("submit", async (e) => {
    const statusEl = document.getElementById("slots-status");

    const editForm = e.target.closest(".admin-slot-edit-form");
    if (editForm) {
      e.preventDefault();
      const row = editForm.closest("[data-slot-id]");
      const slotId = row?.dataset.slotId;
      if (!slotId) return;
      const payload = rowPayload(editForm);
      if (!payload.name || !payload.starts_at || !payload.place_id) {
        setMsg(statusEl, "Namn, plats och tid krävs.", "error");
        return;
      }
      const { error } = await supabase.from("aufguss_slots").update(payload).eq("id", slotId);
      if (error) {
        setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara."), "error");
        return;
      }
      editingSlotId = null;
      setMsg(statusEl, "Post sparad.", "ok");
      await loadSlots();
      return;
    }

    const gapForm = e.target.closest(".admin-gap-form");
    if (gapForm) {
      e.preventDefault();
      if (!night) return;
      const gap = gapForm.closest(".admin-schedule-gap");
      const afterSlotId = gap?.dataset.afterSlotId;
      const minutes = Number(gapForm.querySelector('input[name="minutes"]')?.value);
      if (!afterSlotId || !Number.isFinite(minutes) || minutes === 0) {
        setMsg(statusEl, "Ange hur många minuter (inte 0).", "error");
        return;
      }

      const { error: insertError } = await supabase.from("aufguss_schedule_offsets").insert({
        night_id: night.id,
        after_slot_id: afterSlotId,
        minutes
      });
      if (insertError) {
        setMsg(statusEl, window.aufgussFormatError(insertError, "Kunde inte spara förskjutning."), "error");
        return;
      }

      const { error: rpcError } = await supabase.rpc("aufguss_offset_after_slot", {
        p_night_id: night.id,
        p_after_slot_id: afterSlotId,
        p_minutes: minutes
      });
      if (rpcError) {
        await supabase
          .from("aufguss_schedule_offsets")
          .delete()
          .eq("night_id", night.id)
          .eq("after_slot_id", afterSlotId);
        setMsg(statusEl, window.aufgussFormatError(rpcError, "Kunde inte flytta tider."), "error");
        return;
      }

      setMsg(statusEl, `Förskjutning ${minutes} min tillagd.`, "ok");
      await loadSlots();
    }
  });

  document.getElementById("places-list")?.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="save-place"]');
    if (!btn) return;
    const row = btn.closest("[data-place-id]");
    const placeId = row?.dataset.placeId;
    const capacity = Number(row?.querySelector('[data-field="capacity"]')?.value);
    const statusEl = document.getElementById("places-status");
    if (!placeId || !Number.isFinite(capacity) || capacity < 1) {
      setMsg(statusEl, "Kapacitet måste vara minst 1.", "error");
      return;
    }

    const { error } = await supabase
      .from("aufguss_places")
      .update({ capacity })
      .eq("id", placeId);
    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara bastu."), "error");
      return;
    }

    setMsg(statusEl, "Bastu sparad.", "ok");
    await loadPlaces();
    await loadSlots();
  });

  document.getElementById("btn-save-settings")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("settings-status");
    if (!night) return;

    const closesRaw = document.getElementById("signup-closes-at").value;
    const payload = {
      status: document.getElementById("night-status").value,
      signup_closes_at: closesRaw || null
    };

    const { data, error } = await supabase
      .from("aufguss_nights")
      .update(payload)
      .eq("id", night.id)
      .select("*")
      .single();

    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara inställningar."), "error");
      return;
    }

    night = data;
    updateNightBadge();
    setMsg(statusEl, "Inställningar sparade.", "ok");
  });

  async function refreshAll() {
    await loadNight();
    await loadSlots();
    setDefaultStartTime();
  }

  function showLoadError(error) {
    const message = window.aufgussFormatError(error, "Kunde inte ladda data.");
    setMsg(document.getElementById("slots-status"), message, "error");
    setMsg(document.getElementById("settings-status"), message, "error");
    if (scheduleList) {
      scheduleList.innerHTML = `<div class="empty-state">${window.aufgussEscapeHtml(message)}</div>`;
    }
  }

  async function bootstrap() {
    if (!supabase) {
      showLoadError(new Error("Supabase kunde inte startas."));
      return;
    }

    try {
      await loadPlaces();
      await refreshAll();
    } catch (error) {
      showLoadError(error);
    }
  }

  if (isAuthed()) {
    showApp();
  } else {
    showLogin();
  }
})();
