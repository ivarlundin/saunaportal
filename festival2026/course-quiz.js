(function () {
    const SUPABASE_URL = "https://nicpgzkkyktzphkyzhfl.supabase.co";
    const SUPABASE_KEY = "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";
    const SESSION_KEY = "sauna_festival_participant_id";

    function normalizeAnswerString(answerString = "") {
        return answerString
            .split(/[\s,]+/)
            .map(part => part.trim().toUpperCase())
            .filter(Boolean)
            .join(",");
    }

    function getSubmittedAnswersString(answers = []) {
        return normalizeAnswerString(answers.join(", "));
    }

    function initCourseQuiz({
        courseSlug,
        courseSteps = [],
        quizQuestions = []
    }) {
        if (!window.supabase) {
            console.warn("⚠️ Supabase JS is not loaded yet.");
            return;
        }

        const supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        // ==========================================
        // QUIZINSTÄLLNINGAR
        // ==========================================

        // Minsta procent för att bli godkänd
        const PASS_PERCENTAGE = 60;

        // Rätt svar på de 10 frågorna
        const correctAnswers = [
            "C",
            "B",
            "D",
            "B",
            "C",
            "D",
            "A",
            "C",
            "B",
            "D"
        ];

        // ==========================================
        // SUPABASE
        // ==========================================

        async function getCourseRecordBySlug(courseSlug) {
            if (!courseSlug) {
                return null;
            }

            const { data, error } = await supabaseClient
                .from("festival2026_courses")
                .select("id, course_key")
                .eq("slug", courseSlug)
                .maybeSingle();

            if (error) {
                console.error("Could not load course record:", error);
                return null;
            }

            return data || null;
        }

        async function syncCourseEnrollment(fields = {}) {
            if (!courseSlug) {
                return false;
            }

            const participantId = localStorage.getItem(SESSION_KEY);

            if (!participantId) {
                return false;
            }

            const courseRecord = await getCourseRecordBySlug(courseSlug);

            if (!courseRecord?.id) {
                return false;
            }

            const { error } = await supabaseClient
                .functions
                .invoke("festival2026-auth", {
                    body: {
                        action: "save_enrollment",
                        participant_id: participantId,
                        course_id: courseRecord.id,
                        fields
                    }
                });

            if (error) {
                console.error("Could not sync course enrollment:", error);
                return false;
            }

            return true;
        }

        // ==========================================
        // STATE
        // ==========================================

        const state = {
            step: 0,
            quizIndex: 0,
            answers: [],
            isSubmitting: false
        };

        // ==========================================
        // COURSE
        // ==========================================

        function renderCourseStep() {
            const step = courseSteps[state.step];

            if (!step) {
                return;
            }

            const content = document.getElementById("course-content");
            const progress = document.getElementById("course-progress");
            const backButton = document.getElementById("course-back");
            const nextButton = document.getElementById("course-next");

            if (content) {
                content.innerHTML = `
                    <h1>${step.title}</h1>
                    ${step.content}
                `;
            }

            if (progress) {
                progress.textContent =
                    `STEG ${state.step + 1} AV ${courseSteps.length}`;
            }

            if (backButton) {
                backButton.disabled = state.step === 0;
            }

            if (nextButton) {
                nextButton.textContent =
                    state.step === courseSteps.length - 1
                        ? "Starta quizet →"
                        : "Nästa →";
            }
        }

        function showQuiz() {
            const courseModal = document.getElementById("course-modal");
            const quizPanel = document.getElementById("quiz-panel");
            const quizProgress = document.getElementById("quiz-progress");
            const status = document.getElementById("quiz-status");

            if (courseModal) {
                courseModal.hidden = true;
            }

            if (quizPanel) {
                quizPanel.hidden = false;
            }

            if (status) {
                status.textContent = "";
            }

            if (quizProgress) {
                quizProgress.textContent =
                    `QUIZ - ${quizQuestions.length} FRÅGOR`;
            }

            if (quizQuestions.length > 0) {
                state.quizIndex = 0;
                state.answers = [];
                renderQuizQuestion();
            }
        }

        function showPreviousCourseStep() {
            const quizPanel = document.getElementById("quiz-panel");
            const courseModal = document.getElementById("course-modal");

            if (quizPanel) {
                quizPanel.hidden = true;
            }

            if (courseModal) {
                courseModal.hidden = false;
            }

            state.step = courseSteps.length - 1;

            renderCourseStep();
        }

        // ==========================================
        // QUIZ
        // ==========================================

        function renderQuizQuestion() {
            if (!quizQuestions.length) {
                return;
            }

            const question = quizQuestions[state.quizIndex];

            if (!question) {
                return;
            }

            const quizProgress =
                document.getElementById("quiz-progress");

            const quizContent =
                document.getElementById("quiz-content");

            const nextButton =
                document.getElementById("quiz-next");

            if (quizProgress) {
                quizProgress.textContent =
                    `FRÅGA ${state.quizIndex + 1} AV ${quizQuestions.length}`;
            }

            if (quizContent) {
                quizContent.innerHTML = `
                    <h1>${question.question}</h1>

                    <div class="quiz-options">
                        ${question.answers.map((answer, index) => {
                            const value =
                                String.fromCharCode(65 + index);

                            return `
                                <label>
                                    <input
                                        type="radio"
                                        name="course-quiz-answer"
                                        value="${value}"
                                    >
                                    <span>${answer}</span>
                                </label>
                            `;
                        }).join("")}
                    </div>
                `;
            }

            if (nextButton) {
                nextButton.textContent =
                    state.quizIndex === quizQuestions.length - 1
                        ? "Visa resultat →"
                        : "Svara →";
            }
        }

        async function resetQuizIfFailed(score = null) {
            state.quizIndex = 0;
            state.answers = [];

            const status =
                document.getElementById("quiz-status");

            const resultPanel =
                document.getElementById("result-panel");

            const quizPanel =
                document.getElementById("quiz-panel");

            if (status) {
                if (score !== null) {
                    status.textContent =
                        `✕ ${score}% — du behöver minst ${PASS_PERCENTAGE}% för godkänt. Försök igen från början.`;
                } else {
                    status.textContent =
                        "✕ Du misslyckades. Försök igen från början.";
                }
            }

            if (resultPanel) {
                resultPanel.hidden = true;
            }

            if (quizPanel) {
                quizPanel.hidden = false;
            }

            renderQuizQuestion();
        }

        // ==========================================
        // RÄTTA QUIZ
        // ==========================================

        async function finishQuiz() {
            const participantId =
                localStorage.getItem(SESSION_KEY);

            // ------------------------------------------
            // Räkna rätt svar
            // ------------------------------------------

            const correctCount =
                state.answers.reduce((score, answer, index) => {
                    return score +
                        (answer === correctAnswers[index] ? 1 : 0);
                }, 0);

            const totalQuestions =
                correctAnswers.length;

            // ------------------------------------------
            // Räkna procent
            // ------------------------------------------

            const quizScore = Math.round(
                (correctCount / totalQuestions) * 100
            );

            // ------------------------------------------
            // Godkänt om minst 60 %
            // ------------------------------------------

            const hasPassed =
                quizScore >= PASS_PERCENTAGE;

            console.log(
                `Quizresultat: ${correctCount}/${totalQuestions} = ${quizScore}%`
            );

            console.log(
                `Godkänd: ${hasPassed}`
            );

            // ------------------------------------------
            // Spara resultat till deltagaren
            // ------------------------------------------

            if (participantId) {
                const { error } = await supabaseClient
                    .from("festival2026_deltagare")
                    .update({
                        course_completed: hasPassed,
                        quiz_score: quizScore,
                        quiz_passed: hasPassed,
                        certificate_issued: hasPassed
                    })
                    .eq("id", participantId);

                if (error) {
                    console.error(
                        "Could not save certification:",
                        error
                    );
                }

                // --------------------------------------
                // Spara även via Edge Function
                // --------------------------------------

                await syncCourseEnrollment({
                    course_completed: hasPassed,
                    quiz_score: quizScore,
                    quiz_passed: hasPassed,
                    certificate_issued: hasPassed,
                    completed_at: hasPassed
                        ? new Date().toISOString()
                        : null
                });
            }

            // ------------------------------------------
            // UNDERKÄNT
            // ------------------------------------------

            if (!hasPassed) {
                await resetQuizIfFailed(quizScore);
                return;
            }

            // ------------------------------------------
            // GODKÄNT
            // ------------------------------------------

            const resultPanel =
                document.getElementById("result-panel");

            const quizPanel =
                document.getElementById("quiz-panel");

            const resultScore =
                document.getElementById("result-score");

            const resultMessage =
                document.getElementById("result-message");

            if (quizPanel) {
                quizPanel.hidden = true;
            }

            if (resultPanel) {
                resultPanel.hidden = false;
            }

            if (resultScore) {
                resultScore.textContent =
                    `${quizScore}%`;
            }

            if (resultMessage) {
                resultMessage.textContent =
                    `Du är godkänd och certifierad! ${correctCount} av ${totalQuestions} rätt.`;
            }
        }

        // ==========================================
        // STARTA KURS
        // ==========================================

        async function markCourseStarted() {
            const participantId =
                localStorage.getItem(SESSION_KEY);

            if (!participantId) {
                return false;
            }

            const { error } = await supabaseClient
                .from("festival2026_deltagare")
                .update({
                    course_started: true
                })
                .eq("id", participantId);

            if (error) {
                console.error(
                    "Could not mark course as started:",
                    error
                );
            }

            await syncCourseEnrollment({
                course_started: true,
                started_at: new Date().toISOString(),
                progress_percentage: 20
            });

            return true;
        }

        // ==========================================
        // EVENTS
        // ==========================================

        function bindCourseEvents() {
            const courseBack =
                document.getElementById("course-back");

            const courseNext =
                document.getElementById("course-next");

            const quizNext =
                document.getElementById("quiz-next");

            const quizBack =
                document.getElementById("quiz-back");

            const resultDashboard =
                document.getElementById("result-dashboard");

            // ------------------------------------------
            // Föregående kurssteg
            // ------------------------------------------

            courseBack?.addEventListener("click", () => {
                if (state.step > 0) {
                    state.step -= 1;
                    renderCourseStep();
                }
            });

            // ------------------------------------------
            // Nästa kurssteg
            // ------------------------------------------

            courseNext?.addEventListener("click", () => {
                if (state.step < courseSteps.length - 1) {
                    state.step += 1;
                    renderCourseStep();
                    return;
                }

                showQuiz();
            });

            // ------------------------------------------
            // Quiz-svar
            // ------------------------------------------

            quizNext?.addEventListener("click", () => {

                // Avbryt om quizet redan håller på
                // att rättas mot databasen
                if (state.isSubmitting) {
                    return;
                }

                const selected =
                    document.querySelector(
                        "input[name='course-quiz-answer']:checked"
                    );

                const status =
                    document.getElementById("quiz-status");

                // Inget svar valt
                if (!selected) {
                    if (status) {
                        status.textContent =
                            "Välj ett svar först.";
                    }

                    return;
                }

                // Spara svaret
                state.answers.push(
                    selected.value
                        .trim()
                        .toUpperCase()
                );

                if (status) {
                    status.textContent = "";
                }

                // Gå till nästa fråga
                state.quizIndex += 1;

                // Det finns fler frågor
                if (state.quizIndex < quizQuestions.length) {
                    renderQuizQuestion();
                    return;
                }

                // --------------------------------------
                // Quizet är klart
                // --------------------------------------

                state.isSubmitting = true;

                quizNext.disabled = true;

                const originalText =
                    quizNext.textContent;

                quizNext.textContent =
                    "Rättar...";

                // Rätta quizet
                finishQuiz().finally(() => {

                    state.isSubmitting = false;

                    quizNext.disabled = false;

                    quizNext.textContent =
                        originalText;
                });
            });

            // ------------------------------------------
            // Tillbaka från quiz
            // ------------------------------------------

            quizBack?.addEventListener(
                "click",
                showPreviousCourseStep
            );

            // ------------------------------------------
            // Resultat -> dashboard
            // ------------------------------------------

            resultDashboard?.addEventListener("click", () => {
                window.location.href = "index.html";
            });
        }

        // ==========================================
        // INIT
        // ==========================================

        bindCourseEvents();

        markCourseStarted()
            .then(() => renderCourseStep())
            .catch(() => renderCourseStep());
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    window.CourseQuiz = {
        init: initCourseQuiz,
        normalizeAnswerString,
        getSubmittedAnswersString
    };
})();