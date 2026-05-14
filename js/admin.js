// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, signOut, createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, orderBy, getDocs, 
    doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let currentUser = null;

// === ПРОВЕРКА АВТОРИЗАЦИИ ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('✅ Пользователь авторизован:', user.email);
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role !== 'admin') {
                    Swal.fire({ icon: 'error', title: 'Доступ запрещён', text: 'Только администраторы', confirmButtonColor: '#6198FF' })
                        .then(() => window.location.href = 'index.html');
                    return;
                }
                currentUser = user;
                setupAdminPanel(userData);
                loadDashboardStats();
            } else {
                Swal.fire('Ошибка', 'Пользователь не найден', 'error');
            }
        } catch (error) { console.error('❌ Ошибка:', error); }
    } else {
        window.location.href = 'login.html';
    }
});

// === НАСТРОЙКА ПАНЕЛИ ===
function setupAdminPanel(userData) {
    document.getElementById('adminName').textContent = userData.name || 'Администратор';
    document.querySelectorAll('.admin-nav .nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.classList.contains('logout')) return;
            e.preventDefault();
            document.querySelectorAll('.admin-nav .nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            switchSection(this.dataset.section);
        });
    });
}

// === ПЕРЕКЛЮЧЕНИЕ СЕКЦИЙ ===
function switchSection(section) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(section);
    if (target) target.classList.add('active');
    
    const titles = { 
        dashboard: 'Панель управления', 
        programs: 'Программы', 
        features: 'Преимущества', 
        services: 'Услуги', 
        users: 'Пользователи',
        specialists: 'Специалисты',  // ✅ Есть?
        reviews: 'Отзывы'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Панель управления';
    
    // ✅ ПРОВЕРЬТЕ что есть эти строки:
    if (section === 'programs') loadProgramsTable();
    else if (section === 'features') loadFeaturesTable();
    else if (section === 'services') loadServicesTable();
    else if (section === 'users') loadUsersTable();
    else if (section === 'specialists') loadSpecialistsTable();  // ✅ ЕСТЬ?
    else if (section === 'reviews') loadReviewsTable();          // ✅ ЕСТЬ?
    else if (section === 'dashboard') loadDashboardStats();
}

// === ДАШБОРД ===
async function loadDashboardStats() {
    try {
        document.getElementById('statUsers').textContent = (await getDocs(collection(db, 'users'))).size;
        document.getElementById('statPrograms').textContent = (await getDocs(collection(db, 'programs'))).size;
        document.getElementById('statFeatures').textContent = (await getDocs(collection(db, 'features'))).size;
        document.getElementById('statServices').textContent = (await getDocs(collection(db, 'services'))).size;
    } catch (e) { console.error('❌ Статистика:', e); }
}

