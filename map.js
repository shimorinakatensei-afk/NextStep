document.addEventListener('DOMContentLoaded', () => {

    // Проверяем что профиль есть
    const profile = JSON.parse(sessionStorage.getItem('profile'));
    if (!profile) {
        window.location.href = '/';
        return;
    }

    const universityData = {
        usa: {
            label: "США",
            list: [
                "Massachusetts Institute of Technology (MIT)",
                "Stanford University",
                "Harvard University",
                "Princeton University",
                "Yale University",
                "Brown University"
            ]
        },
        europe: {
            label: "Европа",
            list: [
                "ETH Zurich (Швейцария)",
                "Technical University of Munich (Германия)",
                "Sorbonne University (Франция)",
                "Delft University of Technology (Нидерланды)"
            ]
        },
        asia: {
            label: "Азия",
            list: [
                "National University of Singapore (NUS)",
                "KAIST (Южная Корея)",
                "Seoul National University",
                "Tsinghua University (Китай)"
            ]
        },
        uk: {
            label: "Великобритания",
            list: [
                "University of Oxford",
                "University of Cambridge",
                "Imperial College London",
                "London School of Economics (LSE)"
            ]
        }
    };

    const mapLands = document.querySelectorAll('.land');
    const uniBlock = document.getElementById('university-selector-block');
    const uniGrid = document.getElementById('university-grid');
    const submitFinalBtn = document.getElementById('submitFinalBtn');
    const hiddenCountryInput = document.getElementById('selected_country');
    const hiddenUniInput = document.getElementById('selected_university');

    // Назад на форму
    document.getElementById('backToFormBtn').addEventListener('click', () => {
        window.location.href = '/';
    });

    // Клик по региону карты
    mapLands.forEach(land => {
        land.addEventListener('click', () => {
            mapLands.forEach(l => l.classList.remove('active'));
            land.classList.add('active');

            const countryKey = land.getAttribute('data-country');
            hiddenCountryInput.value = countryKey;
            hiddenUniInput.value = '';

            // Сбросить кнопку
            submitFinalBtn.disabled = true;
            submitFinalBtn.className = 'w-full sm:w-2/3 h-12 bg-blue-600/30 text-blue-400 border border-blue-900/50 rounded-xl text-sm font-bold tracking-wide transition cursor-not-allowed';
            submitFinalBtn.textContent = 'Выберите университет';

            // Рендер списка вузов
            if (universityData[countryKey]) {
                uniGrid.innerHTML = '';
                uniBlock.classList.remove('hidden');

                universityData[countryKey].list.forEach(uniName => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'uni-btn w-full h-10 px-4 rounded-lg bg-slate-950 border border-slate-800 text-left text-xs font-medium text-slate-300 hover:border-slate-700 cursor-pointer truncate transition';
                    btn.textContent = uniName;

                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.uni-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        hiddenUniInput.value = uniName;

                        submitFinalBtn.disabled = false;
                        submitFinalBtn.className = 'w-full sm:w-2/3 h-12 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-sm font-bold tracking-wide transition cursor-pointer shadow-lg shadow-blue-900/20';
                        submitFinalBtn.textContent = `Сгенерировать план →`;
                    });

                    uniGrid.appendChild(btn);
                });
            }
        });
    });

    // Фразы загрузки
    const loadingPhrases = [
        "Инициализация нейросетевых моделей...",
        "Анализируем академический контекст Узбекистана...",
        "Сравниваем с 11 реальными кейсами...",
        "Оцениваем требования выбранного университета...",
        "Синтезируем пошаговый план развития..."
    ];

    // Финальная отправка
    submitFinalBtn.addEventListener('click', async () => {
        if (!profile || !hiddenUniInput.value) return;

        const finalPayload = {
            ...profile,
            dream_university: `${hiddenUniInput.value}`
        };

        // Показать лоадер
        document.getElementById('screen-map').classList.add('hidden');
        document.getElementById('screen-loading').classList.remove('hidden');

        let phraseIndex = 0;
        const statusDisplay = document.getElementById('loading-status');
        const loadingInterval = setInterval(() => {
            phraseIndex = (phraseIndex + 1) % loadingPhrases.length;
            statusDisplay.textContent = loadingPhrases[phraseIndex];
        }, 1200);

        try {
            const response = await fetch('/api/generate-roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });

            const resData = await response.json();
            clearInterval(loadingInterval);

            if (!resData.success) {
                alert('Ошибка сервера: ' + resData.error);
                document.getElementById('screen-loading').classList.add('hidden');
                document.getElementById('screen-map').classList.remove('hidden');
                return;
            }

            // Сохраняем результат и переходим на result.html
            sessionStorage.setItem('result', JSON.stringify(resData.data));
            window.location.href = '/result.html';

        } catch (error) {
            clearInterval(loadingInterval);
            console.error('Ошибка:', error);
            alert('Не удалось связаться с сервером. Убедись что node server.js запущен.');
            document.getElementById('screen-loading').classList.add('hidden');
            document.getElementById('screen-map').classList.remove('hidden');
        }
    });
});