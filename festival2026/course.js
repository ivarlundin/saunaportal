// =================================
// SAUNAPORTAL — COURSE
// =================================

console.log("📚 Course.js loaded");


// =================================
// COURSE STATE
// =================================

const courseState = {
    currentStep: 1,
    totalSteps: 5,
    participant: null
};


// =================================
// ELEMENTS
// =================================

const courseElements = {
    content:
        document.getElementById("course-content"),

    progress:
        document.getElementById("course-progress"),

    back:
        document.getElementById("course-back"),

    next:
        document.getElementById("course-next")
};


// =================================
// GET PARTICIPANT
// =================================

function getCourseParticipant() {

    if (
        typeof window.getCurrentParticipant ===
        "function"
    ) {

        return window.getCurrentParticipant();

    }


    const participant =
        window.currentParticipant ||
        null;


    return participant;
}


// =================================
// LOAD COURSE
// =================================

function loadCourse() {

    console.log("📚 Loading course...");


    courseState.participant =
        getCourseParticipant();


    courseState.currentStep = 1;


    showCourseStep(
        courseState.currentStep
    );

}


// =================================
// SHOW COURSE STEP
// =================================

function showCourseStep(step) {

    if (
        step < 1 ||
        step > courseState.totalSteps
    ) {

        return;

    }


    courseState.currentStep =
        step;


    const steps =
        document.querySelectorAll(
            ".course-step"
        );


    steps.forEach(
        courseStep => {

            const stepNumber =
                Number(
                    courseStep.dataset.step
                );


            if (
                stepNumber === step
            ) {

                courseStep.style.display =
                    "block";

                courseStep.classList.add(
                    "active"
                );

            } else {

                courseStep.style.display =
                    "none";

                courseStep.classList.remove(
                    "active"
                );

            }

        }
    );


    updateCourseProgress();

    updateCourseNavigation();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    console.log(
        `📖 Course step ${step}/${courseState.totalSteps}`
    );

}


// =================================
// PROGRESS
// =================================

function updateCourseProgress() {

    if (!courseElements.progress) {

        return;

    }


    courseElements.progress.textContent =
        `STEG ${courseState.currentStep} AV ${courseState.totalSteps}`;

}


// =================================
// NAVIGATION
// =================================

function updateCourseNavigation() {

    if (
        !courseElements.back ||
        !courseElements.next
    ) {

        return;

    }


    // BACK BUTTON

    if (
        courseState.currentStep === 1
    ) {

        courseElements.back.style.visibility =
            "hidden";

    } else {

        courseElements.back.style.visibility =
            "visible";

    }


    // NEXT BUTTON

    if (
        courseState.currentStep ===
        courseState.totalSteps
    ) {

        courseElements.next.textContent =
            "Starta quiz →";

    } else {

        courseElements.next.textContent =
            "Nästa →";

    }

}


// =================================
// NEXT
// =================================

async function nextCourseStep() {

    if (
        courseState.currentStep <
        courseState.totalSteps
    ) {

        showCourseStep(
            courseState.currentStep + 1
        );

        return;

    }


    // =================================
    // COURSE FINISHED
    // =================================

    console.log(
        "🎓 Course material completed"
    );


    await markCourseCompleted();


    console.log(
        "📝 Opening quiz..."
    );


    if (
        typeof window.showView ===
        "function"
    ) {

        window.showView(
            "quiz-view"
        );

    }

}


// =================================
// BACK
// =================================

function previousCourseStep() {

    if (
        courseState.currentStep <= 1
    ) {

        return;

    }


    showCourseStep(
        courseState.currentStep - 1
    );

}


// =================================
// MARK COURSE STARTED
// =================================

async function markCourseStarted() {

    const participant =
        courseState.participant ||
        getCourseParticipant();


    if (
        !participant ||
        !participant.id
    ) {

        console.warn(
            "⚠️ No participant available"
        );

        return;

    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "festival2026_deltagare"
                )
                .update({
                    course_started: true
                })
                .eq(
                    "id",
                    participant.id
                );


        if (error) {

            throw error;

        }


        participant.course_started =
            true;


        console.log(
            "✅ Course marked as started"
        );

    } catch (error) {

        console.error(
            "❌ Could not mark course as started:",
            error
        );

    }

}


// =================================
// MARK COURSE COMPLETED
// =================================

async function markCourseCompleted() {

    const participant =
        courseState.participant ||
        getCourseParticipant();


    if (
        !participant ||
        !participant.id
    ) {

        console.warn(
            "⚠️ No participant available"
        );

        return;

    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "festival2026_deltagare"
                )
                .update({
                    course_started: true,
                    course_completed: true
                })
                .eq(
                    "id",
                    participant.id
                );


        if (error) {

            throw error;

        }


        participant.course_started =
            true;

        participant.course_completed =
            true;


        console.log(
            "✅ Course marked as completed"
        );

    } catch (error) {

        console.error(
            "❌ Could not mark course as completed:",
            error
        );

    }

}


// =================================
// START COURSE
// =================================

async function startCourse() {

    console.log(
        "📚 Course started"
    );


    await markCourseStarted();


    loadCourse();

}


// =================================
// BUTTONS
// =================================

if (
    courseElements.next
) {

    courseElements.next.addEventListener(
        "click",
        nextCourseStep
    );

}


if (
    courseElements.back
) {

    courseElements.back.addEventListener(
        "click",
        previousCourseStep
    );

}


// =================================
// PUBLIC API
// =================================

window.startCourse =
    startCourse;


window.loadCourse =
    loadCourse;


window.showCourseStep =
    showCourseStep;


window.nextCourseStep =
    nextCourseStep;


window.previousCourseStep =
    previousCourseStep;


// =================================
// INIT
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "📚 Course initialized"
        );

    }
);