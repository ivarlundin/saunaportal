// =================================
// SUPABASE
// =================================

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// =================================
// SESSION
// =================================

const PARTICIPANT_SESSION_KEY =
    "saunaportal_participant_id";


// =================================
// APP STATE
// =================================

const state = {

    currentView: null,

    currentParticipant: null

};


// =================================
// VIEWS
// =================================

const views = {

    signup:
        document.getElementById(
            "signup-view"
        ),

    welcome:
        document.getElementById(
            "welcome-view"
        ),

    course:
        document.getElementById(
            "course-view"
        ),

    quiz:
        document.getElementById(
            "quiz-view"
        ),

    result:
        document.getElementById(
            "result-view"
        ),

    portal:
        document.getElementById(
            "portal-view"
        ),

    courses:
        document.getElementById(
            "courses-view"
        ),

    certificate:
        document.getElementById(
            "certificate-view"
        ),

    forum:
        document.getElementById(
            "forum-view"
        ),

    profile:
        document.getElementById(
            "profile-view"
        )

};


// =================================
// SHOW VIEW
// =================================

window.showView = function (
    viewName
) {

    console.log(
        "➡️ Showing view:",
        viewName
    );


    Object.values(
        views
    ).forEach(
        view => {

            if (!view) {

                return;

            }

            view.classList.remove(
                "active"
            );

        }
    );


    const view =
        views[viewName];


    if (!view) {

        console.error(
            "❌ View not found:",
            viewName
        );

        return;

    }


    view.classList.add(
        "active"
    );


    state.currentView =
        viewName;


    // ---------------------------------
    // COURSE
    // ---------------------------------

    if (
        viewName === "course"
    ) {

        console.log(
            "📚 Course view opened"
        );


        if (
            typeof window.startCourse ===
            "function"
        ) {

            window.startCourse();

        } else {

            console.error(
                "❌ startCourse() is not available"
            );

        }

    }


    // ---------------------------------
    // QUIZ
    // ---------------------------------

    if (
        viewName === "quiz"
    ) {

        console.log(
            "📝 Quiz view opened"
        );


        if (
            typeof window.startQuiz ===
            "function"
        ) {

            window.startQuiz();

        } else {

            console.error(
                "❌ startQuiz() is not available"
            );

        }

    }


    // ---------------------------------
    // RESULT
    // ---------------------------------

    if (
        viewName === "result"
    ) {

        console.log(
            "🏆 Result view opened"
        );


        if (
            typeof window.showQuizResult ===
            "function"
        ) {

            window.showQuizResult();

        }

    }


    // ---------------------------------
    // PORTAL
    // ---------------------------------

    if (
        viewName === "portal"
    ) {

        updatePortalName();

    }


    // ---------------------------------
    // COURSES
    // ---------------------------------

    if (
        viewName === "courses"
    ) {

        updateCoursesView();

    }


    // ---------------------------------
    // CERTIFICATE
    // ---------------------------------

    if (
        viewName === "certificate"
    ) {

        updateCertificateView();

    }


    // ---------------------------------
    // PROFILE
    // ---------------------------------

    if (
        viewName === "profile"
    ) {

        updateProfileView();

    }


    updateUserProfile();

};


// =================================
// CURRENT PARTICIPANT
// =================================

window.getCurrentParticipant =
    function () {

        return state.currentParticipant;

    };


// =================================
// SET CURRENT PARTICIPANT
// =================================

window.setCurrentParticipant =
    function (
        participant
    ) {

        state.currentParticipant =
            participant;


        window.currentParticipant =
            participant;


        updateUserProfile();

        updatePortalName();

        updateCoursesView();

        updateCertificateView();

        updateProfileView();

    };


// =================================
// SAVE PARTICIPANT SESSION
// =================================

window.saveParticipantSession =
    function (
        participantId
    ) {

        if (!participantId) {

            console.warn(
                "⚠️ Cannot save empty participant ID"
            );

            return false;

        }


        try {

            localStorage.setItem(
                PARTICIPANT_SESSION_KEY,
                participantId
            );


            console.log(
                "💾 Participant session saved:",
                participantId
            );


            return true;

        } catch (error) {

            console.error(
                "❌ Could not save participant session:",
                error
            );


            return false;

        }

    };


// =================================
// GET PARTICIPANT SESSION
// =================================

function getParticipantSession() {

    try {

        const participantId =
            localStorage.getItem(
                PARTICIPANT_SESSION_KEY
            );


        if (!participantId) {

            return null;

        }


        return participantId;

    } catch (error) {

        console.error(
            "❌ Could not read participant session:",
            error
        );


        return null;

    }

}


