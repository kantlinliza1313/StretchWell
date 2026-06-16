// ============================================
// 🔹 ИМПОРТ FIREBASE
// ============================================
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ============================================
// 🔹 ССЫЛКА НА КОЛЛЕКЦИЮ СООБЩЕНИЙ
// ============================================
// 🔥 Все сообщения будут сохраняться в Firestore → contactMessages
const contactMessagesRef = collection(db, 'contactMessages');

// ============================================
// 🔹 ОБРАБОТКА ОТПРАВКИ ФОРМЫ
// ============================================
function sendMessage(event) {
    event.preventDefault(); // Предотвращаем стандартное поведение формы

    // Получение значений из полей формы
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value.trim();
    const submitBtn = document.getElementById('submitBtn');

    // 🔥 ВАЛИДАЦИЯ
    if (!name || !email || !message) {
        Swal.fire({
            icon: "error",
            title: "Ошибка...",
            text: "Заполните все обязательные поля!",
            confirmButtonColor: '#6198FF'
        });
        return;
    }

    // Проверка email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        Swal.fire({
            icon: "error",
            title: "Ошибка",
            text: "Введите корректный email",
            confirmButtonColor: '#6198FF'
        });
        return;
    }

    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

    // 🔥 ОТПРАВКА ДАННЫХ В FIREBASE
    addDoc(contactMessagesRef, {
        name: name,
        email: email,
        phone: phone || 'Не указан',
        subject: subject,
        message: message,
        read: false,                    // Сообщение не прочитано
        createdAt: serverTimestamp()    // Дата отправки
    })
    .then(() => {
        console.log('✅ Сообщение успешно отправлено в Firebase');

        // Очистка полей формы
        document.getElementById('name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('subject').value = 'general';
        document.getElementById('message').value = '';

        // Показываем сообщение об успехе
        const form = document.getElementById('contactForm');
        const formSuccess = document.getElementById('formSuccess');
        
        form.style.display = 'none';
        formSuccess.style.display = 'block';

        Swal.fire({
            position: "top-end",
            icon: "success",
            title: "Сообщение успешно отправлено!",
            text: "Мы ответим вам в ближайшее время",
            showConfirmButton: false,
            timer: 2500
        });

        // Через 5 секунд возвращаем форму
        setTimeout(() => {
            form.style.display = 'block';
            formSuccess.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить сообщение';
        }, 5000);
    })
    .catch((error) => {
        console.error('❌ Ошибка отправки:', error);
        
        Swal.fire({
            icon: "error",
            title: "Ошибка отправки",
            text: "Пожалуйста, попробуйте снова. " + error.message,
            confirmButtonColor: '#6198FF'
        });

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить сообщение';
    });
}

// ============================================
// 🔹 ПРИВЯЗКА К ФОРМЕ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#contactForm');
    if (form) {
        form.addEventListener('submit', sendMessage);
        console.log('✅ Форма контактов готова к отправке');
    }
});

console.log('📧 Contact.js загружен');