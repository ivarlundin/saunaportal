// ==========================================
// SAUNA FESTIVAL 2026 — APP
// ==========================================

console.log("🔥 app.js loaded");


// ==========================================
// SUPABASE
// ==========================================

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ==========================================
// APP STATE
// ==========================================

const state = {

    participantId: null,

    name: "",
    alias: "",
    saunaOil: "",
    favoriteTemperature: null,
    motto: "",
    photoPath: null,

    courseStep: 0,

    quizQuestions: [],
    quizAnswers: [],
    quizScore: 0,
    quizPercentage: 0,
    quizPassed: false,
    certificateIssued: false,
    courseStarted: false,
    courseCompleted: false

};


const CERTIFICATION_PASS_PERCENTAGE = 70;


// ==========================================
// SESSION
// ==========================================

const SESSION_KEY =
    "sauna_festival_participant_id";


function saveParticipantSession(
    participantId
) {

    localStorage.setItem(
        SESSION_KEY,
        participantId
    );

    state.participantId =
        participantId;

    console.log(
        "💾 Participant session saved:",
        participantId
    );

}


function getParticipantSession() {

    return localStorage.getItem(
        SESSION_KEY
    );

}


function clearParticipantSession() {

    localStorage.removeItem(
        SESSION_KEY
    );

    state.participantId = null;

    console.log(
        "🧹 Participant session cleared"
    );

}


function logoutParticipant() {

    clearParticipantSession();
    sessionStorage.clear();

    state.name = "";
    state.alias = "";
    state.saunaOil = "";
    state.favoriteTemperature = null;
    state.motto = "";
    state.photoPath = null;
    state.courseStep = 0;
    state.quizQuestions = [];
    state.quizAnswers = [];
    state.quizScore = 0;
    state.quizPercentage = 0;
    state.quizPassed = false;
    state.certificateIssued = false;
    state.courseStarted = false;
    state.courseCompleted = false;

    window.location.href = "index.html";

}


// ==========================================
// NAVIGATION
// ==========================================

function showView(
    viewId
) {

    const views =
        document.querySelectorAll(
            ".view"
        );


    views.forEach(
        view => {

            view.classList.remove(
                "active"
            );

        }
    );


    const view =
        document.getElementById(
            viewId
        );


    if (!view) {

        console.warn(
            "View not found:",
            viewId
        );

        return;

    }


    view.classList.add(
        "active"
    );


    window.scrollTo({
        top: 0,
        behavior: "instant"
    });


    console.log(
        "➡️ Showing view:",
        viewId
    );

}


// ==========================================
// LOAD PARTICIPANT
// ==========================================

async function loadParticipant(
    participantId
) {

    console.log(
        "👤 Loading participant:",
        participantId
    );


    const {
        data,
        error
    } = await supabaseClient

        .from(
            "festival2026_deltagare"
        )

        .select("*")

        .eq(
            "id",
            participantId
        )

        .single();


    if (error) {

        console.error(
            "❌ Could not load participant:",
            error
        );

        return null;

    }


    if (!data) {

        console.warn(
            "⚠️ Participant not found"
        );

        return null;

    }


    // ======================================
    // UPDATE STATE
    // ======================================

    state.participantId =
        data.id;

    state.name =
        data.name || "";

    state.alias =
        data.alias || "";

    state.saunaOil =
        data.sauna_oil || "";

    state.favoriteTemperature =
        data.favorite_temperature ??
        null;

    state.motto =
        data.motto || "";

    state.photoPath =
        data.photo_path || null;

    state.quizPercentage =
        data.quiz_score ?? 0;

    state.quizPassed =
        data.quiz_passed || false;

    state.certificateIssued =
        data.certificate_issued || false;

    state.courseStarted =
        data.course_started || false;

    state.courseCompleted =
        data.course_completed || false;


    console.log(
        "✅ Participant loaded:",
        state
    );


    return data;

}


