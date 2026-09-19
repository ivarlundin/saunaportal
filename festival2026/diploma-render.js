const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const SESSION_KEY =
    "sauna_festival_participant_id";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const diplomaSheet =
    document.getElementById("diploma-sheet");


function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function getCourseParam() {

    const params =
        new URLSearchParams(window.location.search);

    const fromQuery =
        params.get("course") ||
        params.get("id") ||
        params.get("slug");

    if (fromQuery) {
        return String(fromQuery).trim();
    }

    if (window.location.hash.length > 1) {
        return window.location.hash
            .slice(1)
            .replace(/^course=/, "")
            .trim();
    }

    return "";

}


function isCoursePassed(record = {}) {

    return Boolean(
        record.quiz_passed ||
        record.completed ||
        record.course_completed ||
        record.completed_at ||
        record.certificate_issued ||
        record.is_completed ||
        record.status === "completed"
    );

}


function formatDiplomaDate(value) {

    if (!value) {
        return "Datum saknas";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Datum saknas";
    }

    return new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "long"
    }).format(date);

}


async function loadParticipant(participantId) {

    const { data, error } = await supabaseClient
        .from("festival2026_deltagare")
        .select("id, name, alias")
        .eq("id", participantId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;

}


async function loadCourse(courseParam) {

    let query = supabaseClient
        .from("festival2026_courses")
        .select("*");

    if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(courseParam)
    ) {
        query = query.eq("id", courseParam);
    } else {
        query = query.eq("slug", courseParam);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        throw error;
    }

    return data;

}


async function loadEnrollment(participantId, course) {

    const { data, error } =
        await supabaseClient.functions.invoke(
            "festival2026-auth",
            {
                body: {
                    action: "get_enrollments",
                    participant_id: participantId
                }
            }
        );

    if (error) {
        throw error;
    }

    const enrollments = Array.isArray(data?.enrollments)
        ? data.enrollments
        : [];

    return enrollments.find(enrollment =>
        enrollment.course_id === course.id ||
        enrollment.slug === course.slug
    ) || null;

}


function renderDiploma({
    participant,
    course,
    enrollment
}) {

    const personName =
        participant?.name ||
        (participant?.alias
            ? `@${participant.alias}`
            : "Deltagare");

    const courseTitle =
        (course?.title || course?.slug || "Kurs")
            .replace(/\s+/g, " ")
            .trim();

    const completedAt =
        enrollment?.completed_at ||
        enrollment?.passed_at ||
        null;

    const score =
        enrollment?.quiz_score != null
            ? `${enrollment.quiz_score}%`
            : null;

    const issuedLabel =
        formatDiplomaDate(completedAt);

    diplomaSheet.innerHTML = `
        <div class="diploma-frame">
            <img
                class="diploma-logo"
                src="sauna-portal-logo.png"
                alt="SaunaPortal"
            >

            <p class="diploma-kicker">SaunaPortal</p>
            <h1 class="diploma-title">Kursintyg</h1>

            <div class="diploma-body">
                <p class="diploma-intro">
                    Härmed intygas att
                </p>

                <p class="diploma-person">
                    ${escapeHtml(personName)}
                </p>

                <p class="diploma-course">
                    med godkänt resultat har slutfört utbildningen
                    <strong>${escapeHtml(courseTitle)}</strong>
                </p>

                <p class="diploma-meta">
                    Datum för godkänt resultat: ${escapeHtml(issuedLabel)}
                    ${
                        score
                            ? `<br>Quizresultat: ${escapeHtml(score)}`
                            : ""
                    }
                    ${
                        participant?.alias
                            ? `<br>Deltagaralias: @${escapeHtml(participant.alias)}`
                            : ""
                    }
                </p>

                <p class="diploma-closing">
                    Intyget är utfärdat av SaunaPortal
                    inför SaunaFestival 2026.
                </p>
            </div>

            <div class="diploma-footer">
                <div class="diploma-sign-block">
                    <img
                        class="diploma-signature"
                        src="signature.png"
                        alt=""
                    >
                    <p class="diploma-sign-line"></p>
                    <p class="diploma-sign-label">
                        SaunaPortal · Kursansvarig
                    </p>
                </div>

                <div class="diploma-seal" aria-hidden="true">
                    Godkänd<br>
                    Festival<br>
                    2026
                </div>
            </div>
        </div>
    `;

    document.title =
        `Kursintyg · ${courseTitle} · SaunaPortal`;

}


function renderDiplomaError(message) {

    if (!diplomaSheet) {
        return;
    }

    diplomaSheet.innerHTML = `
        <p class="diploma-error">
            ${escapeHtml(message)}
        </p>
    `;

}


async function loadDiploma() {

    const courseParam = getCourseParam();

    if (!courseParam) {
        renderDiplomaError(
            "Ingen kurs angiven i URL:en. Öppna intyget via Mina intyg."
        );
        return;
    }

    const participantId =
        localStorage.getItem(SESSION_KEY);

    if (!participantId) {
        renderDiplomaError(
            "Du behöver vara inloggad för att visa kursintyget."
        );
        return;
    }

    try {

        const course = await loadCourse(courseParam);

        if (!course) {
            renderDiplomaError(
                `Kunde inte hitta kursen “${courseParam}”.`
            );
            return;
        }

        const [participant, enrollment] =
            await Promise.all([
                loadParticipant(participantId),
                loadEnrollment(participantId, course)
            ]);

        if (!participant) {
            renderDiplomaError(
                "Kunde inte hitta din deltagarprofil."
            );
            return;
        }

        if (!enrollment || !isCoursePassed(enrollment)) {
            renderDiplomaError(
                "Det finns inget godkänt resultat för den här kursen ännu."
            );
            return;
        }

        renderDiploma({
            participant,
            course,
            enrollment
        });

    } catch (error) {

        console.error("Could not render diploma:", error);
        renderDiplomaError(
            "Intyget kunde inte laddas just nu. Försök igen senare."
        );

    }

}


document.addEventListener("DOMContentLoaded", () => {

    document
        .getElementById("diploma-print")
        ?.addEventListener("click", () => {
            window.print();
        });

    loadDiploma();

});
