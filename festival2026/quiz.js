// =================================
// SAUNAPORTAL — QUIZ
// =================================

console.log("📝 Quiz.js loaded");


// =================================
// QUIZ STATE
// =================================

const quizState = {

    questions: [],

    currentQuestion: 0,

    answers: {},

    score: 0,

    finished: false,

    loading: false,

    participant: null

};


// =================================
// ELEMENTS
// =================================

const quizElements = {

    content:
        document.getElementById(
            "quiz-content"
        ),

    progress:
        document.getElementById(
            "quiz-progress"
        ),

    next:
        document.getElementById(
            "quiz-next"
        ),

    status:
        document.getElementById(
            "quiz-status"
        )

};


// =================================
// PARTICIPANT
// =================================

function getQuizParticipant() {

    if (
        typeof window.getCurrentParticipant ===
        "function"
    ) {

        return window.getCurrentParticipant();

    }


    return (
        window.currentParticipant ||
        null
    );

}


// =================================
// LOAD QUESTIONS
// =================================

async function loadQuestions() {

    console.log(
        "📝 Loading quiz questions..."
    );


    quizState.loading = true;


    if (quizElements.status) {

        quizElements.status.textContent =
            "Laddar quiz...";

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from(
                    "quiz_questions"
                )
                .select(
                    `
                    id,
                    question,
                    option_a,
                    option_b,
                    option_c,
                    option_d,
                    correct_answer,
                    order_index
                    `
                )
                .order(
                    "order_index",
                    {
                        ascending: true
                    }
                );


        if (error) {

            throw error;

        }


        quizState.questions =
            data || [];


        console.log(
            `✅ Loaded ${quizState.questions.length} quiz questions`
        );


        if (
            quizState.questions.length === 0
        ) {

            showQuizError(
                "Det finns inga quizfrågor ännu."
            );

            return false;

        }


        quizState.loading = false;


        if (quizElements.status) {

            quizElements.status.textContent =
                "";

        }


        return true;

    } catch (error) {

        quizState.loading = false;


        console.error(
            "❌ Could not load quiz questions:",
            error
        );


        showQuizError(
            "Kunde inte ladda quizet. Kontrollera databasen."
        );


        return false;

    }

}


// =================================
// SHOW ERROR
// =================================

function showQuizError(message) {

    if (!quizElements.content) {

        return;

    }


    quizElements.content.innerHTML = `

        <div class="quiz-error">

            <h1>
                Något gick fel
            </h1>

            <p>
                ${message}
            </p>

        </div>

    `;


    if (quizElements.next) {

        quizElements.next.disabled =
            true;

    }

}


// =================================
// START QUIZ
// =================================

async function startQuiz() {

    console.log(
        "📝 Starting quiz..."
    );


    quizState.participant =
        getQuizParticipant();


    quizState.currentQuestion =
        0;


    quizState.answers = {};


    quizState.score =
        0;


    quizState.finished =
        false;


    if (quizElements.next) {

        quizElements.next.disabled =
            false;

    }


    const loaded =
        await loadQuestions();


    if (!loaded) {

        return;

    }


    renderQuestion();

}


// =================================
// RENDER QUESTION
// =================================

