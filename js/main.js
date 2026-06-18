// Горизонтальная прокрутка для секции услуг
document.addEventListener('DOMContentLoaded', function() {
    const track = document.querySelector('.services-track');
    const prevArrow = document.querySelector('.prev-arrow');
    const nextArrow = document.querySelector('.next-arrow');
    const cards = document.querySelectorAll('.service-card');
    
    if (track && prevArrow && nextArrow) {
        const scrollAmount = 345; // ширина карточки + gap
        
        prevArrow.addEventListener('click', () => {
            track.scrollBy({ 
                left: -scrollAmount, 
                behavior: 'smooth' 
            });
            updateArrows();
        });
        
        nextArrow.addEventListener('click', () => {
            track.scrollBy({ 
                left: scrollAmount, 
                behavior: 'smooth' 
            });
            updateArrows();
        });
        
        // Обновление состояния стрелок
        function updateArrows() {
            const scrollLeft = track.scrollLeft;
            const maxScroll = track.scrollWidth - track.clientWidth;
            
            prevArrow.disabled = scrollLeft <= 0;
            nextArrow.disabled = scrollLeft >= maxScroll - 1;
        }
        
        // Проверка при загрузке и скролле
        updateArrows();
        track.addEventListener('scroll', updateArrows);
        
        // Клавиатурная навигация
        track.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else if (e.key === 'ArrowRight') {
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        });
        
        // Сделать трек фокусируемым для клавиатуры
        track.setAttribute('tabindex', '0');
    }
});

// ============================================
// 🔥 БУРГЕР-МЕНЮ ДЛЯ МОБИЛЬНЫХ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const burgerMenu = document.getElementById('burgerMenu');
    const mainNav = document.getElementById('mainNav');
    
    if (burgerMenu && mainNav) {
        // Создаём overlay для затемнения
        const overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        document.body.appendChild(overlay);
        
        // Открытие/закрытие меню
        burgerMenu.addEventListener('click', function() {
            this.classList.toggle('active');
            mainNav.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
        });
        
        // Закрытие по клику на overlay
        overlay.addEventListener('click', function() {
            burgerMenu.classList.remove('active');
            mainNav.classList.remove('active');
            this.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        // Закрытие при клике на пункт меню
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 992) {
                    burgerMenu.classList.remove('active');
                    mainNav.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Закрытие при изменении размера окна
        window.addEventListener('resize', function() {
            if (window.innerWidth > 992) {
                burgerMenu.classList.remove('active');
                mainNav.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mainNav.classList.contains('active')) {
                burgerMenu.classList.remove('active');
                mainNav.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
});