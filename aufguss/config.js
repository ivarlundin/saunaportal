// Shared Supabase config for Aufguss schedule app
// Same project as festival2026 (publishable anon key).

window.AUFGUSS_CONFIG = {
  SUPABASE_URL: "https://nicpgzkkyktzphkyzhfl.supabase.co",
  SUPABASE_KEY: "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn",
  ADMIN_PASSWORD: "tallbarr",
  COOKIE_NAME: "aufguss_participant",
  COOKIE_DAYS: 14,
  ADMIN_SESSION_KEY: "aufguss_admin_ok",
  // Background refresh interval — keep calm on mobile (was 8s and felt like a reload).
  POLL_MS: 30000
};

window.aufgussCreateClient = function aufgussCreateClient() {
  if (!window.supabase) {
    return null;
  }
  return window.supabase.createClient(
    window.AUFGUSS_CONFIG.SUPABASE_URL,
    window.AUFGUSS_CONFIG.SUPABASE_KEY
  );
};

window.aufgussFormatError = function aufgussFormatError(error, fallback) {
  const message = error?.message || "";
  const code = error?.code || "";

  if (
    code === "PGRST202" ||
    code === "PGRST205" ||
    /schema cache|relation .* does not exist|could not find the table/i.test(message)
  ) {
    return "Backend saknas — kör aufguss/supabase/sql/aufguss.sql och aufguss-admin-offsets-and-close-time.sql i Supabase.";
  }
  if (error?.error === "signup_closed" || /signup closed/i.test(message)) {
    return "Anmälan är stängd för kvällen.";
  }
  if (error?.error === "slot_full" || /slot full/i.test(message)) {
    return "Fullt — ingen plats kvar.";
  }
  if (
    error?.error === "participant_required" ||
    /participant id and name required/i.test(message)
  ) {
    return "Namn och id krävs.";
  }
  if (error?.error === "slot_not_found" || /slot not found/i.test(message)) {
    return "Posten hittades inte.";
  }
  return message || fallback || "Något gick fel.";
};

window.aufgussSignupErrorMessage = function aufgussSignupErrorMessage(result) {
  if (!result || result.ok) return "";
  return window.aufgussFormatError(
    { error: result.error, message: result.message },
    "Kunde inte anmäla."
  );
};

window.aufgussEscapeHtml = function aufgussEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

window.aufgussFormatTime = function aufgussFormatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

/**
 * Derive effective night mode from status + optional signup_closes_at.
 * Returns: setup | signup_open | closed
 */
window.aufgussEffectiveNightStatus = function aufgussEffectiveNightStatus(night, now = Date.now()) {
  if (!night) return "setup";
  const status = night.status || "setup";
  if (status === "setup") return "setup";
  if (status === "closed") return "closed";
  if (status !== "signup_open") return status;

  const closesAt = night.signup_closes_at;
  const nightDate = night.night_date;
  if (!closesAt || !nightDate) return "signup_open";

  const match = String(closesAt).match(/^(\d{2}):(\d{2})/);
  if (!match) return "signup_open";

  const [y, m, d] = String(nightDate).split("-").map(Number);
  if (!y || !m || !d) return "signup_open";

  // Interpret close time in local browser timezone (event is on-site).
  const closeMs = new Date(y, m - 1, d, Number(match[1]), Number(match[2]), 0, 0).getTime();
  if (Number.isNaN(closeMs)) return "signup_open";
  return now >= closeMs ? "closed" : "signup_open";
};

window.aufgussFormatDateTimeLocal = function aufgussFormatDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

window.aufgussIntensityLabel = function aufgussIntensityLabel(n) {
  const v = Number(n) || 0;
  return "●".repeat(Math.max(0, Math.min(5, v))) + "○".repeat(Math.max(0, 5 - v));
};

window.aufgussSetCookie = function aufgussSetCookie(name, value, days) {
  const maxAge = Math.round((days || 14) * 24 * 60 * 60);
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

window.aufgussGetCookie = function aufgussGetCookie(name) {
  const key = encodeURIComponent(name) + "=";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(key)) {
      return decodeURIComponent(trimmed.slice(key.length));
    }
  }
  return null;
};

window.aufgussReadParticipantCookie = function aufgussReadParticipantCookie() {
  const raw = window.aufgussGetCookie(window.AUFGUSS_CONFIG.COOKIE_NAME);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data && data.id && data.name) {
      return { id: String(data.id), name: String(data.name) };
    }
  } catch (_) {
    // legacy "id|name"
    const pipe = raw.indexOf("|");
    if (pipe > 0) {
      return {
        id: raw.slice(0, pipe),
        name: raw.slice(pipe + 1)
      };
    }
  }
  return null;
};

window.aufgussWriteParticipantCookie = function aufgussWriteParticipantCookie(id, name) {
  const payload = JSON.stringify({ id: String(id), name: String(name) });
  window.aufgussSetCookie(
    window.AUFGUSS_CONFIG.COOKIE_NAME,
    payload,
    window.AUFGUSS_CONFIG.COOKIE_DAYS
  );
};
