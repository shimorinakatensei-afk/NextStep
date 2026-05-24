document.addEventListener('DOMContentLoaded', () => {

    // GPA слайдер
    const gpaSlider = document.getElementById('gpa_uzbek');
    const gpaValue = document.getElementById('gpaValue');
    gpaSlider.addEventListener('input', (e) => {
        gpaValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Сабмит формы
    document.getElementById('profileForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const profile = {
            name: document.getElementById('name').value.trim(),
            city: document.getElementById('city').value,
            grade: document.getElementById('grade').value,
            gpa_uzbek: document.getElementById('gpa_uzbek').value,
            ielts_score: document.getElementById('ielts_score').value,
            sat_score: document.getElementById('sat_score').value,
            olympiads: document.getElementById('olympiads').value.trim(),
            budget_raw: document.getElementById('budget_raw').value
        };

        // Сохраняем в sessionStorage и переходим на карту
        sessionStorage.setItem('profile', JSON.stringify(profile));
        window.location.href = '/map.html';
    });
});