function renderQuestion() {

    if (!quizElements.content) {

        return;

    }


    const question =
        quizState.questions[
            quizState.currentQuestion
        ];


    if (!question) {

        finishQuiz();

        return;

    }


    const questionNumber =
        quizState.currentQuestion + 1;


    const totalQuestions =
        quizState.questions.length;


    updateQuizProgress();


    const selectedAnswer =
        quizState.answers[
            question.id
        ] || "";


    quizElements.content.innerHTML = `

        <div class="quiz-question">

            <div class="quiz-question-number">

                FRÅGA ${questionNumber}

            </div>


            <h1>

                ${escapeHtml(
                    question.question
                )}

            </h1>


            <div class="quiz-options">

                ${createOption(
                    question.id,
                    "A",
                    question.option_a,
                    selectedAnswer
                )}

                ${createOption(
                    question.id,
                    "B",
                    question.option_b,
                    selectedAnswer
                )}

                ${createOption(
                    question.id,
                    "C",
                    question.option_c,
                    selectedAnswer
                )}

                ${createOption(
                    question.id,
                    "D",
                    question.option_d,
                    selectedAnswer
                )}

            </div>

        </div>

    `;


    setupAnswerListeners();


    if (quizElements.next) {

        if (questionNumber === totalQuestions) {

            quizElements.next.textContent =
                "Visa resultat →";

        } else {

            quizElements.next.textContent =
                "Nästa →";

        }

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    console.log(
        `❓ Question ${questionNumber}/${totalQuestions}`
    );

}


// =================================
// CREATE OPTION
// =================================

function createOption(
    questionId,
    letter,
    text,
    selectedAnswer
) {

    const selected =
        selectedAnswer === letter;


    return `

        <label
            class="quiz-option ${selected ? "selected" : ""}"
        >

            <input
                type="radio"
                name="quiz-answer-${questionId}"
                value="${letter}"
                ${selected ? "checked" : ""}
            >

            <span class="quiz-option-letter">
                ${letter}
            </span>

            <span class="quiz-option-text">
                ${escapeHtml(text)}
            </span>

        </label>

    `;

}


// =================================
// ANSWER LISTENERS
// =================================

function setupAnswerListeners() {

    const inputs =
        quizElements.content.querySelectorAll(
            'input[type="radio"]'
        );


    inputs.forEach(
        input => {

            input.addEventListener(
                "change",
                () => {

                    const question =
                        quizState.questions[
                            quizState.currentQuestion
                        ];


                    quizState.answers[
                        question.id
                    ] =
                        input.value;


                    updateSelectedOption();

                }
            );

        }
    );

}


// =================================
// UPDATE SELECTED OPTION
// =================================

function updateSelectedOption() {

    const options =
        quizElements.content.querySelectorAll(
            ".quiz-option"
        );


    options.forEach(
        option => {

            const input =
                option.querySelector(
                    "input"
                );


            if (
                input &&
                input.checked
            ) {

                option.classList.add(
                    "selected"
                );

            } else {

                option.classList.remove(
                    "selected"
                );

            }

        }
    );

}


// =================================
// NEXT QUESTION
// =================================

function nextQuestion() {

    if (
        quizState.loading ||
        quizState.finished
    ) {

        return;

    }


    const question =
        quizState.questions[
            quizState.currentQuestion
        ];


    if (!question) {

        return;

    }


    const answer =
        quizState.answers[
            question.id
        ];


    // No answer

    if (!answer) {

        if (quizElements.status) {

            quizElements.status.textContent =
                "Välj ett svar först.";

        }


        return;

    }


    if (quizElements.status) {

        quizElements.status.textContent =
            "";

    }


    // Next question

    if (
        quizState.currentQuestion <
        quizState.questions.length - 1
    ) {

        quizState.currentQuestion++;


        renderQuestion();


        return;

    }


    // Last question

    finishQuiz();

}


// =================================
// CALCULATE SCORE
// =================================

function calculateScore() {

    let score = 0;


    quizState.questions.forEach(
        question => {

            const answer =
                quizState.answers[
                    question.id
                ];


            if (!answer) {

                return;

            }


            if (
                String(answer).toUpperCase() ===
                String(
                    question.correct_answer
                ).toUpperCase()
            ) {

                score++;

            }

        }
    );


    return score;

}


// =================================
// FINISH QUIZ
// =================================

async function finishQuiz() {

    if (
        quizState.finished
    ) {

        return;

    }


    quizState.finished =
        true;


    console.log(
        "🏁 Finishing quiz..."
    );


    quizState.score =
        calculateScore();


    const total =
        quizState.questions.length;


    const percentage =
        total > 0
            ? Math.round(
                (
                    quizState.score /
                    total
                ) * 100
            )
            : 0;


    /*
        70% = godkänt.

        Ändra denna siffra senare
        om ni vill ha annan gräns.
    */

    const passed =
        percentage >= 70;


    console.log(
        `🏆 Quiz score: ${quizState.score}/${total}`
    );


    console.log(
        `📊 Percentage: ${percentage}%`
    );


    console.log(
        `🎓 Passed: ${passed}`
    );


    await saveQuizResult(
        quizState.score,
        total,
        percentage,
        passed
    );


    showResult(
        quizState.score,
        total,
        percentage,
        passed
    );

}


// =================================
// SAVE RESULT
// =================================

async function saveQuizResult(
    score,
    total,
    percentage,
    passed
) {

    const participant =
        quizState.participant ||
        getQuizParticipant();


    if (
        !participant ||
        !participant.id
    ) {

        console.warn(
            "⚠️ No participant found. Result cannot be saved."
        );

        return;

    }


    const certificateIssued =
        passed;


    const updateData = {

        quiz_score:
            score,

        quiz_passed:
            passed,

        certificate_issued:
            certificateIssued,

        course_completed:
            true

    };


    console.log(
        "💾 Saving quiz result:",
        {
            participantId:
                participant.id,

            score,

            total,

            percentage,

            passed,

            certificateIssued

        }
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from(
                    "festival2026_deltagare"
                )
                .update(
                    updateData
                )
                .eq(
                    "id",
                    participant.id
                )
                .select()
                .single();


        if (error) {

            throw error;

        }


        console.log(
            "✅ Quiz result saved",
            data
        );


        /*
            Keep local participant
            in sync.
        */

        Object.assign(
            participant,
            updateData
        );


        window.currentParticipant =
            participant;


    } catch (error) {

        console.error(
            "❌ Could not save quiz result:",
            error
        );

    }

}


// =================================
// SHOW RESULT
// =================================

function showResult(
    score,
    total,
    percentage,
    passed
) {

    const resultScore =
        document.getElementById(
            "result-score"
        );


    const resultDetail =
        document.getElementById(
            "result-detail"
        );


    const resultMessage =
        document.getElementById(
            "result-message"
        );


    const certificateText =
        document.getElementById(
            "certificate-text"
        );


    const resultStatus =
        document.getElementById(
            "result-status"
        );


    if (resultScore) {

        resultScore.textContent =
            `${percentage}%`;

    }


    if (resultDetail) {

        resultDetail.textContent =
            `Du fick ${score} av ${total} rätt.`;

    }


    if (passed) {

        if (resultStatus) {

            resultStatus.textContent =
                "✓ GODKÄND";

        }


        if (resultMessage) {

            resultMessage.textContent =
                "Snyggt! Du har klarat SaunaPortal-kursen och är nu certifierad.";

        }


        if (certificateText) {

            certificateText.textContent =
                "Ditt certifikat är utfärdat.";

        }

    } else {

        if (resultStatus) {

            resultStatus.textContent =
                "✕ EJ GODKÄND";

        }


        if (resultMessage) {

            resultMessage.textContent =
                "Du klarade inte godkäntgränsen den här gången. Läs igenom kursen och försök igen.";

        }


        if (certificateText) {

            certificateText.textContent =
                "Certifikatet utfärdas när du har klarat quizet.";

        }

    }


    if (
        typeof window.showView ===
        "function"
    ) {

        window.showView(
            "result-view"
        );

    }


    updateProfileAfterQuiz();

}


// =================================
// UPDATE PROFILE
// =================================

function updateProfileAfterQuiz() {

    const participant =
        quizState.participant ||
        getQuizParticipant();


    if (!participant) {

        return;

    }


    const name =
        participant.name ||
        "-";


    const alias =
        participant.alias ||
        "-";


    const profileName =
        document.getElementById(
            "user-name"
        );


    const profileAlias =
        document.getElementById(
            "user-alias"
        );


    if (profileName) {

        profileName.textContent =
            name;

    }


    if (profileAlias) {

        profileAlias.textContent =
            alias;

    }


    const quizScore =
        document.getElementById(
            "profile-quiz-score"
        );


    if (quizScore) {

        quizScore.textContent =
            `${quizState.score}/${quizState.questions.length}`;

    }


    const courseStatus =
        document.getElementById(
            "profile-course-status"
        );


    if (courseStatus) {

        courseStatus.textContent =
            "Klar";

    }

}


// =================================
// PROGRESS
// =================================

function updateQuizProgress() {

    if (!quizElements.progress) {

        return;

    }


    const current =
        quizState.currentQuestion + 1;


    const total =
        quizState.questions.length;


    quizElements.progress.textContent =
        `FRÅGA ${current} AV ${total}`;

}


// =================================
// ESCAPE HTML
// =================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =================================
// BUTTON
// =================================

if (
    quizElements.next
) {

    quizElements.next.addEventListener(
        "click",
        nextQuestion
    );

}


// =================================
// PUBLIC API
// =================================

window.startQuiz =
    startQuiz;


window.loadQuestions =
    loadQuestions;


window.nextQuestion =
    nextQuestion;


window.finishQuiz =
    finishQuiz;


// =================================
// INIT
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "📝 Quiz initialized"
        );

    }
);