// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 ФЛАГИ ДЛЯ ПРЕДОТВРАЩЕНИЯ БЕСКОНЕЧНОГО РЕДИРЕКТА
let isProcessingLogout = false;
let hasCheckedAuth = false;

document.addEventListener('DOMContentLoaded', function() {
    
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Показ/скрытие пароля
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }

    // Проверка авторизации
    onAuthStateChanged(auth, async (user) => {
        // ✅ Если уже проверяли или выходим — не редиректим
        if (hasCheckedAuth || isProcessingLogout) return;
        
        if (user) {
            hasCheckedAuth = true;
            console.log('✅ Пользователь авторизован:', user.email);
            
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                
                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        name: user.displayName || user.email?.split('@')[0] || 'Пользователь',
                        email: user.email,
                        role: 'client',
                        phone: '',
                        goal: 'flexibility',
                        experience: 'beginner',
                        createdAt: serverTimestamp(),
                        stats: { lessons: 0, flexibility: 0, minutes: 0, streak: 0 },
                        enrolledPrograms: []
                    });
                    console.log('✅ Пользователь создан в базе');
                }
                
                const userData = userSnap.exists() ? userSnap.data() : {};
                
                // Проверка активности
                if (userData.isActive === false) {
                    console.log('⚠️ Аккаунт заблокирован');
                    await window.logout();
                    Swal.fire('Ошибка', 'Ваш аккаунт заблокирован', 'error');
                    hasCheckedAuth = false;
                    return;
                }
                
                // Обновляем время последнего входа
                await updateDoc(userRef, {
                    lastLogin: serverTimestamp()
                }).catch(err => console.log('⚠️ Не удалось обновить lastLogin'));
                
                localStorage.setItem('user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: userData.name || user.displayName || user.email?.split('@')[0],
                    role: userData.role || 'client'
                }));
                
                // 🔥 ПРОВЕРКА РОЛИ И ПЕРЕНАПРАВЛЕНИЕ
                console.log('🔄 Перенаправление, роль:', userData.role);
                if (userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
                
            } catch (error) {
                console.error('❌ Ошибка при работе с базой:', error);
                hasCheckedAuth = false;
            }
        } else {
            // Пользователь не авторизован — остаёмся на login.html
            console.log('ℹ️ Пользователь не авторизован');
            hasCheckedAuth = false;
        }
    });

    // Обработка формы входа
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value.trim().toLowerCase();
            const password = document.getElementById('password')?.value;
            
            if (!email || !password) {
                Swal.fire('Ошибка', 'Введите email и пароль', 'error');
                return;
            }
            
            if (errorMessage) errorMessage.style.display = 'none';
            if (submitBtn) submitBtn.disabled = true;
            
            try {
                console.log('🔐 Вход...', email);
                
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('✅ Успешный вход:', userCredential.user.uid);
                
                // Перенаправление произойдёт в onAuthStateChanged выше
                
            } catch (error) {
                console.error('❌ Ошибка входа:', error.code, error.message);
                
                let msg = 'Не удалось войти';
                if (error.code === 'auth/user-not-found') msg = 'Пользователь не найден';
                else if (error.code === 'auth/wrong-password') msg = 'Неверный пароль';
                else if (error.code === 'auth/invalid-email') msg = 'Некорректный email';
                else if (error.code === 'auth/invalid-credential') msg = 'Неверный email или пароль';
                
                if (errorText && errorMessage) {
                    errorText.textContent = msg;
                    errorMessage.style.display = 'flex';
                }
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    
}); // ✅ ЗАКРЫВАЕМ DOMContentLoaded

// === ВЫХОД ИЗ СИСТЕМЫ (вне DOMContentLoaded) ===
window.logout = function() {
    console.log('🚪 Выход из системы...');
    isProcessingLogout = true;
    
    signOut(auth).then(() => {
        console.log('✅ Успешный выход');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        
        // Сбрасываем флаги и перенаправляем
        isProcessingLogout = false;
        hasCheckedAuth = false;
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('❌ Ошибка выхода:', error);
        isProcessingLogout = false;
        hasCheckedAuth = false;
    });
};

console.log('🔐 Login.js загружен');