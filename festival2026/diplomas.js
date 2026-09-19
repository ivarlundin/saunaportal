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

const diplomaCatalog =
    document.getElementById("diploma-catalog");


function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

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


function formatPassedDate(value) {

    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "long"
    }).format(date);

}


async function loadParticipantEnrollments(participantId) {

    if (!participantId) {
        return [];
    }

    try {

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

        return Array.isArray(data?.enrollments)
            ? data.enrollments
            : [];

    } catch (error) {

        console.warn(
            "Could not load enrollments for diplomas:",
            error
        );

        return [];

    }

}


function renderDiplomaCatalog(passedCourses) {

    if (!diplomaCatalog) {
        return;
    }

    if (!passedCourses.length) {

        diplomaCatalog.innerHTML = `
            <article class="course-catalog-card">
                <div class="course-catalog-copy">
                    <h2>Inga intyg ännu</h2>
                    <p>
                        När du klarar en kursquiz visas kursintyget här.
                    </p>
                </div>
            </article>
        `;

        return;

    }

    diplomaCatalog.innerHTML = "";

    passedCourses.forEach(course => {

        const article = document.createElement("article");
        article.className = "course-catalog-card";

        const title =
            course.title ||
            course.slug ||
            "Kurs";

        const description =
            course.description ||
            "Godkänt kursintyg från SaunaPortal.";

        const passedLabel =
            formatPassedDate(
                course.completed_at ||
                course.passed_at
            );

        const score =
            course.quiz_score != null &&
            course.quiz_score !== ""
                ? `${course.quiz_score}%`
                : null;

        const metaParts = [];

        if (passedLabel) {
            metaParts.push(`Godkänd ${passedLabel}`);
        }

        if (score) {
            metaParts.push(`Resultat ${score}`);
        }

        const slug = encodeURIComponent(
            course.slug || course.id
        );

        article.innerHTML = `
            <div class="course-catalog-copy">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(description)}</p>
                ${
                    metaParts.length
                        ? `<span class="course-catalog-meta">${escapeHtml(metaParts.join(" · "))}</span>`
                        : ""
                }
                <span class="course-status completed">✓ Godkänd</span>
            </div>
            <a
                class="primary-button"
                href="diploma-render.html?course=${slug}"
            >
                Visa intyg →
            </a>
        `;

        diplomaCatalog.appendChild(article);

    });

}


async function loadDiplomas() {

    if (!diplomaCatalog) {
        return;
    }

    const participantId =
        localStorage.getItem(SESSION_KEY);

    diplomaCatalog.innerHTML = `
        <article class="course-catalog-card">
            <div class="course-catalog-copy">
                <h2>Laddar intyg...</h2>
                <p>Hämtar godkända kurser.</p>
            </div>
        </article>
    `;

    if (!participantId) {

        diplomaCatalog.innerHTML = `
            <article class="course-catalog-card">
                <div class="course-catalog-copy">
                    <h2>Logga in för att se intyg</h2>
                    <p>
                        Du behöver vara registrerad i SaunaPortal
                        för att visa dina kursintyg.
                    </p>
                </div>
                <a class="primary-button" href="index.html">
                    Till startsidan →
                </a>
            </article>
        `;

        return;

    }

    try {

        const [{ data: courses, error }, enrollments] =
            await Promise.all([
                supabaseClient
                    .from("festival2026_courses")
                    .select("*"),
                loadParticipantEnrollments(participantId)
            ]);

        if (error) {
            throw error;
        }

        const courseList = Array.isArray(courses)
            ? courses
            : [];

        const passedEnrollments = enrollments.filter(
            enrollment => isCoursePassed(enrollment)
        );

        const byCourseId = new Map();
        const bySlug = new Map();

        passedEnrollments.forEach(enrollment => {

            if (enrollment.course_id) {
                byCourseId.set(
                    enrollment.course_id,
                    enrollment
                );
            }

            if (enrollment.slug) {
                bySlug.set(
                    enrollment.slug,
                    enrollment
                );
            }

        });

        const passedCourses = courseList
            .filter(course =>
                byCourseId.has(course.id) ||
                (course.slug && bySlug.has(course.slug))
            )
            .map(course => {

                const enrollment =
                    byCourseId.get(course.id) ||
                    bySlug.get(course.slug) ||
                    {};

                return {
                    ...course,
                    completed_at:
                        enrollment.completed_at ||
                        enrollment.passed_at ||
                        null,
                    quiz_score:
                        enrollment.quiz_score ??
                        null,
                    quiz_passed: true
                };

            })
            .sort((first, second) =>
                String(first.title || first.slug)
                    .localeCompare(
                        String(second.title || second.slug),
                        "sv"
                    )
            );

        renderDiplomaCatalog(passedCourses);

    } catch (error) {

        console.error("Could not load diplomas:", error);

        diplomaCatalog.innerHTML = `
            <article class="course-catalog-card">
                <div class="course-catalog-copy">
                    <h2>Kunde inte ladda intyg</h2>
                    <p>
                        Försök igen om en stund.
                    </p>
                </div>
            </article>
        `;

    }

}


document.addEventListener(
    "DOMContentLoaded",
    loadDiplomas
);