// =================================
// CLEAR PARTICIPANT SESSION
// =================================

window.clearParticipantSession =
    function () {

        try {

            localStorage.removeItem(
                PARTICIPANT_SESSION_KEY
            );

        } catch (error) {

            console.error(
                "❌ Could not clear participant session:",
                error
            );

        }


        state.currentParticipant =
            null;


        window.currentParticipant =
            null;


        console.log(
            "🗑️ Participant session cleared"
        );

    };


// =================================
// UPDATE USER PROFILE
// =================================

function updateUserProfile() {

    const participant =
        state.currentParticipant;


    if (!participant) {

        return;

    }


    // ---------------------------------
    // TOP PROFILE
    // ---------------------------------

    const userName =
        document.getElementById(
            "user-name"
        );


    const userAlias =
        document.getElementById(
            "user-alias"
        );


    const userAvatar =
        document.getElementById(
            "user-avatar"
        );


    if (userName) {

        userName.textContent =
            participant.name || "-";

    }


    if (userAlias) {

        userAlias.textContent =
            participant.alias || "-";

    }


    if (
        userAvatar &&
        participant.photo_path
    ) {

        userAvatar.src =
            getPhotoUrl(
                participant.photo_path
            );

    }


    // ---------------------------------
    // PROFILE OVERVIEW
    // ---------------------------------

    const overviewName =
        document.getElementById(
            "profile-overview-name"
        );


    const overviewAlias =
        document.getElementById(
            "profile-overview-alias"
        );


    const overviewAvatar =
        document.getElementById(
            "profile-overview-avatar"
        );


    if (overviewName) {

        overviewName.textContent =
            participant.name || "-";

    }


    if (overviewAlias) {

        overviewAlias.textContent =
            participant.alias || "-";

    }


    if (
        overviewAvatar &&
        participant.photo_path
    ) {

        overviewAvatar.src =
            getPhotoUrl(
                participant.photo_path
            );

    }


    // ---------------------------------
    // PROFILE STATS
    // ---------------------------------

    const courseStatus =
        document.getElementById(
            "profile-course-status"
        );


    const quizScore =
        document.getElementById(
            "profile-quiz-score"
        );


    const temperature =
        document.getElementById(
            "profile-temperature"
        );


    const oil =
        document.getElementById(
            "profile-oil"
        );


    const motto =
        document.getElementById(
            "profile-motto"
        );


    if (courseStatus) {

        courseStatus.textContent =
            participant.course_completed
                ? "Klar"
                : participant.course_started
                    ? "Pågår"
                    : "Ej startad";

    }


    if (quizScore) {

        quizScore.textContent =
            participant.quiz_score !== null &&
            participant.quiz_score !== undefined
                ? participant.quiz_score
                : "-";

    }


    if (temperature) {

        temperature.textContent =
            participant.favorite_temperature
                ? `${participant.favorite_temperature} °C`
                : "-";

    }


    if (oil) {

        oil.textContent =
            participant.sauna_oil ||
            "-";

    }


    if (motto) {

        motto.textContent =
            participant.motto ||
            "-";

    }

}


// =================================
// PHOTO URL
// =================================

function getPhotoUrl(
    photoPath
) {

    if (!photoPath) {

        return "";

    }

    const {
        data
    } =
        supabaseClient
            .storage
            .from(
                "festival2026-deltagare"
            )
            .getPublicUrl(
                photoPath
            );

    return data.publicUrl;

}


// =================================
// LOAD PARTICIPANT
// =================================

async function loadParticipant(
    participantId
) {

    console.log(
        "👤 Loading participant:",
        participantId
    );


    if (!participantId) {

        return null;

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
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

            throw error;

        }


        window.setCurrentParticipant(
            data
        );


        console.log(
            "✅ Participant loaded:",
            data
        );


        return data;

    } catch (error) {

        console.error(
            "❌ Could not load participant:",
            error
        );


        localStorage.removeItem(
            PARTICIPANT_SESSION_KEY
        );


        return null;

    }

}


// =================================
// RESTORE PARTICIPANT SESSION
// =================================