// ============================================
// 🔹 ПРОГРАММЫ
// ============================================
async function loadProgramsTable() {
    const tbody = document.getElementById('programsTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    try {
        const snapshot = await getDocs(collection(db, 'programs'));
        const programs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!programs.length) { tbody.innerHTML = '<tr><td colspan="6">Нет программ</td></tr>'; return; }
        const lvl = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый' };
        const goal = { flexibility: 'Гибкость', strength: 'Сила', relax: 'Расслабление', recovery: 'Восстановление' };
        tbody.innerHTML = programs.map(p => `
            <tr>
                <td><strong>${p.title}</strong></td>
                <td>${lvl[p.level]||p.level}</td>
                <td>${goal[p.goal]||p.goal}</td>
                <td>${p.videosCount||0}</td>
                <td><span class="badge ${p.isActive!==false?'badge-success':'badge-danger'}">${p.isActive!==false?'Активна':'Скрыта'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="editProgram('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="deleteProgram('${p.id}','${p.title}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${p.isActive!==false?'active':''}" onclick="toggleProgram('${p.id}',${p.isActive!==false})"><i class="fas fa-${p.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { console.error('❌ Программы:', e); tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; }
}
window.openProgramModal = function(id = null) {
    const modal = document.getElementById('programModal'), title = document.getElementById('programModalTitle'), form = document.getElementById('programForm');
    if (!modal || !title || !form) return;
    if (id) { title.textContent = 'Редактировать программу'; loadProgramData(id); }
    else { title.textContent = 'Добавить программу'; form.reset(); document.getElementById('programId').value = ''; document.getElementById('pActive').checked = true; }
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
};
window.closeProgramModal = function() { const modal = document.getElementById('programModal'); if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; } };
async function loadProgramData(id) {
    try {
        const snap = await getDoc(doc(db, 'programs', id));
        if (snap.exists()) { const d = snap.data();
            document.getElementById('programId').value = id;
            document.getElementById('pTitle').value = d.title||''; document.getElementById('pSlug').value = d.slug||'';
            document.getElementById('pShortDesc').value = d.shortDescription||''; document.getElementById('pFullDesc').value = d.fullDescription||'';
            document.getElementById('pLevel').value = d.level||'beginner'; document.getElementById('pGoal').value = d.goal||'flexibility';
            document.getElementById('pDurations').value = d.durations||'medium'; document.getElementById('pDuration').value = d.duration||'';
            document.getElementById('pTimePerDay').value = d.timePerDay||''; document.getElementById('pVideosCount').value = d.videosCount||10;
            document.getElementById('pImage').value = d.image||''; document.getElementById('pForWhom').value = d.forWhom||'';
            document.getElementById('pBenefits').value = d.benefits?.join('\n')||''; document.getElementById('pSchedule').value = d.schedule?.join('\n')||'';
            document.getElementById('pActive').checked = d.isActive!==false;
        }
    } catch (e) { console.error(e); Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); }
}
document.getElementById('programForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('programId').value;
    const data = { title: document.getElementById('pTitle').value, slug: document.getElementById('pSlug').value, shortDescription: document.getElementById('pShortDesc').value, fullDescription: document.getElementById('pFullDesc').value, level: document.getElementById('pLevel').value, goal: document.getElementById('pGoal').value, durations: document.getElementById('pDurations').value, duration: document.getElementById('pDuration').value, timePerDay: document.getElementById('pTimePerDay').value, videosCount: parseInt(document.getElementById('pVideosCount').value)||10, image: document.getElementById('pImage').value, forWhom: document.getElementById('pForWhom').value, benefits: document.getElementById('pBenefits').value.split('\n').filter(l=>l.trim()), schedule: document.getElementById('pSchedule').value.split('\n').filter(l=>l.trim()), isActive: document.getElementById('pActive').checked, updatedAt: serverTimestamp() };
    try {
        if (id) await updateDoc(doc(db, 'programs', id), data);
        else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'programs'), data); }
        localStorage.setItem('programsUpdated', Date.now());
        Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success');
        closeProgramModal(); loadProgramsTable();
    } catch (err) { console.error(err); Swal.fire('❌ Ошибка', 'Не удалось: '+err.message, 'error'); }
});
window.editProgram = function(id) { openProgramModal(id); };
window.deleteProgram = async function(id, title) {
    const r = await Swal.fire({ title: 'Удалить?', text: `Удалить "${title}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: 'Да' });
    if (r.isConfirmed) { try { await deleteDoc(doc(db, 'programs', id)); localStorage.setItem('programsUpdated', Date.now()); Swal.fire('Удалено!', '', 'success'); loadProgramsTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); } }
};
window.toggleProgram = async function(id, state) {
    try { await updateDoc(doc(db, 'programs', id), { isActive: !state, updatedAt: serverTimestamp() }); localStorage.setItem('programsUpdated', Date.now()); Swal.fire({ icon: 'success', title: state?'Скрыто':'Показано', timer: 1500, showConfirmButton: false }); loadProgramsTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); }
};

