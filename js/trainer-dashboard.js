import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    doc, getDoc, collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUser = null;
let trainerData = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await initTrainerDashboard();
    } else {
        window.location.href = 'login.html';
    }
});

async function initTrainerDashboard() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists()) {
            window.location.href = 'login.html';
            return;
        }
        
        trainerData = userDoc.data();
        
        // 🔥 ПРОВЕРКА РОЛИ
        if (trainerData.role !== 'trainer') {
            console.warn('⚠️ Это не тренер! Роль:', trainerData.role);
            
            // Перенаправляем на правильную страницу
            const redirectUrl = trainerData.role === 'admin' ? 'admin.html' : 'dashboard.html';
            
            Swal.fire({
                icon: 'warning',
                title: 'Доступ запрещён',
                text: 'Эта страница только для тренеров',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = redirectUrl;
            });
            return;
        }
        
        if (trainerData.isActive === false) {
            Swal.fire('Ошибка', 'Ваш аккаунт заблокирован', 'error')
                .then(() => window.logout());
            return;
        }
        
        // Обновляем UI
        updateUI(trainerData);
        
        // Загружаем данные
        await loadMyPrograms();
        await loadStats();
        
        console.log('✅ Тренер авторизован:', trainerData.name);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

function updateUI(data) {
    const name = data.name || 'Тренер';
    
    const topUserName = document.getElementById('topUserName');
    if (topUserName) topUserName.textContent = name;
    
    const welcomeName = document.getElementById('welcomeName');
    if (welcomeName) welcomeName.textContent = `Добро пожаловать, ${name.split(' ')[0]}! 👋`;
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = data.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

async function loadMyPrograms() {
    const container = document.getElementById('myProgramsList');
    if (!container) return;
    
    try {
        const q = query(
            collection(db, 'programs'),
            where('trainerId', '==', trainerData.trainerId)
        );
        const snapshot = await getDocs(q);
        const programs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Обновляем счётчик
        const statPrograms = document.getElementById('statPrograms');
        if (statPrograms) statPrograms.textContent = programs.length;
        
        if (programs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-dumbbell" style="font-size: 48px; color: #e1e8ed; margin-bottom: 15px;"></i>
                    <h4>У вас пока нет программ</h4>
                    <p>Создайте свою первую программу тренировок</p>
                    <a href="trainer-programs.html?action=new" class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Создать программу
                    </a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="programs-mini-grid">
                ${programs.slice(0, 4).map(p => `
                    <div class="program-mini-card">
                        <img src="${p.image || 'https://via.placeholder.com/300x150/6198FF/FFFFFF?text=Program'}" alt="${p.title}">
                        <div class="program-mini-info">
                            <h5>${p.title}</h5>
                            <p>${p.videosCount || 0} уроков</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        container.innerHTML = '<p style="color: #e74c3c;">Ошибка загрузки</p>';
    }
}

async function loadStats() {
    try {
        // Мои клиенты
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const myClients = users.filter(u => {
            if (u.role !== 'client') return false;
            const enrolled = u.enrolledPrograms || [];
            return enrolled.some(p => p.trainerId === trainerData.trainerId);
        });
        
        const statClients = document.getElementById('statClients');
        if (statClients) statClients.textContent = myClients.length;
        
        // Уроков завершено
        let totalCompleted = 0;
        myClients.forEach(client => {
            const enrolled = client.enrolledPrograms || [];
            enrolled.forEach(p => {
                if (p.trainerId === trainerData.trainerId) {
                    totalCompleted += (p.completedLessons?.length || 0);
                }
            });
        });
        
        const statCompleted = document.getElementById('statCompleted');
        if (statCompleted) statCompleted.textContent = totalCompleted;
        
        // Средний прогресс
        let totalProgress = 0;
        let progressCount = 0;
        myClients.forEach(client => {
            const enrolled = client.enrolledPrograms || [];
            enrolled.forEach(p => {
                if (p.trainerId === trainerData.trainerId) {
                    totalProgress += (p.progress || 0);
                    progressCount++;
                }
            });
        });
        
        const avgProgress = progressCount > 0 ? Math.round(totalProgress / progressCount) : 0;
        const statAvgProgress = document.getElementById('statAvgProgress');
        if (statAvgProgress) statAvgProgress.textContent = avgProgress + '%';
        
    } catch (error) {
        console.error('❌ Ошибка статистики:', error);
    }
}

window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
};

// Мобильное меню
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    }
    if (sidebarClose && sidebar) {
        sidebarClose.addEventListener('click', () => sidebar.classList.remove('active'));
    }
});

console.log('🏋️ Trainer Dashboard загружен');