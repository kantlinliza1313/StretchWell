// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    getDocs,
    updateDoc, 
    serverTimestamp,
    collection,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ============================================
// 🔹 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let currentUser = null;
let currentProgram = null;
let currentLessonIndex = 0;
let allLessons = [];

// Делаем доступными для HTML
window.currentProgramSlug = null;
window.programLessons = [];

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadProgram();
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ЗАГРУЗКА ПРОГРАММЫ
// ============================================
async function loadProgram() {
    const urlParams = new URLSearchParams(window.location.search);
    const programSlug = urlParams.get('slug');
    
    if (!programSlug) {
        Swal.fire('Ошибка', 'Программа не указана', 'error');
        return;
    }
    
    // Сохраняем slug глобально
    window.currentProgramSlug = programSlug;
    
    try {
        // Загружаем программу из Firebase
        const q = query(
            collection(db, 'programs'), 
            where('slug', '==', programSlug)
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            Swal.fire('Ошибка', 'Программа не найдена', 'error');
            return;
        }
        
        currentProgram = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        
        // Загружаем данные пользователя для прогресса
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        // Обновляем информацию о пользователе в шапке
        updateUserInfo(userData);
        
        // Обновляем UI программы
        updateProgramUI(userData);
        
        // Рендерим уроки
        await renderLessons();
        
        console.log('✅ Программа загружена:', currentProgram.title);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        document.getElementById('lessonsGrid').innerHTML = 
            '<p style="text-align: center; color: #e74c3c;">Ошибка загрузки программы</p>';
    }
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ UI ПРОГРАММЫ
// ============================================
function updateProgramUI(userData) {
    // Основная информация
    document.getElementById('programTitle').textContent = currentProgram.title;
    document.getElementById('programName').textContent = currentProgram.title;
    document.getElementById('programDesc').textContent = currentProgram.shortDescription || '';
    
    const lessons = currentProgram.lessons || [];
    document.getElementById('totalLessons').textContent = lessons.length;
    
    // Общая длительность
    const totalMinutes = lessons.reduce((sum, lesson) => {
        return sum + (parseDuration(lesson.duration) || 0);
    }, 0);
    document.getElementById('totalDuration').textContent = totalMinutes;
    
    // Прогресс
    const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === currentProgram.slug);
    const completedLessons = enrolledProgram?.completedLessons || [];
    const progress = lessons.length > 0 
        ? Math.round((completedLessons.length / lessons.length) * 100) 
        : 0;
    
    document.getElementById('progressPercent').textContent = progress + '%';
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ
// ============================================
function updateUserInfo(userData) {
    const name = userData.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Пользователь';
    
    const userNameEls = document.querySelectorAll('.user-name');
    userNameEls.forEach(el => el.textContent = name);
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

// ============================================
// 🔹 РЕНДЕР УРОКОВ
// ============================================
async function renderLessons() {
    const grid = document.getElementById('lessonsGrid');
    const lessons = currentProgram.lessons || [];
    
    // Сохраняем глобально для навигации
    allLessons = lessons;
    window.programLessons = lessons;
    
    if (lessons.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">Уроки ещё не добавлены</p>';
        return;
    }
    
    try {
        // Получаем прогресс пользователя
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === currentProgram.slug);
        const completedLessons = enrolledProgram?.completedLessons || [];
        
        // Обновляем прогресс в UI
        const progress = Math.round((completedLessons.length / lessons.length) * 100);
        document.getElementById('progressPercent').textContent = progress + '%';
        
        // Создаём карточки уроков
        grid.innerHTML = lessons.map((lesson, index) => {
            return renderLessonCard(lesson, index, completedLessons);
        }).join('');
        
        console.log('✅ Уроки отображены:', lessons.length);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки прогресса:', error);
        grid.innerHTML = '<p style="text-align: center; color: #e74c3c;">Ошибка загрузки уроков</p>';
    }
}

// ============================================
// 🔹 СОЗДАНИЕ КАРТОЧКИ УРОКА
// ============================================
function renderLessonCard(lesson, index, completedLessons) {
    const isCompleted = completedLessons.includes(index);
    const isLocked = index > 0 && !completedLessons.includes(index - 1) && completedLessons.length > 0 && !completedLessons.includes(index);
    const isFirstLesson = index === 0;
    
    // Определяем статус
    let statusClass = '';
    let statusBadge = '';
    
    if (isCompleted) {
        statusClass = 'completed';
        statusBadge = '<span class="status-badge completed"><i class="fas fa-check"></i> Выполнен</span>';
    } else if (isLocked) {
        statusClass = 'locked';
        statusBadge = '<span class="status-badge locked"><i class="fas fa-lock"></i> Заблокирован</span>';
    } else {
        statusClass = 'current';
        statusBadge = '<span class="status-badge current"><i class="fas fa-play"></i> Доступен</span>';
    }
    
    const duration = lesson.duration || '15 мин';
    const title = lesson.title || `День ${lesson.day || (index + 1)}`;
    const dayNumber = lesson.day || (index + 1);
    
    // Экранируем данные для onclick
    const lessonData = encodeURIComponent(JSON.stringify({
        title: title,
        duration: duration,
        videoUrl: lesson.videoUrl || '',
        index: index
    }));
    
    return `
        <div class="lesson-card ${statusClass}">
            <div class="lesson-number">
                ${isCompleted ? '<i class="fas fa-check"></i>' : dayNumber}
            </div>
            
            <div class="lesson-info">
                <h4>${title}</h4>
                <div class="lesson-meta">
                    <span><i class="fas fa-clock"></i> ${duration}</span>
                    ${statusBadge}
                </div>
            </div>
            
            <div class="lesson-actions">
                ${isLocked ? `
                    <button class="btn-watch" disabled>
                        <i class="fas fa-lock"></i> Заблокирован
                    </button>
                ` : `
                    <button class="btn-watch" onclick="openVideoFromCard('${lessonData}')">
                        <i class="fas fa-play"></i> ${isCompleted ? 'Повторить' : 'Смотреть'}
                    </button>
                `}
            </div>
        </div>
    `;
}

// ============================================
// 🔹 ОТКРЫТИЕ ВИДЕО ИЗ КАРТОЧКИ
// ============================================
window.openVideoFromCard = function(encodedData) {
    try {
        const lessonData = JSON.parse(decodeURIComponent(encodedData));
        openVideo(lessonData.index, lessonData);
    } catch (error) {
        console.error('❌ Ошибка открытия видео:', error);
        Swal.fire('Ошибка', 'Не удалось открыть видео', 'error');
    }
}

// ============================================
// 🔹 ОТКРЫТИЕ ВИДЕО В МОДАЛЬНОМ ОКНЕ
// ============================================
window.openVideo = function(lessonIndex, lessonData) {
    currentLessonIndex = lessonIndex;
    
    const modal = document.getElementById('videoModal');
    if (!modal) {
        console.error('❌ Модальное окно не найдено');
        return;
    }
    
    const titleEl = document.getElementById('modalLessonTitle');
    const durationEl = document.getElementById('modalLessonDuration');
    const playerEl = document.getElementById('videoPlayer');
    const completeBtn = document.getElementById('completeLessonBtn');
    
    // Устанавливаем данные урока
    titleEl.textContent = lessonData.title || `Урок ${lessonIndex + 1}`;
    durationEl.textContent = lessonData.duration || '15 мин';
    
    // Загружаем видео
    const videoUrl = lessonData.videoUrl || '';
    
    if (videoUrl.includes('drive.google.com')) {
        // Google Drive
        const fileId = extractGoogleDriveFileId(videoUrl);
        if (fileId) {
            playerEl.src = `https://drive.google.com/file/d/${fileId}/preview`;
        } else {
            playerEl.src = '';
            Swal.fire('Ошибка', 'Не удалось получить ID видео', 'error');
            return;
        }
    } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        // YouTube
        const videoId = extractYouTubeId(videoUrl);
        if (videoId) {
            playerEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else {
            playerEl.src = '';
        }
    } else if (videoUrl) {
        // Прямая ссылка
        playerEl.src = videoUrl;
    } else {
        playerEl.src = '';
    }
    
    // Проверяем, завершён ли урок
    checkLessonCompletion(lessonIndex, completeBtn);
    
    // Обновляем кнопки навигации
    updateNavigationButtons();
    
    // Показываем модальное окно
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    console.log('▶️ Открыто видео:', lessonData.title);
}

// ============================================
// 🔹 ПРОВЕРКА ЗАВЕРШЕНИЯ УРОКА
// ============================================
async function checkLessonCompletion(lessonIndex, button) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === window.currentProgramSlug);
        const completedLessons = enrolledProgram?.completedLessons || [];
        
        if (completedLessons.includes(lessonIndex)) {
            button.innerHTML = '<i class="fas fa-check-circle"></i> Урок завершён';
            button.classList.add('completed');
            button.disabled = true;
        } else {
            button.innerHTML = '<i class="fas fa-check"></i> Завершить урок';
            button.classList.remove('completed');
            button.disabled = false;
        }
    } catch (error) {
        console.error('Ошибка проверки:', error);
    }
}