// ============================================
// 🔹 ПРЕИМУЩЕСТВА
// ============================================
async function loadFeaturesTable() {
    const tbody = document.getElementById('featuresTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    try {
        const snapshot = await getDocs(collection(db, 'features'));
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order||999)-(b.order||999));
        if (!items.length) { tbody.innerHTML = '<tr><td colspan="6">Нет данных</td></tr>'; return; }
        tbody.innerHTML = items.map(f => `
            <tr>
                <td><strong>${f.number||'-'}</strong></td>
                <td>${f.title||'Без названия'}</td>
                <td>${(f.description||'').substring(0,40)}${(f.description||'').length>40?'...':''}</td>
                <td>${f.order||'-'}</td>
                <td><span class="badge ${f.isActive!==false?'badge-success':'badge-danger'}">${f.isActive!==false?'Показано':'Скрыто'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="editFeature('${f.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="deleteFeature('${f.id}','${f.title||'элемента'}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${f.isActive!==false?'active':''}" onclick="toggleFeature('${f.id}',${f.isActive!==false})"><i class="fas fa-${f.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { console.error('❌', e); tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; }
}
window.openFeatureModal = function(id = null) {
    const modal = document.getElementById('featureModal'), title = document.getElementById('featureModalTitle'), form = document.getElementById('featureForm');
    if (id) { title.textContent = 'Редактировать'; loadFeatureData(id); }
    else { title.textContent = 'Добавить преимущество'; form.reset(); document.getElementById('featureId').value = ''; document.getElementById('fActive').checked = true; }
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
};
window.closeFeatureModal = function() { document.getElementById('featureModal').classList.remove('active'); document.body.style.overflow = ''; };
async function loadFeatureData(id) {
    try { const snap = await getDoc(doc(db, 'features', id)); if (snap.exists()) { const d = snap.data();
        document.getElementById('featureId').value = id; document.getElementById('fNumber').value = d.number||1; document.getElementById('fOrder').value = d.order||1;
        document.getElementById('fTitle').value = d.title||''; document.getElementById('fDescription').value = d.description||''; document.getElementById('fActive').checked = d.isActive!==false;
    }} catch (e) { console.error(e); Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); }
}
document.getElementById('featureForm')?.addEventListener('submit', async function(e) {
    e.preventDefault(); const id = document.getElementById('featureId').value;
    const data = { number: parseInt(document.getElementById('fNumber').value)||1, order: parseInt(document.getElementById('fOrder').value)||1, title: document.getElementById('fTitle').value, description: document.getElementById('fDescription').value, isActive: document.getElementById('fActive').checked, updatedAt: serverTimestamp() };
    try { if (id) await updateDoc(doc(db, 'features', id), data); else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'features'), data); }
        localStorage.setItem('featuresUpdated', Date.now()); Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success'); closeFeatureModal(); loadFeaturesTable();
    } catch (err) { console.error(err); Swal.fire('❌ Ошибка', 'Не удалось', 'error'); }
});
window.editFeature = function(id) { openFeatureModal(id); };
window.deleteFeature = async function(id, title) {
    const r = await Swal.fire({ title: 'Удалить?', text: `Удалить "${title}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: 'Да' });
    if (r.isConfirmed) { try { await deleteDoc(doc(db, 'features', id)); localStorage.setItem('featuresUpdated', Date.now()); Swal.fire('Удалено!', '', 'success'); loadFeaturesTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); } }
};
window.toggleFeature = async function(id, state) {
    try { await updateDoc(doc(db, 'features', id), { isActive: !state, updatedAt: serverTimestamp() }); localStorage.setItem('featuresUpdated', Date.now()); Swal.fire({ icon: 'success', title: state?'Скрыто':'Показано', timer: 1500, showConfirmButton: false }); loadFeaturesTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); }
};

