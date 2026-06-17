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
    
    window.currentProgramSlug = programSlug;
    
    try {
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
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        updateUserInfo(userData);
        updateProgramUI(userData);
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
    document.getElementById('programTitle').textContent = currentProgram.title;
    document.getElementById('programName').textContent = currentProgram.title;
    document.getElementById('programDesc').textContent = currentProgram.shortDescription || '';
    
    const lessons = currentProgram.lessons || [];
    document.getElementById('totalLessons').textContent = lessons.length;
    
    const totalMinutes = lessons.reduce((sum, lesson) => {
        return sum + (parseDuration(lesson.duration) || 0);
    }, 0);
    document.getElementById('totalDuration').textContent = totalMinutes;
    
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
    
    allLessons = lessons;
    window.programLessons = lessons;
    
    if (lessons.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">Уроки ещё не добавлены</p>';
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === currentProgram.slug);
        const completedLessons = enrolledProgram?.completedLessons || [];
        
        const progress = Math.round((completedLessons.length / lessons.length) * 100);
        document.getElementById('progressPercent').textContent = progress + '%';
        
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
    
    titleEl.textContent = lessonData.title || `Урок ${lessonIndex + 1}`;
    durationEl.textContent = lessonData.duration || '15 мин';
    
    const videoUrl = lessonData.videoUrl || '';
    
    if (videoUrl.includes('drive.google.com')) {
        const fileId = extractGoogleDriveFileId(videoUrl);
        if (fileId) {
            playerEl.src = `https://drive.google.com/file/d/${fileId}/preview`;
        } else {
            playerEl.src = '';
            Swal.fire('Ошибка', 'Не удалось получить ID видео', 'error');
            return;
        }
    } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        const videoId = extractYouTubeId(videoUrl);
        if (videoId) {
            playerEl.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else {
            playerEl.src = '';
        }
    } else if (videoUrl) {
        playerEl.src = videoUrl;
    } else {
        playerEl.src = '';
    }
    
    checkLessonCompletion(lessonIndex, completeBtn);
    updateNavigationButtons();
    
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
    if (playerEl) playerEl.src = '';
    
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
        
        const playerEl = document.getElementById('videoPlayer');
        if (playerEl) playerEl.src = '';
        
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
        const nextIndex = currentLessonIndex + 1;
        if (nextIndex >= allLessons.length) {
            nextBtn.disabled = true;
        } else {
            checkNextLessonUnlocked(nextIndex, nextBtn);
        }
    }
}

