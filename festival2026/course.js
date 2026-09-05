// ==========================================
// SAUNA FESTIVAL 2026 - COURSE
// ==========================================

const courseSteps = [

	{
		title: "Välkommen till SaunaPortal",
		content: `
			<p>Här börjar din väg mot SaunaPortal-certifieringen.</p>
			<div class="course-content-box">
				<strong>Så fungerar kursen</strong>
				<p>Gå igenom fem korta steg om bastukultur, säkerhet och värdskap. När kursen är klar väntar ett quiz.</p>
			</div>
		`
	},

	{
		title: "Bastukultur",
		content: `
			<p>Bastun är en plats för återhämtning, närvaro och gemenskap.</p>
			<div class="course-content-box">
				<strong>En bra bastuupplevelse</strong>
				<p>Visa hänsyn, respektera tystnad när den behövs och lämna plats för alla.</p>
			</div>
		`
	},

	{
		title: "Säkerhet först",
		content: `
			<p>Lyssna på kroppen och lämna bastun om du känner dig yr eller illamående.</p>
			<div class="course-content-box">
				<strong>Kom ihåg</strong>
				<p>Drick vatten, ta pauser och följ alltid festivalens säkerhetsanvisningar.</p>
			</div>
		`
	},

	{
		title: "Värdskap och aufguss",
		content: `
			<p>Ett gott värdskap skapar trygghet och gör upplevelsen bättre för hela gruppen.</p>
			<div class="course-content-box">
				<strong>Inför en aufguss</strong>
				<p>Berätta vad som händer, kontrollera att alla är bekväma och använd dofter med omtanke.</p>
			</div>
		`
	},

	{
		title: "Redo för quizet",
		content: `
			<p>Du har nu gått igenom grunderna i SaunaPortal-kursen.</p>
			<div class="course-content-box">
				<strong>Nästa steg</strong>
				<p>Avsluta kursen och testa dina kunskaper i certifieringsquizet.</p>
			</div>
		`
	}

];


function renderCourseStep() {

	const state =
		window.saunaFestival?.state;

	const content =
		document.getElementById("course-content");

	const progress =
		document.getElementById("course-progress");

	const backButton =
		document.getElementById("course-back");

	const nextButton =
		document.getElementById("course-next");

	if (!state || !content) {
		return;
	}

	const stepIndex = Math.max(
		0,
		Math.min(
			state.courseStep,
			courseSteps.length - 1
		)
	);

	state.courseStep = stepIndex;

	const step = courseSteps[stepIndex];

	content.innerHTML = `
		<h1>${step.title}</h1>
		${step.content}
	`;

	if (progress) {
		progress.textContent =
			`STEG ${stepIndex + 1} AV ${courseSteps.length}`;
	}

	if (backButton) {
		backButton.disabled = stepIndex === 0;
	}

	if (nextButton) {
		nextButton.textContent =
			stepIndex === courseSteps.length - 1
				? "Starta quizet →"
				: "Nästa →";
	}

}


function initCourse() {

	document
		.getElementById("course-back")
		?.addEventListener("click", () => {

			const state = window.saunaFestival?.state;

			if (state && state.courseStep > 0) {
				state.courseStep -= 1;
				renderCourseStep();
			}

		});

	document
		.getElementById("course-next")
		?.addEventListener("click", () => {

			const state = window.saunaFestival?.state;

			if (!state) {
				return;
			}

			if (state.courseStep < courseSteps.length - 1) {
				state.courseStep += 1;
				renderCourseStep();
				return;
			}

			window.saunaFestival.startQuiz();

		});

}


window.saunaFestivalCourse = {
	renderCourseStep
};


document.addEventListener(
	"DOMContentLoaded",
	initCourse
);