// ============================================
// 🔹 УСЛУГИ
// ============================================
async function loadServicesTable() {
    const tbody = document.getElementById('servicesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    try {
        const snapshot = await getDocs(collection(db, 'services'));
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order||999)-(b.order||999));
        if (!items.length) { tbody.innerHTML = '<tr><td colspan="6">Нет данных</td></tr>'; return; }
        tbody.innerHTML = items.map(s => `
            <tr>
                <td>${s.title||'Без названия'}</td>
                <td>${(s.description||'').substring(0,40)}...</td>
                <td><img src="${s.image||''}" onerror="this.src='https://via.placeholder.com/50?text=No'" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>
                <td>${s.order||'-'}</td>
                <td><span class="badge ${s.isActive!==false?'badge-success':'badge-danger'}">${s.isActive!==false?'Показано':'Скрыто'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="editService('${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="deleteService('${s.id}','${s.title||'услуги'}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${s.isActive!==false?'active':''}" onclick="toggleService('${s.id}',${s.isActive!==false})"><i class="fas fa-${s.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { console.error('❌', e); tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; }
}
window.openServiceModal = function(id = null) {
    const modal = document.getElementById('serviceModal'), title = document.getElementById('serviceModalTitle'), form = document.getElementById('serviceForm');
    if (id) { title.textContent = 'Редактировать'; loadServiceData(id); }
    else { title.textContent = 'Добавить услугу'; form.reset(); document.getElementById('serviceId').value = ''; document.getElementById('sActive').checked = true; }
    modal.classList.add('active'); document.body.style.overflow = 'hidden';
};
window.closeServiceModal = function() { document.getElementById('serviceModal').classList.remove('active'); document.body.style.overflow = ''; };
async function loadServiceData(id) {
    try { const snap = await getDoc(doc(db, 'services', id)); if (snap.exists()) { const d = snap.data();
        document.getElementById('serviceId').value = id; document.getElementById('sTitle').value = d.title||''; document.getElementById('sDescription').value = d.description||'';
        document.getElementById('sImage').value = d.image||''; document.getElementById('sOrder').value = d.order||1; document.getElementById('sActive').checked = d.isActive!==false;
    }} catch (e) { console.error(e); Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); }
}
document.getElementById('serviceForm')?.addEventListener('submit', async function(e) {
    e.preventDefault(); const id = document.getElementById('serviceId').value;
    const data = { title: document.getElementById('sTitle').value, description: document.getElementById('sDescription').value, image: document.getElementById('sImage').value, order: parseInt(document.getElementById('sOrder').value)||1, isActive: document.getElementById('sActive').checked, updatedAt: serverTimestamp() };
    try { if (id) await updateDoc(doc(db, 'services', id), data); else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'services'), data); }
        localStorage.setItem('servicesUpdated', Date.now()); Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success'); closeServiceModal(); loadServicesTable();
    } catch (err) { console.error(err); Swal.fire('❌ Ошибка', 'Не удалось', 'error'); }
});
window.editService = function(id) { openServiceModal(id); };
window.deleteService = async function(id, title) {
    const r = await Swal.fire({ title: 'Удалить?', text: `Удалить "${title}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: 'Да' });
    if (r.isConfirmed) { try { await deleteDoc(doc(db, 'services', id)); localStorage.setItem('servicesUpdated', Date.now()); Swal.fire('Удалено!', '', 'success'); loadServicesTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); } }
};
window.toggleService = async function(id, state) {
    try { await updateDoc(doc(db, 'services', id), { isActive: !state, updatedAt: serverTimestamp() }); localStorage.setItem('servicesUpdated', Date.now()); Swal.fire({ icon: 'success', title: state?'Скрыто':'Показано', timer: 1500, showConfirmButton: false }); loadServicesTable(); } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); }
};

// ============================================
// 🔹 ПОЛЬЗОВАТЕЛИ (клиенты и админы)
// ============================================

// Показываем/скрываем поля в зависимости от роли
window.toggleAdminFields = function() {
    const role = document.getElementById('uRole').value;
    const clientFields = document.getElementById('clientFields');
    const passwordHint = document.getElementById('passwordHint');
    const password = document.getElementById('uPassword');
    
    if (role === 'admin') {
        clientFields.style.display = 'none';
        passwordHint.style.display = 'block';
        password.minLength = 10;
    } else {
        clientFields.style.display = 'flex';
        passwordHint.style.display = 'none';
        password.minLength = 8;
    }
};

