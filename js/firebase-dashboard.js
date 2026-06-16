// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    doc, getDoc, updateDoc,
    collection, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные
let currentUser = null;
let currentProgramData = null;

// === ПРОВЕРКА АВТОРИЗАЦИИ ===
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('✅ Пользователь авторизован:', user.email);
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('📋 Данные пользователя:', userData);
                
                updateUI(userData, user);
                await loadActiveProgram(userData, user);
                setupProfileForm();
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
    
    // Имя в шапке
    if (document.getElementById('topUserName')) {
        document.getElementById('topUserName').textContent = name;
    }
    
    // Приветствие
    if (document.getElementById('welcomeName')) {
        document.getElementById('welcomeName').textContent = `Здравствуйте, ${name.split(' ')[0]}! 👋`;
    }
    
    // Имя в профиле
    if (document.getElementById('profileName')) {
        document.getElementById('profileName').textContent = name;
    }
    
    // Email
    if (document.getElementById('profileEmail')) {
        document.getElementById('profileEmail').textContent = user.email || userData.email || '';
    }
    
    // Телефон
    if (document.getElementById('profilePhone')) {
        document.getElementById('profilePhone').textContent = userData.phone || 'Не указан';
    }
    
    // Дата регистрации
    if (document.getElementById('profileRegDate') && userData.createdAt) {
        const date = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        document.getElementById('profileRegDate').textContent = date.toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    
    // Цель
    if (document.getElementById('profileGoal')) {
        const goalLabels = {
            flexibility: 'Развитие гибкости',
            strength: 'Укрепление мышц',
            relax: 'Снятие напряжения',
            recovery: 'Восстановление',
            health: 'Общее оздоровление'
        };
        document.getElementById('profileGoal').textContent = goalLabels[userData.goal] || 'Не указана';
    }
    
    // Уровень подготовки
    if (document.getElementById('profileExperience')) {
        const expLabels = {
            beginner: 'Новичок',
            intermediate: 'Средний',
            advanced: 'Продвинутый'
        };
        document.getElementById('profileExperience').textContent = expLabels[userData.experience] || 'Не указан';
    }
    
    // Аватар
    if (document.getElementById('userAvatar')) {
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
    
    // ✅ СТАТИСТИКА ИЗ FIREBASE
    if (userData.stats) {
        if (document.getElementById('statLessons')) {
            document.getElementById('statLessons').textContent = userData.stats.totalLessons || 0;
        }
        if (document.getElementById('statFlexibility')) {
            document.getElementById('statFlexibility').textContent = (userData.stats.progress || 0) + '%';
        }
        if (document.getElementById('statMinutes')) {
            document.getElementById('statMinutes').textContent = userData.stats.totalMinutes || 0;
        }
        if (document.getElementById('statStreak')) {
            document.getElementById('statStreak').textContent = userData.stats.streak || 0;
        }
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('userStats', JSON.stringify(userData.stats || {}));
}

// === ЗАГРУЗКА АКТИВНОЙ ПРОГРАММЫ ===
async function loadActiveProgram(userData, user) {
    console.log('🔄 Загрузка активной программы...');
    
    const enrolledPrograms = userData.enrolledPrograms || [];
    console.log('📋 Записанные программы:', enrolledPrograms);
    
    const loadingEl = document.getElementById('programLoading');
    const templateEl = document.querySelector('.program-card-template');
    const noProgramEl = document.getElementById('noProgramTemplate');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'none';
    if (noProgramEl) noProgramEl.style.display = 'none';
    
    if (enrolledPrograms.length === 0) {
        console.log('⚠️ Нет записанных программ');
        if (noProgramEl) noProgramEl.style.display = 'block';
        return;
    }
    
    const activeEnrollment = enrolledPrograms.find(p => p.status === 'active');
    
    if (!activeEnrollment) {
        console.log('⚠️ Нет активных программ');
        if (noProgramEl) noProgramEl.style.display = 'block';
        return;
    }
    
    console.log('✅ Найдена активная программа:', activeEnrollment);
    
    try {
        const q = query(
            collection(db, 'programs'),
            where('slug', '==', activeEnrollment.slug)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const programDoc = snapshot.docs[0];
            const program = programDoc.data();
            console.log('✅ Программа загружена:', program);
            
            currentProgramData = {
                id: programDoc.id,
                slug: program.slug,
                title: program.title,
                lessons: program.lessons || [],
                videosCount: program.videosCount || 0
            };
            
            renderActiveProgram(program, activeEnrollment);
        } else {
            console.error('❌ Программа не найдена по slug:', activeEnrollment.slug);
            currentProgramData = {
                slug: activeEnrollment.slug,
                title: activeEnrollment.title,
                lessons: [],
                videosCount: 0
            };
            renderActiveProgramBasic(activeEnrollment);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        if (noProgramEl) noProgramEl.style.display = 'block';
    }
}

// === РЕНДЕР АКТИВНОЙ ПРОГРАММЫ ===
function renderActiveProgram(program, enrollment) {
    const loadingEl = document.getElementById('programLoading');
    const noProgramEl = document.getElementById('noProgramTemplate');
    const templateEl = document.querySelector('.program-card-template');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (noProgramEl) noProgramEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'block';
    
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
    const completedLessons = enrollment.completedLessons?.length || 0;
    const totalLessons = program.videosCount || program.lessons?.length || 0;
    
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
    
    updateDashboardStatsForProgram(enrollment, program);
    
    const btnContinue = document.getElementById('btnContinue');
    if (btnContinue) {
        btnContinue.onclick = function() { openLessonsPage(); };
    }
    
    console.log('✅ Программа отрисована, прогресс:', progress + '%');
}

// === ОБНОВЛЕНИЕ СТАТИСТИКИ ===
function updateDashboardStatsForProgram(enrollment, program) {
    const programProgress = enrollment.progress || 0;
    
    const progressEl = document.getElementById('statFlexibility');
    if (progressEl) {
        progressEl.textContent = programProgress + '%';
    }
    
    const lessonsEl = document.getElementById('statLessons');
    if (lessonsEl) {
        lessonsEl.textContent = enrollment.completedLessons?.length || 0;
    }
    
    console.log('📊 Статистика обновлена:', program.title, '| Прогресс:', programProgress + '%');
}

// === РЕНДЕР ЗАГЛУШКИ ===
function renderActiveProgramBasic(enrollment) {
    const loadingEl = document.getElementById('programLoading');
    const templateEl = document.querySelector('.program-card-template');
    const noProgramEl = document.getElementById('noProgramTemplate');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (templateEl) templateEl.style.display = 'none';
    if (noProgramEl) {
        noProgramEl.style.display = 'block';
        const titleEl = noProgramEl.querySelector('.program-name');
        const descEl = noProgramEl.querySelector('.program-desc');
        if (titleEl) titleEl.textContent = enrollment.title;
        if (descEl) descEl.textContent = 'Программа загружена';
    }
    
    console.log('✅ Показана базовая информация');
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

// === ОТКРЫТЬ СТРАНИЦУ УРОКОВ ===
window.openLessonsPage = function() {
    const programSlug = currentProgramData?.slug;
    
    if (!programSlug) {
        Swal.fire('Ошибка', 'Активная программа не найдена', 'error');
        return;
    }
    
    window.location.href = `lessons.html?slug=${encodeURIComponent(programSlug)}`;
}

// === СМЕНИТЬ ПРОГРАММУ ===
window.changeProgram = async function() {
    console.log('🔄 Кнопка "Сменить программу" нажата');
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            console.error('❌ Документ пользователя не найден');
            return;
        }
        
        const userData = userDoc.data();
        let enrolledPrograms = userData.enrolledPrograms || [];
        
        console.log('📋 Всего программ:', enrolledPrograms.length);
        
        if (enrolledPrograms.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'У вас нет программ',
                text: 'Выберите программу из каталога',
                confirmButtonText: 'Перейти в каталог',
                confirmButtonColor: '#6198FF'
            }).then(() => {
                window.location.href = 'my_programs.html';
            });
            return;
        }
        
        showAllProgramsModal(enrolledPrograms);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось загрузить программы', 'error');
    }
}

