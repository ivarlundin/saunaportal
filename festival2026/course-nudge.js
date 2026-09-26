(function () {
    const NUDGE_INTERVAL_MS = 15 * 60 * 1000;
    const NUDGE_STORAGE_KEY = "sauna_festival_course_nudge_at";
    const SESSION_KEY = "sauna_festival_participant_id";
    const SUPABASE_URL = "https://nicpgzkkyktzphkyzhfl.supabase.co";
    const SUPABASE_KEY = "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";
    const COURSE_URL = "festival2026.html";

    function lastNudgeAt() {
        const time = Number(localStorage.getItem(NUDGE_STORAGE_KEY));
        return Number.isFinite(time) ? time : 0;
    }

    function markNudge() {
        localStorage.setItem(NUDGE_STORAGE_KEY, String(Date.now()));
    }

    function notifiedWithin15Minutes() {
        const last = lastNudgeAt();
        return last > 0 && Date.now() - last < NUDGE_INTERVAL_MS;
    }

    function onCoursePage() {
        return /(?:^|\/)(?:festival2026|course-\d+)\.html$/.test(location.pathname);
    }

    function client() {
        if (!window.supabase) {
            return null;
        }

        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    async function hasTakenFestivalCourse(participantId) {
        const supabaseClient = client();

        if (!supabaseClient || !participantId) {
            return null;
        }

        const { data, error } = await supabaseClient
            .from("festival2026_deltagare")
            .select("course_completed")
            .eq("id", participantId)
            .maybeSingle();

        if (error) {
            console.warn("Could not check festival course:", error);
            return null;
        }

        return Boolean(data?.course_completed);
    }

    function ensureModal() {
        let modal = document.getElementById("course-nudge");

        if (modal) {
            return modal;
        }

        const style = document.createElement("style");
        style.textContent = `
            .course-nudge[hidden] { display: none !important; }
            .course-nudge {
                position: fixed;
                inset: 0;
                z-index: 80;
                display: grid;
                place-items: center;
                padding: 16px;
                background: rgb(0 0 0 / 45%);
            }
            .course-nudge-card {
                width: min(420px, 100%);
                padding: 16px;
                background: #d4d4d4;
                border: 2px solid;
                border-color: #fff #404040 #404040 #fff;
                text-align: center;
            }
            .course-nudge-card img {
                width: 140px;
                height: 140px;
                object-fit: contain;
            }
            .course-nudge-card h2 { margin: 8px 0; }
            .course-nudge-card p { margin: 0 0 14px; }
            .course-nudge-actions {
                display: flex;
                justify-content: center;
                gap: 8px;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement("div");
        modal.id = "course-nudge";
        modal.className = "course-nudge";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="course-nudge-card" role="dialog" aria-modal="true" aria-labelledby="course-nudge-title">
                <img src="illustration-pen-notebook.png" alt="">
                <h2 id="course-nudge-title">Ta festivalkursen</h2>
                <p>Du har inte gått SaunaFestival 2026 ännu. Kursen gör dig redo inför festivalen.</p>
                <div class="course-nudge-actions">
                    <button type="button" class="secondary-button" data-course-nudge="later">Senare</button>
                    <button type="button" class="primary-button" data-course-nudge="course">Gå kurs</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener("click", event => {
            const action = event.target.closest("[data-course-nudge]")?.dataset.courseNudge;

            if (!action) {
                return;
            }

            markNudge();
            modal.hidden = true;

            if (action === "course") {
                window.location.href = COURSE_URL;
            }

            document.dispatchEvent(new CustomEvent("saunacoursenudge", {
                detail: window.saunaCourseNudge.status
            }));
        });

        return modal;
    }

    function publish(status) {
        window.saunaCourseNudge.status = status;
        document.dispatchEvent(new CustomEvent("saunacoursenudge", { detail: status }));
    }

    async function checkCourseNudge() {
        const participantId = localStorage.getItem(SESSION_KEY);
        const status = {
            participantId,
            hasTakenCourse: null,
            notifiedWithin15Minutes: notifiedWithin15Minutes(),
            lastNudgeAt: lastNudgeAt(),
            shown: false
        };

        if (!participantId) {
            publish(status);
            return status;
        }

        const taken = await hasTakenFestivalCourse(participantId);
        status.hasTakenCourse = taken;
        status.notifiedWithin15Minutes = notifiedWithin15Minutes();

        if (taken !== false) {
            publish(status);
            return status;
        }

        if (status.notifiedWithin15Minutes || onCoursePage()) {
            publish(status);
            return status;
        }

        const modal = ensureModal();
        modal.hidden = false;
        status.shown = true;
        publish(status);
        return status;
    }

    window.saunaCourseNudge = {
        check: checkCourseNudge,
        mark: markNudge,
        clear() {
            localStorage.removeItem(NUDGE_STORAGE_KEY);
        },
        lastNudgeAt,
        status: null
    };

    document.addEventListener("DOMContentLoaded", () => {
        checkCourseNudge();
    });
})();