async function loadUsersTable() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) { console.error('❌ Не найден usersTable'); return; }
    
    console.log('🔄 Загрузка пользователей...');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        console.log('📋 Получено пользователей:', snapshot.size);
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!users.length) { 
            tbody.innerHTML = '<tr><td colspan="6">Нет пользователей</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = users.map(user => {
            // Правильная обработка даты
            let createdAt = '-';
            if (user.createdAt) {
                if (user.createdAt.toDate) {
                    createdAt = user.createdAt.toDate().toLocaleDateString('ru-RU');
                } else if (typeof user.createdAt === 'string') {
                    createdAt = user.createdAt.split('T')[0];
                }
            }
            
            return `
                <tr>
                    <td>${user.name || 'Без имени'}</td>
                    <td>${user.email || '-'}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role === 'admin' ? 'Админ' : 'Клиент'}</span></td>
                    <td>${createdAt}</td>
                    <td><span class="badge ${user.isActive !== false ? 'badge-success' : 'badge-danger'}">${user.isActive !== false ? 'Активен' : 'Заблокирован'}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" onclick="window.editUser('${user.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete" onclick="window.deleteUser('${user.id}', '${user.name || user.email}')"><i class="fas fa-trash"></i></button>
                            <button class="btn-icon btn-toggle ${user.isActive !== false ? 'active' : ''}" onclick="window.toggleUser('${user.id}', ${user.isActive !== false})"><i class="fas fa-${user.isActive !== false ? 'lock' : 'unlock'}"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        console.log('✅ Пользователи отображены');
        
    } catch (error) { 
        console.error('❌ Ошибка загрузки пользователей:', error); 
        tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`; 
    }
}

// Открытие модального окна
window.openUserModal = function(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (!modal || !title || !form) { console.error('❌ Не найдены элементы'); return; }
    
    if (userId) { 
        title.textContent = 'Редактировать пользователя'; 
        window.loadUserData(userId); 
    } else { 
        title.textContent = 'Добавить пользователя'; 
        form.reset(); 
        document.getElementById('userId').value = ''; 
        document.getElementById('uRole').value = 'client'; 
        document.getElementById('uActive').checked = true; 
        document.getElementById('uPassword').required = true;
        document.getElementById('uPassword').minLength = 8;
        window.toggleAdminFields();
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeUserModal = function() { 
    const modal = document.getElementById('userModal'); 
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; } 
};

// Загрузка данных пользователя
window.loadUserData = async function(userId) {
    try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) { 
            const d = snap.data();
            document.getElementById('userId').value = userId;
            document.getElementById('uName').value = d.name || '';
            document.getElementById('uEmail').value = d.email || '';
            document.getElementById('uPassword').value = '';
            document.getElementById('uPassword').required = false;
            document.getElementById('uPhone').value = d.phone || '';
            document.getElementById('uGoal').value = d.goal || 'flexibility';
            document.getElementById('uRole').value = d.role || 'client';
            document.getElementById('uActive').checked = d.isActive !== false;
            window.toggleAdminFields();
        } else { 
            Swal.fire('Ошибка', 'Пользователь не найден', 'error'); 
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); 
    }
};

