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

        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const state = {
            step: 0,
            quizIndex: 0,
            answers: []
        };

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
                content.innerHTML = `<h1>${step.title}</h1>${step.content}`;
            }

            if (progress) {
                progress.textContent = `STEG ${state.step + 1} AV ${courseSteps.length}`;
            }

            if (backButton) {
                backButton.disabled = state.step === 0;
            }

            if (nextButton) {
                nextButton.textContent = state.step === courseSteps.length - 1 ? "Starta quizet →" : "Nästa →";
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
                quizProgress.textContent = `QUIZ - ${quizQuestions.length} FRÅGOR`;
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

        function renderQuizQuestion() {
            if (!quizQuestions.length) {
                return;
            }

            const question = quizQuestions[state.quizIndex];

            if (!question) {
                return;
            }

            const quizProgress = document.getElementById("quiz-progress");
            const quizContent = document.getElementById("quiz-content");
            const nextButton = document.getElementById("quiz-next");

            if (quizProgress) {
                quizProgress.textContent = `FRÅGA ${state.quizIndex + 1} AV ${quizQuestions.length}`;
            }

            if (quizContent) {
                quizContent.innerHTML = `
                    <h1>${question.question}</h1>
                    <div class="quiz-options">
                        ${question.answers.map((answer, index) => {
                            const value = String.fromCharCode(65 + index);
                            return `
                                <label>
                                    <input type="radio" name="course-quiz-answer" value="${value}">
                                    <span>${answer}</span>
                                </label>
                            `;
                        }).join("")}
                    </div>
                `;
            }

            if (nextButton) {
                nextButton.textContent = state.quizIndex === quizQuestions.length - 1 ? "Visa resultat →" : "Svara →";
            }
        }

        async function resetQuizIfFailed() {
            state.quizIndex = 0;
            state.answers = [];

            const status = document.getElementById("quiz-status");
            const resultPanel = document.getElementById("result-panel");
            const quizPanel = document.getElementById("quiz-panel");

            if (status) {
                status.textContent = "✕ Du misslyckades. Försök igen från början.";
            }

            if (resultPanel) {
                resultPanel.hidden = true;
            }

            if (quizPanel) {
                quizPanel.hidden = false;
            }

            renderQuizQuestion();
        }

        async function finishQuiz() {
            const participantId = localStorage.getItem(SESSION_KEY);
            let expectedAnswers = "";

            if (courseSlug) {
                const { data: courseRow, error: courseRowError } = await supabaseClient
                    .from("festival2026_courses")
                    .select("course_key")
                    .eq("slug", courseSlug)
                    .maybeSingle();

                if (courseRowError) {
                    console.error("Could not load course key:", courseRowError);
                }

                expectedAnswers = courseRow?.course_key || "";
            }

            const submittedAnswers = getSubmittedAnswersString(state.answers);
            const normalizedExpectedAnswers = normalizeAnswerString(expectedAnswers);
            const hasMatchingAnswerString = normalizedExpectedAnswers.length > 0 && submittedAnswers === normalizedExpectedAnswers;

            if (participantId) {
                const { error } = await supabaseClient
                    .from("festival2026_deltagare")
                    .update({
                        course_completed: hasMatchingAnswerString,
                        quiz_score: hasMatchingAnswerString ? 100 : 0,
                        quiz_passed: hasMatchingAnswerString,
                        certificate_issued: hasMatchingAnswerString
                    })
                    .eq("id", participantId);

                if (error) {
                    console.error("Could not save certification:", error);
                }
            }

            if (!hasMatchingAnswerString) {
                await resetQuizIfFailed();
                return;
            }

            const resultPanel = document.getElementById("result-panel");
            const quizPanel = document.getElementById("quiz-panel");
            const resultScore = document.getElementById("result-score");
            const resultMessage = document.getElementById("result-message");

            if (quizPanel) {
                quizPanel.hidden = true;
            }

            if (resultPanel) {
                resultPanel.hidden = false;
            }

            if (resultScore) {
                resultScore.textContent = "100%";
            }

            if (resultMessage) {
                resultMessage.textContent = "Du är godkänd och certifierad!";
            }
        }

        async function markCourseStarted() {
            const participantId = localStorage.getItem(SESSION_KEY);

            if (!participantId) {
                return false;
            }

            const { error } = await supabaseClient
                .from("festival2026_deltagare")
                .update({ course_started: true })
                .eq("id", participantId);

            if (error) {
                console.error("Could not mark course as started:", error);
            }

            return true;
        }

        function bindCourseEvents() {
            const courseBack = document.getElementById("course-back");
            const courseNext = document.getElementById("course-next");
            const quizNext = document.getElementById("quiz-next");
            const quizBack = document.getElementById("quiz-back");
            const resultDashboard = document.getElementById("result-dashboard");

            courseBack?.addEventListener("click", () => {
                if (state.step > 0) {
                    state.step -= 1;
                    renderCourseStep();
                }
            });

            courseNext?.addEventListener("click", () => {
                if (state.step < courseSteps.length - 1) {
                    state.step += 1;
                    renderCourseStep();
                    return;
                }

                showQuiz();
            });

            quizNext?.addEventListener("click", () => {
                const selected = document.querySelector("input[name='course-quiz-answer']:checked");
                const status = document.getElementById("quiz-status");

                if (!selected) {
                    if (status) {
                        status.textContent = "Välj ett svar först.";
                    }
                    return;
                }

                state.answers.push(selected.value.trim().toUpperCase());

                if (status) {
                    status.textContent = "";
                }

                state.quizIndex += 1;

                if (state.quizIndex < quizQuestions.length) {
                    renderQuizQuestion();
                    return;
                }

                finishQuiz();
            });

            quizBack?.addEventListener("click", showPreviousCourseStep);

            resultDashboard?.addEventListener("click", () => {
                window.location.href = "index.html";
            });
        }

        bindCourseEvents();
        markCourseStarted().then(() => renderCourseStep()).catch(() => renderCourseStep());
    }

    window.CourseQuiz = {
        init: initCourseQuiz,
        normalizeAnswerString,
        getSubmittedAnswersString
    };
})();
