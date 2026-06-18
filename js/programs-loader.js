// programs-loader.js
// Импорт Firebase
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let allPrograms = [];
let currentSlide = 0;

// ============================================
// 🔹 ЗАГРУЗКА ПРОГРАММ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📥 Загрузка программ для главной страницы...');
    await loadPrograms();
});

// ============================================
// 🔥 ЗАГРУЗКА ПРОГРАММ ИЗ FIRESTORE
// ============================================
async function loadPrograms() {
    try {
        const slider = document.getElementById('servicesSlider');
        
        if (!slider) {
            console.log('⚠️ Элемент servicesSlider не найден');
            return;
        }
        
        // Загружаем все программы
        const programsRef = collection(db, 'programs');
        const snapshot = await getDocs(programsRef);
        
        if (snapshot.empty) {
            console.log('⚠️ Программы не найдены');
            slider.innerHTML = `
                <div class="no-programs" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 48px; color: #e1e8ed; margin-bottom: 15px; display: block;"></i>
                    <p style="color: #7f8c8d;">Программы временно отсутствуют</p>
                </div>
            `;
            return;
        }
        
        // Преобразуем в массив
        allPrograms = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`✅ Загружено программ: ${allPrograms.length}`);
        
        // Отображаем программы
        renderPrograms(allPrograms);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        const slider = document.getElementById('servicesSlider');
        if (slider) {
            slider.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-exclamation-circle" style="color: #e74c3c; font-size: 32px; display: block; margin-bottom: 10px;"></i>
                    <p style="color: #7f8c8d;">Ошибка загрузки программ</p>
                </div>
            `;
        }
    }
}

// ============================================
// 🔥 ОТРИСОВКА ПРОГРАММ
// ============================================
function renderPrograms(programs) {
    const slider = document.getElementById('servicesSlider');
    const dotsContainer = document.getElementById('servicesDots');
    
    if (!slider) return;
    
    // Создаем HTML для каждой программы
    const programsHTML = programs.map((program, index) => {
        const image = program.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(program.title)}&background=6198FF&color=fff&size=400`;
        const lessonsCount = program.videosCount || program.lessons?.length || 0;
        const timePerDay = program.timePerDay || '10-15 мин';
        
        return `
            <div class="service-card" data-program-id="${program.id}" data-program-slug="${program.slug}">
                <img src="${image}" alt="${program.title}" class="service-image" 
                     onerror="this.src='https://via.placeholder.com/400x220/6198FF/FFFFFF?text=${encodeURIComponent(program.title)}'">
                
                <div class="service-content">
                    <h3 class="service-title">${program.title}</h3>
                    
                    <p class="service-description">
                        ${program.shortDescription || program.fullDescription || 'Описание отсутствует'}
                    </p>
                    
                    <div class="service-meta">
                        <div class="service-meta-item">
                            <i class="fas fa-video"></i>
                            <span>${lessonsCount} уроков</span>
                        </div>
                        <div class="service-meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${timePerDay}</span>
                        </div>
                    </div>
                    
                    <div class="service-buttons">
                        <button onclick="openProgram('${program.slug}')" class="service-btn service-btn-primary">
                            О тренировке
                        </button>
                        ${program.videoUrl ? `
                            <a href="${program.videoUrl}" target="_blank" class="service-btn service-btn-secondary">
                                Видео
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    slider.innerHTML = programsHTML;
    
    // Создаем индикаторы (точки)
    if (dotsContainer && programs.length > 1) {
        const dotsHTML = programs.map((_, index) => `
            <div class="slider-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></div>
        `).join('');
        dotsContainer.innerHTML = dotsHTML;
    }
    
    // Обновляем кнопки
    updateSliderButtons();
}

// ============================================
// 🔥 ОТКРЫТИЕ ПРОГРАММЫ
// ============================================
window.openProgram = function(slug) {
    // 🔥 Перенаправляем на страницу программ с фильтром
    window.location.href = `programs.html?slug=${slug}`;
};

// ============================================
// 🔥 УПРАВЛЕНИЕ СЛАЙДЕРОМ
// ============================================
window.scrollServices = function(direction) {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const cardWidth = slider.querySelector('.service-card')?.offsetWidth + 30 || 330;
    const scrollAmount = cardWidth * (window.innerWidth <= 768 ? 1 : window.innerWidth <= 1200 ? 2 : 3);
    
    slider.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
    
    currentSlide += direction;
    updateSliderButtons();
    updateDots();
};

window.goToSlide = function(index) {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const cards = slider.querySelectorAll('.service-card');
    const card = cards[index];
    
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        currentSlide = index;
        updateSliderButtons();
        updateDots();
    }
};

function updateSliderButtons() {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (prevBtn) prevBtn.disabled = slider.scrollLeft <= 0;
    if (nextBtn) nextBtn.disabled = slider.scrollLeft >= (slider.scrollWidth - slider.clientWidth);
}

function updateDots() {
    const dots = document.querySelectorAll('.slider-dot');
    if (dots.length === 0) return;
    
    const slider = document.getElementById('servicesSlider');
    const cards = slider.querySelectorAll('.service-card');
    
    let activeIndex = 0;
    const sliderCenter = slider.scrollLeft + slider.clientWidth / 2;
    
    cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        if (Math.abs(cardCenter - sliderCenter) < Math.abs(cards[activeIndex].offsetLeft + cards[activeIndex].offsetWidth / 2 - sliderCenter)) {
            activeIndex = index;
        }
    });
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
    });
}

// Обновляем кнопки при прокрутке
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('servicesSlider');
    if (slider) {
        slider.addEventListener('scroll', () => {
            updateSliderButtons();
            updateDots();
        });
    }
});

// Экспорт для глобального доступа
window.loadPrograms = loadPrograms;