// Создание/обновление пользователя
document.getElementById('userForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const name = document.getElementById('uName').value;
    const email = document.getElementById('uEmail').value;
    const password = document.getElementById('uPassword').value;
    const phone = document.getElementById('uPhone').value;
    const goal = document.getElementById('uGoal').value;
    const role = document.getElementById('uRole').value;
    const isActive = document.getElementById('uActive').checked;
    
    // Валидация пароля
    if (!userId && password.length < (role === 'admin' ? 10 : 8)) {
        Swal.fire('Ошибка', `Пароль должен быть не менее ${role === 'admin' ? 10 : 8} символов`, 'error');
        return;
    }
    
    try {
        if (userId) {
            // === РЕДАКТИРОВАНИЕ ===
            const updateData = {
                name: name,
                email: email,
                phone: phone,
                goal: goal,
                role: role,
                isActive: isActive,
                updatedAt: serverTimestamp()
            };
            
            // Если ввели новый пароль
            if (password && password.length >= (role === 'admin' ? 10 : 8)) {
                // Примечание: смена пароля через Firebase Admin SDK
                console.log('ℹ️ Для смены пароля нужен Firebase Admin SDK');
            }
            
            await updateDoc(doc(db, 'users', userId), updateData);
            Swal.fire('✅ Успешно!', 'Пользователь обновлён', 'success');
            
      } else {
    // === СОЗДАНИЕ НОВОГО ===
    
    // Сохраняем текущего админа
    const currentAdmin = auth.currentUser;
    const adminToken = await currentAdmin?.getIdToken();
    
    try {
        // Создаём нового пользователя
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Создаём документ в Firestore
        await setDoc(doc(db, 'users', newUser.uid), {
            name: name,
            email: email,
            phone: phone,
            goal: goal,
            role: role,
            isActive: isActive,
            experience: role === 'admin' ? 'admin' : 'beginner',
            createdAt: serverTimestamp(),
            stats: role === 'admin' ? {} : {
                lessons: 0,
                flexibility: 0,
                minutes: 0,
                streak: 0
            },
            enrolledPrograms: []
        });
        
    } finally {
        // 🔥 Всегда возвращаем админа обратно!
        if (currentAdmin && currentAdmin.uid !== auth.currentUser?.uid) {
            await signOut(auth);
            // Админ войдёт автоматически через onAuthStateChanged
            // или можно явно: await signInWithCustomToken(...)
        }
    }
    
    Swal.fire('✅ Успешно!', `${role === 'admin' ? 'Администратор' : 'Клиент'} создан`, 'success');
}
        
        window.closeUserModal();
        loadUsersTable();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        
        let msg = 'Не удалось сохранить пользователя';
        if (error.code === 'auth/email-already-in-use') msg = 'Email уже зарегистрирован';
        else if (error.code === 'auth/invalid-email') msg = 'Некорректный email';
        else if (error.code === 'auth/weak-password') msg = 'Слишком простой пароль';
        
        Swal.fire('❌ Ошибка', msg, 'error');
    }
});

window.editUser = function(userId) { window.openUserModal(userId); };

window.deleteUser = async function(userId, userName) {
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${userName}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да' 
    });
    
    if (r.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'users', userId));
            console.log('ℹ️ Для полного удаления нужен Firebase Admin SDK');
            Swal.fire('Удалено!', '', 'success'); 
            loadUsersTable();
        } catch(e) { 
            Swal.fire('Ошибка', 'Не удалось удалить', 'error'); 
        }
    }
};

window.toggleUser = async function(userId, state) {
    try {
        await updateDoc(doc(db, 'users', userId), { 
            isActive: !state, 
            updatedAt: serverTimestamp() 
        });
        Swal.fire({ 
            icon: 'success', 
            title: state ? 'Заблокирован' : 'Активен', 
            timer: 1500, 
            showConfirmButton: false 
        });
        loadUsersTable();
    } catch(e) { 
        Swal.fire('Ошибка', 'Не удалось изменить статус', 'error'); 
    }
};

// ============================================
// 🔹 СПЕЦИАЛИСТЫ
// ============================================

async function loadSpecialistsTable() {
    const tbody = document.getElementById('specialistsTableBody');
    if (!tbody) { console.error('❌ Не найден specialistsTableBody'); return; }
    
    console.log('🔄 Загрузка специалистов...');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'specialists'));
        console.log('📋 Получено документов:', snapshot.size);
        
        const specialists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!specialists.length) { tbody.innerHTML = '<tr><td colspan="6">Нет специалистов</td></tr>'; return; }
        
        tbody.innerHTML = specialists.map(spec => `
            <tr>
                <td><img src="${spec.photoUrl || ''}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'"></td>
                <td><strong>${spec.name || 'Без имени'}</strong></td>
                <td>${(spec.position || '').substring(0, 40)}${(spec.position || '').length > 40 ? '...' : ''}</td>
                <td>${spec.experience || '-'}</td>
                <td><span class="badge ${spec.isActive !== false ? 'badge-success' : 'badge-danger'}">${spec.isActive !== false ? 'Показан' : 'Скрыт'}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="window.editSpecialist('${spec.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" onclick="window.deleteSpecialist('${spec.id}', '${spec.name || 'специалиста'}')"><i class="fas fa-trash"></i></button>
                        <button class="btn-icon btn-toggle ${spec.isActive !== false ? 'active' : ''}" onclick="window.toggleSpecialist('${spec.id}', ${spec.isActive !== false})"><i class="fas fa-${spec.isActive !== false ? 'eye' : 'eye-slash'}"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ Специалисты загружены:', specialists.length);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`;
    }
}