async function updateParticipantCertification(
    fields
) {

    if (!state.participantId) {

        throw new Error(
            "No participant session found."
        );

    }

    const {
        data,
        error
    } = await supabaseClient

        .from(
            "festival2026_deltagare"
        )

        .update(
            fields
        )

        .eq(
            "id",
            state.participantId
        )

        .select()

        .single();

    if (error) {

        console.error(
            "❌ Could not update certification:",
            error
        );

        throw error;

    }

    return data;

}


// ==========================================
// GET PARTICIPANT PHOTO URL
// ==========================================

async function getParticipantPhotoUrl(
    photoPath
) {

    if (!photoPath) {

        return null;

    }


    // ======================================
    // PUBLIC URL
    // ======================================

    const {
        data: publicData
    } = supabaseClient

        .storage

        .from(
            "festival2026-deltagare"
        )

        .getPublicUrl(
            photoPath
        );


    if (
        publicData &&
        publicData.publicUrl
    ) {

        return publicData.publicUrl;

    }


    // ======================================
    // SIGNED URL FALLBACK
    // ======================================

    const {
        data,
        error
    } = await supabaseClient

        .storage

        .from(
            "festival2026-deltagare"
        )

        .createSignedUrl(
            photoPath,
            60 * 60
        );


    if (error) {

        console.error(
            "❌ Could not create photo URL:",
            error
        );

        return null;

    }


    return data?.signedUrl || null;

}


// ==========================================
// PROFILE UI
// ==========================================

function createProfileUI() {

    if (
        document.getElementById(
            "festival-profile-widget"
        )
    ) {

        return;

    }


    const widget =
        document.createElement(
            "div"
        );


    widget.id =
        "festival-profile-widget";

    widget.className =
        "festival-profile-widget";


    widget.innerHTML = `

        <button
            type="button"
            id="festival-profile-button"
            class="festival-profile-button"
            aria-label="Öppna profil"
        >

            <img
                id="festival-profile-avatar"
                class="festival-profile-avatar"
                alt=""
            >

            <span
                class="festival-profile-name"
            >

                <strong
                    id="festival-profile-name"
                >
                    -
                </strong>

                <small
                    id="festival-profile-alias"
                >
                    -
                </small>

            </span>

        </button>


        <div
            id="festival-profile-panel"
            class="festival-profile-panel"
            hidden
        >

            <div
                class="festival-profile-panel-header"
            >

                <img
                    id="festival-profile-panel-avatar"
                    class="festival-profile-panel-avatar"
                    alt=""
                >

                <div>

                    <h2
                        id="festival-profile-panel-name"
                    >
                        -
                    </h2>

                    <p
                        id="festival-profile-panel-alias"
                    >
                        -
                    </p>

                </div>

            </div>


            <div
                class="festival-profile-status"
            >

                <span
                    class="festival-status-dot"
                ></span>

                <span>
                    Registrerad på festivalen
                </span>

            </div>


            <div
                class="festival-profile-stats"
            >

                <div
                    class="festival-profile-stat"
                >

                    <span>
                        Bastuolja
                    </span>

                    <strong
                        id="festival-profile-oil"
                    >
                        -
                    </strong>

                </div>


                <div
                    class="festival-profile-stat"
                >

                    <span>
                        Favorittemp.
                    </span>

                    <strong>

                        <span
                            id="festival-profile-temperature"
                        >
                            -
                        </span>

                        °C

                    </strong>

                </div>


                <div
                    class="festival-profile-stat"
                >

                    <span>
                        Motto
                    </span>

                    <strong
                        id="festival-profile-motto"
                    >
                        -
                    </strong>

                </div>

            </div>


            <button
                type="button"
                id="festival-profile-close"
                class="secondary-button full-width"
            >
                Stäng
            </button>


            <button
                type="button"
                id="festival-profile-logout"
                class="secondary-button full-width"
            >
                Logga ut
            </button>

        </div>

    `;


    document.body.appendChild(
        widget
    );


    // ======================================
    // ELEMENTS
    // ======================================

    const profileButton =
        document.getElementById(
            "festival-profile-button"
        );


    const profilePanel =
        document.getElementById(
            "festival-profile-panel"
        );


    const closeButton =
        document.getElementById(
            "festival-profile-close"
        );


    const logoutButton =
        document.getElementById(
            "festival-profile-logout"
        );


    // ======================================
    // OPEN / CLOSE
    // ======================================

    profileButton?.addEventListener(
        "click",
        () => {

            const isHidden =
                profilePanel.hidden;

            profilePanel.hidden =
                !isHidden;

        }
    );


    closeButton?.addEventListener(
        "click",
        () => {

            profilePanel.hidden =
                true;

        }
    );


    logoutButton?.addEventListener(
        "click",
        logoutParticipant
    );


    // ======================================
    // CLICK OUTSIDE
    // ======================================

    document.addEventListener(
        "click",
        event => {

            if (
                profilePanel.hidden
            ) {

                return;

            }


            if (
                widget.contains(
                    event.target
                )
            ) {

                return;

            }


            profilePanel.hidden =
                true;

        }
    );

}