async function restoreParticipantSession() {

    console.log(
        "🔄 Looking for existing participant..."
    );


    const participantId =
        getParticipantSession();


    if (!participantId) {

        console.log(
            "ℹ️ No saved participant ID found."
        );

        return null;

    }


    console.log(
        "🔑 Saved participant ID:",
        participantId
    );


    const participant =
        await loadParticipant(
            participantId
        );


    if (!participant) {

        console.log(
            "⚠️ Saved participant could not be restored."
        );


        return null;

    }


    console.log(
        "✅ Existing participant restored:",
        participant.name
    );


    return participant;

}


// =================================
// WELCOME
// =================================

function setupWelcome() {

    const button =
        document.getElementById(
            "welcome-start-course"
        );


    if (!button) {

        console.warn(
            "⚠️ #welcome-start-course not found"
        );

        return;

    }


    button.onclick =
        async function () {

            console.log(
                "📚 Start course button clicked"
            );


            if (
                !state.currentParticipant
            ) {

                console.error(
                    "❌ No current participant"
                );

                return;

            }


            showView(
                "course"
            );

        };


    console.log(
        "✅ Welcome button connected"
    );

}


// =================================
// PORTAL NAME
// =================================

function updatePortalName() {

    const element =
        document.getElementById(
            "portal-name"
        );


    if (
        !element ||
        !state.currentParticipant
    ) {

        return;

    }


    element.textContent =
        state.currentParticipant.name ||
        state.currentParticipant.alias ||
        "bastufantast";

}


// =================================
// COURSES VIEW
// =================================

function updateCoursesView() {

    const participant =
        state.currentParticipant;


    if (!participant) {

        return;

    }


    const card =
        document.querySelector(
            "#courses-view .course-card"
        );


    if (!card) {

        return;

    }


    const completed =
        participant.course_completed;


    card.innerHTML = `

        <strong>
            SaunaPortal Festival 2026
        </strong>

        <span>
            ${
                completed
                    ? "✓ Slutförd"
                    : participant.course_started
                        ? "◐ Pågår"
                        : "○ Ej startad"
            }
        </span>

    `;

}


// =================================
// CERTIFICATE VIEW
// =================================

function updateCertificateView() {

    const participant =
        state.currentParticipant;


    if (!participant) {

        return;

    }


    const name =
        document.getElementById(
            "certificate-name"
        );


    const alias =
        document.getElementById(
            "certificate-alias"
        );


    if (name) {

        name.textContent =
            participant.name || "-";

    }


    if (alias) {

        alias.textContent =
            participant.alias
                ? `@${participant.alias}`
                : "-";

    }

}


// =================================
// PROFILE VIEW
// =================================

function updateProfileView() {

    const participant =
        state.currentParticipant;


    if (!participant) {

        return;

    }


    const avatar =
        document.getElementById(
            "profile-page-avatar"
        );


    const name =
        document.getElementById(
            "profile-page-name"
        );


    const alias =
        document.getElementById(
            "profile-page-alias"
        );


    const course =
        document.getElementById(
            "profile-page-course"
        );


    const quiz =
        document.getElementById(
            "profile-page-quiz"
        );


    const oil =
        document.getElementById(
            "profile-page-oil"
        );


    const temperature =
        document.getElementById(
            "profile-page-temperature"
        );


    const motto =
        document.getElementById(
            "profile-page-motto"
        );


    if (
        avatar &&
        participant.photo_path
    ) {

        avatar.src =
            getPhotoUrl(
                participant.photo_path
            );

    }


    if (name) {

        name.textContent =
            participant.name || "-";

    }


    if (alias) {

        alias.textContent =
            participant.alias
                ? `@${participant.alias}`
                : "-";

    }


    if (course) {

        course.textContent =
            participant.course_completed
                ? "✓ Slutförd"
                : participant.course_started
                    ? "Pågår"
                    : "Ej startad";

    }


    if (quiz) {

        quiz.textContent =
            participant.quiz_score !== null &&
            participant.quiz_score !== undefined
                ? `${participant.quiz_score}%`
                : "-";

    }


    if (oil) {

        oil.textContent =
            participant.sauna_oil ||
            "-";

    }


    if (temperature) {

        temperature.textContent =
            participant.favorite_temperature
                ? `${participant.favorite_temperature} °C`
                : "-";

    }


    if (motto) {

        motto.textContent =
            participant.motto ||
            "-";

    }

}


// =================================
// PORTAL NAVIGATION
// =================================