// ============================================
// 🔹 ЗАКРЫТИЕ ВИДЕО
// ============================================
window.closeVideoModal = function() {
    const modal = document.getElementById('videoModal');
    const playerEl = document.getElementById('videoPlayer');
    
    if (modal) modal.classList.remove('active');
    if (playerEl) playerEl.src = ''; // Останавливаем видео
    
    document.body.style.overflow = '';
    
    console.log('✖️ Видео закрыто');
}

// ============================================
// 🔹 НАВИГАЦИЯ ПО УРОКАМ
// ============================================
window.navigateLesson = function(direction) {
    const newIndex = currentLessonIndex + direction;
    
    if (newIndex >= 0 && newIndex < allLessons.length) {
        const lesson = allLessons[newIndex];
        
        // Закрываем текущее видео
        const playerEl = document.getElementById('videoPlayer');
        if (playerEl) playerEl.src = '';
        
        // Открываем новое видео
        setTimeout(() => {
            openVideo(newIndex, {
                title: lesson.title || `День ${lesson.day || (newIndex + 1)}`,
                duration: lesson.duration || '15 мин',
                videoUrl: lesson.videoUrl || '',
                index: newIndex
            });
        }, 200);
    }
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ КНОПОК НАВИГАЦИИ
// ============================================
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevLessonBtn');
    const nextBtn = document.getElementById('nextLessonBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentLessonIndex === 0;
    }
    
    if (nextBtn) {
        // Проверяем, разблокирован ли следующий урок
        const nextIndex = currentLessonIndex + 1;
        if (nextIndex >= allLessons.length) {
            nextBtn.disabled = true;
        } else {
            // Следующий урок разблокирован если текущий завершён
            checkNextLessonUnlocked(nextIndex, nextBtn);
        }
    }
}

