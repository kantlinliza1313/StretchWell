// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let currentUser = null;
let userData = null;

// === ПРОВЕРКА АВТОРИЗАЦИИ ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        setupEventListeners();
    } else {
        window.location.href = 'login.html';
    }
});

// === ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===
async function loadUserData() {
    try {
        console.log('📥 Загрузка данных пользователя...');
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Документ пользователя не найден');
            return;
        }
        
        userData = userDoc.data();
        console.log('✅ Данные загружены:', userData);
        
        // Заполняем форму личных данных
        fillPersonalForm(userData);
        
        // Заполняем информацию об аккаунте
        fillAccountInfo(userData, currentUser);
        
        // Загружаем настройки уведомлений
        loadNotificationSettings(userData);
        
        // Обновляем имя в шапке
        updateHeaderName(userData);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        Swal.fire('Ошибка', 'Не удалось загрузить настройки', 'error');
    }
}

// Заполнение формы личных данных
function fillPersonalForm(userData) {
    // Имя
    const fullNameEl = document.getElementById('fullName');
    if (fullNameEl) {
        fullNameEl.value = userData.name || currentUser.displayName || currentUser.email?.split('@')[0] || '';
    }
    
    // Дата рождения
    const birthDateEl = document.getElementById('birthDate');
    if (birthDateEl && userData.birthDate) {
        birthDateEl.value = userData.birthDate;
    }
    
    // Email (только для отображения, изменение через Firebase Auth)
    const emailEl = document.getElementById('email');
    if (emailEl) {
        emailEl.value = currentUser.email || userData.email || '';
        emailEl.disabled = true; // Email меняется через отдельный процесс
    }
    
    // Телефон
    const phoneEl = document.getElementById('phone');
    if (phoneEl) {
        phoneEl.value = userData.phone || '';
    }
    
    // Цель
    const goalEl = document.getElementById('goal');
    if (goalEl && userData.goal) {
        goalEl.value = userData.goal;
    }
    
    // Уровень подготовки
    const experienceEl = document.getElementById('experience');
    if (experienceEl && userData.experience) {
        experienceEl.value = userData.experience;
    }
}

// Заполнение информации об аккаунте
function fillAccountInfo(userData, user) {
    // ID аккаунта
    const idEl = document.querySelector('.info-value:nth-child(2)');
    if (idEl) {
        idEl.textContent = `#${user.uid.slice(-8).toUpperCase()}`;
    }
    
    // Дата регистрации
    const regDateEl = document.querySelectorAll('.info-value')[1];
    if (regDateEl && userData.createdAt) {
        const date = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        regDateEl.textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    // Последний вход
    const lastLoginEl = document.querySelectorAll('.info-value')[2];
    if (lastLoginEl && userData.lastLogin) {
        const date = userData.lastLogin.toDate ? userData.lastLogin.toDate() : new Date(userData.lastLogin);
        lastLoginEl.textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) + 
                                  ', ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
}

// Загрузка настроек уведомлений
function loadNotificationSettings(userData) {
    const notifications = userData.notifications || {};
    
    // Push-уведомления
    const pushToggle = document.querySelector('.notification-item:nth-child(1) input[type="checkbox"]');
    if (pushToggle) pushToggle.checked = notifications.push !== false;
    
    // Напоминания о тренировках
    const reminderToggle = document.querySelector('.notification-item:nth-child(2) input[type="checkbox"]');
    if (reminderToggle) reminderToggle.checked = notifications.reminders !== false;
}

// Обновление имени в шапке
function updateHeaderName(userData) {
    const name = userData.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Пользователь';
    document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
    
    const avatarEl = document.querySelector('.user-avatar');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
        avatarEl.alt = name;
    }
}

// === НАСТРОЙКА ОБРАБОТЧИКОВ ===
function setupEventListeners() {
    // Сохранение личных данных
    const personalForm = document.querySelector('.settings-card:nth-child(2) form');
    if (personalForm) {
        personalForm.addEventListener('submit', handlePersonalSave);
    }
    
    // Смена пароля
    const passwordForm = document.querySelector('.settings-card:nth-child(3) form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }
    
    // Сохранение настроек уведомлений
    const notificationBtn = document.querySelector('.settings-card:nth-child(4) .btn-primary');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', saveNotificationSettings);
    }
    
    // Переключение видимости пароля
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });
    
    // Валидация нового пароля в реальном времени
    const newPasswordEl = document.getElementById('newPassword');
    if (newPasswordEl) {
        newPasswordEl.addEventListener('input', validatePassword);
    }
}