// ✅ ВАЖНО: Все функции должны быть на window!

window.openSpecialistModal = function(specialistId = null) {
    console.log('🔧 openSpecialistModal вызвана, ID:', specialistId);
    const modal = document.getElementById('specialistModal');
    const title = document.getElementById('specialistModalTitle');
    const form = document.getElementById('specialistForm');
    if (!modal || !title || !form) { console.error('❌ Не найдены элементы модального окна'); return; }
    
    if (specialistId) { 
        title.textContent = 'Редактировать специалиста'; 
        window.loadSpecialistData(specialistId); 
    } else { 
        title.textContent = 'Добавить специалиста'; 
        form.reset(); 
        document.getElementById('specialistId').value = ''; 
        document.getElementById('sActive').checked = true; 
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeSpecialistModal = function() {
    const modal = document.getElementById('specialistModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
};

window.loadSpecialistData = async function(id) {
    try {
        const snap = await getDoc(doc(db, 'specialists', id));
        if (snap.exists()) { const d = snap.data();
            document.getElementById('specialistId').value = id;
            document.getElementById('sName').value = d.name || '';
            document.getElementById('sPosition').value = d.position || '';
            document.getElementById('sExperience').value = d.experience || '';
            document.getElementById('sEducation').value = d.education || '';
            document.getElementById('sSpecialization').value = d.specialization || '';
            document.getElementById('sQuote').value = d.quote || '';
            document.getElementById('sPhotoUrl').value = d.photoUrl || '';
            document.getElementById('sActive').checked = d.isActive !== false;
        }
    } catch (e) { console.error(e); Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); }
};

document.getElementById('specialistForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('specialistId').value;
    const data = {
        name: document.getElementById('sName').value,
        position: document.getElementById('sPosition').value,
        experience: document.getElementById('sExperience').value,
        education: document.getElementById('sEducation').value,
        specialization: document.getElementById('sSpecialization').value,
        quote: document.getElementById('sQuote').value,
        photoUrl: document.getElementById('sPhotoUrl').value,
        isActive: document.getElementById('sActive').checked,
        updatedAt: serverTimestamp()
    };
    try {
        if (id) await updateDoc(doc(db, 'specialists', id), data);
        else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'specialists'), data); }
        localStorage.setItem('specialistsUpdated', Date.now());
        Swal.fire('✅ Успешно!', id ? 'Обновлён' : 'Добавлен', 'success');
        window.closeSpecialistModal();
        loadSpecialistsTable();
    } catch (err) { console.error(err); Swal.fire('❌ Ошибка', 'Не удалось', 'error'); }
});

// ✅ ЭТИ ФУНКЦИИ ДОЛЖНЫ БЫТЬ НА window:
window.editSpecialist = function(id) { 
    console.log('✏️ editSpecialist:', id);
    window.openSpecialistModal(id); 
};

window.deleteSpecialist = async function(id, name) {
    console.log('🗑️ deleteSpecialist:', id, name);
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${name}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да' 
    });
    if (r.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'specialists', id));
            localStorage.setItem('specialistsUpdated', Date.now());
            Swal.fire('Удалено!', '', 'success');
            loadSpecialistsTable();
        } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); }
    }
};

