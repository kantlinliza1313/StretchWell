// ============================================
// 🔹 ИНИЦИАЛИЗАЦИЯ EMAILJS
// ============================================
// 🔥 ЗАМЕНИТЕ НА СВОИ ДАННЫЕ ИЗ EMAILJS!
const EMAILJS_PUBLIC_KEY = 'ВАШ_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'ВАШ_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'ВАШ_TEMPLATE_ID';

// Email администратора (куда приходят сообщения)
const ADMIN_EMAIL = 'info@stretchwell.ru';

// Инициализация EmailJS
(function() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        console.log('✅ EmailJS инициализирован');
    } else {
        console.error('❌ EmailJS не загружен');
    }
})();

// ============================================
// 🔹 ОБРАБОТКА ФОРМЫ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formSuccess = document.getElementById('formSuccess');
    
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Валидация
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const subject = document.getElementById('subject').value;
        const message = document.getElementById('message').value.trim();
        
        if (!name || !email || !message) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }
        
        // Проверка email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Введите корректный email', 'error');
            return;
        }
        
        // Блокируем кнопку
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        
        try {
            // Тема сообщения (переводим код в текст)
            const subjectLabels = {
                general: 'Общий вопрос',
                registration: 'Регистрация',
                programs: 'Программы тренировок',
                technical: 'Техническая поддержка',
                other: 'Другое'
            };
            const subjectText = subjectLabels[subject] || subject;
            
            // 🔥 ОТПРАВКА ЧЕРЕЗ EMAILJS
            const templateParams = {
                to_email: ADMIN_EMAIL,
                from_name: name,
                from_email: email,
                phone: phone || 'Не указан',
                subject: subjectText,
                message: message,
                reply_to: email
            };
            
            const response = await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                templateParams
            );
            
            console.log('✅ Сообщение отправлено:', response);
            
            // Показываем успех
            form.style.display = 'none';
            formSuccess.style.display = 'block';
            
            showNotification('Сообщение успешно отправлено!', 'success');
            
            // Через 5 секунд возвращаем форму
            setTimeout(() => {
                form.reset();
                form.style.display = 'block';
                formSuccess.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить сообщение';
            }, 5000);
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            
            let errorMsg = 'Не удалось отправить сообщение';
            if (error.text) errorMsg += ': ' + error.text;
            
            showNotification(errorMsg, 'error');
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить сообщение';
        }
    });
});

// ============================================
// 🔹 УВЕДОМЛЕНИЯ
// ============================================
function showNotification(message, type = 'info') {
    // Используем SweetAlert2 если доступен
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'success' ? 'success' : type === 'error' ? 'error' : 'info',
            title: type === 'success' ? 'Успешно!' : type === 'error' ? 'Ошибка' : 'Информация',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
        return;
    }
    
    // Fallback - alert
    alert(message);
}

console.log('📧 Contact.js загружен');