// ==========================================
// UPDATE PROFILE UI
// ==========================================

async function updateProfileUI() {

    createProfileUI();


    const avatar =
        document.getElementById(
            "festival-profile-avatar"
        );


    const panelAvatar =
        document.getElementById(
            "festival-profile-panel-avatar"
        );


    const name =
        document.getElementById(
            "festival-profile-name"
        );


    const alias =
        document.getElementById(
            "festival-profile-alias"
        );


    const panelName =
        document.getElementById(
            "festival-profile-panel-name"
        );


    const panelAlias =
        document.getElementById(
            "festival-profile-panel-alias"
        );


    const oil =
        document.getElementById(
            "festival-profile-oil"
        );


    const temperature =
        document.getElementById(
            "festival-profile-temperature"
        );


    const motto =
        document.getElementById(
            "festival-profile-motto"
        );


    // ======================================
    // TEXT
    // ======================================

    if (name) {

        name.textContent =
            state.name ||
            "Deltagare";

    }


    if (alias) {

        alias.textContent =
            state.alias
                ? `@${state.alias}`
                : "";

    }


    if (panelName) {

        panelName.textContent =
            state.name ||
            "Deltagare";

    }


    if (panelAlias) {

        panelAlias.textContent =
            state.alias
                ? `@${state.alias}`
                : "";

    }


    if (oil) {

        oil.textContent =
            state.saunaOil ||
            "Ej angivet";

    }


    if (temperature) {

        temperature.textContent =
            state.favoriteTemperature ??
            "–";

    }


    if (motto) {

        motto.textContent =
            state.motto ||
            "Inget motto ännu.";

    }


    // ======================================
    // PHOTO
    // ======================================

    const photoUrl =
        await getParticipantPhotoUrl(
            state.photoPath
        );


    if (photoUrl) {

        if (avatar) {

            avatar.src =
                photoUrl;

        }


        if (panelAvatar) {

            panelAvatar.src =
                photoUrl;

        }

    } else {

        const fallback =
            createInitialAvatar(
                state.name ||
                state.alias ||
                "S"
            );


        if (avatar) {

            avatar.src =
                fallback;

        }


        if (panelAvatar) {

            panelAvatar.src =
                fallback;

        }

    }


    // ======================================
    // SHOW PROFILE
    // ======================================

    const widget =
        document.getElementById(
            "festival-profile-widget"
        );


    if (widget) {

        widget.classList.add(
            "visible"
        );

    }


    console.log(
        "👤 Profile UI updated"
    );

}


// ==========================================
// CREATE FALLBACK AVATAR
// ==========================================