// === СОХРАНЕНИЕ ЛИЧНЫХ ДАННЫХ ===
async function handlePersonalSave(e) {
    e.preventDefault();
    
    const name = document.getElementById('fullName')?.value.trim();
    const birthDate = document.getElementById('birthDate')?.value;
    const phone = document.getElementById('phone')?.value.trim();
    const goal = document.getElementById('goal')?.value;
    const experience = document.getElementById('experience')?.value;
    
    if (!name) {
        Swal.fire('Ошибка', 'Введите имя и фамилию', 'error');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        await updateDoc(userRef, {
            name: name,
            birthDate: birthDate || null,
            phone: phone || null,
            goal: goal || 'flexibility',
            experience: experience || 'beginner',
            updatedAt: serverTimestamp()
        });
        
        // Обновляем локальные данные
        userData.name = name;
        userData.birthDate = birthDate;
        userData.phone = phone;
        userData.goal = goal;
        userData.experience = experience;
        
        // Обновляем отображение
        updateHeaderName(userData);
        
        Swal.fire('✅ Успешно!', 'Данные профиля обновлены', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        Swal.fire('Ошибка', 'Не удалось сохранить изменения', 'error');
    }
}

// === СМЕНА ПАРОЛЯ ===
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    
    // Валидация
    if (!currentPassword || !newPassword || !confirmPassword) {
        Swal.fire('Ошибка', 'Заполните все поля пароля', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        Swal.fire('Ошибка', 'Пароли не совпадают', 'error');
        return;
    }
    
    // Проверка сложности пароля
    if (!validatePasswordStrength(newPassword)) {
        Swal.fire('Ошибка', 'Пароль не соответствует требованиям', 'error');
        return;
    }
    
    try {
        // Реаутентификация перед сменой пароля
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Меняем пароль
        await updatePassword(currentUser, newPassword);
        
        // Очищаем форму
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        Swal.fire('✅ Успешно!', 'Пароль изменён', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка смены пароля:', error);
        
        if (error.code === 'auth/wrong-password') {
            Swal.fire('Ошибка', 'Неверный текущий пароль', 'error');
        } else if (error.code === 'auth/weak-password') {
            Swal.fire('Ошибка', 'Новый пароль слишком слабый', 'error');
        } else {
            Swal.fire('Ошибка', 'Не удалось изменить пароль', 'error');
        }
    }
}

// Валидация сложности пароля
function validatePasswordStrength(password) {
    const requirements = [
        /.{8,}/,           // Минимум 8 символов
        /[A-Z]/,           // Заглавная буква
        /[0-9]/,           // Цифра
        /[^A-Za-z0-9]/     // Специальный символ
    ];
    
    return requirements.every(regex => regex.test(password));
}

// Валидация пароля в реальном времени
function validatePassword(e) {
    const password = e.target.value;
    const requirements = document.querySelectorAll('.password-requirements .requirement');
    
    if (requirements.length < 4) return;
    
    // Обновляем статус требований
    requirements[0].querySelector('i').className = password.length >= 8 ? 'fas fa-check' : 'fas fa-times';
    requirements[1].querySelector('i').className = /[A-Z]/.test(password) ? 'fas fa-check' : 'fas fa-times';
    requirements[2].querySelector('i').className = /[0-9]/.test(password) ? 'fas fa-check' : 'fas fa-times';
    requirements[3].querySelector('i').className = /[^A-Za-z0-9]/.test(password) ? 'fas fa-check' : 'fas fa-times';
}

// Переключение видимости пароля
function togglePasswordVisibility(e) {
    const button = e.currentTarget;
    const input = button.closest('.input-with-icon').querySelector('input');
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}


// === УДАЛЕНИЕ АККУНТА ===
window.confirmDeleteAccount = function() {
    document.getElementById('deleteConfirmModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.closeDeleteModal = function() {
    document.getElementById('deleteConfirmModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('confirmEmail').value = '';
}

window.deleteAccount = async function() {
    const confirmEmail = document.getElementById('confirmEmail')?.value.trim().toLowerCase();
    
    if (confirmEmail !== currentUser.email?.toLowerCase()) {
        Swal.fire('Ошибка', 'Введите ваш email для подтверждения', 'error');
        return;
    }
    
    try {
        // Запрашиваем пароль для подтверждения
        const { value: password } = await Swal.fire({
            title: 'Подтвердите удаление',
            text: 'Введите ваш пароль для окончательного удаления аккаунта',
            input: 'password',
            inputPlaceholder: 'Пароль',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            confirmButtonText: 'Удалить навсегда',
            cancelButtonText: 'Отмена'
        });
        
        if (!password) return;
        
        // Реаутентификация
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Удаляем документ из Firestore
        await deleteDoc(doc(db, 'users', currentUser.uid));
        
        // Удаляем аккаунт в Firebase Auth
        await deleteUser(currentUser);
        
        // Очищаем localStorage и перенаправляем
        localStorage.clear();
        sessionStorage.clear();
        
        Swal.fire({
            icon: 'success',
            title: 'Аккаунт удалён',
            text: 'Все ваши данные были безвозвратно удалены',
            timer: 3000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'login.html';
        });
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        
        if (error.code === 'auth/wrong-password') {
            Swal.fire('Ошибка', 'Неверный пароль', 'error');
        } else if (error.code === 'auth/requires-recent-login') {
            Swal.fire('Ошибка', 'Для удаления нужно войти недавно. Выйдите и войдите снова.', 'error');
        } else {
            Swal.fire('Ошибка', 'Не удалось удалить аккаунт: ' + error.message, 'error');
        }
    }
}

// Закрытие модального окна по клику вне его
document.getElementById('deleteConfirmModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
});

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeDeleteModal();
    }
});

console.log('⚙️ Settings.js загружен');