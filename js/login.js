import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Флаг для предотвращения бесконечного редиректа
let isProcessingLogout = false;
let hasCheckedAuth = false;

// ============================================
// 🔹 ФУНКЦИИ МОДАЛЬНОГО ОКНА ОШИБОК
// ============================================
window.showErrorModal = function(message) {
    const modal = document.getElementById('errorModal');
    const messageText = document.getElementById('errorMessageText');
    
    if (messageText) messageText.textContent = message;
    if (modal) modal.classList.add('active');
    
    document.body.style.overflow = 'hidden';
}

window.closeErrorModal = function() {
    const modal = document.getElementById('errorModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Закрытие по клику вне модального окна
document.addEventListener('click', function(e) {
    const modal = document.getElementById('errorModal');
    if (modal && e.target === modal) {
        closeErrorModal();
    }
});

// Закрытие по клавише Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeErrorModal();
    }
});

// ============================================
// 🔹 ФУНКЦИЯ: ПОЛУЧИТЬ URL ДЛЯ РЕДИРЕКТА ПО РОЛИ
// ============================================
function getRedirectUrl(role) {
    switch (role) {
        case 'admin':
            return 'admin.html';
        case 'trainer':
            return 'trainer-dashboard.html';
        case 'client':
        default:
            return 'dashboard.html';
    }
}

// ============================================
// 🔹 ФУНКЦИЯ: ПРОВЕРИТЬ, НАХОДИТСЯ ЛИ НА "СВОЕЙ" СТРАНИЦЕ
// ============================================
function isOnOwnPage(role, currentPage) {
    // Страницы для каждой роли
    const pagesByRole = {
        admin: ['admin.html'],
        trainer: ['trainer-dashboard.html', 'trainer-programs.html', 'trainer-clients.html', 'trainer-stats.html'],
        client: ['dashboard.html', 'lessons.html', 'my_programs.html', 'progress.html', 'schedule.html', 'settings.html']
    };
    
    const allowedPages = pagesByRole[role] || pagesByRole.client;
    return allowedPages.some(page => currentPage.includes(page));
}

// ============================================
// 🔹 ФУНКЦИЯ: ПЕРЕНАПРАВИТЬ ПО РОЛИ (если нужно)
// ============================================
function redirectByRole(role, forceRedirect = false) {
    const currentPage = window.location.pathname;
    const targetUrl = getRedirectUrl(role);
    
    console.log(`👤 Роль: ${role} | Страница: ${currentPage} | Цель: ${targetUrl}`);
    
    // Если принудительный редирект (после входа) — всегда перенаправляем
    if (forceRedirect) {
        console.log(`🔄 Принудительное перенаправление на ${targetUrl}`);
        window.location.href = targetUrl;
        return;
    }
    
    // Если на login.html — перенаправляем на свою страницу
    if (currentPage.includes('login.html') || currentPage.endsWith('/')) {
        console.log(`🔄 Перенаправление с login.html на ${targetUrl}`);
        window.location.href = targetUrl;
        return;
    }
    
    // Если на чужой странице — перенаправляем (кроме админа)
    if (role !== 'admin' && !isOnOwnPage(role, currentPage)) {
        console.log(`⚠️ На чужой странице! Перенаправление на ${targetUrl}`);
        window.location.href = targetUrl;
        return;
    }
    
    console.log('✅ На своей странице, остаёмся');
}

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (hasCheckedAuth) return;
    hasCheckedAuth = true;
    
    if (user && !isProcessingLogout) {
        try {
            console.log('✅ Пользователь авторизован:', user.email);
            
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
                console.error('❌ Документ пользователя не найден');
                showErrorModal('Профиль не найден. Обратитесь к администратору.');
                hasCheckedAuth = false;
                return;
            }
            
            const userData = userDoc.data();
            
            // Проверка блокировки
            if (userData.isActive === false) {
                console.log('⚠️ Аккаунт заблокирован');
                await window.logout();
                showErrorModal('Ваш аккаунт заблокирован. Обратитесь к администратору.');
                hasCheckedAuth = false;
                return;
            }
            
            // Обновляем время последнего входа
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            }).catch(err => console.log('⚠️ Не удалось обновить lastLogin'));
            
            // 🔥 ПЕРЕНАПРАВЛЯЕМ ПО РОЛИ (без принудительного редиректа)
            const role = userData.role || 'client';
            redirectByRole(role, false);
            
        } catch (error) {
            console.error('❌ Ошибка проверки пользователя:', error);
            hasCheckedAuth = false;
        }
    } else if (!user) {
        console.log('ℹ️ Пользователь не авторизован');
        hasCheckedAuth = false;
    }
});

// ============================================
// 🔹 ОБРАБОТКА ФОРМЫ ВХОДА
// ============================================
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    
    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;
    
    // === ВАЛИДАЦИЯ ===
    if (!email && !password) {
        showErrorModal('Заполните все обязательные поля!');
        emailInput?.classList.add('error');
        passwordInput?.classList.add('error');
        return;
    }
    
    if (!email) {
        showErrorModal('Введите адрес электронной почты');
        emailInput?.focus();
        emailInput?.classList.add('error');
        return;
    }
    
    if (!password) {
        showErrorModal('Введите пароль');
        passwordInput?.focus();
        passwordInput?.classList.add('error');
        return;
    }
    
    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showErrorModal('Введите корректный email адрес');
        emailInput?.focus();
        emailInput?.classList.add('error');
        return;
    }
    
    // Убираем подсветку ошибок
    emailInput?.classList.remove('error');
    passwordInput?.classList.remove('error');
    
    // === ПОПЫТКА ВХОДА ===
    try {
        console.log('🔐 Вход...', email);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ Успешный вход:', user.uid);
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            showErrorModal('Профиль не найден. Обратитесь к администратору.');
            return;
        }
        
        const userData = userDoc.data();
        
        // Проверка блокировки
        if (userData.isActive === false) {
            showErrorModal('Ваш аккаунт заблокирован. Обратитесь к администратору.');
            await window.logout();
            return;
        }
        
        // Обновляем время последнего входа
        await updateDoc(doc(db, 'users', user.uid), {
            lastLogin: serverTimestamp()
        });
        
        // 🔥 ПРИНУДИТЕЛЬНОЕ ПЕРЕНАПРАВЛЕНИЕ ПО РОЛИ
        const role = userData.role || 'client';
        console.log(`🎯 Роль пользователя: ${role}`);
        
        // Принудительно перенаправляем после входа
        redirectByRole(role, true);
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error.code, error.message);
        
        // Понятные сообщения об ошибках
        let errorMessage = 'Неверный email или пароль. Проверьте правильность ввода.';
        
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
            case 'auth/user-not-found':
                errorMessage = 'Неверный email или пароль. Проверьте правильность ввода.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Некорректный формат email';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Слишком много попыток входа. Попробуйте позже.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Аккаунт заблокирован. Обратитесь к администратору.';
                break;
        }
        
        showErrorModal(errorMessage);
        emailInput?.focus();
        emailInput?.select();
    }
});

// ============================================
// 🔹 ВЫХОД ИЗ СИСТЕМЫ
// ============================================
window.logout = function() {
    console.log('🚪 Выход из системы...');
    isProcessingLogout = true;
    
    signOut(auth).then(() => {
        console.log('✅ Успешный выход');
        isProcessingLogout = false;
        hasCheckedAuth = false;
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('❌ Ошибка выхода:', error);
        isProcessingLogout = false;
        hasCheckedAuth = false;
    });
};

console.log('🔐 Login.js загружен');    