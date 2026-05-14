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