// === ПОКАЗАТЬ ВСЕ ПРОГРАММЫ ===
function showAllProgramsModal(enrolledPrograms) {
    const activeProgram = enrolledPrograms.find(p => p.status === 'active');
    
    const programsList = enrolledPrograms.map(p => {
        const isActive = p.slug === activeProgram?.slug;
        
        return `
            <div style="
                padding: 15px;
                margin: 10px 0;
                border: 2px solid ${isActive ? '#6198FF' : '#e1e8ed'};
                border-radius: 8px;
                background: ${isActive ? '#f0f7ff' : 'white'};
                position: relative;
            ">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1; cursor: pointer;" onclick="switchToProgram('${p.slug}')">
                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${p.title}</h4>
                        <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                            Прогресс: ${p.progress || 0}% • 
                            ${p.completedLessons?.length || 0} уроков
                        </p>
                        ${isActive ? 
                            '<span style="color: #6198FF; font-size: 12px; margin-top: 5px; display: block;"><i class="fas fa-check-circle"></i> Активная</span>' : 
                            '<span style="color: #95a5a6; font-size: 12px; margin-top: 5px; display: block;"><i class="fas fa-pause-circle"></i> Приостановлена</span>'
                        }
                    </div>
                    
                    ${!isActive ? `
                        <button onclick="deleteProgram('${p.slug}', '${p.title}')" style="
                            background: #fee;
                            border: none;
                            color: #e74c3c;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 13px;
                            margin-left: 10px;
                        " title="Удалить программу">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
                
                ${isActive ? `
                    <button onclick="switchToProgram('${p.slug}')" style="
                        margin-top: 10px;
                        width: 100%;
                        padding: 10px;
                        background: #6198FF;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fas fa-play"></i> Продолжить
                    </button>
                ` : `
                    <button onclick="switchToProgram('${p.slug}')" style="
                        margin-top: 10px;
                        width: 100%;
                        padding: 10px;
                        background: white;
                        color: #6198FF;
                        border: 2px solid #6198FF;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fas fa-exchange-alt"></i> Сделать активной
                    </button>
                `}
            </div>
        `;
    }).join('');
    
    Swal.fire({
        title: '<i class="fas fa-list"></i> Мои программы',
        html: `
            <div style="text-align: left; max-height: 500px; overflow-y: auto;">
                ${programsList}
            </div>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e1e8ed; text-align: center;">
                <a href="my_programs.html" style="color: #6198FF; text-decoration: none; font-weight: 600;">
                    <i class="fas fa-plus-circle"></i> Записаться на новую программу
                </a>
            </div>
        `,
        width: '650px',
        showConfirmButton: false,
        showCloseButton: true
    });
}

// === УДАЛЕНИЕ ПРОГРАММЫ ===
window.deleteProgram = function(slug, title) {
    Swal.fire({
        title: 'Удалить программу?',
        html: `
            <p>Вы уверены что хотите удалить программу</p>
            <p style="color: #6198FF; font-weight: 600;">"${title}"</p>
            <p style="color: #e74c3c; font-size: 14px; margin-top: 10px;">
                ⚠️ Весь прогресс будет потерян
            </p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await confirmDeleteProgram(slug);
        }
    });
}

