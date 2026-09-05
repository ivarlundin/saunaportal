// ==========================================
// SAUNA FESTIVAL 2026 - QUIZ
// ==========================================

const quizQuestions = [

	{
		question: "Vad är viktigast i en gemensam bastu?",
		answers: [
			"Att visa hänsyn",
			"Att alltid prata högt",
			"Att stanna längst"
		],
		correct: 0
	},

	{
		question: "Vad bör du göra om du känner dig yr i bastun?",
		answers: [
			"Hämta mer vatten åt alla",
			"Lämna bastun och ta en paus",
			"Sätta dig närmare aggregatet"
		],
		correct: 0
	},

	{
		question: "Vad kännetecknar ett gott värdskap?",
		answers: [
			"Att kontrollera att alla är bekväma",
			"Att bestämma över alla andra",
			"Att hoppa över introduktionen"
		],
		correct: 0
	},

	{
		question: "Vad är klokt inför en aufguss?",
		answers: [
			"Att använda så mycket doft som möjligt",
			"Att informera gruppen och visa omtanke",
			"Att överraska alla utan förvarning"
		],
		correct: 0
	},

	{
		question: "Vad hjälper dig att må bra under bastubad?",
		answers: [
			"Vatten och regelbundna pauser",
			"Att ignorera kroppens signaler",
			"Att aldrig lämna bastun"
		],
		correct: 0
	}

];


function renderQuizQuestion() {

	const state =
		window.saunaFestival?.state;

	const content =
		document.getElementById("quiz-content");

	const progress =
		document.getElementById("quiz-progress");

	const nextButton =
		document.getElementById("quiz-next");

	if (!state || !content) {
		return;
	}

	const questionIndex = Math.min(
		state.quizQuestions.length,
		quizQuestions.length - 1
	);

	const question = quizQuestions[questionIndex];

	content.innerHTML = `
		<h1>${question.question}</h1>
		<div class="quiz-options">
			${question.answers.map((answer, answerIndex) => `
				<label>
					<input type="radio" name="quiz-answer" value="${answerIndex}">
					<span>${answer}</span>
				</label>
			`).join("")}
		</div>
	`;

	if (progress) {
		progress.textContent =
			`FRÅGA ${questionIndex + 1} AV ${quizQuestions.length}`;
	}

	if (nextButton) {
		nextButton.textContent =
			questionIndex === quizQuestions.length - 1
				? "Visa resultat →"
				: "Svara →";
	}

}


function submitQuizAnswer() {

	const state =
		window.saunaFestival?.state;

	const selected =
		document.querySelector(
			"input[name='quiz-answer']:checked"
		);

	const status =
		document.getElementById("quiz-status");

	if (!state || !selected) {

		if (status) {
			status.textContent = "Välj ett svar först.";
		}

		return;
	}

	const questionIndex = state.quizQuestions.length;
	const question = quizQuestions[questionIndex];

	if (Number(selected.value) === question.correct) {
		state.quizScore += 1;
	}

	state.quizQuestions.push(questionIndex);
	state.quizAnswers.push(Number(selected.value));

	if (status) {
		status.textContent = "";
	}

	if (state.quizQuestions.length < quizQuestions.length) {
		renderQuizQuestion();
		return;
	}

	window.saunaFestival.showResult(
		state.quizScore,
		quizQuestions.length
	);

}


function initQuiz() {

	document
		.getElementById("quiz-next")
		?.addEventListener("click", submitQuizAnswer);

}


window.saunaFestivalQuiz = {
	renderQuizQuestion
};


document.addEventListener(
	"DOMContentLoaded",
	initQuiz
);