window.toggleSpecialist = async function(id, state) {
    console.log('👁️ toggleSpecialist:', id, state);
    try {
        await updateDoc(doc(db, 'specialists', id), { isActive: !state, updatedAt: serverTimestamp() });
        localStorage.setItem('specialistsUpdated', Date.now());
        Swal.fire({ icon: 'success', title: state ? 'Скрыт' : 'Показан', timer: 1500, showConfirmButton: false });
        loadSpecialistsTable();
    } catch(e) { Swal.fire('Ошибка', 'Не удалось', 'error'); }
};


// ============================================
// 🔹 НАСТРОЙКИ
// ============================================
async function loadSettings() {
    try {
        const snap = await getDocs(query(collection(db, 'settings'), where('section', '==', 'home')));
        const settings = {}; snap.docs.forEach(doc => { const d = doc.data(); settings[d.key] = d.value; });
        if (settings.hero_title) document.getElementById('heroTitle').value = settings.hero_title;
        if (settings.hero_subtitle) document.getElementById('heroSubtitle').value = settings.hero_subtitle;
        if (settings.hero_btn1) document.getElementById('heroBtn1').value = settings.hero_btn1;
        if (settings.hero_btn2) document.getElementById('heroBtn2').value = settings.hero_btn2;
    } catch (e) { console.error('❌ Настройки:', e); }
}
document.getElementById('settingsForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const settings = [ { key: 'hero_title', value: document.getElementById('heroTitle').value }, { key: 'hero_subtitle', value: document.getElementById('heroSubtitle').value }, { key: 'hero_btn1', value: document.getElementById('heroBtn1').value }, { key: 'hero_btn2', value: document.getElementById('heroBtn2').value } ];
    try {
        for (const s of settings) {
            const q = query(collection(db, 'settings'), where('key', '==', s.key)); const snap = await getDocs(q);
            if (!snap.empty) await updateDoc(doc(db, 'settings', snap.docs[0].id), { value: s.value, section: 'home', updatedAt: serverTimestamp() });
            else await addDoc(collection(db, 'settings'), { key: s.key, value: s.value, section: 'home', updatedAt: serverTimestamp() });
        }
        Swal.fire('✅ Успешно!', 'Настройки сохранены', 'success');
    } catch (err) { console.error(err); Swal.fire('Ошибка', 'Не удалось', 'error'); }
});

// ============================================
// 🔹 ВЫХОД
// ============================================
window.logout = function() { signOut(auth).then(() => window.location.href = 'login.html').catch(e => console.error('Выход:', e)); };

// ============================================
// 🔹 ОТЗЫВЫ
// ============================================

async function loadReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) { console.error('❌ Не найден reviewsTableBody'); return; }
    
    console.log('🔄 Загрузка отзывов...');
    tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'reviews'));
        console.log('📋 Получено отзывов:', snapshot.size);
        
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!reviews.length) { tbody.innerHTML = '<tr><td colspan="5">Нет отзывов</td></tr>'; return; }
        
        tbody.innerHTML = reviews.map(review => {
            const userName = review.userName || 'Аноним';
            const rating = '⭐'.repeat(review.rating || 5);
            const date = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
            
            return `
                <tr>
                    <td><strong>${userName}</strong></td>
                    <td>${rating}</td>
                    <td>${(review.text || '').substring(0, 50)}...</td>
                    <td>${date}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-delete" onclick="window.deleteReview('${review.id}', '${userName}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        console.log('✅ Отзывы отображены');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки отзывов:', error);
        tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${error.message}</td></tr>`;
    }
}

// ✅ ВАЖНО: Функция должна быть на window!
window.deleteReview = async function(reviewId, userName) {
    console.log('🗑️ deleteReview:', reviewId, userName);
    
    const result = await Swal.fire({
        title: 'Удалить отзыв?',
        text: `Вы уверены что хотите удалить отзыв от "${userName}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#999',
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена'
    });
    
    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'reviews', reviewId));
            Swal.fire('Удалено!', 'Отзыв удалён', 'success');
            loadReviewsTable();
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            Swal.fire('Ошибка', 'Не удалось удалить отзыв', 'error');
        }
    }
};

console.log('🚀 Админ-панель загружена');