// Импорт Firebase
import { auth, db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, orderBy, getDocs, 
    doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ============================================
// 🔹 ВТОРОЙ FIREBASE APP (для создания пользователей без выхода админа)
// ============================================
const adminApp = initializeApp(firebaseConfig, 'AdminSecondary');
const adminAuth = getAuth(adminApp);

// Глобальные переменные
let currentUser = null;
let currentLessons = [];
let isCreatingUser = false;

// === ПРОВЕРКА АВТОРИЗАЦИИ ===
onAuthStateChanged(auth, async (user) => {
    if (isCreatingUser) return;
    
    if (user) {
        console.log('✅ Пользователь авторизован:', user.email);
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role !== 'admin') {
                    Swal.fire({ 
                        icon: 'error', 
                        title: 'Доступ запрещён', 
                        text: 'Только администраторы', 
                        confirmButtonColor: '#6198FF' 
                    }).then(() => window.location.href = 'index.html');
                    return;
                }
                currentUser = user;
                setupAdminPanel(userData);
                loadDashboardStats();
            } else {
                Swal.fire('Ошибка', 'Пользователь не найден', 'error');
            }
        } catch (error) { 
            console.error('❌ Ошибка:', error); 
        }
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
        trainers: 'Тренеры',
        features: 'Преимущества', 
        services: 'Услуги', 
        users: 'Пользователи',
        specialists: 'Специалисты',
        reviews: 'Отзывы',
        contactMessages: 'Сообщения с сайта' 
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Панель управления';
    
    switch(section) {
        case 'programs': loadProgramsTable(); break;
        case 'trainers': loadTrainersTable(); break;
        case 'features': loadFeaturesTable(); break;
        case 'services': loadServicesTable(); break;
        case 'users': loadUsersTable(); break;
        case 'specialists': loadSpecialistsTable(); break;
        case 'reviews': loadReviewsTable(); break;
        case 'contactMessages': loadContactMessages(); break;
        case 'dashboard': loadDashboardStats(); break;
    }
}

// === ДАШБОРД ===
async function loadDashboardStats() {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => d.data());
        const trainersCount = users.filter(u => u.role === 'trainer').length;
        
        //  Проверяем существование элементов перед установкой
        const statUsers = document.getElementById('statUsers');
        const statTrainers = document.getElementById('statTrainers');
        const statPrograms = document.getElementById('statPrograms');
        const statFeatures = document.getElementById('statFeatures');
        const statServices = document.getElementById('statServices');
        
        if (statUsers) statUsers.textContent = users.length;
        if (statTrainers) statTrainers.textContent = trainersCount;
        if (statPrograms) statPrograms.textContent = (await getDocs(collection(db, 'programs'))).size;
        if (statFeatures) statFeatures.textContent = (await getDocs(collection(db, 'features'))).size;
        if (statServices) statServices.textContent = (await getDocs(collection(db, 'services'))).size;
        
    } catch (e) { 
        console.error('❌ Статистика:', e); 
    }
}

// ============================================
// 🔹 УРОКИ ПРОГРАММ
// ============================================
window.addLesson = function() {
    currentLessons.push({
        day: currentLessons.length + 1,
        title: '',
        videoUrl: '',
        duration: ''
    });
    renderLessons();
}

window.deleteLesson = function(index) {
    currentLessons.splice(index, 1);
    currentLessons = currentLessons.map((lesson, i) => ({ ...lesson, day: i + 1 }));
    renderLessons();
}

window.updateLesson = function(index, field, value) {
    currentLessons[index][field] = value;
}