// Проверка разблокировки следующего урока
async function checkNextLessonUnlocked(nextIndex, button) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === window.currentProgramSlug);
        const completedLessons = enrolledProgram?.completedLessons || [];
        
        // Следующий урок разблокирован если предыдущий завершён
        const isUnlocked = nextIndex === 0 || completedLessons.includes(nextIndex - 1);
        button.disabled = !isUnlocked;
        
        if (!isUnlocked) {
            button.innerHTML = '<span>Следующий урок</span> <i class="fas fa-lock"></i>';
        } else {
            button.innerHTML = '<span>Следующий урок</span> <i class="fas fa-chevron-right"></i>';
        }
    } catch (error) {
        console.error('Ошибка проверки:', error);
        button.disabled = true;
    }
}

// ============================================
// 🔹 ЗАВЕРШЕНИЕ УРОКА
// ============================================
window.completeLesson = async function() {
    const result = await Swal.fire({
        title: 'Завершить урок?',
        text: 'Прогресс будет сохранён',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#43e97b',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'Да, завершить',
        cancelButtonText: 'Отмена'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const currentLesson = allLessons[currentLessonIndex];
        const lessonDuration = parseDuration(currentLesson.duration) || 20;
        
        // ✅ ОБНОВЛЯЕМ ПРОГРЕСС КОНКРЕТНОЙ ПРОГРАММЫ
        const enrolledPrograms = userData.enrolledPrograms?.map(p => {
            if (p.slug === window.currentProgramSlug && p.status === 'active') {
                let completedLessons = p.completedLessons || [];
                if (!completedLessons.includes(currentLessonIndex)) {
                    completedLessons.push(currentLessonIndex);
                }
                
                const totalLessons = allLessons.length || 1;
                const newProgress = Math.round((completedLessons.length / totalLessons) * 100);
                
                return {
                    ...p,
                    completedLessons: completedLessons,
                    progress: newProgress,
                    lastAccessedAt: new Date().toISOString()
                };
            }
            return p;
        }) || [];
        
        // Общая статистика
        const stats = userData.stats || {};
        let lastWorkout = null;
        
        if (stats.lastWorkoutDate) {
            if (stats.lastWorkoutDate.toDate) {
                lastWorkout = stats.lastWorkoutDate.toDate().toISOString().split('T')[0];
            } else if (typeof stats.lastWorkoutDate === 'string') {
                lastWorkout = stats.lastWorkoutDate.split('T')[0];
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        let newStreak = stats.streak || 0;
        
        if (lastWorkout !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastWorkout === yesterdayStr) {
                newStreak += 1;
            } else if (lastWorkout !== today) {
                newStreak = 1;
            }
        }
        
        // Лог активности
        const activityLog = userData.activityLog || [];
        const todayActivity = activityLog.find(log => {
            let logDate = null;
            if (log.date?.toDate) {
                logDate = log.date.toDate().toISOString().split('T')[0];
            } else if (typeof log.date === 'string') {
                logDate = log.date.split('T')[0];
            }
            return logDate === today;
        });
        
        if (todayActivity) {
            todayActivity.lessonsCompleted = (todayActivity.lessonsCompleted || 0) + 1;
            todayActivity.minutesWatched = (todayActivity.minutesWatched || 0) + lessonDuration;
        } else {
            activityLog.push({
                date: new Date(),
                lessonsCompleted: 1,
                minutesWatched: lessonDuration
            });
        }
        
        // Общий прогресс
        const totalProgress = calculateTotalProgress(enrolledPrograms);
        
        // Обновляем пользователя
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            stats: {
                totalLessons: (stats.totalLessons || 0) + 1,
                totalMinutes: (stats.totalMinutes || 0) + lessonDuration,
                progress: totalProgress,
                streak: newStreak,
                lastWorkoutDate: new Date()
            },
            activityLog: activityLog,
            updatedAt: serverTimestamp()
        });
        
        // Обновляем UI
        await renderLessons();
        
        // Обновляем кнопку в модальном окне
        const completeBtn = document.getElementById('completeLessonBtn');
        if (completeBtn) {
            completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Урок завершён';
            completeBtn.classList.add('completed');
            completeBtn.disabled = true;
        }
        
        // Показываем успех
        const updatedEnrollment = enrolledPrograms.find(p => p.slug === window.currentProgramSlug);
        Swal.fire({
            icon: 'success',
            title: 'Урок завершён! 🎉',
            html: `
                <p>Прогресс программы обновлён</p>
                <p style="margin-top: 10px; color: #6198FF; font-size: 18px;">
                    <i class="fas fa-chart-line"></i> ${updatedEnrollment.progress}% пройдено
                </p>
                <p style="margin-top: 5px; font-size: 14px;">
                    <i class="fas fa-clock"></i> +${lessonDuration} мин<br>
                    <i class="fas fa-fire"></i> Серия: ${newStreak} дн.
                </p>
            `,
            timer: 3500,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось сохранить прогресс', 'error');
    }
}

// ============================================
// 🔹 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Парсинг длительности (например "15 мин" → 15)
function parseDuration(durationStr) {
    if (!durationStr) return 20;
    const match = durationStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 20;
}

// Подсчёт общего прогресса
function calculateTotalProgress(enrolledPrograms) {
    if (!enrolledPrograms || enrolledPrograms.length === 0) return 0;
    
    const activePrograms = enrolledPrograms.filter(p => p.status === 'active');
    if (activePrograms.length === 0) return 0;
    
    const totalProgress = activePrograms.reduce((sum, p) => sum + (p.progress || 0), 0);
    return Math.round(totalProgress / activePrograms.length);
}

// Извлечение ID файла из Google Drive
function extractGoogleDriveFileId(url) {
    if (!url) return '';
    
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)\/view/,
        /\/file\/d\/([a-zA-Z0-9_-]+)\//,
        /id=([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{20,})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return '';
}

// Извлечение ID видео из YouTube
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
        /youtube\.com\/embed\/([^&\s]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return '';
}

// ============================================
// 🔹 ОБРАБОТЧИКИ КЛАВИАТУРЫ
// ============================================
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('videoModal');
    const isModalOpen = modal && modal.classList.contains('active');
    
    if (e.key === 'Escape' && isModalOpen) {
        closeVideoModal();
    } else if (e.key === 'ArrowLeft' && isModalOpen) {
        navigateLesson(-1);
    } else if (e.key === 'ArrowRight' && isModalOpen) {
        navigateLesson(1);
    }
});

// Закрытие модального окна по клику на overlay
document.addEventListener('click', (e) => {
    const modal = document.getElementById('videoModal');
    if (e.target === modal || e.target.classList.contains('video-modal-overlay')) {
        closeVideoModal();
    }
});

// Функция выхода (для бокового меню)
window.logout = function() {
    import('./firebase-config.js').then(({ auth }) => {
        import("https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js").then(({ signOut }) => {
            signOut(auth).then(() => {
                localStorage.removeItem('user');
                sessionStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        });
    });
};

console.log('📚 Lessons.js загружен');