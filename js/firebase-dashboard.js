// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    doc, getDoc, updateDoc,
    collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// === ПРОВЕРКА АВТОРИЗАЦИИ ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('✅ Пользователь авторизован:', user.email);
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('📋 Данные пользователя:', userData);
                
                updateUI(userData, user);
                await loadActiveProgram(userData, user);
            } else {
                console.error('❌ Документ пользователя не найден!');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        }
    } else {
        console.log('❌ Пользователь не авторизован');
        window.location.href = 'login.html';
    }
});

// === ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ===
function updateUI(userData, user) {
    const name = userData.name || user.displayName || user.email?.split('@')[0] || 'Пользователь';
    
    if (document.getElementById('topUserName')) {
        document.getElementById('topUserName').textContent = name;
    }
    if (document.getElementById('welcomeName')) {
        document.getElementById('welcomeName').textContent = `С возвращением, ${name.split(' ')[0]}! 👋`;
    }
    if (document.getElementById('profileName')) {
        document.getElementById('profileName').textContent = name;
    }
    if (document.getElementById('profileEmail')) {
        document.getElementById('profileEmail').textContent = user.email || userData.email || '';
    }
    if (document.getElementById('profilePhone')) {
        document.getElementById('profilePhone').textContent = userData.phone || 'Не указан';
    }
    if (document.getElementById('profileRegDate') && userData.createdAt) {
        const date = new Date(userData.createdAt);
        document.getElementById('profileRegDate').textContent = date.toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    if (document.getElementById('userAvatar')) {
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
    
    // Статистика
    if (userData.stats) {
        if (document.getElementById('statLessons')) {
            document.getElementById('statLessons').textContent = userData.stats.lessons || 0;
        }
        if (document.getElementById('statFlexibility')) {
            document.getElementById('statFlexibility').textContent = (userData.stats.flexibility || 0) + '%';
        }
        if (document.getElementById('statMinutes')) {
            document.getElementById('statMinutes').textContent = userData.stats.minutes || 0;
        }
        if (document.getElementById('statStreak')) {
            document.getElementById('statStreak').textContent = userData.stats.streak || 0;
        }
    }
}

// === ЗАГРУЗКА АКТИВНОЙ ПРОГРАММЫ ===
async function loadActiveProgram(userData, user) {
    console.log('🔄 Загрузка активной программы...');
    
    const enrolledPrograms = userData.enrolledPrograms || [];
    console.log('📋 Записанные программы:', enrolledPrograms);
    
    // Скрываем загрузку
    const loadingEl = document.getElementById('programLoading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    if (enrolledPrograms.length === 0) {
        console.log('⚠️ Нет записанных программ');
        renderNoProgram();
        return;
    }
    
    const activeProgram = enrolledPrograms.find(p => p.status === 'active');
    
    if (!activeProgram) {
        console.log('⚠️ Нет активных программ');
        renderNoProgram();
        return;
    }
    
    console.log('✅ Найдена активная программа:', activeProgram);
    
    try {
        // Ищем программу по полю slug
        const q = query(
            collection(db, 'programs'),
            where('slug', '==', activeProgram.slug)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const program = snapshot.docs[0].data();
            console.log('✅ Программа загружена:', program);
            renderActiveProgram(program, activeProgram);
        } else {
            console.error('❌ Программа не найдена по slug:', activeProgram.slug);
            renderActiveProgramBasic(activeProgram);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        renderNoProgram();
    }
}

// === РЕНДЕР АКТИВНОЙ ПРОГРАММЫ (заполняет HTML по ID) ===
function renderActiveProgram(program, enrollment) {
    // Скрываем загрузку и заглушку, показываем шаблон
    const loadingEl = document.getElementById('programLoading');
    const noProgramEl = document.getElementById('noProgramTemplate');
    const templateEl = document.querySelector('.program-card-template');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (noProgramEl) noProgramEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'block';
    
    // Заполняем данные
    const img = document.getElementById('activeProgramImage');
    if (img && program.image) {
        img.src = program.image;
        img.alt = program.title;
        img.onerror = function() {
            this.src = `https://via.placeholder.com/400x250/6198FF/FFFFFF?text=${encodeURIComponent(program.title)}`;
        };
    }
    
    const level = document.getElementById('activeProgramLevel');
    if (level) level.textContent = getLevelLabel(program.level);
    
    const title = document.getElementById('activeProgramTitle');
    if (title) title.textContent = program.title;
    
    const desc = document.getElementById('activeProgramDesc');
    if (desc) desc.textContent = program.shortDescription || program.fullDescription || '';
    
    const progress = enrollment.progress || 0;
    const completedLessons = enrollment.completedLessons || Math.round((progress / 100) * (program.videosCount || 0));
    const totalLessons = program.videosCount || 0;
    
    const progressValue = document.getElementById('activeProgramProgress');
    const progressFill = document.getElementById('activeProgramFill');
    const completedEl = document.getElementById('activeCompletedLessons');
    const totalEl = document.getElementById('activeTotalLessons');
    const timeEl = document.getElementById('activeTimePerDay');
    
    if (progressValue) progressValue.textContent = progress + '%';
    if (progressFill) progressFill.style.width = progress + '%';
    if (completedEl) completedEl.textContent = completedLessons;
    if (totalEl) totalEl.textContent = totalLessons;
    if (timeEl) timeEl.textContent = program.timePerDay || '';
    
    // Кнопка "Продолжить"
    const btnContinue = document.getElementById('btnContinue');
    if (btnContinue) {
        btnContinue.onclick = function() { continueProgram(program.slug); };
    }
    
    console.log('✅ Программа отрисована в HTML');
}

// === РЕНДЕР ПРОГРАММЫ (базовая, если не нашли в базе) ===
function renderActiveProgramBasic(enrollment) {
    // Скрываем загрузку и шаблон, показываем заглушку с данными
    const loadingEl = document.getElementById('programLoading');
    const templateEl = document.querySelector('.program-card-template');
    const noProgramEl = document.getElementById('noProgramTemplate');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'none';
    if (noProgramEl) {
        noProgramEl.style.display = 'block';
        // Заполняем базовые данные в заглушку
        const titleEl = noProgramEl.querySelector('.program-name');
        const descEl = noProgramEl.querySelector('.program-desc');
        if (titleEl) titleEl.textContent = enrollment.title;
        if (descEl) descEl.textContent = 'Программа загружена';
    }
    
    console.log('✅ Показана базовая информация о программе');
}

// === ЗАГЛУШКА (нет программы) ===
function renderNoProgram() {
    // Скрываем загрузку и шаблон, показываем заглушку
    const loadingEl = document.getElementById('programLoading');
    const templateEl = document.querySelector('.program-card-template');
    const noProgramEl = document.getElementById('noProgramTemplate');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'none';
    if (noProgramEl) noProgramEl.style.display = 'block';
    
    console.log('✅ Показана заглушка "нет программы"');
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function getLevelLabel(level) {
    const labels = {
        beginner: 'Новичок',
        intermediate: 'Средний',
        advanced: 'Продвинутый'
    };
    return labels[level] || 'Средний';
}

// === ПРОДОЛЖИТЬ ТРЕНИРОВКУ ===
window.continueProgram = function(slug) {
    console.log('▶️ Продолжить программу:', slug);
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Продолжить тренировку?',
            text: 'Вы готовы к следующему уроку?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6198FF',
            cancelButtonColor: '#999',
            confirmButtonText: 'Да, начать!',
            cancelButtonText: 'Позже'
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    icon: 'success',
                    title: 'Удачи!',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    }
}

// === СМЕНИТЬ ПРОГРАММУ ===
window.changeProgram = async function() {
    try {
        // Загружаем все активные программы
        const q = query(
            collection(db, 'programs'),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (programs.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Нет доступных программ',
                text: 'В каталоге пока нет программ',
                confirmButtonColor: '#6198FF'
            });
            return;
        }
        
        // Создаём список программ для выбора
        const programsList = programs.map(p => `
            <div class="program-option" onclick="selectNewProgram('${p.slug}', '${p.title}')" style="
                padding: 15px;
                margin: 10px 0;
                border: 2px solid #e1e8ed;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
            " onmouseover="this.style.borderColor='#6198FF'; this.style.background='#f0f7ff'" 
               onmouseout="this.style.borderColor='#e1e8ed'; this.style.background='white'">
                <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${p.title}</h4>
                <p style="margin: 0; color: #7f8c8d; font-size: 14px;">${p.shortDescription || ''}</p>
                <div style="margin-top: 8px; font-size: 12px; color: #6198FF;">
                    <i class="fas fa-clock"></i> ${p.timePerDay || ''} | 
                    <i class="fas fa-video"></i> ${p.videosCount || 0} уроков
                </div>
            </div>
        `).join('');
        
        // Показываем модальное окно выбора
        await Swal.fire({
            title: 'Выберите новую программу',
            html: `
                <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                    ${programsList}
                </div>
            `,
            width: '600px',
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Закрыть',
            customClass: {
                container: 'program-selection-modal'
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        Swal.fire('Ошибка', 'Не удалось загрузить программы', 'error');
    }
}

// === ВЫБОР НОВОЙ ПРОГРАММЫ ===
window.selectNewProgram = async function(slug, title) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        // Получаем текущие программы
        let enrolledPrograms = userData.enrolledPrograms || [];
        
        // Помечаем все программы как завершённые
        enrolledPrograms = enrolledPrograms.map(p => ({
            ...p,
            status: p.status === 'active' ? 'completed' : p.status
        }));
        
        // Проверяем не записан ли уже на эту программу
        const alreadyEnrolled = enrolledPrograms.find(p => p.slug === slug);
        
        if (alreadyEnrolled) {
            // Активируем существующую
            enrolledPrograms = enrolledPrograms.map(p => ({
                ...p,
                status: p.slug === slug ? 'active' : p.status
            }));
        } else {
            // Добавляем новую
            enrolledPrograms.push({
                slug: slug,
                title: title,
                enrolledAt: new Date().toISOString(),
                progress: 0,
                status: 'active',
                completedLessons: 0,
                lastAccessedAt: null
            });
        }
        
        // Обновляем пользователя
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms
        });
        
        Swal.fire({
            icon: 'success',
            title: 'Программа изменена!',
            text: `Теперь вы занимаетесь по программе "${title}"`,
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Перезагружаем страницу чтобы обновить отображение
            window.location.reload();
        });
        
    } catch (error) {
        console.error('❌ Ошибка смены программы:', error);
        Swal.fire('Ошибка', 'Не удалось сменить программу', 'error');
    }
}

// === ВЫХОД ===
window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
};

console.log('🚀 Dashboard загружен');