function renderLessons() {
    const container = document.getElementById('lessonsContainer');
    const noLessons = document.getElementById('noLessons');
    
    if (!container) return;
    
    if (currentLessons.length === 0) {
        if (noLessons) noLessons.style.display = 'block';
        container.querySelectorAll('.lesson-card').forEach(card => card.remove());
        return;
    }
    
    if (noLessons) noLessons.style.display = 'none';
    
    container.innerHTML = currentLessons.map((lesson, index) => `
        <div class="lesson-card" style="background: white; border: 2px solid #eef2f6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #2c3e50;">
                    <i class="fas fa-calendar-day" style="color: #6198FF; margin-right: 8px;"></i>
                    День ${lesson.day}
                </h4>
                <button type="button" class="btn btn-sm btn-danger" onclick="window.deleteLesson(${index})">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
            <div class="form-row" style="margin-bottom: 10px;">
                <div class="form-group" style="flex: 2;">
                    <label>Название урока</label>
                    <input type="text" class="form-input" placeholder="Например: Разминка"
                           value="${escapeHtml(lesson.title)}"
                           onchange="window.updateLesson(${index}, 'title', this.value)">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Длительность</label>
                    <input type="text" class="form-input" placeholder="15 мин"
                           value="${escapeHtml(lesson.duration)}"
                           onchange="window.updateLesson(${index}, 'duration', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Видео (Google Drive)</label>
                <input type="text" class="form-input" placeholder="https://drive.google.com/file/d/.../view"
                       value="${escapeHtml(lesson.videoUrl)}"
                       onchange="window.updateLesson(${index}, 'videoUrl', this.value)">
                ${lesson.videoUrl ? `
                    <small style="color: #27ae60; display: block; margin-top: 5px;">
                        <i class="fas fa-check-circle"></i> Видео добавлено
                    </small>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.loadProgramLessons = function(programData) {
    if (programData.lessons && Array.isArray(programData.lessons)) {
        currentLessons = programData.lessons;
        renderLessons();
    }
}

window.clearLessons = function() {
    currentLessons = [];
    renderLessons();
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
                <td><strong>${escapeHtml(p.title)}</strong></td>
                <td>${lvl[p.level]||p.level}</td>
                <td>${goal[p.goal]||p.goal}</td>
                <td>${p.videosCount||0}</td>
                <td><span class="badge ${p.isActive!==false?'badge-success':'badge-danger'}">${p.isActive!==false?'Активна':'Скрыта'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="window.editProgram('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="window.deleteProgram('${p.id}','${escapeHtml(p.title)}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${p.isActive!==false?'active':''}" onclick="window.toggleProgram('${p.id}',${p.isActive!==false})"><i class="fas fa-${p.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { 
        console.error('❌ Программы:', e); 
        tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; 
    }
}

window.openProgramModal = function(id = null) {
    const modal = document.getElementById('programModal');
    const title = document.getElementById('programModalTitle');
    const form = document.getElementById('programForm');
    if (!modal || !title || !form) return;
    window.clearLessons();
    if (id) { 
        title.textContent = 'Редактировать программу'; 
        loadProgramData(id); 
    } else { 
        title.textContent = 'Добавить программу'; 
        form.reset(); 
        document.getElementById('programId').value = ''; 
        document.getElementById('pActive').checked = true; 
    }
    modal.classList.add('active'); 
    document.body.style.overflow = 'hidden';
};

window.closeProgramModal = function() { 
    const modal = document.getElementById('programModal'); 
    if (modal) { 
        modal.classList.remove('active'); 
        document.body.style.overflow = ''; 
        window.clearLessons();
    } 
};

async function loadProgramData(id) {
    try {
        const snap = await getDoc(doc(db, 'programs', id));
        if (snap.exists()) { 
            const d = snap.data();
            document.getElementById('programId').value = id;
            document.getElementById('pTitle').value = d.title||''; 
            document.getElementById('pSlug').value = d.slug||'';
            document.getElementById('pShortDesc').value = d.shortDescription||''; 
            document.getElementById('pFullDesc').value = d.fullDescription||'';
            document.getElementById('pLevel').value = d.level||'beginner'; 
            document.getElementById('pGoal').value = d.goal||'flexibility';
            document.getElementById('pDurations').value = d.durations||'medium'; 
            document.getElementById('pDuration').value = d.duration||'';
            document.getElementById('pTimePerDay').value = d.timePerDay||''; 
            document.getElementById('pVideosCount').value = d.videosCount||10;
            document.getElementById('pImage').value = d.image||''; 
            document.getElementById('pForWhom').value = d.forWhom||'';
            document.getElementById('pBenefits').value = d.benefits?.join('\n')||''; 
            document.getElementById('pSchedule').value = d.schedule?.join('\n')||'';
            document.getElementById('pActive').checked = d.isActive!==false;
            if (d.lessons && Array.isArray(d.lessons)) {
                currentLessons = d.lessons;
                renderLessons();
            }
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); 
    }
}

document.getElementById('programForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('programId').value;
    const data = { 
        title: document.getElementById('pTitle').value, 
        slug: document.getElementById('pSlug').value, 
        shortDescription: document.getElementById('pShortDesc').value, 
        fullDescription: document.getElementById('pFullDesc').value, 
        level: document.getElementById('pLevel').value, 
        goal: document.getElementById('pGoal').value, 
        durations: document.getElementById('pDurations').value, 
        duration: document.getElementById('pDuration').value, 
        timePerDay: document.getElementById('pTimePerDay').value, 
        videosCount: parseInt(document.getElementById('pVideosCount').value)||10, 
        image: document.getElementById('pImage').value, 
        forWhom: document.getElementById('pForWhom').value, 
        benefits: document.getElementById('pBenefits').value.split('\n').filter(l=>l.trim()), 
        schedule: document.getElementById('pSchedule').value.split('\n').filter(l=>l.trim()), 
        lessons: currentLessons,
        isActive: document.getElementById('pActive').checked, 
        updatedAt: serverTimestamp() 
    };
    try {
        if (id) await updateDoc(doc(db, 'programs', id), data);
        else { 
            data.createdAt = serverTimestamp(); 
            await addDoc(collection(db, 'programs'), data); 
        }
        localStorage.setItem('programsUpdated', Date.now());
        Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success');
        window.closeProgramModal(); 
        loadProgramsTable();
    } catch (err) { 
        console.error(err); 
        Swal.fire('❌ Ошибка', 'Не удалось: '+err.message, 'error'); 
    }
});

window.editProgram = function(id) { window.openProgramModal(id); };
window.deleteProgram = async function(id, title) {
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${title}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да' 
    });
    if (r.isConfirmed) { 
        try { 
            await deleteDoc(doc(db, 'programs', id)); 
            localStorage.setItem('programsUpdated', Date.now()); 
            Swal.fire('Удалено!', '', 'success'); 
            loadProgramsTable(); 
        } catch(e) { 
            Swal.fire('Ошибка', 'Не удалось', 'error'); 
        } 
    }
};
window.toggleProgram = async function(id, state) {
    try { 
        await updateDoc(doc(db, 'programs', id), { 
            isActive: !state, 
            updatedAt: serverTimestamp() 
        }); 
        localStorage.setItem('programsUpdated', Date.now()); 
        Swal.fire({ 
            icon: 'success', 
            title: state?'Скрыто':'Показано', 
            timer: 1500, 
            showConfirmButton: false 
        }); 
        loadProgramsTable(); 
    } catch(e) { 
        Swal.fire('Ошибка', 'Не удалось', 'error'); 
    }
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
                <td><strong>${escapeHtml(f.number||'-')}</strong></td>
                <td>${escapeHtml(f.title||'Без названия')}</td>
                <td>${escapeHtml((f.description||'').substring(0,40))}${(f.description||'').length>40?'...':''}</td>
                <td>${f.order||'-'}</td>
                <td><span class="badge ${f.isActive!==false?'badge-success':'badge-danger'}">${f.isActive!==false?'Показано':'Скрыто'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="window.editFeature('${f.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="window.deleteFeature('${f.id}','${escapeHtml(f.title||'элемента')}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${f.isActive!==false?'active':''}" onclick="window.toggleFeature('${f.id}',${f.isActive!==false})"><i class="fas fa-${f.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { 
        console.error('❌', e); 
        tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; 
    }
}

window.openFeatureModal = function(id = null) {
    const modal = document.getElementById('featureModal');
    const title = document.getElementById('featureModalTitle');
    const form = document.getElementById('featureForm');
    if (id) { 
        title.textContent = 'Редактировать'; 
        loadFeatureData(id); 
    } else { 
        title.textContent = 'Добавить преимущество'; 
        form.reset(); 
        document.getElementById('featureId').value = ''; 
        document.getElementById('fActive').checked = true; 
    }
    modal.classList.add('active'); 
    document.body.style.overflow = 'hidden';
};

window.closeFeatureModal = function() { 
    document.getElementById('featureModal').classList.remove('active'); 
    document.body.style.overflow = ''; 
};

async function loadFeatureData(id) {
    try { 
        const snap = await getDoc(doc(db, 'features', id)); 
        if (snap.exists()) { 
            const d = snap.data();
            document.getElementById('featureId').value = id; 
            document.getElementById('fNumber').value = d.number||1; 
            document.getElementById('fOrder').value = d.order||1;
            document.getElementById('fTitle').value = d.title||''; 
            document.getElementById('fDescription').value = d.description||''; 
            document.getElementById('fActive').checked = d.isActive!==false;
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); 
    }
}

document.getElementById('featureForm')?.addEventListener('submit', async function(e) {
    e.preventDefault(); 
    const id = document.getElementById('featureId').value;
    const data = { 
        number: parseInt(document.getElementById('fNumber').value)||1, 
        order: parseInt(document.getElementById('fOrder').value)||1, 
        title: document.getElementById('fTitle').value, 
        description: document.getElementById('fDescription').value, 
        isActive: document.getElementById('fActive').checked, 
        updatedAt: serverTimestamp() 
    };
    try { 
        if (id) await updateDoc(doc(db, 'features', id), data); 
        else { 
            data.createdAt = serverTimestamp(); 
            await addDoc(collection(db, 'features'), data); 
        }
        localStorage.setItem('featuresUpdated', Date.now()); 
        Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success'); 
        window.closeFeatureModal(); 
        loadFeaturesTable();
    } catch (err) { 
        console.error(err); 
        Swal.fire('❌ Ошибка', 'Не удалось', 'error'); 
    }
});

window.editFeature = function(id) { window.openFeatureModal(id); };
window.deleteFeature = async function(id, title) {
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${title}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да' 
    });
    if (r.isConfirmed) { 
        try { 
            await deleteDoc(doc(db, 'features', id)); 
            localStorage.setItem('featuresUpdated', Date.now()); 
            Swal.fire('Удалено!', '', 'success'); 
            loadFeaturesTable(); 
        } catch(e) { 
            Swal.fire('Ошибка', 'Не удалось', 'error'); 
        } 
    }
};
window.toggleFeature = async function(id, state) {
    try { 
        await updateDoc(doc(db, 'features', id), { 
            isActive: !state, 
            updatedAt: serverTimestamp() 
        }); 
        localStorage.setItem('featuresUpdated', Date.now()); 
        Swal.fire({ 
            icon: 'success', 
            title: state?'Скрыто':'Показано', 
            timer: 1500, 
            showConfirmButton: false 
        }); 
        loadFeaturesTable(); 
    } catch(e) { 
        Swal.fire('Ошибка', 'Не удалось', 'error'); 
    }
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
                <td>${escapeHtml(s.title||'Без названия')}</td>
                <td>${escapeHtml((s.description||'').substring(0,40))}...</td>
                <td><img src="${escapeHtml(s.image||'')}" onerror="this.src='https://via.placeholder.com/50?text=No'" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>
                <td>${s.order||'-'}</td>
                <td><span class="badge ${s.isActive!==false?'badge-success':'badge-danger'}">${s.isActive!==false?'Показано':'Скрыто'}</span></td>
                <td><div class="table-actions">
                    <button class="btn-icon btn-edit" onclick="window.editService('${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" onclick="window.deleteService('${s.id}','${escapeHtml(s.title||'услуги')}')"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon btn-toggle ${s.isActive!==false?'active':''}" onclick="window.toggleService('${s.id}',${s.isActive!==false})"><i class="fas fa-${s.isActive!==false?'eye':'eye-slash'}"></i></button>
                </div></td>
            </tr>`).join('');
    } catch (e) { 
        console.error('❌', e); 
        tbody.innerHTML = '<tr><td colspan="6">Ошибка</td></tr>'; 
    }
}

window.openServiceModal = function(id = null) {
    const modal = document.getElementById('serviceModal');
    const title = document.getElementById('serviceModalTitle');
    const form = document.getElementById('serviceForm');
    if (id) { 
        title.textContent = 'Редактировать'; 
        loadServiceData(id); 
    } else { 
        title.textContent = 'Добавить услугу'; 
        form.reset(); 
        document.getElementById('serviceId').value = ''; 
        document.getElementById('sActive').checked = true; 
    }
    modal.classList.add('active'); 
    document.body.style.overflow = 'hidden';
};

window.closeServiceModal = function() { 
    document.getElementById('serviceModal').classList.remove('active'); 
    document.body.style.overflow = ''; 
};

async function loadServiceData(id) {
    try { 
        const snap = await getDoc(doc(db, 'services', id)); 
        if (snap.exists()) { 
            const d = snap.data();
            document.getElementById('serviceId').value = id; 
            document.getElementById('sTitle').value = d.title||''; 
            document.getElementById('sDescription').value = d.description||'';
            document.getElementById('sImage').value = d.image||''; 
            document.getElementById('sOrder').value = d.order||1; 
            document.getElementById('sActive').checked = d.isActive!==false;
        }
    } catch (e) { 
        console.error(e); 
        Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); 
    }
}

document.getElementById('serviceForm')?.addEventListener('submit', async function(e) {
    e.preventDefault(); 
    const id = document.getElementById('serviceId').value;
    const data = { 
        title: document.getElementById('sTitle').value, 
        description: document.getElementById('sDescription').value, 
        image: document.getElementById('sImage').value, 
        order: parseInt(document.getElementById('sOrder').value)||1, 
        isActive: document.getElementById('sActive').checked, 
        updatedAt: serverTimestamp() 
    };
    try { 
        if (id) await updateDoc(doc(db, 'services', id), data); 
        else { 
            data.createdAt = serverTimestamp(); 
            await addDoc(collection(db, 'services'), data); 
        }
        localStorage.setItem('servicesUpdated', Date.now()); 
        Swal.fire('✅ Успешно!', id?'Обновлено':'Добавлено', 'success'); 
        window.closeServiceModal(); 
        loadServicesTable();
    } catch (err) { 
        console.error(err); 
        Swal.fire('❌ Ошибка', 'Не удалось', 'error'); 
    }
});

window.editService = function(id) { window.openServiceModal(id); };
window.deleteService = async function(id, title) {
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${title}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да' 
    });
    if (r.isConfirmed) { 
        try { 
            await deleteDoc(doc(db, 'services', id)); 
            localStorage.setItem('servicesUpdated', Date.now()); 
            Swal.fire('Удалено!', '', 'success'); 
            loadServicesTable(); 
        } catch(e) { 
            Swal.fire('Ошибка', 'Не удалось', 'error'); 
        } 
    }
};
window.toggleService = async function(id, state) {
    try { 
        await updateDoc(doc(db, 'services', id), { 
            isActive: !state, 
            updatedAt: serverTimestamp() 
        }); 
        localStorage.setItem('servicesUpdated', Date.now()); 
        Swal.fire({ 
            icon: 'success', 
            title: state?'Скрыто':'Показано', 
            timer: 1500, 
            showConfirmButton: false 
        }); 
        loadServicesTable(); 
    } catch(e) { 
        Swal.fire('Ошибка', 'Не удалось', 'error'); 
    }
};

// ============================================
// 🔹 ПОЛЬЗОВАТЕЛИ (клиенты и админы)
// ============================================
window.toggleAdminFields = function() {
    const role = document.getElementById('uRole').value;
    const clientFields = document.getElementById('clientFields');
    const passwordHint = document.getElementById('passwordHint');
    const password = document.getElementById('uPassword');
    
    if (role === 'admin') {
        if (clientFields) clientFields.style.display = 'none';
        if (passwordHint) passwordHint.style.display = 'block';
        if (password) password.minLength = 10;
    } else {
        if (clientFields) clientFields.style.display = 'flex';
        if (passwordHint) passwordHint.style.display = 'none';
        if (password) password.minLength = 8;
    }
};

async function loadUsersTable() {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!users.length) { 
            tbody.innerHTML = '<tr><td colspan="6">Нет пользователей</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = users.map(user => {
            // Пропускаем тренеров — они в отдельной секции
            if (user.role === 'trainer') return '';
            
            let createdAt = '-';
            if (user.createdAt) {
                if (user.createdAt.toDate) {
                    createdAt = user.createdAt.toDate().toLocaleDateString('ru-RU');
                } else if (typeof user.createdAt === 'string') {
                    createdAt = user.createdAt.split('T')[0];
                }
            }
            
            const roleLabel = user.role === 'admin' ? 'Админ' : 'Клиент';
            const roleClass = user.role === 'admin' ? 'badge-admin' : 'badge-user';
            
            return `
                <tr>
                    <td>${escapeHtml(user.name || 'Без имени')}</td>
                    <td>${escapeHtml(user.email || '-')}</td>
                    <td><span class="badge ${roleClass}">${roleLabel}</span></td>
                    <td>${createdAt}</td>
                    <td><span class="badge ${user.isActive !== false ? 'badge-success' : 'badge-danger'}">${user.isActive !== false ? 'Активен' : 'Заблокирован'}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" onclick="window.editUser('${user.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete" onclick="window.deleteUser('${user.id}', '${escapeHtml(user.name || user.email)}')"><i class="fas fa-trash"></i></button>
                            <button class="btn-icon btn-toggle ${user.isActive !== false ? 'active' : ''}" onclick="window.toggleUser('${user.id}', ${user.isActive !== false})"><i class="fas fa-${user.isActive !== false ? 'lock' : 'unlock'}"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).filter(html => html).join('');
        
    } catch (error) { 
        console.error('❌ Ошибка:', error); 
        tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`; 
    }
}

window.openUserModal = function(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    if (!modal || !title || !form) return;
    
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
    if (modal) { 
        modal.classList.remove('active'); 
        document.body.style.overflow = ''; 
    } 
};

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
    
    if (!userId && password.length < (role === 'admin' ? 10 : 8)) {
        Swal.fire('Ошибка', `Пароль должен быть не менее ${role === 'admin' ? 10 : 8} символов`, 'error');
        return;
    }
    
    try {
        if (userId) {
            const updateData = {
                name: name,
                email: email,
                phone: phone,
                goal: goal,
                role: role,
                isActive: isActive,
                updatedAt: serverTimestamp()
            };
            
            await updateDoc(doc(db, 'users', userId), updateData);
            Swal.fire('✅ Успешно!', 'Пользователь обновлён', 'success');
            
        } else {
            isCreatingUser = true;
            
            try {
                const userCredential = await createUserWithEmailAndPassword(adminAuth, email, password);
                const newUser = userCredential.user;
                
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
                
                await signOut(adminAuth);
                
            } finally {
                isCreatingUser = false;
            }
            
            Swal.fire('✅ Успешно!', `${role === 'admin' ? 'Администратор' : 'Клиент'} создан`, 'success');
        }
        
        window.closeUserModal();
        loadUsersTable();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        isCreatingUser = false;
        
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
// 🔹 ТРЕНЕРЫ
// ============================================
async function loadTrainersTable() {
    const grid = document.getElementById('trainersGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Загрузка...</p></div>';
    
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'trainer'));
        const snapshot = await getDocs(q);
        const trainers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        
        const statTrainers = document.getElementById('statTrainers');
        if (statTrainers) statTrainers.textContent = trainers.length;
        
        renderTrainers(trainers);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки тренеров:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Ошибка загрузки</h3></div>';
    }
}

function renderTrainers(trainers) {
    const grid = document.getElementById('trainersGrid');
    if (!grid) return;
    
    if (trainers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-tie"></i>
                <h3>Тренеры ещё не добавлены</h3>
                <p>Нажмите "Добавить тренера" чтобы создать первого</p>
                <button class="btn btn-primary" onclick="window.openTrainerModal()">
                    <i class="fas fa-user-plus"></i> Добавить тренера
                </button>
            </div>
        `;
        return;
    }
    
    const specLabels = {
        flexibility: 'Гибкость',
        strength: 'Сила',
        yoga: 'Йога',
        pilates: 'Пилатес',
        rehabilitation: 'Реабилитация',
        cardio: 'Кардио',
        general: 'ОФП'
    };
    
    grid.innerHTML = trainers.map(t => {
        const photoUrl = t.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=6198FF&color=fff`;
        const specLabel = specLabels[t.specialization] || t.specialization || 'Тренер';
        
        return `
            <div class="trainer-card">
                <div class="trainer-card-header">
                    <img src="${photoUrl}" alt="${t.name}" class="trainer-avatar" 
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=6198FF&color=fff'">
                    <div class="trainer-main-info">
                        <h4>${escapeHtml(t.name)}</h4>
                        <p class="trainer-email">${escapeHtml(t.email)}</p>
                        <span class="trainer-specialization-badge">${escapeHtml(specLabel)}</span>
                    </div>
                </div>
                
                ${t.description ? `<p class="trainer-description">${escapeHtml(t.description)}</p>` : ''}
                
                <div class="trainer-stats">
                    <div class="trainer-stat">
                        <span class="trainer-stat-value">${t.clientsCount || 0}</span>
                        <span class="trainer-stat-label">Клиентов</span>
                    </div>
                    <div class="trainer-stat">
                        <span class="trainer-stat-value">${t.programsCount || 0}</span>
                        <span class="trainer-stat-label">Программ</span>
                    </div>
                </div>
                
                <span class="trainer-status ${t.isActive !== false ? 'active' : 'inactive'}">
                    <i class="fas fa-${t.isActive !== false ? 'check-circle' : 'times-circle'}"></i>
                    ${t.isActive !== false ? 'Активен' : 'Заблокирован'}
                </span>
                
                <div class="trainer-actions">
                    <button class="btn btn-outline" onclick="window.openTrainerModal('${t.uid}')">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-danger" onclick="window.deleteTrainer('${t.uid}', '${escapeHtml(t.name)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.openTrainerModal = function(trainerUid = null) {
    const modal = document.getElementById('trainerModal');
    const form = document.getElementById('trainerForm');
    const title = document.getElementById('trainerModalTitle');
    
    if (!modal || !form || !title) return;
    
    form.reset();
    document.getElementById('trainerId').value = '';
    
    if (trainerUid) {
        title.innerHTML = '<i class="fas fa-edit"></i> Редактировать тренера';
        window.loadTrainerData(trainerUid);
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Добавить тренера';
        document.getElementById('tPassword').required = true;
        document.getElementById('tPassword').minLength = 6;
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeTrainerModal = function() {
    const modal = document.getElementById('trainerModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

window.loadTrainerData = async function(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            Swal.fire('Ошибка', 'Тренер не найден', 'error');
            return;
        }
        
        const t = userDoc.data();
        
        document.getElementById('trainerId').value = uid;
        document.getElementById('tName').value = t.name || '';
        document.getElementById('tEmail').value = t.email || '';
        document.getElementById('tPhone').value = t.phone || '';
        document.getElementById('tSpecialization').value = t.specialization || '';
        document.getElementById('tExperience').value = t.experience || '';
        document.getElementById('tDescription').value = t.description || '';
        document.getElementById('tEducation').value = t.education || '';
        document.getElementById('tPhotoUrl').value = t.photoUrl || '';
        document.getElementById('tInstagram').value = t.instagram || '';
        document.getElementById('tActive').checked = t.isActive !== false;
        document.getElementById('tCanCreatePrograms').checked = t.canCreatePrograms !== false;
        document.getElementById('tCanViewClients').checked = t.canViewClients !== false;
        
        document.getElementById('tPassword').required = false;
        document.getElementById('tPassword').placeholder = 'Оставьте пустым, чтобы не менять';
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        Swal.fire('Ошибка', 'Не удалось загрузить данные', 'error');
    }
};

// 🔥 ЕДИНСТВЕННЫЙ обработчик формы тренера (убраны дубликаты!)
document.getElementById('trainerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const uid = document.getElementById('trainerId').value;
    const isEditing = !!uid;
    
    const trainerData = {
        name: document.getElementById('tName').value.trim(),
        email: document.getElementById('tEmail').value.trim().toLowerCase(),
        phone: document.getElementById('tPhone').value.trim(),
        specialization: document.getElementById('tSpecialization').value,
        experience: document.getElementById('tExperience').value.trim(),
        description: document.getElementById('tDescription').value.trim(),
        education: document.getElementById('tEducation').value.trim(),
        photoUrl: document.getElementById('tPhotoUrl').value.trim(),
        instagram: document.getElementById('tInstagram').value.trim(),
        isActive: document.getElementById('tActive').checked,
        canCreatePrograms: document.getElementById('tCanCreatePrograms').checked,
        canViewClients: document.getElementById('tCanViewClients').checked,
        role: 'trainer',
        updatedAt: serverTimestamp()
    };
    
    try {
        if (isEditing) {
            // РЕДАКТИРОВАНИЕ
            await updateDoc(doc(db, 'users', uid), trainerData);
            
            Swal.fire({
                icon: 'success',
                title: 'Тренер обновлён!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // СОЗДАНИЕ НОВОГО
            const password = document.getElementById('tPassword').value;
            
            if (!password || password.length < 6) {
                Swal.fire('Ошибка', 'Пароль должен быть минимум 6 символов', 'error');
                return;
            }
            
            // 🔥 Проверка: существует ли уже такой email?
            const existingUser = await checkIfEmailExists(trainerData.email);
            
            if (existingUser) {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Email уже используется',
                    html: `
                        <p>Пользователь с email <strong>${escapeHtml(trainerData.email)}</strong> уже существует.</p>
                        <p style="margin-top: 10px; color: #7f8c8d; font-size: 13px;">
                            Имя: ${escapeHtml(existingUser.name || 'Не указано')}<br>
                            Роль: ${getRoleLabel(existingUser.role)}
                        </p>
                        <p style="margin-top: 15px; font-weight: 600;">Что вы хотите сделать?</p>
                    `,
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: '<i class="fas fa-exchange-alt"></i> Сделать тренером',
                    denyButtonText: '<i class="fas fa-user-plus"></i> Создать нового',
                    cancelButtonText: 'Отмена',
                    confirmButtonColor: '#6198FF',
                    denyButtonColor: '#43e97b'
                });
                
                if (result.isConfirmed) {
                    await updateDoc(doc(db, 'users', existingUser.uid), {
                        role: 'trainer',
                        specialization: trainerData.specialization,
                        experience: trainerData.experience,
                        description: trainerData.description,
                        education: trainerData.education,
                        photoUrl: trainerData.photoUrl,
                        instagram: trainerData.instagram,
                        isActive: trainerData.isActive,
                        canCreatePrograms: trainerData.canCreatePrograms,
                        canViewClients: trainerData.canViewClients,
                        trainerId: 'trainer_' + Date.now(),
                        clientsCount: 0,
                        programsCount: 0,
                        updatedAt: serverTimestamp()
                    });
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Готово!',
                        html: `<p>Пользователь <strong>${escapeHtml(existingUser.name)}</strong> теперь тренер</p>`,
                        timer: 2500,
                        showConfirmButton: false
                    });
                    
                } else if (result.isDenied) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Введите другой email',
                        text: 'Пожалуйста, измените email в форме и попробуйте снова',
                        confirmButtonColor: '#6198FF'
                    });
                    return;
                } else {
                    return;
                }
                
            } else {
                // Email свободен — создаём нового тренера
                isCreatingUser = true;
                
                try {
                    const userCredential = await createUserWithEmailAndPassword(
                        adminAuth, 
                        trainerData.email, 
                        password
                    );
                    
                    const newUid = userCredential.user.uid;
                    const trainerId = 'trainer_' + Date.now();
                    
                    await setDoc(doc(db, 'users', newUid), {
                        ...trainerData,
                        uid: newUid,
                        trainerId: trainerId,
                        createdAt: serverTimestamp(),
                        clientsCount: 0,
                        programsCount: 0
                    });
                    
                    await signOut(adminAuth);
                    
                } finally {
                    isCreatingUser = false;
                }
                
                Swal.fire({
                    icon: 'success',
                    title: 'Тренер создан!',
                    html: `
                        <p>Тренер <strong>${escapeHtml(trainerData.name)}</strong> успешно создан</p>
                        <p style="margin-top: 10px; font-size: 13px; color: #7f8c8d;">
                            Email: ${escapeHtml(trainerData.email)}<br>
                            ID: ${trainerId}
                        </p>
                    `,
                    timer: 3500,
                    showConfirmButton: false
                });
            }
        }
        
        window.closeTrainerModal();
        loadTrainersTable();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        isCreatingUser = false;
        
        let errorMsg = 'Не удалось сохранить тренера';
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'Этот email уже используется';
        } else if (error.code === 'auth/weak-password') {
            errorMsg = 'Слишком слабый пароль (мин. 6 символов)';
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = 'Некорректный email';
        }
        
        Swal.fire('Ошибка', errorMsg, 'error');
    }
});