function createInitialAvatar(
    text
) {

    const letter =
        text
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "S";


    const svg = `

        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="160"
            height="160"
            viewBox="0 0 160 160"
        >

            <rect
                width="160"
                height="160"
                fill="#0000aa"
            />

            <text
                x="80"
                y="100"
                text-anchor="middle"
                font-family="Arial, Helvetica, sans-serif"
                font-size="72"
                font-weight="bold"
                fill="white"
            >
                ${letter}
            </text>

        </svg>

    `;


    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );

}


// ==========================================
// SIGNUP COMPLETE STATUS
// ==========================================

function showSignupCompleteStatus() {

    const status =
        document.getElementById(
            "signup-status"
        );


    if (!status) {

        return;

    }


    status.textContent =
        "✓ Du är registrerad på Saunafestivalen 2026.";


    status.classList.add(
        "success"
    );

}


// ==========================================
// WELCOME WINDOW
// ==========================================

function showWelcomeWindow() {

    showView(
        "welcome-view"
    );


    document.body.classList.add(
        "welcome-open"
    );


    console.log(
        "👋 Welcome window shown"
    );

}


// ==========================================
// HIDE WELCOME WINDOW
// ==========================================

function hideWelcomeWindow() {

    document.body.classList.remove(
        "welcome-open"
    );


    console.log(
        "👋 Welcome window closed"
    );

}


// ==========================================
// WELCOME WINDOW INIT
// ==========================================

function initWelcomeWindow() {

    const startButton =
        document.getElementById(
            "welcome-start-course"
        );


    if (!startButton) {

        console.warn(
            "⚠️ Welcome start button not found."
        );

        return;

    }


    // Prevent duplicate listeners
    if (
        startButton.dataset.initialized === "true"
    ) {

        return;

    }


    startButton.dataset.initialized =
        "true";


    startButton.addEventListener(
        "click",
        () => {

            hideWelcomeWindow();

            startCourse();

        }
    );


    console.log(
        "👋 Welcome window initialized"
    );

}


function updateDashboardUI() {

    const progress =
        state.courseCompleted
            ? 100
            : state.courseStarted
                ? 20
                : 0;

    const welcomeName =
        document.getElementById("welcome-name");

    const progressBar =
        document.getElementById("dashboard-progress-bar");

    const progressLabel =
        document.getElementById("dashboard-progress");

    const score =
        document.getElementById("dashboard-score");

    const status =
        document.getElementById("dashboard-status");

    const courseLabel =
        document.getElementById("dashboard-course-label");

    if (welcomeName) {
        welcomeName.textContent =
            state.name || state.alias || "bastufantast";
    }

    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }

    if (progressLabel) {
        progressLabel.textContent = `${progress}%`;
    }

    if (score) {
        score.textContent =
            state.quizPercentage > 0
                ? `${state.quizPercentage}%`
                : "--";
    }

    if (status) {
        status.textContent =
            state.certificateIssued
                ? "Certifierad"
                : state.courseStarted
                    ? "Pågår"
                    : "Påbörja";
    }

    if (courseLabel) {
        courseLabel.textContent =
            state.courseCompleted
                ? "Kursen är klar"
                : state.courseStarted
                    ? "Fortsätt där du slutade"
                    : "Inte påbörjad";
    }

}


// ==========================================
// PARTICIPANT READY
// ==========================================

async function participantReady(
    participant
) {

    if (!participant) {

        return;

    }


    console.log(
        "🎉 Participant ready:",
        participant
    );


    await updateProfileUI();


    updateDashboardUI();


    showSignupCompleteStatus();


    initWelcomeWindow();


    showWelcomeWindow();


}


// ==========================================
// START COURSE
// ==========================================

function startCourse() {

    if (!state.participantId) {

        console.warn(
            "⚠️ Cannot start course without participant."
        );

        return;

    }


    window.location.href = "course-1.html";


    console.log(
        "📚 Course started"
    );

}


// ==========================================
// START QUIZ
// ==========================================

