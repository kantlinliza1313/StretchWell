import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Флаг для предотвращения бесконечного редиректа
let isProcessingLogout = false;
let hasCheckedAuth = false;

// Проверяем авторизацию при загрузке страницы
onAuthStateChanged(auth, async (user) => {
    // Если уже проверяли, не проверяем снова
    if (hasCheckedAuth) return;
    hasCheckedAuth = true;
    
    if (user && !isProcessingLogout) {
        // Пользователь уже авторизован
        try {
            console.log('✅ Пользователь авторизован:', user.email);
            
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Проверка активности
                if (userData.isActive === false) {
                    console.log('⚠️ Аккаунт заблокирован');
                    await window.logout();
                    Swal.fire('Ошибка', 'Ваш аккаунт заблокирован', 'error');
                    hasCheckedAuth = false;
                    return;
                }
                
                // Обновляем время последнего входа
                await updateDoc(doc(db, 'users', user.uid), {
                    lastLogin: serverTimestamp()
                }).catch(err => console.log('⚠️ Не удалось обновить lastLogin'));
                
                // Редирект в зависимости от роли
                console.log('🔄 Перенаправление, роль:', userData.role);
                if (userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                console.error('❌ Документ пользователя не найден');
            }
        } catch (error) {
            console.error('❌ Ошибка проверки пользователя:', error);
            hasCheckedAuth = false;
        }
    } else if (!user) {
        console.log('ℹ️ Пользователь не авторизован - остаёмся на login.html');
        hasCheckedAuth = false;
    }
});

// Обработка формы входа
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        Swal.fire('Ошибка', 'Введите email и пароль', 'error');
        return;
    }
    
    try {
        console.log('🔐 Вход...', email);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ Успешный вход:', user.uid);
        
        // Получаем данные пользователя
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Проверка активности
            if (userData.isActive === false) {
                console.log('⚠️ Аккаунт заблокирован');
                await window.logout();
                Swal.fire('Ошибка', 'Ваш аккаунт заблокирован', 'error');
                return;
            }
            
            // Обновляем время последнего входа
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            }).catch(err => console.log('⚠️ Не удалось обновить lastLogin'));
            
            // Редирект в зависимости от роли
            console.log('🔄 Перенаправление, роль:', userData.role);
            if (userData.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            console.error('❌ Документ пользователя не найден');
            Swal.fire('Ошибка', 'Пользователь не найден в базе', 'error');
        }
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error.code, error.message);
        
        let msg = 'Не удалось войти';
        if (error.code === 'auth/user-not-found') msg = 'Пользователь не найден';
        else if (error.code === 'auth/wrong-password') msg = 'Неверный пароль';
        else if (error.code === 'auth/invalid-email') msg = 'Некорректный email';
        else if (error.code === 'auth/invalid-credential') msg = 'Неверный email или пароль';
        
        Swal.fire('Ошибка', msg, 'error');
    }
});

// Глобальная функция выхода (вызывается из других файлов)
window.logout = function() {
    console.log('🚪 Выход из системы...');
    isProcessingLogout = true;
    
    signOut(auth).then(() => {
        console.log('✅ Успешный выход');
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