function setupPortalNavigation() {

    const portalCourses =
        document.getElementById(
            "portal-courses"
        );


    const portalCertificate =
        document.getElementById(
            "portal-certificate"
        );


    const portalForum =
        document.getElementById(
            "portal-forum"
        );


    const portalProfile =
        document.getElementById(
            "portal-profile"
        );


    portalCourses?.addEventListener(
        "click",
        () => {

            showView(
                "courses"
            );

        }
    );


    portalCertificate?.addEventListener(
        "click",
        () => {

            showView(
                "certificate"
            );

        }
    );


    portalForum?.addEventListener(
        "click",
        () => {

            showView(
                "forum"
            );

        }
    );


    portalProfile?.addEventListener(
        "click",
        () => {

            showView(
                "profile"
            );

        }
    );

}


// =================================
// RESULT NAVIGATION
// =================================

function setupResultNavigation() {

    const home =
        document.getElementById(
            "result-home"
        );


    const courses =
        document.getElementById(
            "result-courses"
        );


    const certificate =
        document.getElementById(
            "result-certificate"
        );


    const forum =
        document.getElementById(
            "result-forum"
        );


    const profile =
        document.getElementById(
            "result-profile"
        );


    home?.addEventListener(
        "click",
        () => {

            showView(
                "portal"
            );

        }
    );


    courses?.addEventListener(
        "click",
        () => {

            showView(
                "courses"
            );

        }
    );


    certificate?.addEventListener(
        "click",
        () => {

            showView(
                "certificate"
            );

        }
    );


    forum?.addEventListener(
        "click",
        () => {

            showView(
                "forum"
            );

        }
    );


    profile?.addEventListener(
        "click",
        () => {

            showView(
                "profile"
            );

        }
    );

}


// =================================
// BACK BUTTONS
// =================================

function setupBackButtons() {

    const coursesBack =
        document.getElementById(
            "courses-back"
        );


    const certificateBack =
        document.getElementById(
            "certificate-back"
        );


    const forumBack =
        document.getElementById(
            "forum-back"
        );


    const profileBack =
        document.getElementById(
            "profile-back"
        );


    coursesBack?.addEventListener(
        "click",
        () => {

            showView(
                "portal"
            );

        }
    );


    certificateBack?.addEventListener(
        "click",
        () => {

            showView(
                "portal"
            );

        }
    );


    forumBack?.addEventListener(
        "click",
        () => {

            showView(
                "portal"
            );

        }
    );


    profileBack?.addEventListener(
        "click",
        () => {

            showView(
                "portal"
            );

        }
    );

}


// =================================
// PROFILE BUTTON
// =================================

function setupProfileButton() {

    const button =
        document.getElementById(
            "user-profile-button"
        );


    const overview =
        document.getElementById(
            "profile-overview"
        );


    if (
        !button ||
        !overview
    ) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            const open =
                overview.getAttribute(
                    "aria-hidden"
                ) === "false";


            overview.setAttribute(
                "aria-hidden",
                open
                    ? "true"
                    : "false"
            );


            button.setAttribute(
                "aria-expanded",
                open
                    ? "false"
                    : "true"
            );


            overview.classList.toggle(
                "active",
                !open
            );

        }
    );

}


// =================================
// SHOW WELCOME
// =================================

function showWelcome() {

    const participant =
        state.currentParticipant;


    if (!participant) {

        console.warn(
            "⚠️ Cannot show welcome without participant"
        );

        return;

    }


    const welcomeName =
        document.getElementById(
            "welcome-name"
        );


    if (welcomeName) {

        welcomeName.textContent =
            participant.name ||
            participant.alias ||
            "bastufantast";

    }


    showView(
        "welcome"
    );

}


// =================================
// START VIEW
// =================================

async function determineStartView() {

    const participant =
        await restoreParticipantSession();


    if (!participant) {

        console.log(
            "🚦 Start view: signup"
        );


        showView(
            "signup"
        );


        return;

    }


    // ---------------------------------
    // COMPLETED COURSE
    // ---------------------------------

    if (
        participant.course_completed
    ) {

        console.log(
            "🚦 Existing participant → portal"
        );


        showView(
            "portal"
        );


        return;

    }


    // ---------------------------------
    // COURSE NOT COMPLETED
    // ---------------------------------

    console.log(
        "🚦 Existing participant → welcome"
    );


    showWelcome();

}


// =================================
// INIT
// =================================

async function initApp() {

    console.log(
        "🚀 SaunaPortal starting..."
    );


    setupWelcome();

    setupPortalNavigation();

    setupResultNavigation();

    setupBackButtons();

    setupProfileButton();


    console.log(
        "🔌 App initialized."
    );


    await determineStartView();

}


// =================================
// DOM READY
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initApp();

    }
);