// 🔥 Вспомогательная функция: проверка существования email
async function checkIfEmailExists(email) {
    try {
        const q = query(
            collection(db, 'users'),
            where('email', '==', email.toLowerCase())
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            return { uid: userDoc.id, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Ошибка проверки email:', error);
        return null;
    }
}

// Вспомогательная функция: название роли
function getRoleLabel(role) {
    const labels = {
        admin: '👑 Администратор',
        trainer: '🏋️ Тренер',
        client: '👤 Клиент'
    };
    return labels[role] || role;
}

window.deleteTrainer = async function(uid, name) {
    const result = await Swal.fire({
        title: 'Удалить тренера?',
        html: `
            <p>Тренер <strong>${escapeHtml(name)}</strong> будет удалён.</p>
            <p style="color: #e74c3c; font-size: 13px; margin-top: 10px;">
                ⚠️ Все его программы останутся, но будут без автора
            </p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        await deleteDoc(doc(db, 'users', uid));
        
        Swal.fire({
            icon: 'success',
            title: 'Тренер удалён',
            timer: 2000,
            showConfirmButton: false
        });
        
        loadTrainersTable();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось удалить тренера', 'error');
    }
};

// ============================================
// 🔹 СПЕЦИАЛИСТЫ
// ============================================
async function loadSpecialistsTable() {
    const tbody = document.getElementById('specialistsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'specialists'));
        const specialists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!specialists.length) { 
            tbody.innerHTML = '<tr><td colspan="6">Нет специалистов</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = specialists.map(spec => `
            <tr>
                <td><img src="${escapeHtml(spec.photoUrl || '')}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'"></td>
                <td><strong>${escapeHtml(spec.name || 'Без имени')}</strong></td>
                <td>${escapeHtml((spec.position || '').substring(0, 40))}${(spec.position || '').length > 40 ? '...' : ''}</td>
                <td>${escapeHtml(spec.experience || '-')}</td>
                <td><span class="badge ${spec.isActive !== false ? 'badge-success' : 'badge-danger'}">${spec.isActive !== false ? 'Показан' : 'Скрыт'}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="window.editSpecialist('${spec.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" onclick="window.deleteSpecialist('${spec.id}', '${escapeHtml(spec.name || 'специалиста')}')"><i class="fas fa-trash"></i></button>
                        <button class="btn-icon btn-toggle ${spec.isActive !== false ? 'active' : ''}" onclick="window.toggleSpecialist('${spec.id}', ${spec.isActive !== false})"><i class="fas fa-${spec.isActive !== false ? 'eye' : 'eye-slash'}"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`;
    }
}

window.openSpecialistModal = function(specialistId = null) {
    const modal = document.getElementById('specialistModal');
    const title = document.getElementById('specialistModalTitle');
    const form = document.getElementById('specialistForm');
    if (!modal || !title || !form) return;
    
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
    if (modal) { 
        modal.classList.remove('active'); 
        document.body.style.overflow = ''; 
    }
};

window.loadSpecialistData = async function(id) {
    try {
        const snap = await getDoc(doc(db, 'specialists', id));
        if (snap.exists()) { 
            const d = snap.data();
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
    } catch (e) { 
        console.error(e); 
        Swal.fire('Ошибка', 'Не удалось загрузить', 'error'); 
    }
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
        else { 
            data.createdAt = serverTimestamp(); 
            await addDoc(collection(db, 'specialists'), data); 
        }
        localStorage.setItem('specialistsUpdated', Date.now());
        Swal.fire('✅ Успешно!', id ? 'Обновлён' : 'Добавлен', 'success');
        window.closeSpecialistModal();
        loadSpecialistsTable();
    } catch (err) { 
        console.error(err); 
        Swal.fire('❌ Ошибка', 'Не удалось', 'error'); 
    }
});

window.editSpecialist = function(id) { window.openSpecialistModal(id); };

window.deleteSpecialist = async function(id, name) {
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
        } catch(e) { 
            Swal.fire('Ошибка', 'Не удалось', 'error'); 
        }
    }
};

window.toggleSpecialist = async function(id, state) {
    try {
        await updateDoc(doc(db, 'specialists', id), { 
            isActive: !state, 
            updatedAt: serverTimestamp() 
        });
        localStorage.setItem('specialistsUpdated', Date.now());
        Swal.fire({ 
            icon: 'success', 
            title: state ? 'Скрыт' : 'Показан', 
            timer: 1500, 
            showConfirmButton: false 
        });
        loadSpecialistsTable();
    } catch(e) { 
        Swal.fire('Ошибка', 'Не удалось', 'error'); 
    }
};

// ============================================
// 🔹 ОТЗЫВЫ
// ============================================
async function loadReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'reviews'));
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!reviews.length) { 
            tbody.innerHTML = '<tr><td colspan="5">Нет отзывов</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = reviews.map(review => {
            const userName = review.userName || 'Аноним';
            const rating = '⭐'.repeat(review.rating || 5);
            const date = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
            
            return `
                <tr>
                    <td><strong>${escapeHtml(userName)}</strong></td>
                    <td>${rating}</td>
                    <td>${escapeHtml((review.text || '').substring(0, 50))}...</td>
                    <td>${date}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-delete" onclick="window.deleteReview('${review.id}', '${escapeHtml(userName)}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки отзывов:', error);
        tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${error.message}</td></tr>`;
    }
}

window.deleteReview = async function(reviewId, userName) {
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

// ============================================
// 🔹 НАСТРОЙКИ
// ============================================
async function loadSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            
            const siteNameEl = document.getElementById('siteName');
            const supportEmailEl = document.getElementById('supportEmail');
            const maxUsersEl = document.getElementById('maxUsers');
            const maintenanceModeEl = document.getElementById('maintenanceMode');
            
            if (siteNameEl) siteNameEl.value = settings.siteName || '';
            if (supportEmailEl) supportEmailEl.value = settings.supportEmail || '';
            if (maxUsersEl) maxUsersEl.value = settings.maxUsers || 100;
            if (maintenanceModeEl) maintenanceModeEl.checked = settings.maintenanceMode || false;
            
            console.log('✅ Настройки загружены');
        } else {
            console.log('ℹ️ Настройки не найдены, создаём по умолчанию');
            await setDoc(doc(db, 'settings', 'general'), {
                siteName: 'StretchWell',
                supportEmail: 'support@stretchwell.ru',
                maxUsers: 100,
                maintenanceMode: false,
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error);
    }
}

// ============================================
// 🔹 СООБЩЕНИЯ С КОНТАКТНОЙ ФОРМЫ
// ============================================
async function loadContactMessages() {
    const tbody = document.getElementById('contactMessagesTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
    
    try {
        const q = query(
            collection(db, 'contactMessages'),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (!messages.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Нет сообщений</td></tr>';
            return;
        }
        
        const subjectLabels = {
            general: 'Общий вопрос',
            registration: 'Регистрация',
            programs: 'Программы',
            technical: 'Техподдержка',
            other: 'Другое'
        };
        
        tbody.innerHTML = messages.map(m => {
            const date = m.createdAt?.toDate 
                ? m.createdAt.toDate().toLocaleString('ru-RU') 
                : '—';
            
            return `
                <tr class="${m.read ? '' : 'unread-row'}">
                    <td><strong>${escapeHtml(m.name)}</strong></td>
                    <td><a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></td>
                    <td>${escapeHtml(m.phone || '—')}</td>
                    <td><span class="badge badge-info">${subjectLabels[m.subject] || m.subject}</span></td>
                    <td style="max-width:250px;">${escapeHtml((m.message || '').substring(0, 80))}${(m.message || '').length > 80 ? '...' : ''}</td>
                    <td>${date}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-icon btn-edit" onclick="window.viewContactMessage('${m.id}')" title="Просмотр">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="window.deleteContactMessage('${m.id}')" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        tbody.innerHTML = `<tr><td colspan="7">Ошибка: ${error.message}</td></tr>`;
    }
}

window.viewContactMessage = async function(messageId) {
    try {
        const docSnap = await getDoc(doc(db, 'contactMessages', messageId));
        if (!docSnap.exists()) {
            Swal.fire('Ошибка', 'Сообщение не найдено', 'error');
            return;
        }
        
        const m = docSnap.data();
        const date = m.createdAt?.toDate 
            ? m.createdAt.toDate().toLocaleString('ru-RU') 
            : '—';
        
        // Отмечаем как прочитанное
        if (!m.read) {
            await updateDoc(doc(db, 'contactMessages', messageId), { read: true });
        }
        
        Swal.fire({
            title: `<strong>${escapeHtml(m.subject)}</strong>`,
            html: `
                <div style="text-align:left;">
                    <p><strong>От:</strong> ${escapeHtml(m.name)} (${escapeHtml(m.email)})</p>
                    <p><strong>Телефон:</strong> ${escapeHtml(m.phone || '—')}</p>
                    <p><strong>Дата:</strong> ${date}</p>
                    <hr style="margin: 15px 0;">
                    <p style="white-space: pre-wrap;">${escapeHtml(m.message)}</p>
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Закрыть',
            confirmButtonColor: '#6198FF'
        });
        
        loadContactMessages();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось загрузить сообщение', 'error');
    }
};

window.deleteContactMessage = async function(messageId) {
    const result = await Swal.fire({
        title: 'Удалить сообщение?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена'
    });
    
    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'contactMessages', messageId));
            Swal.fire('Удалено!', '', 'success');
            loadContactMessages();
        } catch (error) {
            Swal.fire('Ошибка', 'Не удалось удалить', 'error');
        }
    }
};

// Добавьте в switchSection:
// case 'contactMessages': loadContactMessages(); break;

// ============================================
// 🔹 ВЫХОД
// ============================================
window.logout = function() { 
    signOut(auth).then(() => window.location.href = 'login.html').catch(e => console.error('Выход:', e)); 
};

// Загружаем настройки при инициализации
loadSettings();

console.log('🚀 Админ-панель загружена');