function startQuiz() {

    if (!state.participantId) {

        console.warn(
            "⚠️ Cannot start quiz without participant."
        );

        return;

    }


    state.quizQuestions =
        [];


    state.quizAnswers =
        [];


    state.quizScore =
        0;


    showView(
        "quiz-view"
    );


    window.saunaFestivalQuiz?.renderQuizQuestion();


    console.log(
        "📝 Quiz started"
    );

}


// ==========================================
// SHOW RESULT
// ==========================================

function showResult(
    score,
    total
) {

    state.quizScore =
        score;


    const percentage =
        total > 0

            ? Math.round(
                (
                    score /
                    total
                ) * 100
            )

            : 0;

    const passed =
        percentage > CERTIFICATION_PASS_PERCENTAGE;

    state.quizPercentage =
        percentage;

    state.quizPassed =
        passed;

    state.certificateIssued =
        passed;

    state.courseCompleted =
        true;


    const resultScore =
        document.getElementById(
            "result-score"
        );


    if (resultScore) {

        resultScore.textContent =
            `${percentage}%`;

    }


    const resultMessage =
        document.getElementById(
            "result-message"
        );


    if (resultMessage) {

        if (passed) {

            resultMessage.textContent =
                "Du är godkänd och certifierad!";

        } else {

            resultMessage.textContent =
                `Du fick ${percentage}%. Du behöver mer än ${CERTIFICATION_PASS_PERCENTAGE}% för att bli certifierad.`;

        }

    }


    showView(
        "result-view"
    );


    updateParticipantCertification({
        course_completed: true,
        quiz_score: percentage,
        quiz_passed: passed,
        certificate_issued: passed
    }).catch(
        error => console.error(
            "❌ Could not save certification result:",
            error
        )
    );

}


// ==========================================
// INITIALIZE APP
// ==========================================

async function initApp() {

    console.log(
        "🔥 Sauna Festival 2026 starting..."
    );


    // ======================================
    // CREATE PROFILE UI
    // ======================================

    createProfileUI();


    // ======================================
    // INITIALIZE WELCOME
    // ======================================

    initWelcomeWindow();


    // ======================================
    // GET SESSION
    // ======================================

    const participantId =
        getParticipantSession();


    if (!participantId) {

        console.log(
            "👤 No existing participant session."
        );

        return;

    }


    console.log(
        "👤 Existing participant session:",
        participantId
    );


    // ======================================
    // LOAD PARTICIPANT
    // ======================================

    const participant =
        await loadParticipant(
            participantId
        );


    if (!participant) {

        console.log(
            "🧹 Session invalid. Clearing session."
        );


        clearParticipantSession();


        return;

    }


    // ======================================
    // PARTICIPANT EXISTS
    // ======================================

    await participantReady(
        participant
    );

}


// ==========================================
// DOM READY
// ==========================================

function initForumLinks() {

    [
        "portal-forum",
        "community-button"
    ].forEach(
        buttonId => {

            document
                .getElementById(buttonId)
                ?.addEventListener(
                    "click",
                    () => {
                        window.location.href = "forum.html";
                    }
                );

        }
    );

}


function initCoursesLink() {

    document
        .getElementById("portal-courses")
        ?.addEventListener(
            "click",
            () => {
                window.location.href = "courses.html";
            }
        );

}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        initForumLinks();
        initCoursesLink();
        initApp();
    }
);


// ==========================================
// GLOBAL API
// ==========================================
//
// Dessa funktioner kan användas av:
//
// signup.js
// course.js
// quiz.js
//
// ==========================================

window.saunaFestival = {

    state,

    saveParticipantSession,

    getParticipantSession,

    clearParticipantSession,

    logoutParticipant,

    loadParticipant,

    showView,

    updateProfileUI,

    participantReady,

    startCourse,

    startQuiz,

    showResult,
    updateParticipantCertification,

    showWelcomeWindow,

    hideWelcomeWindow,

    initWelcomeWindow

};