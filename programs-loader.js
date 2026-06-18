// programs-loader.js
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let allPrograms = [];
let isScrolling = false;
let autoScrollInterval = null;

// Загрузка при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📥 Загрузка программ...');
    await loadPrograms();
    setupTouchEvents();
    setupAutoScroll();
});

async function loadPrograms() {
    try {
        const slider = document.getElementById('servicesSlider');
        if (!slider) return;
        
        const programsRef = collection(db, 'programs');
        const snapshot = await getDocs(programsRef);
        
        if (snapshot.empty) {
            slider.innerHTML = '<p style="text-align:center;padding:40px;">Программы не найдены</p>';
            return;
        }
        
        allPrograms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Загружено: ${allPrograms.length}`);
        
        renderPrograms(allPrograms);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

function renderPrograms(programs) {
    const slider = document.getElementById('servicesSlider');
    const dotsContainer = document.getElementById('servicesDots');
    
    if (!slider) return;
    
    slider.innerHTML = programs.map(program => {
        const image = program.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(program.title)}&background=6198FF&color=fff&size=400`;
        const lessonsCount = program.videosCount || program.lessons?.length || 0;
        const timePerDay = program.timePerDay || '10-15 мин';
        
        return `
            <div class="service-card">
                <img src="${image}" alt="${program.title}" class="service-image" 
                     onerror="this.src='https://via.placeholder.com/400x220/6198FF/FFFFFF?text=Program'">
                <div class="service-content">
                    <h3 class="service-title">${program.title}</h3>
                    <p class="service-description">${program.shortDescription || program.fullDescription || ''}</p>
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
                        <button onclick="window.openProgram('${program.slug}')" class="service-btn service-btn-primary">
                            О тренировке
                        </button>
                        ${program.videoUrl ? `<a href="${program.videoUrl}" target="_blank" class="service-btn service-btn-secondary">Видео</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Создаем точки
    if (dotsContainer && programs.length > 1) {
        dotsContainer.innerHTML = programs.map((_, i) => 
            `<div class="slider-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
        ).join('');
    }
    
    // Обновляем состояние после рендера
    setTimeout(() => {
        updateSliderButtons();
        updateDots();
        updateCardVisibility();
    }, 100);
}

// 🔥 ОБНОВЛЁННАЯ ФУНКЦИЯ ПРОКРУТКИ
window.scrollServices = function(direction) {
    const slider = document.getElementById('servicesSlider');
    if (!slider || isScrolling) return;
    
    isScrolling = true;
    
    // Получаем первую карточку для расчёта ширины
    const cards = slider.querySelectorAll('.service-card');
    if (cards.length === 0) {
        isScrolling = false;
        return;
    }
    
    // 🔥 Расчёт ширины карточки с учётом отступов
    const card = cards[0];
    const cardWidth = card.offsetWidth;
    const gap = parseInt(getComputedStyle(slider).gap) || 12;
    const scrollAmount = cardWidth + gap;
    
    // 🔥 Прокрутка на одну карточку (для всех экранов)
    const targetScroll = slider.scrollLeft + (direction * scrollAmount);
    
    slider.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
    });
    
    // Обновляем состояние после прокрутки
    setTimeout(() => {
        isScrolling = false;
        updateSliderButtons();
        updateDots();
        updateCardVisibility();
    }, 400);
};

// 🔥 НОВАЯ ФУНКЦИЯ: Обновление видимости карточек
function updateCardVisibility() {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const cards = slider.querySelectorAll('.service-card');
    const sliderRect = slider.getBoundingClientRect();
    const center = sliderRect.left + sliderRect.width / 2;
    
    cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distanceFromCenter = Math.abs(cardCenter - center);
        const threshold = sliderRect.width / 2 + cardRect.width / 2;
        
        // Карточка полностью видна
        const isVisible = cardRect.right > sliderRect.left + 10 && cardRect.left < sliderRect.right - 10;
        card.style.opacity = isVisible ? '1' : '0.4';
        card.style.transform = isVisible ? 'scale(1)' : 'scale(0.95)';
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    });
}

// Переход к конкретному слайду
window.goToSlide = function(index) {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const cards = slider.querySelectorAll('.service-card');
    if (cards.length === 0 || index >= cards.length) return;
    
    const card = cards[index];
    const gap = parseInt(getComputedStyle(slider).gap) || 12;
    const scrollPosition = card.offsetLeft - (slider.clientWidth - card.offsetWidth) / 2;
    
    slider.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
    });
    
    setTimeout(() => {
        updateDots();
        updateCardVisibility();
    }, 400);
};

// Обновление кнопок (стрелок)
function updateSliderButtons() {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (prevBtn) {
        prevBtn.disabled = slider.scrollLeft <= 5;
    }
    
    if (nextBtn) {
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        nextBtn.disabled = slider.scrollLeft >= maxScroll - 5;
    }
}

// Обновление точек
function updateDots() {
    const dots = document.querySelectorAll('.slider-dot');
    const slider = document.getElementById('servicesSlider');
    const cards = slider?.querySelectorAll('.service-card');
    
    if (!dots.length || !cards?.length) return;
    
    let activeIndex = 0;
    const sliderLeft = slider.scrollLeft;
    const sliderWidth = slider.clientWidth;
    
    cards.forEach((card, index) => {
        const cardLeft = card.offsetLeft;
        const cardRight = cardLeft + card.offsetWidth;
        
        // Карточка считается активной, если она в центре
        if (cardLeft <= sliderLeft + sliderWidth / 2 && cardRight > sliderLeft + sliderWidth / 2) {
            activeIndex = index;
        }
    });
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
    });
}

// 🔥 СВАЙП для мобильных (улучшенный)
function setupTouchEvents() {
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let isSwiping = false;
    
    slider.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isDragging = true;
        isSwiping = false;
        clearInterval(autoScrollInterval);
    }, { passive: true });
    
    slider.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = startX - currentX;
        const diffY = startY - currentY;
        
        // Определяем, что это горизонтальный свайп
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isSwiping = true;
            e.preventDefault();
        }
    }, { passive: false });
    
    slider.addEventListener('touchend', (e) => {
        if (!isDragging || !isSwiping) {
            isDragging = false;
            return;
        }
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        
        // 🔥 Минимальное расстояние для свайпа
        if (Math.abs(diffX) > 40) {
            const direction = diffX > 0 ? 1 : -1;
            scrollServices(direction);
        } else {
            // Если свайп маленький — просто обновляем состояние
            updateCardVisibility();
        }
        
        isDragging = false;
        isSwiping = false;
        
        // Возобновляем автоскролл
        setTimeout(setupAutoScroll, 5000);
    }, { passive: true });
    
    // Обновление при скролле
    slider.addEventListener('scroll', () => {
        updateSliderButtons();
        updateDots();
        updateCardVisibility();
    });
    
    // Обновление при ресайзе
    window.addEventListener('resize', () => {
        updateSliderButtons();
        updateDots();
        updateCardVisibility();
    });
}

// 🔥 АВТОПРОКРУТКА
function setupAutoScroll() {
    clearInterval(autoScrollInterval);
    
    const slider = document.getElementById('servicesSlider');
    if (!slider) return;
    
    const cards = slider.querySelectorAll('.service-card');
    if (cards.length <= 1) return;
    
    autoScrollInterval = setInterval(() => {
        // Проверяем, не наведена ли мышь
        const isHovering = slider.matches(':hover');
        if (isHovering) return;
        
        const nextBtn = document.querySelector('.next-btn');
        if (nextBtn && !nextBtn.disabled) {
            scrollServices(1);
        } else {
            // Если достигли конца — возвращаемся в начало
            setTimeout(() => {
                goToSlide(0);
            }, 1000);
        }
    }, 5000);
}

// Открытие программы
window.openProgram = function(slug) {
    window.location.href = `programs.html?slug=${slug}`;
};

window.loadPrograms = loadPrograms;

console.log('✅ programs-loader.js загружен');