// Подтверждение удаления
async function confirmDeleteProgram(slug) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = (userData.enrolledPrograms || []).filter(p => p.slug !== slug);
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Программа удалена:', slug);
        
        Swal.fire({
            icon: 'success',
            title: 'Программа удалена',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.reload();
        });
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        Swal.fire('Ошибка', 'Не удалось удалить программу', 'error');
    }
}

// === ПЕРЕКЛЮЧЕНИЕ ПРОГРАММЫ ===
window.switchToProgram = async function(slug) {
    console.log('🔄 Переключение на программу:', slug);
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = userData.enrolledPrograms?.map(p => ({
            ...p,
            status: p.slug === slug ? 'active' : 'paused'
        })) || [];
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Программа переключена');
        
        Swal.close();
        
        Swal.fire({
            icon: 'success',
            title: 'Программа изменена!',
            text: 'Загрузка новой программы...',
            timer: 1500,
            showConfirmButton: false,
            allowOutsideClick: false
        }).then(() => {
            window.location.reload();
        });
        
    } catch (error) {
        console.error('❌ Ошибка переключения:', error);
        Swal.fire('Ошибка', 'Не удалось сменить программу', 'error');
    }
}

// === РЕДАКТИРОВАНИЕ ПРОФИЛЯ ===
window.editProfile = function() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    // Заполняем форму текущими данными
    const name = document.getElementById('profileName')?.textContent || '';
    const phone = document.getElementById('profilePhone')?.textContent || '';
    const goal = document.getElementById('profileGoal')?.textContent || '';
    
    document.getElementById('editName').value = name;
    document.getElementById('editPhone').value = phone;
    
    // Преобразуем текст цели в value
    const goalValues = {
        'Развитие гибкости': 'flexibility',
        'Укрепление мышц': 'strength',
        'Снятие напряжения': 'relax',
        'Восстановление': 'recovery',
        'Общее оздоровление': 'health'
    };
    document.getElementById('editGoal').value = goalValues[goal] || 'flexibility';
    
    modal.classList.add('active');
}

// === ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ===
window.closeModal = function() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// === СОХРАНЕНИЕ ПРОФИЛЯ ===
function setupProfileForm() {
    const form = document.getElementById('editProfileForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('editName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const goal = document.getElementById('editGoal').value;
        
        if (!currentUser) {
            Swal.fire('Ошибка', 'Необходимо войти в систему', 'error');
            return;
        }
        
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                name: name,
                phone: phone,
                goal: goal,
                updatedAt: serverTimestamp()
            });
            
            // Обновляем отображение
            document.getElementById('profileName').textContent = name;
            document.getElementById('topUserName').textContent = name;
            document.getElementById('welcomeName').textContent = `С возвращением, ${name.split(' ')[0]}! 👋`;
            
            // Обновляем цель в профиле
            const goalLabels = {
                flexibility: 'Развитие гибкости',
                strength: 'Укрепление мышц',
                relax: 'Снятие напряжения',
                recovery: 'Восстановление',
                health: 'Общее оздоровление'
            };
            document.getElementById('profileGoal').textContent = goalLabels[goal] || goal;
            
            closeModal();
            
            Swal.fire('✅ Успешно!', 'Профиль обновлён', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            Swal.fire('Ошибка', 'Не удалось сохранить изменения', 'error');
        }
    });
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

// Закрытие модального окна по клику вне его
document.addEventListener('click', function(e) {
    const modal = document.getElementById('editProfileModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

// 🔥 Загрузка количества непрочитанных сообщений
async function loadUnreadMessagesCount() {
    // 🔥 ПРОВЕРКА: пользователь авторизован?
    if (!currentUser || !currentUser.uid) {
        console.log('⏳ Пользователь ещё не авторизован, ждём...');
        return;
    }
    
    try {
        const q = query(
            collection(db, 'messages'),
            where('to', '==', currentUser.uid),
            where('fromRole', '==', 'trainer'),
            where('read', '==', false)
        );
        
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        
        const countEl = document.getElementById('msgCount');
        if (countEl) {
            countEl.textContent = count;
            countEl.style.display = count > 0 ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки сообщений:', error);
    }
}

// Вызовите эту функцию после загрузки данных
loadUnreadMessagesCount();

console.log('🚀 Dashboard загружен');