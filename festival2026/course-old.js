function showSection(sectionId) {
    const sections = document.querySelectorAll('main section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Quiz form submission handler
document.getElementById('quizForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const answers = Object.fromEntries(formData);

    // Validate answers
    const correctAnswers = {
        q1: 'A',
        q2: 'B'
    };

    let score = 0;
    for (const [question, answer] of Object.entries(answers)) {
        if (answer === correctAnswers[question]) {
            score++;
        }
    }

    // Display results
    document.getElementById('resultsMessage').innerHTML = 
        `<p>You scored ${score} out of 2!</p>
         <p>${score === 2 ? 'Congratulations! You passed the quiz.' : 'You need to review the material before proceeding.'}</p>`;

    // Submit results to Supabase
    const user = getCurrentUser(); // Assume this function exists in app.js
    if (user) {
        supabase.from('quiz_results').insert({
            user_id: user.id,
            course_id: 1,
            answers: JSON.stringify(answers),
            score: score,
            completed: true
        }).then(() => {
            // Mark course as completed if necessary
            markCourseCompleted(user.id, 1);
        });
    }
});