async function checkNextLessonUnlocked(nextIndex, button) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledProgram = userData.enrolledPrograms?.find(p => p.slug === window.currentProgramSlug);
        const completedLessons = enrolledProgram?.completedLessons || [];
        
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
// 🔹 ЗАВЕРШЕНИЕ УРОКА (РАБОЧАЯ ВЕРСИЯ)
// ============================================
window.completeLesson = async function() {
    console.log('🎯 Завершение урока...');
    console.log('📋 currentLessonIndex:', currentLessonIndex);
    console.log('📋 currentProgramSlug:', window.currentProgramSlug);
    
    if (!currentUser) {
        Swal.fire('Ошибка', 'Вы не авторизованы', 'error');
        return;
    }
    
    if (!window.currentProgramSlug) {
        Swal.fire('Ошибка', 'Программа не выбрана', 'error');
        return;
    }
    
    if (allLessons.length === 0) {
        Swal.fire('Ошибка', 'Нет уроков в программе', 'error');
        return;
    }
    
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
        
        if (!userDoc.exists()) {
            Swal.fire('Ошибка', 'Пользователь не найден', 'error');
            return;
        }
        
        const userData = userDoc.data();
        let enrolledPrograms = userData.enrolledPrograms || [];
        
        let programIndex = enrolledPrograms.findIndex(p => p.slug === window.currentProgramSlug);
        
        if (programIndex === -1) {
            const newEnrollment = {
                slug: window.currentProgramSlug,
                title: currentProgram.title || 'Программа',
                trainerId: currentProgram.trainerId || null,
                trainerName: currentProgram.trainerName || null,
                enrolledAt: new Date().toISOString(),
                progress: 0,
                status: 'active',
                completedLessons: [],
                lastAccessedAt: new Date().toISOString()
            };
            
            enrolledPrograms.push(newEnrollment);
            programIndex = enrolledPrograms.length - 1;
        }
        
        const currentEnrollment = enrolledPrograms[programIndex];
        let completedLessons = currentEnrollment.completedLessons || [];
        
        if (!completedLessons.includes(currentLessonIndex)) {
            completedLessons.push(currentLessonIndex);
            completedLessons.sort((a, b) => a - b);
        }
        
        const totalLessons = allLessons.length || 1;
        const newProgress = Math.round((completedLessons.length / totalLessons) * 100);
        
        enrolledPrograms[programIndex] = {
            ...currentEnrollment,
            completedLessons: completedLessons,
            progress: newProgress,
            lastAccessedAt: new Date().toISOString(),
            status: currentEnrollment.status || 'active'
        };
        
        const currentLesson = allLessons[currentLessonIndex];
        const lessonDuration = parseDuration(currentLesson.duration) || 20;
        
        const stats = userData.stats || {
            totalLessons: 0,
            totalMinutes: 0,
            progress: 0,
            streak: 0
        };
        
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
            } else {
                newStreak = 1;
            }
        }
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            'stats.totalLessons': (stats.totalLessons || 0) + 1,
            'stats.totalMinutes': (stats.totalMinutes || 0) + lessonDuration,
            'stats.streak': newStreak,
            'stats.lastWorkoutDate': new Date(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Прогресс сохранён');
        
        await renderLessons();
        
        const completeBtn = document.getElementById('completeLessonBtn');
        if (completeBtn) {
            completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Урок завершён';
            completeBtn.classList.add('completed');
            completeBtn.disabled = true;
        }
        
        const isProgramComplete = completedLessons.length === totalLessons;
        
        if (isProgramComplete) {
            Swal.fire({
                icon: 'success',
                title: '🏆 Программа полностью пройдена!',
                html: `
                    <p style="font-size: 18px; color: #43e97b; font-weight: 600;">
                        Поздравляем! Вы прошли все ${totalLessons} уроков!
                    </p>
                `,
                confirmButtonText: 'Отлично!',
                confirmButtonColor: '#43e97b'
            });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Урок завершён! 🎉',
                html: `
                    <p>Прогресс программы обновлён</p>
                    <p style="margin-top: 10px; color: #6198FF; font-size: 18px; font-weight: 600;">
                        <i class="fas fa-chart-line"></i> ${newProgress}% пройдено
                    </p>
                    <p style="margin-top: 5px; font-size: 14px; color: #7f8c8d;">
                        <i class="fas fa-check-circle"></i> ${completedLessons.length} из ${totalLessons} уроков<br>
                        <i class="fas fa-fire"></i> Серия: ${newStreak} дн.
                    </p>
                `,
                timer: 3500,
                showConfirmButton: false
            });
        }
        
        updateNavigationButtons();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось сохранить прогресс: ' + error.message, 'error');
    }
};

// ============================================
// 🔹 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function parseDuration(durationStr) {
    if (!durationStr) return 20;
    const match = durationStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 20;
}

function calculateTotalProgress(enrolledPrograms) {
    if (!enrolledPrograms || enrolledPrograms.length === 0) return 0;
    
    const activePrograms = enrolledPrograms.filter(p => p.status === 'active');
    if (activePrograms.length === 0) return 0;
    
    const totalProgress = activePrograms.reduce((sum, p) => sum + (p.progress || 0), 0);
    return Math.round(totalProgress / activePrograms.length);
}

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
// 🔹 ОБРАБОТЧИКИ СОБЫТИЙ
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

document.addEventListener('click', (e) => {
    const modal = document.getElementById('videoModal');
    if (e.target === modal || e.target.classList.contains('video-modal-overlay')) {
        closeVideoModal();
    }
});

// Привязка кнопки "Завершить урок" (дублирующая для надёжности)
document.addEventListener('DOMContentLoaded', () => {
    const completeBtn = document.getElementById('completeLessonBtn');
    if (completeBtn) {
        // Проверяем что onclick уже есть в HTML
        if (!completeBtn.getAttribute('onclick')) {
            completeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof window.completeLesson === 'function') {
                    window.completeLesson();
                }
            });
        }
        console.log('✅ Кнопка "Завершить урок" готова');
    }
});

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