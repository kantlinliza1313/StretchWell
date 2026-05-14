// Данные программ
const programsData = {
    'back-pain': {
        title: 'Боли в спине',
        subtitle: 'Избавьтесь от боли в пояснице, шее и грудном отделе',
        forWhom: 'Для тех, кто испытывает боли в спине из-за сидячей работы, неправильной осанки или физических нагрузок.',
        benefits: [
            '✓ Устранение болей в пояснице и шее',
            '✓ Улучшение осанки',
            '✓ Снятие напряжения в грудном отделе',
            '✓ Укрепление мышц спины',
            '✓ Профилактика заболеваний позвоночника'
        ],
        specs: [
            '4 недели',
            '10 видео',
            '15-20 мин/день'
        ],
        schedule: [
            'Неделя 1: Диагностика и подготовка',
            'Неделя 2: Укрепление мышц спины',
            'Неделя 3: Растяжка и мобильность',
            'Неделя 4: Закрепление результата'
        ],
        video: 'assets/videos/back-pain-intro.mp4'
    },
    'leg-pain': {
        title: 'Боли в ногах',
        subtitle: 'Избавьтесь от тяжести и дискомфорта в ногах',
        forWhom: 'Для тех, кто испытывает судороги, тяжесть и боли в ногах после долгого дня.',
        benefits: [
            '✓ Избавление от судорог',
            '✓ Снятие тяжести в ногах',
            '✓ Растяжка мышц и связок',
            '✓ Улучшение кровообращения',
            '✓ Легкость в ногах'
        ],
        specs: [
            '3 недели',
            '8 видео',
            '15-25 мин/день'
        ],
        schedule: [
            'Неделя 1: Растяжка икр и бедер',
            'Неделя 2: Работа с суставами',
            'Неделя 3: Комплексное восстановление'
        ],
        video: 'assets/videos/leg-pain-intro.mp4'
    },
    flexibility: {
        title: 'Растяжка для гибкости',
        subtitle: 'Развивайте гибкость всего тела',
        forWhom: 'Для всех уровней подготовки — от начинающих до продвинутых.',
        benefits: [
            '✓ Развитие гибкости всего тела',
            '✓ Улучшение координации',
            '✓ Красивая осанка',
            '✓ Свобода движений',
            '✓ Подвижность суставов'
        ],
        specs: [
            '6 недель',
            '15 видео',
            '20-30 мин/день'
        ],
        schedule: [
            'Недели 1-2: Базовая растяжка',
            'Недели 3-4: Продвинутые упражнения',
            'Недели 5-6: Сложные элементы'
        ],
        video: 'assets/videos/flexibility-intro.mp4'
    },
    relaxation: {
        title: 'Расслабление',
        subtitle: 'Снимите стресс и напряжение',
        forWhom: 'Для тех, кто хочет снять стресс и восстановить силы после рабочего дня.',
        benefits: [
            '✓ Снятие мышечного напряжения',
            '✓ Уменьшение стресса',
            '✓ Улучшение качества сна',
            '✓ Эмоциональное равновесие',
            '✓ Восстановление сил'
        ],
        specs: [
            '3 недели',
            '8 видео',
            '10-25 мин/день'
        ],
        schedule: [
            'Неделя 1: Расслабление тела',
            'Неделя 2: Дыхательные практики',
            'Неделя 3: Гармония и баланс'
        ],
        video: 'assets/videos/relaxation-intro.mp4'
    },
    'post-workout': {
        title: 'Растяжка после тренировок',
        subtitle: 'Восстановление мышц после нагрузок',
        forWhom: 'Для тех, кто занимается спортом и хочет правильно восстанавливаться.',
        benefits: [
            '✓ Быстрое восстановление мышц',
            '✓ Предотвращение крепатуры',
            '✓ Улучшение результатов тренировок',
            '✓ Гибкость и мобильность',
            '✓ Профилактика травм'
        ],
        specs: [
            '4 недели',
            '12 видео',
            '10-20 мин'
        ],
        schedule: [
            'Неделя 1: Базовое восстановление',
            'Неделя 2: Растяжка после кардио',
            'Неделя 3: Растяжка после силовых',
            'Неделя 4: Комплексное восстановление'
        ],
        video: 'assets/videos/post-workout-intro.mp4'
    },
    intensive: {
        title: 'Интенсивная растяжка',
        subtitle: 'Достигните максимальной гибкости',
        forWhom: 'Для продвинутых, кто хочет освоить сложные элементы и достичь максимальной гибкости.',
        benefits: [
            '✓ Продвинутый уровень',
            '✓ Шпагаты и мостики',
            '✓ Сложные элементы',
            '✓ Максимальная гибкость',
            '✓ Профессиональный подход'
        ],
        specs: [
            '8 недель',
            '20 видео',
            '30-40 мин/день'
        ],
        schedule: [
            'Недели 1-2: Интенсивная подготовка',
            'Недели 3-5: Работа над шпагатами',
            'Недели 6-7: Мостики и прогибы',
            'Неделя 8: Сложные элементы'
        ],
        video: 'assets/videos/intensive-intro.mp4'
    }
};

// Модальные окна
document.addEventListener('DOMContentLoaded', function() {
    const programModal = document.getElementById('programModal');
    const videoModal = document.getElementById('videoModal');
    const modalCloseButtons = document.querySelectorAll('.modal-close');
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    
    // Кнопки "О тренировки"
    document.querySelectorAll('.btn-program-details').forEach(button => {
        button.addEventListener('click', function() {
            const programId = this.getAttribute('data-program');
            openProgramModal(programId);
        });
    });
    
    // Кнопки "Видео"
    document.querySelectorAll('.btn-program-video').forEach(button => {
        button.addEventListener('click', function() {
            const videoId = this.getAttribute('data-video');
            openVideoModal(videoId);
        });
    });
    
    // Закрытие модальных окон
    modalCloseButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal(programModal);
            closeModal(videoModal);
        });
    });
    
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', function() {
            closeModal(programModal);
            closeModal(videoModal);
        });
    });
    
    // Закрытие по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal(programModal);
            closeModal(videoModal);
        }
    });
    
    // Открытие модального окна с программой
    function openProgramModal(programId) {
        const data = programsData[programId];
        if (!data) return;
        
        document.getElementById('modalTitle').textContent = data.title;
        document.getElementById('modalSubtitle').textContent = data.subtitle;
        document.getElementById('modalForWhom').textContent = data.forWhom;
        
        // Преимущества
        const benefitsList = document.getElementById('modalBenefits');
        benefitsList.innerHTML = data.benefits.map(benefit => `<li>${benefit}</li>`).join('');
        
        // Характеристики
        const specsContainer = document.getElementById('modalSpecs');
        specsContainer.innerHTML = data.specs.map(spec => `
            <div class="spec">
                <span>${spec}</span>
            </div>
        `).join('');
        
        // Расписание
        const scheduleContainer = document.getElementById('modalSchedule');
        scheduleContainer.innerHTML = data.schedule.map(item => `
            <div class="schedule-item">${item}</div>
        `).join('');
        
        programModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Открытие модального окна с видео
    function openVideoModal(videoId) {
        const data = programsData[videoId];
        if (!data) return;
        
        const videoElement = document.getElementById('modalVideo');
        videoElement.querySelector('source').src = data.video;
        videoElement.load();
        
        document.getElementById('videoModalTitle').textContent = data.title;
        
        videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Закрытие модального окна
    function closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Остановить видео при закрытии
        if (modal === videoModal) {
            const videoElement = document.getElementById('modalVideo');
            videoElement.pause();
        }
    }
});