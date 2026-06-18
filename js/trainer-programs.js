// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, 
    doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let currentUser = null;
let trainerData = null;
let currentLessons = [];

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
            
            // 🔥 ПРОВЕРКА: это точно тренер?
            if (trainerData.role !== 'trainer') {
                console.warn('⚠️ Это не тренер! Роль:', trainerData.role);
                
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
            
            // Загружаем программы
            await loadProgramsTable();
            
            // Если в URL ?action=new — открываем модалку
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('action') === 'new') {
                setTimeout(() => window.openProgramModal(), 300);
            }
            
            console.log('✅ Тренер авторизован:', trainerData.name);
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
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
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================
// 🔹 ПРОГРАММЫ (ТОЛЬКО СВОИ!)
// ============================================
async function loadProgramsTable() {
    const tbody = document.getElementById('programsTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
    
    try {
        // 🔥 ВАЖНО: загружаем ТОЛЬКО программы этого тренера
        const q = query(
            collection(db, 'programs'),
            where('trainerId', '==', trainerData.trainerId)
        );
        const snapshot = await getDocs(q);
        const programs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log('📋 Моих программ:', programs.length);
        
        if (!programs.length) { 
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <i class="fas fa-dumbbell" style="font-size: 48px; color: #e1e8ed; margin-bottom: 15px;"></i>
                        <h4 style="color: #2c3e50; margin-bottom: 10px;">У вас пока нет программ</h4>
                        <p style="color: #7f8c8d; margin-bottom: 20px;">Создайте свою первую программу тренировок</p>
                        <button class="btn btn-primary" onclick="window.openProgramModal()">
                            <i class="fas fa-plus"></i> Создать программу
                        </button>
                    </td>
                </tr>
            `; 
            return; 
        }
        
        const lvl = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый' };
        const goal = { flexibility: 'Гибкость', strength: 'Сила', relax: 'Расслабление', recovery: 'Восстановление' };
        
        tbody.innerHTML = programs.map(p => `
            <tr>
                <td><strong>${escapeHtml(p.title)}</strong></td>
                <td>${lvl[p.level]||p.level}</td>
                <td>${goal[p.goal]||p.goal}</td>
                <td>${p.videosCount||0}</td>
                <td>${p.clientsCount||0}</td>
                <td><span class="badge ${p.isActive!==false?'badge-success':'badge-danger'}">${p.isActive!==false?'Активна':'Скрыта'}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="window.editProgram('${p.id}')" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="window.deleteProgram('${p.id}','${escapeHtml(p.title)}')" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-icon btn-toggle ${p.isActive!==false?'active':''}" 
                                onclick="window.toggleProgram('${p.id}',${p.isActive!==false})"
                                title="${p.isActive!==false?'Скрыть':'Показать'}">
                            <i class="fas fa-${p.isActive!==false?'eye':'eye-slash'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (e) { 
        console.error('❌ Программы:', e); 
        tbody.innerHTML = '<tr><td colspan="7">Ошибка: ' + e.message + '</td></tr>'; 
    }
}

// ============================================
// 🔹 МОДАЛЬНОЕ ОКНО ПРОГРАММЫ
// ============================================
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
        title.textContent = 'Создать программу'; 
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
            
            // 🔥 ПРОВЕРКА: программа принадлежит этому тренеру?
            if (d.trainerId !== trainerData.trainerId) {
                Swal.fire('Ошибка', 'Это не ваша программа', 'error');
                window.closeProgramModal();
                return;
            }
            
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

// ============================================
// 🔹 СОХРАНЕНИЕ ПРОГРАММЫ
// ============================================
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
        updatedAt: serverTimestamp(),
        
        // 🔥 ВАЖНО: привязка к тренеру
        trainerId: trainerData.trainerId,
        trainerUid: currentUser.uid,
        trainerName: trainerData.name
    };
    
    try {
        if (id) {
            // РЕДАКТИРОВАНИЕ — проверяем что программа наша
            const existingDoc = await getDoc(doc(db, 'programs', id));
            if (existingDoc.exists() && existingDoc.data().trainerId !== trainerData.trainerId) {
                Swal.fire('Ошибка', 'Вы не можете редактировать чужую программу', 'error');
                return;
            }
            
            await updateDoc(doc(db, 'programs', id), data);
            Swal.fire('✅ Успешно!', 'Программа обновлена', 'success');
        } else {
            // СОЗДАНИЕ НОВОЙ
            data.createdAt = serverTimestamp();
            data.clientsCount = 0;
            await addDoc(collection(db, 'programs'), data);
            Swal.fire('✅ Успешно!', 'Программа создана', 'success');
        }
        
        localStorage.setItem('programsUpdated', Date.now());
        window.closeProgramModal(); 
        loadProgramsTable();
        
    } catch (err) { 
        console.error(err); 
        Swal.fire('❌ Ошибка', 'Не удалось: '+err.message, 'error'); 
    }
});

// ============================================
// 🔹 ДЕЙСТВИЯ С ПРОГРАММАМИ
// ============================================
window.editProgram = function(id) { 
    window.openProgramModal(id); 
};

window.deleteProgram = async function(id, title) {
    // 🔥 ПРОВЕРКА: программа принадлежит этому тренеру?
    try {
        const docSnap = await getDoc(doc(db, 'programs', id));
        if (docSnap.exists() && docSnap.data().trainerId !== trainerData.trainerId) {
            Swal.fire('Ошибка', 'Вы не можете удалить чужую программу', 'error');
            return;
        }
    } catch (e) {
        console.error(e);
    }
    
    const r = await Swal.fire({ 
        title: 'Удалить?', 
        text: `Удалить "${title}"?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#e74c3c', 
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена'
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
    // 🔥 ПРОВЕРКА: программа принадлежит этому тренеру?
    try {
        const docSnap = await getDoc(doc(db, 'programs', id));
        if (docSnap.exists() && docSnap.data().trainerId !== trainerData.trainerId) {
            Swal.fire('Ошибка', 'Вы не можете изменять чужую программу', 'error');
            return;
        }
    } catch (e) {
        console.error(e);
    }
    
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

// Автоматическая генерация slug из названия
document.getElementById('pTitle')?.addEventListener('input', function() {
    const slugField = document.getElementById('pSlug');
    if (slugField && !slugField.dataset.manual) {
        // Простая транслитерация
        const translit = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
            'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
            'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
            'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
            'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
            'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
            'э': 'e', 'ю': 'yu', 'я': 'ya', ' ': '-'
        };
        
        let slug = this.value.toLowerCase()
            .split('')
            .map(char => translit[char] || char)
            .join('')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        slugField.value = slug;
    }
});

// Если пользователь редактирует slug вручную — отключаем автогенерацию
document.getElementById('pSlug')?.addEventListener('input', function() {
    this.dataset.manual = 'true';
});

// ============================================
// 🔹 ВЫХОД
// ============================================
window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
};

// ============================================
// 🔹 МОБИЛЬНОЕ МЕНЮ
// ============================================
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

console.log('🏋️ Trainer Programs загружен');