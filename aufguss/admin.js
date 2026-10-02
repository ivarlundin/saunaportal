// Aufguss admin CMS — desktop schedule editor

(() => {
  const cfg = window.AUFGUSS_CONFIG;
  const supabase = window.aufgussCreateClient();

  let night = null;
  let places = [];
  let slots = [];
  let signupsBySlot = new Map();

  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("login-status");

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

  async function loadPlaces() {
    const { data, error } = await supabase
      .from("aufguss_places")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    places = data || [];

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
          status: "signup_open"
        })
        .select("*")
        .single();
      if (createError) throw createError;
      night = created;
    }

    document.getElementById("night-title").value = night.title || "";
    document.getElementById("night-date").value = night.night_date || "";
    document.getElementById("night-status").value = night.status || "signup_open";
    updateNightBadge();
  }

  function updateNightBadge() {
    const badge = document.getElementById("night-badge");
    if (!badge || !night) return;
    badge.classList.remove("is-open", "is-closed");
    if (night.status === "signup_open") {
      badge.textContent = "Anmälan öppen";
      badge.classList.add("is-open");
    } else if (night.status === "closed") {
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

    renderSlots();
  }

  function placeOptions(selectedId) {
    return places
      .map((p) => {
        const selected = p.id === selectedId ? " selected" : "";
        return `<option value="${p.id}"${selected}>${window.aufgussEscapeHtml(p.name)}</option>`;
      })
      .join("");
  }

  function renderSlots() {
    const body = document.getElementById("slots-body");
    const count = document.getElementById("slot-count");
    if (count) count.textContent = `${slots.length} poster`;

    if (!slots.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state">Inga poster ännu. Lägg till den första ovan.</td></tr>`;
      return;
    }

    body.innerHTML = slots
      .map((slot) => {
        const people = signupsBySlot.get(slot.id) || [];
        const names = people
          .map((p) => `<li>${window.aufgussEscapeHtml(p.participant_name)}</li>`)
          .join("");
        const startsLocal = window.aufgussFormatDateTimeLocal(slot.starts_at);

        return `
          <tr data-slot-id="${slot.id}">
            <td>
              <input type="datetime-local" data-field="starts_at" value="${startsLocal}">
            </td>
            <td>
              <input type="text" data-field="name" value="${window.aufgussEscapeHtml(slot.name)}">
            </td>
            <td>
              <select data-field="place_id">${placeOptions(slot.place_id)}</select>
              <div class="capacity">${slot.signup_count}/${slot.place_capacity}</div>
            </td>
            <td>
              <input type="number" min="1" data-field="duration_minutes" value="${slot.duration_minutes}" style="width:72px">
            </td>
            <td>
              <input type="text" data-field="bastuolja" value="${window.aufgussEscapeHtml(slot.bastuolja || "")}">
            </td>
            <td>
              <input type="text" data-field="aufgussmeister" value="${window.aufgussEscapeHtml(slot.aufgussmeister || "")}">
            </td>
            <td>
              <select data-field="intensity">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (n) =>
                      `<option value="${n}"${Number(slot.intensity) === n ? " selected" : ""}>${n}</option>`
                  )
                  .join("")}
              </select>
            </td>
            <td>
              <div class="capacity">${people.length} anmälda</div>
              <ul class="signup-list">${names || "<li class='muted' style='background:transparent;border:0;padding:0'>—</li>"}</ul>
            </td>
            <td>
              <div style="display:grid;gap:6px">
                <button type="button" class="btn btn-sm" data-action="save">Spara</button>
                <button type="button" class="btn btn-danger btn-sm" data-action="delete">Ta bort</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function rowPayload(tr) {
    const get = (field) => tr.querySelector(`[data-field="${field}"]`)?.value;
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

  document.getElementById("slots-body")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const tr = btn.closest("tr[data-slot-id]");
    if (!tr) return;
    const slotId = tr.dataset.slotId;
    const statusEl = document.getElementById("slots-status");

    if (btn.dataset.action === "delete") {
      if (!confirm("Ta bort denna post?")) return;
      const { error } = await supabase.from("aufguss_slots").delete().eq("id", slotId);
      if (error) {
        setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte ta bort."), "error");
        return;
      }
      setMsg(statusEl, "Post borttagen.", "ok");
      await loadSlots();
      return;
    }

    if (btn.dataset.action === "save") {
      const payload = rowPayload(tr);
      if (!payload.name || !payload.starts_at || !payload.place_id) {
        setMsg(statusEl, "Namn, plats och tid krävs.", "error");
        return;
      }
      const { error } = await supabase
        .from("aufguss_slots")
        .update(payload)
        .eq("id", slotId);
      if (error) {
        setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara."), "error");
        return;
      }
      setMsg(statusEl, "Post sparad.", "ok");
      await loadSlots();
    }
  });

  document.getElementById("btn-save-night")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("night-status-msg");
    if (!night) return;

    const payload = {
      title: document.getElementById("night-title").value.trim() || "Aufguss-kväll",
      night_date: document.getElementById("night-date").value || null,
      status: document.getElementById("night-status").value
    };

    const { data, error } = await supabase
      .from("aufguss_nights")
      .update(payload)
      .eq("id", night.id)
      .select("*")
      .single();

    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Kunde inte spara kväll."), "error");
      return;
    }

    night = data;
    updateNightBadge();
    setMsg(statusEl, "Kväll sparad.", "ok");
  });

  document.getElementById("btn-offset")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("offset-status");
    const minutes = Number(document.getElementById("offset-minutes").value);
    if (!night || !Number.isFinite(minutes) || minutes === 0) {
      setMsg(statusEl, "Ange hur många minuter (inte 0).", "error");
      return;
    }

    const { data, error } = await supabase.rpc("aufguss_offset_night", {
      p_night_id: night.id,
      p_minutes: minutes
    });

    if (error) {
      setMsg(statusEl, window.aufgussFormatError(error, "Offset misslyckades."), "error");
      return;
    }

    setMsg(statusEl, `Flyttade ${data || 0} poster med ${minutes} min.`, "ok");
    await loadSlots();
  });

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
    setDefaultStartTime();
    setMsg(statusEl, "Post tillagd.", "ok");
    await loadSlots();
  });

  document.getElementById("btn-refresh")?.addEventListener("click", async () => {
    try {
      await refreshAll();
      setMsg(document.getElementById("night-status-msg"), "Uppdaterat.", "ok");
    } catch (error) {
      setMsg(
        document.getElementById("night-status-msg"),
        window.aufgussFormatError(error, "Uppdatering misslyckades."),
        "error"
      );
    }
  });

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

  async function refreshAll() {
    await loadNight();
    await loadSlots();
    setDefaultStartTime();
  }

  function showLoadError(error) {
    const message = window.aufgussFormatError(error, "Kunde inte ladda data.");
    setMsg(document.getElementById("night-status-msg"), message, "error");
    setMsg(document.getElementById("slots-status"), message, "error");
    const body = document.getElementById("slots-body");
    if (body) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state">${window.aufgussEscapeHtml(message)}</td></tr>`;
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
