// Импорт Firebase
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// === ЗАГРУЗКА ПРОГРАММ ===
export async function loadPrograms() {
    const container = document.querySelector('.programs-grid');
    if (!container) return;
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading" style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Загрузка программ...</div>';
    
    try {
        const q = query(
            collection(db, 'programs'),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (programs.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #7f8c8d;">Программ пока нет</p>';
            return;
        }
        
        container.innerHTML = programs.map(program => `
            <div class="program-card" data-slug="${program.slug}">
                <div class="program-card-image">
                    <img src="${program.image}" alt="${program.title}" onerror="this.src='https://via.placeholder.com/400x250/6198FF/FFFFFF?text=${encodeURIComponent(program.title)}'">
                </div>
                <div class="program-card-content">
                    <h3 class="program-card-title">${program.title}</h3>
                    <p class="program-card-desc">${program.shortDescription}</p>
                    <div class="program-card-meta" style="margin: 10px 0; font-size: 14px; color: #7f8c8d;">
                        <span><i class="fas fa-video"></i> ${program.videosCount || 0} уроков</span>
                        <span style="margin-left: 15px;"><i class="fas fa-clock"></i> ${program.timePerDay || ''}</span>
                    </div>
                    <div class="program-card-buttons">
                        <button class="btn-program-details" data-slug="${program.slug}">
                            О тренировке
                        </button>
                        <button class="btn-program-video" data-slug="${program.slug}">
                            Видео
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        console.log('✅ Программы загружены:', programs.length);
        
        // Инициализируем модальные окна
        initProgramModals(programs);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">Не удалось загрузить программы</p>';
    }
}

// === ИНИЦИАЛИЗАЦИЯ МОДАЛЬНЫХ ОКОН ===
function initProgramModals(programs) {
    // Кнопки "О тренировке"
    document.querySelectorAll('.btn-program-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const slug = this.dataset.slug;
            const program = programs.find(p => p.slug === slug);
            if (program) openProgramModal(program);
        });
    });
    
    // Кнопки "Видео"
    document.querySelectorAll('.btn-program-video').forEach(btn => {
        btn.addEventListener('click', function() {
            const slug = this.dataset.slug;
            const program = programs.find(p => p.slug === slug);
            if (program) openVideoModal(program);
        });
    });
}

// === ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ПРОГРАММЫ ===
function openProgramModal(program) {
    const modal = document.getElementById('programModal');
    if (!modal) return;
    
    document.getElementById('modalTitle').textContent = program.title;
    document.getElementById('modalSubtitle').textContent = program.fullDescription || program.shortDescription;
    document.getElementById('modalForWhom').textContent = program.forWhom || '';
    
    // Преимущества
    const benefitsList = document.getElementById('modalBenefits');
    if (benefitsList && program.benefits) {
        benefitsList.innerHTML = program.benefits.map(b => `<li>✓ ${b}</li>`).join('');
    }
    
    // Что входит
    const specsContainer = document.getElementById('modalSpecs');
    if (specsContainer) {
        specsContainer.innerHTML = `
            <div class="spec"><span>${program.duration || ''}</span></div>
            <div class="spec"><span>${program.videosCount || 0} видео</span></div>
            <div class="spec"><span>${program.timePerDay || ''}</span></div>
        `;
    }
    
    // Программа по неделям
    const scheduleContainer = document.getElementById('modalSchedule');
    if (scheduleContainer && program.schedule) {
        scheduleContainer.innerHTML = program.schedule.map(week => `<div class="schedule-item">${week}</div>`).join('');
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// === ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ВИДЕО ===
function openVideoModal(program) {
    const modal = document.getElementById('videoModal');
    if (!modal) return;
    
    const videoTitle = document.getElementById('videoModalTitle');
    const videoElement = document.getElementById('modalVideo');
    
    if (videoTitle) videoTitle.textContent = program.title;
    
    if (videoElement && program.videoUrl) {
        videoElement.querySelector('source').src = program.videoUrl;
        videoElement.load();
    } else if (videoTitle) {
        videoTitle.textContent = 'Видео скоро появится';
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// === ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ===
document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            const video = document.getElementById('modalVideo');
            if (video) { video.pause(); video.currentTime = 0; }
        }
    });
});

// === 🔥 АВТО-ОБНОВЛЕНИЕ: слушаем изменения из админки ===
window.addEventListener('storage', (e) => {
    if (e.key === 'programsUpdated') {
        console.log('🔄 Программы обновлены в админке, перезагружаем...');
        // Перезагружаем только программы, не всю страницу
        loadPrograms();
    }
});

// Экспорт
export { openProgramModal, openVideoModal };