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
    document.getElementById("view-schema").hidden = view !== "schema";
    document.getElementById("view-signups").hidden = view !== "signups";
    document.getElementById("view-settings").hidden = view !== "settings";
    btnAddSlot.hidden = view !== "schema";

    document.querySelectorAll(".admin-tab").forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (view === "signups") renderSignups();
  }

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  function formatTimeHHMM(iso) {
    return window.aufgussFormatTime(iso);
  }

  function formatClosesAtForInput(value) {
    return window.aufgussFormatTimeInputValue(value, "17:00");
  }

  function getSelectedSignupControl() {
    return (
      document.querySelector('input[name="signup-control"]:checked')?.value ||
      "scheduled"
    );
  }

  function setSelectedSignupControl(control) {
    const value = control || "scheduled";
    const input = document.querySelector(`input[name="signup-control"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function controlToStatus(control) {
    if (control === "setup") return "setup";
    if (control === "force_closed") return "closed";
    return "signup_open";
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
          signup_control: "scheduled",
          signup_closes_at: "17:00"
        })
        .select("*")
        .single();
      if (createError) throw createError;
      night = created;
    }

    const closesEl = document.getElementById("signup-closes-at");
    if (closesEl) closesEl.value = formatClosesAtForInput(night.signup_closes_at);
    setSelectedSignupControl(window.aufgussResolveSignupControl(night));
    updateNightBadge();
  }

  function updateNightBadge() {
    const badge = document.getElementById("night-badge");
    if (!badge || !night) return;
    badge.classList.remove("is-open", "is-closed");

    const control = window.aufgussResolveSignupControl(night);
    const effective = window.aufgussEffectiveNightStatus(night);
    if (effective === "signup_open") {
      badge.textContent =
        control === "force_open" ? "Manuellt öppen" : "Anmälan öppen";
      badge.classList.add("is-open");
    } else if (effective === "closed") {
      badge.textContent =
        control === "force_closed" ? "Manuellt stängd" : "Stängd · live";
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
    renderSignups();
  }

  function buildParticipants() {
    const byParticipant = new Map();
    const slotById = new Map(slots.map((s) => [s.id, s]));

    for (const [slotId, people] of signupsBySlot.entries()) {
      const slot = slotById.get(slotId);
      for (const person of people) {
        const key = person.participant_id || `name:${person.participant_name}`;
        if (!byParticipant.has(key)) {
          byParticipant.set(key, {
            id: person.participant_id || "",
            name: person.participant_name || "Okänd",
            slots: []
          });
        }
        const entry = byParticipant.get(key);
        if (person.participant_name && entry.name === "Okänd") {
          entry.name = person.participant_name;
        }
        if (slot) {
          entry.slots.push({
            id: slot.id,
            name: slot.name,
            starts_at: slot.starts_at,
            place_name: slot.place_name,
            duration_minutes: slot.duration_minutes
          });
        }
      }
    }

    return Array.from(byParticipant.values())
      .map((p) => {
        p.slots.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
        return p;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }

  function renderSignups() {
    const list = document.getElementById("signups-list");
    const summary = document.getElementById("signups-summary");
    if (!list) return;

    const participants = buildParticipants();
    const totalSignups = participants.reduce((n, p) => n + p.slots.length, 0);

    if (summary) {
      summary.textContent = participants.length
        ? `${participants.length} personer · ${totalSignups} anmälningar`
        : "Inga anmälda ännu";
    }

    if (!participants.length) {
      list.innerHTML = `<div class="empty-state">Ingen har anmält sig via länken ännu.</div>`;
      return;
    }

    list.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-signups-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>Poster</th>
              <th>Antal</th>
            </tr>
          </thead>
          <tbody>
            ${participants
              .map((person) => {
                const sessions = person.slots
                  .map(
                    (slot) =>
                      `${formatTimeHHMM(slot.starts_at)} ${slot.name}`
                  )
                  .join(" · ");
                return `
                  <tr class="admin-signup-row">
                    <td class="admin-signup-name">${window.aufgussEscapeHtml(person.name)}</td>
                    <td class="admin-signup-sessions" title="${window.aufgussEscapeHtml(sessions)}">${window.aufgussEscapeHtml(sessions)}</td>
                    <td class="admin-signup-count">${person.slots.length}</td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderOffsetBar(offset) {
    return `
      <tr class="admin-offset-row" data-offset-id="${offset.id}">
        <td colspan="7">
          <div class="admin-offset-bar">
            <span>Fördröjning ${offset.minutes} min</span>
            <button type="button" class="admin-offset-remove" data-action="remove-offset" aria-label="Ta bort fördröjning">×</button>
          </div>
        </td>
      </tr>`;
  }

  function renderGap(afterSlotId) {
    return `
      <tr class="admin-gap-row" data-after-slot-id="${afterSlotId}">
        <td colspan="7">
          <div class="admin-schedule-gap">
            <button
              type="button"
              class="admin-gap-hit"
              data-action="open-offset"
              aria-expanded="false"
              aria-label="Lägg till fördröjning"
            ></button>
            <div class="admin-gap-menu" hidden>
              <span class="admin-gap-menu-title">Lägg till fördröjning</span>
              <button type="button" class="admin-gap-preset" data-action="pick-offset" data-minutes="5">+5 min</button>
              <button type="button" class="admin-gap-preset" data-action="pick-offset" data-minutes="10">+10 min</button>
              <button type="button" class="admin-gap-preset" data-action="pick-offset" data-minutes="15">+15 min</button>
              <button type="button" class="admin-gap-preset" data-action="pick-offset" data-minutes="30">+30 min</button>
              <form class="admin-gap-custom">
                <label class="sr-only" for="offset-custom-${afterSlotId}">Egen (minuter)</label>
                <input id="offset-custom-${afterSlotId}" type="number" name="minutes" placeholder="Egen" step="1" min="-180" max="180" required>
                <span class="muted">min</span>
                <button type="submit" class="btn btn-sm">OK</button>
              </form>
              <button type="button" class="admin-gap-cancel" data-action="cancel-offset">Avbryt</button>
            </div>
          </div>
        </td>
      </tr>`;
  }

  async function applyOffset(afterSlotId, minutes) {
    const statusEl = document.getElementById("slots-status");
    if (!night) return;
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
      setMsg(statusEl, window.aufgussFormatError(insertError, "Kunde inte spara fördröjning."), "error");
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

    setMsg(statusEl, `Fördröjning ${minutes} min tillagd.`, "ok");
    await loadSlots();
  }

  function formatTimeInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function combineDateWithTime(baseIso, timeHHMM) {
    const match = String(timeHHMM || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const base = baseIso ? new Date(baseIso) : new Date();
    if (Number.isNaN(base.getTime())) return null;
    base.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return base.toISOString();
  }

  function renderSlotRow(slot) {
    const meister = slot.aufgussmeister || "—";
    return `
      <tr class="admin-slot-row" data-slot-id="${slot.id}">
        <td class="admin-slot-time">${window.aufgussEscapeHtml(formatTimeHHMM(slot.starts_at))}</td>
        <td class="admin-slot-name">${window.aufgussEscapeHtml(slot.name)}</td>
        <td class="admin-slot-meister">${window.aufgussEscapeHtml(meister)}</td>
        <td>${window.aufgussEscapeHtml(slot.place_name || "—")}</td>
        <td class="admin-slot-num">${slot.duration_minutes} min</td>
        <td class="admin-slot-num">${slot.signup_count}/${slot.place_capacity}</td>
        <td class="admin-slot-actions">
          <button type="button" class="admin-slot-edit" data-action="edit-slot" aria-label="Redigera ${window.aufgussEscapeHtml(slot.name)}">
            Redigera
          </button>
        </td>
      </tr>`;
  }

  function fillEditPlaceSelect(selectedId) {
    const select = document.getElementById("edit-place");
    if (!select) return;
    select.innerHTML = placeOptions(selectedId);
  }

  function openEditModal(slotId) {
    const slot = slots.find((s) => s.id === slotId);
    const modal = document.getElementById("edit-slot-modal");
    if (!slot || !modal) return;

    editingSlotId = slotId;
    const people = signupsBySlot.get(slot.id) || [];

    document.getElementById("edit-slot-id").value = slot.id;
    document.getElementById("edit-base-starts").value = slot.starts_at || "";
    document.getElementById("edit-starts-time").value = formatTimeInput(slot.starts_at);
    document.getElementById("edit-name").value = slot.name || "";
    document.getElementById("edit-meister").value = slot.aufgussmeister || "";
    document.getElementById("edit-duration").value = String(slot.duration_minutes || 15);
    document.getElementById("edit-oil").value = slot.bastuolja || "";
    document.getElementById("edit-intensity").value = String(slot.intensity || 3);
    fillEditPlaceSelect(slot.place_id);

    document.getElementById("edit-signup-count").textContent = `${people.length} anmälda`;
    document.getElementById("edit-signup-list").innerHTML = people.length
      ? people
          .map((p) => `<li>${window.aufgussEscapeHtml(p.participant_name)}</li>`)
          .join("")
      : `<li class="muted" style="background:transparent;border:0;padding:0">Inga anmälda</li>`;

    setMsg(document.getElementById("edit-status"), "");
    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
    document.getElementById("edit-name")?.focus();
  }

  function closeEditModal() {
    const modal = document.getElementById("edit-slot-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
    editingSlotId = null;
    setMsg(document.getElementById("edit-status"), "");
  }

  function editFormPayload() {
    const baseStarts = document.getElementById("edit-base-starts").value || null;
    const timeRaw = document.getElementById("edit-starts-time").value;
    return {
      name: (document.getElementById("edit-name").value || "").trim(),
      place_id: document.getElementById("edit-place").value,
      starts_at: combineDateWithTime(baseStarts, timeRaw),
      duration_minutes: Number(document.getElementById("edit-duration").value) || 15,
      bastuolja: (document.getElementById("edit-oil").value || "").trim(),
      aufgussmeister: (document.getElementById("edit-meister").value || "").trim(),
      intensity: Number(document.getElementById("edit-intensity").value) || 3
    };
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

    scheduleList.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-schedule-table">
          <thead>
            <tr>
              <th>Tid</th>
              <th>Titel</th>
              <th>Aufgussmästare</th>
              <th>Plats</th>
              <th>Min</th>
              <th>Anmälda</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${parts.join("")}
          </tbody>
        </table>
      </div>`;
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
    input.value = formatTimeInput(base.toISOString());
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
    const baseForDate = slots.length
      ? slots[slots.length - 1].starts_at
      : night.night_date
        ? `${night.night_date}T19:00:00`
        : new Date().toISOString();
    const payload = {
      night_id: night.id,
      name: document.getElementById("new-name").value.trim(),
      place_id: document.getElementById("new-place").value,
      starts_at: combineDateWithTime(baseForDate, startsRaw),
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
      const slotId = row?.dataset.slotId;
      if (slotId) openEditModal(slotId);
      return;
    }

    if (btn.dataset.action === "open-offset") {
      const gap = btn.closest(".admin-schedule-gap");
      if (!gap) return;
      document.querySelectorAll(".admin-schedule-gap.is-open").forEach((el) => {
        if (el === gap) return;
        el.classList.remove("is-open");
        el.querySelector(".admin-gap-menu")?.setAttribute("hidden", "");
        el.querySelector(".admin-gap-hit")?.setAttribute("aria-expanded", "false");
      });
      gap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      gap.querySelector(".admin-gap-menu")?.removeAttribute("hidden");
      return;
    }

    if (btn.dataset.action === "cancel-offset") {
      const gap = btn.closest(".admin-schedule-gap");
      if (!gap) return;
      gap.classList.remove("is-open");
      gap.querySelector(".admin-gap-menu")?.setAttribute("hidden", "");
      gap.querySelector(".admin-gap-hit")?.setAttribute("aria-expanded", "false");
      return;
    }

    if (btn.dataset.action === "pick-offset") {
      const gapRow = btn.closest(".admin-gap-row");
      const afterSlotId = gapRow?.dataset.afterSlotId;
      const minutes = Number(btn.dataset.minutes);
      await applyOffset(afterSlotId, minutes);
      return;
    }

    if (btn.dataset.action === "remove-offset") {
      const bar = btn.closest("[data-offset-id]");
      const offsetId = bar?.dataset.offsetId;
      const offset = offsets.find((o) => o.id === offsetId);
      if (!offset || !night) return;
      if (!confirm(`Ta bort fördröjning ${offset.minutes} min? Tiderna efteråt justeras tillbaka.`)) {
        return;
      }

      const { error: rpcError } = await supabase.rpc("aufguss_offset_after_slot", {
        p_night_id: night.id,
        p_after_slot_id: offset.after_slot_id,
        p_minutes: -Number(offset.minutes)
      });
      if (rpcError) {
        setMsg(statusEl, window.aufgussFormatError(rpcError, "Kunde inte ångra fördröjning."), "error");
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

      setMsg(statusEl, "Fördröjning borttagen.", "ok");
      await loadSlots();
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".admin-schedule-gap.is-open")) return;
    document.querySelectorAll(".admin-schedule-gap.is-open").forEach((gap) => {
      gap.classList.remove("is-open");
      gap.querySelector(".admin-gap-menu")?.setAttribute("hidden", "");
      gap.querySelector(".admin-gap-hit")?.setAttribute("aria-expanded", "false");
    });
  });


  document.getElementById("edit-slot-modal")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn?.dataset.action === "close-edit-modal") {
      closeEditModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("edit-slot-modal");
    if (modal && !modal.hidden) closeEditModal();
  });

  document.getElementById("edit-slot-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("edit-status");
    const slotId = document.getElementById("edit-slot-id").value;
    if (!slotId) return;

    const payload = editFormPayload();
    if (!payload.name || !payload.starts_at || !payload.place_id) {
      setMsg(statusEl, "Namn, plats och tid krävs.", "error");
      return;
    }

    const { error } = await supabase.from("aufguss_slots").update(payload).eq("id", slotId);
    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara."), "error");
      return;
    }

    closeEditModal();
    setMsg(document.getElementById("slots-status"), "Post sparad.", "ok");
    await loadSlots();
  });

  document.getElementById("btn-delete-slot")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("edit-status");
    const slotId = document.getElementById("edit-slot-id").value;
    if (!slotId) return;
    if (!confirm("Ta bort denna post?")) return;

    const { error } = await supabase.from("aufguss_slots").delete().eq("id", slotId);
    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte ta bort."), "error");
      return;
    }

    closeEditModal();
    setMsg(document.getElementById("slots-status"), "Post borttagen.", "ok");
    await loadSlots();
  });

  scheduleList?.addEventListener("submit", async (e) => {
    const gapForm = e.target.closest(".admin-gap-custom");
    if (gapForm) {
      e.preventDefault();
      const gapRow = gapForm.closest(".admin-gap-row");
      const afterSlotId = gapRow?.dataset.afterSlotId;
      const minutes = Number(gapForm.querySelector('input[name="minutes"]')?.value);
      await applyOffset(afterSlotId, minutes);
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

    const closesRaw = formatClosesAtForInput(
      document.getElementById("signup-closes-at").value
    );
    const control = getSelectedSignupControl();
    const payload = {
      status: controlToStatus(control),
      signup_control: control,
      signup_closes_at: closesRaw
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
