// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let currentUser = null;
let trainerData = null;
let allMyClients = [];
let myPrograms = [];

// ============================================
// 🔹 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
                window.location.href = 'login.html';
                return;
            }
            
            trainerData = userDoc.data();
            console.log('👤 Данные тренера:', trainerData);
            
            // Проверка роли
            if (trainerData.role !== 'trainer') {
                const redirectUrl = trainerData.role === 'admin' ? 'admin.html' : 'dashboard.html';
                Swal.fire({
                    icon: 'warning',
                    title: 'Доступ запрещён',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => window.location.href = redirectUrl);
                return;
            }
            
            // Проверка trainerId
            if (!trainerData.trainerId) {
                Swal.fire('Ошибка', 'У вашего аккаунта отсутствует ID тренера', 'error');
                return;
            }
            
            if (trainerData.isActive === false) {
                Swal.fire('Ошибка', 'Ваш аккаунт заблокирован', 'error')
                    .then(() => window.logout());
                return;
            }
            
            updateUI(trainerData);
            await loadMyPrograms();
            await loadMyClients();
            
            // ✅ Вызываем setupEventListeners (функция определена ниже)
            setupEventListeners();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
        }
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ОБНОВЛЕНИЕ UI
// ============================================
function updateUI(data) {
    const name = data.name || 'Тренер';
    const topUserName = document.getElementById('topUserName');
    if (topUserName) topUserName.textContent = name;
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = data.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

// ============================================
// 🔹 ЗАГРУЗКА ПРОГРАММ ТРЕНЕРА
// ============================================
async function loadMyPrograms() {
    try {
        const q = query(
            collection(db, 'programs'),
            where('trainerId', '==', trainerData.trainerId)
        );
        const snapshot = await getDocs(q);
        myPrograms = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Заполняем фильтр
        const filterSelect = document.getElementById('filterByProgram');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="all">Все программы</option>';
            myPrograms.forEach(p => {
                const option = document.createElement('option');
                option.value = p.slug;
                option.textContent = p.title;
                filterSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        myPrograms = [];
    }
}

// ============================================
// 🔹 ЗАГРУЗКА КЛИЕНТОВ
// ============================================
async function loadMyClients() {
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
    
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        allMyClients = allUsers
            .filter(u => {
                if (u.role !== 'client') return false;
                const enrolled = u.enrolledPrograms || [];
                return enrolled.some(p => p.trainerId === trainerData.trainerId);
            })
            .map(client => {
                const enrolled = client.enrolledPrograms || [];
                const myClientPrograms = enrolled
                    .filter(p => p.trainerId === trainerData.trainerId)
                    .map(p => {
                        const programInfo = myPrograms.find(mp => mp.slug === p.slug);
                        return {
                            ...p,
                            programTitle: programInfo?.title || p.title || 'Программа',
                            programImage: programInfo?.image || ''
                        };
                    });
                return { ...client, myPrograms: myClientPrograms };
            });
        
        const countEl = document.getElementById('clientsCount');
        if (countEl) countEl.textContent = allMyClients.length;
        
        renderClients(allMyClients);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        grid.innerHTML = '<p style="color: #e74c3c;">Ошибка загрузки</p>';
    }
}

// ============================================
// 🔹 РЕНДЕР КЛИЕНТОВ
// ============================================
function renderClients(clients) {
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;
    
    if (clients.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-users" style="font-size: 64px; color: #e1e8ed;"></i>
                <h3>У вас пока нет клиентов</h3>
                <p>Когда клиенты запишутся на ваши программы, они появятся здесь</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = clients.map(client => {
        const totalLessons = client.myPrograms.reduce((sum, p) => sum + (p.completedLessons?.length || 0), 0);
        const totalProgress = client.myPrograms.reduce((sum, p) => sum + (p.progress || 0), 0);
        const avgProgress = client.myPrograms.length > 0 ? Math.round(totalProgress / client.myPrograms.length) : 0;
        
        return `
            <div class="client-card" onclick="window.showClientDetails('${client.id}')">
                <div class="client-card-header">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'К')}&background=6198FF&color=fff" 
                         class="client-avatar-large">
                    <div class="client-main-info">
                        <h4>${escapeHtml(client.name || 'Без имени')}</h4>
                        <p class="client-email">${escapeHtml(client.email || '')}</p>
                    </div>
                </div>
                <div class="client-stats-row">
                    <div class="client-stat">
                        <span class="client-stat-value">${client.myPrograms.length}</span>
                        <span class="client-stat-label">Программ</span>
                    </div>
                    <div class="client-stat">
                        <span class="client-stat-value">${totalLessons}</span>
                        <span class="client-stat-label">Уроков</span>
                    </div>
                    <div class="client-stat">
                        <span class="client-stat-value">${avgProgress}%</span>
                        <span class="client-stat-label">Прогресс</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// 🔹 ДЕТАЛИ КЛИЕНТА
// ============================================
window.showClientDetails = async function(clientId) {
    const client = allMyClients.find(c => c.id === clientId);
    if (!client) return;
    
    const modal = document.getElementById('clientDetailsModal');
    const body = document.getElementById('clientDetailsBody');
    if (!modal || !body) return;
    
    const totalLessons = client.myPrograms.reduce((sum, p) => sum + (p.completedLessons?.length || 0), 0);
    const avgProgress = client.myPrograms.length > 0 
        ? Math.round(client.myPrograms.reduce((sum, p) => sum + (p.progress || 0), 0) / client.myPrograms.length) 
        : 0;
    
    body.innerHTML = `
        <div class="client-details">
            <div class="client-details-header">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'К')}&background=6198FF&color=fff&size=120" 
                     class="client-avatar-xl">
                <div>
                    <h2>${escapeHtml(client.name)}</h2>
                    <p><i class="fas fa-envelope"></i> ${escapeHtml(client.email || '—')}</p>
                </div>
            </div>
            
            <div class="client-programs-details" style="margin-top: 20px;">
                ${client.myPrograms.map(p => `
                    <div class="client-program-detail">
                        <h5>${escapeHtml(p.programTitle)}</h5>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${p.progress || 0}%"></div>
                        </div>
                        <small>${p.completedLessons?.length || 0} уроков завершено</small>
                    </div>
                `).join('')}
            </div>
            
            <div class="client-details-actions" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="window.sendMessageToClient('${client.id}', '${escapeHtml(client.email)}')">
                    <i class="fas fa-envelope"></i> Написать
                </button>
                <button class="btn btn-outline" onclick="window.closeClientDetails()">Закрыть</button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
};

window.closeClientDetails = function() {
    const modal = document.getElementById('clientDetailsModal');
    if (modal) modal.classList.remove('active');
};

// ============================================
// 🔹 ОТПРАВКА СООБЩЕНИЯ
// ============================================
window.sendMessageToClient = async function(clientId, clientEmail) {
    const client = allMyClients.find(c => c.id === clientId);
    if (!client) return;
    
    const { value: formValues } = await Swal.fire({
        title: 'Написать клиенту',
        html: `
            <input type="text" id="msg-subject" class="swal2-input" placeholder="Тема">
            <textarea id="msg-text" class="swal2-textarea" placeholder="Сообщение" rows="5"></textarea>
        `,
        showCancelButton: true,
        confirmButtonText: 'Отправить',
        preConfirm: () => {
            const subject = document.getElementById('msg-subject').value;
            const text = document.getElementById('msg-text').value;
            if (!subject || !text) {
                Swal.showValidationMessage('Заполните все поля');
                return false;
            }
            return { subject, text };
        }
    });
    
    if (formValues) {
        try {
            await addDoc(collection(db, 'messages'), {
                from: currentUser.uid,
                to: clientId,
                fromName: trainerData.name,
                toName: client.name,
                fromRole: 'trainer',
                toRole: 'client',
                subject: formValues.subject,
                text: formValues.text,
                read: false,
                createdAt: serverTimestamp(),
                conversationId: `${currentUser.uid}_${clientId}`
            });
            
            Swal.fire('Отправлено!', '', 'success');
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Swal.fire('Ошибка', error.message, 'error');
        }
    }
};

// ============================================
// 🔹 ✅ ФИЛЬТРАЦИЯ И ПОИСК (ЭТОЙ ФУНКЦИИ НЕ ХВАТАЛО!)
// ============================================
function setupEventListeners() {
    const searchInput = document.getElementById('searchClients');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    const filterSelect = document.getElementById('filterByProgram');
    if (filterSelect) {
        filterSelect.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const searchText = (document.getElementById('searchClients')?.value || '').toLowerCase().trim();
    const programFilter = document.getElementById('filterByProgram')?.value || 'all';
    
    let filtered = allMyClients;
    
    if (searchText) {
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(searchText) ||
            (c.email || '').toLowerCase().includes(searchText)
        );
    }
    
    if (programFilter !== 'all') {
        filtered = filtered.filter(c => 
            c.myPrograms.some(p => p.slug === programFilter)
        );
    }
    
    renderClients(filtered);
}

// ============================================
// 🔹 ВЫХОД
// ============================================
window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    });
};

// Мобильное меню
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (sidebarClose && sidebar) sidebarClose.addEventListener('click', () => sidebar.classList.remove('active'));
});

console.log('👥 Trainer Clients загружен');