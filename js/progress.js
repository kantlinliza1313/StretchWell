// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные для графиков
window.activityChart = null;
window.flexibilityChart = null;
window.workoutTypesChart = null;
window.timeChart = null;

// Глобальные переменные
let currentUser = null;
let userData = null;

// Проверка авторизации
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadProgressData();
    } else {
        window.location.href = 'login.html';
    }
});

// Загрузка данных прогресса
async function loadProgressData() {
    try {
        console.log('📊 Загрузка данных прогресса...');
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Документ пользователя не найден');
            return;
        }
        
        userData = userDoc.data();
        console.log('✅ Данные прогресса загружены:', userData);
        
        // Обновляем UI
        updateStatsSummary();
        updateCharts();
        updateAchievements();
        updateRecentResults();
        updateUserInfo();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки прогресса:', error);
    }
}

// Обновление общей статистики
function updateStatsSummary() {
    const stats = userData.stats || {};
    
    // ✅ ИСПОЛЬЗУЕМ ID вместо nth-child
    const elements = {
        lessons: document.getElementById('statTotalLessons'),
        progress: document.getElementById('statProgress'),
        minutes: document.getElementById('statTotalMinutes'),
        streak: document.getElementById('statStreak')
    };
    
    if (elements.lessons) elements.lessons.textContent = stats.totalLessons || 0;
    if (elements.progress) elements.progress.textContent = (stats.progress || 0) + '%';
    if (elements.minutes) elements.minutes.textContent = stats.totalMinutes || 0;
    if (elements.streak) elements.streak.textContent = stats.streak || 0;
    
    console.log('📊 Статистика обновлена:', stats);
}

// Обновление графиков
function updateCharts() {
    const activityLog = userData.activityLog || [];
    
    // 📊 График активности по неделям
    const activityCtx = document.getElementById('activityChart');
    if (activityCtx) {
        const weeklyData = aggregateByWeek(activityLog);
        
        if (window.activityChart && typeof window.activityChart.destroy === 'function') {
            window.activityChart.destroy();
        }
        
        window.activityChart = new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: weeklyData.labels,
                datasets: [{
                    label: 'Тренировки',
                    data: weeklyData.lessons,
                    borderColor: '#6198FF',
                    backgroundColor: 'rgba(97, 152, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
    
    // 📈 График прогресса по программам
    const flexibilityCtx = document.getElementById('flexibilityChart');
    if (flexibilityCtx) {
        const enrolledPrograms = userData.enrolledPrograms || [];
        const progressData = enrolledPrograms.map(p => p.progress || 0);
        const labels = enrolledPrograms.map(p => {
            const title = p.title || p.slug || 'Программа';
            return title.length > 15 ? title.substring(0, 15) + '...' : title;
        });
        
        if (window.flexibilityChart && typeof window.flexibilityChart.destroy === 'function') {
            window.flexibilityChart.destroy();
        }
        
        window.flexibilityChart = new Chart(flexibilityCtx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Нет программ'],
                datasets: [{
                    label: 'Прогресс %',
                    data: progressData.length ? progressData : [0],
                    backgroundColor: 'rgba(97, 152, 255, 0.6)',
                    borderColor: '#6198FF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }
    
    // 🥧 График типов тренировок
    const typesCtx = document.getElementById('workoutTypesChart');
    if (typesCtx) {
        // Считаем распределение по целям программ
        const goalCounts = {};
        const enrolledPrograms = userData.enrolledPrograms || [];
        
        enrolledPrograms.forEach(p => {
            // Можно добавить логику если есть goal в программе
            goalCounts['Гибкость'] = (goalCounts['Гибкость'] || 0) + 1;
        });
        
        const labels = Object.keys(goalCounts);
        const data = Object.values(goalCounts);
        const colors = ['#6198FF', '#43e97b', '#f093fb', '#4facfe'];
        
        if (window.workoutTypesChart && typeof window.workoutTypesChart.destroy === 'function') {
            window.workoutTypesChart.destroy();
        }
        
        window.workoutTypesChart = new Chart(typesCtx, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Гибкость', 'Сила', 'Расслабление'],
                datasets: [{
                    data: data.length ? data : [45, 25, 20],
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
    
    // 📊 График времени по дням недели
    const timeCtx = document.getElementById('timeChart');
    if (timeCtx) {
        const dailyData = aggregateByDayOfWeek(activityLog);
        
        if (window.timeChart && typeof window.timeChart.destroy === 'function') {
            window.timeChart.destroy();
        }
        
        window.timeChart = new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Минуты',
                    data: dailyData,
                    backgroundColor: '#6198FF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

// Агрегация данных по неделям
function aggregateByWeek(activityLog) {
    const weeks = {};
    const today = new Date();
    
    // Последние 4 недели
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekKey = weekStart.toISOString().split('T')[0];
        weeks[weekKey] = { lessons: 0, minutes: 0 };
    }
    
    // Считаем активность
    activityLog.forEach(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const logKey = logDate.toISOString().split('T')[0];
        
        // Находим подходящую неделю
        for (const weekKey of Object.keys(weeks)) {
            const weekStart = new Date(weekKey);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            if (logDate >= weekStart && logDate < weekEnd) {
                weeks[weekKey].lessons += log.lessonsCompleted || 0;
                weeks[weekKey].minutes += log.minutesWatched || 0;
                break;
            }
        }
    });
    
    return {
        labels: Object.keys(weeks).map((k, i) => `Неделя ${i + 1}`),
        lessons: Object.values(weeks).map(w => w.lessons),
        minutes: Object.values(weeks).map(w => w.minutes)
    };
}

// Агрегация по дням недели
function aggregateByDayOfWeek(activityLog) {
    const days = [0, 0, 0, 0, 0, 0, 0]; // Пн-Вс
    
    activityLog.forEach(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const dayIndex = (logDate.getDay() + 6) % 7; // 0=Пн, 6=Вс
        days[dayIndex] += log.minutesWatched || 0;
    });
    
    return days;
}

// Обновление достижений
function updateAchievements() {
    const stats = userData.stats || {};
    const achievements = userData.achievements || [];
    
    // Конфигурация достижений
    const achievementConfigs = {
        first_workout: { title: 'Первые шаги', desc: 'Завершите первую тренировку', requirement: () => stats.totalLessons >= 1 },
        streak_5: { title: 'Серия из 5 дней', desc: 'Тренируйтесь 5 дней подряд', requirement: () => stats.streak >= 5 },
        lessons_10: { title: '10 тренировок', desc: 'Завершите 10 тренировок', requirement: () => stats.totalLessons >= 10 },
        strength_master: { title: 'Силач', desc: 'Завершите программу "Сила"', requirement: () => achievements.includes('strength_completed') },
        flex_100: { title: 'Мастер гибкости', desc: 'Достигните 100% прогресса', requirement: () => stats.progress >= 100 },
        streak_30: { title: 'Месяц тренировок', desc: 'Занимайтесь 30 дней подряд', requirement: () => stats.streak >= 30 },
        lessons_50: { title: '50 тренировок', desc: 'Завершите 50 тренировок', requirement: () => stats.totalLessons >= 50 },
        all_programs: { title: 'Профессионал', desc: 'Завершите все программы', requirement: () => achievements.includes('all_completed') }
    };
    
    // Обновляем каждую карточку
    Object.keys(achievementConfigs).forEach(achievementId => {
        const card = document.querySelector(`[data-achievement="${achievementId}"]`);
        if (!card) return;
        
        const config = achievementConfigs[achievementId];
        const isUnlocked = achievements.includes(achievementId) || config.requirement();
        
        if (isUnlocked) {
            card.classList.add('unlocked');
            card.classList.remove('locked');
            
            const lockIcon = card.querySelector('.achievement-lock i');
            if (lockIcon) {
                lockIcon.className = 'fas fa-lock-open';
            }
            
            // Дата получения
            const achievementData = achievements.find(a => typeof a === 'object' && a.id === achievementId);
            const dateEl = card.querySelector('.achievement-date');
            if (achievementData?.date && dateEl) {
                const date = achievementData.date.toDate ? achievementData.date.toDate() : new Date(achievementData.date);
                dateEl.textContent = 'Получено ' + date.toLocaleDateString('ru-RU');
            }
        } else {
            card.classList.add('locked');
            card.classList.remove('unlocked');
            
            const lockIcon = card.querySelector('.achievement-lock i');
            if (lockIcon) {
                lockIcon.className = 'fas fa-lock';
            }
            
            // Обновляем прогресс
            const progressEl = card.querySelector('.achievement-progress');
            if (progressEl) {
                if (achievementId === 'flex_100') {
                    progressEl.textContent = `Прогресс: ${stats.progress}%`;
                } else if (achievementId === 'streak_30') {
                    progressEl.textContent = `Прогресс: ${stats.streak}/30 дней`;
                } else if (achievementId === 'lessons_50') {
                    progressEl.textContent = `Прогресс: ${stats.totalLessons}/50`;
                } else if (achievementId === 'streak_5') {
                    progressEl.textContent = `Прогресс: ${stats.streak}/5`;
                } else if (achievementId === 'lessons_10') {
                    progressEl.textContent = `Прогресс: ${stats.totalLessons}/10`;
                }
            }
        }
    });
}

// Поделиться всеми достижениями
window.shareAllAchievements = function() {
    const stats = userData.stats || {};
    const userName = userData.name || 'Пользователь';
    
    const shareText = `🏆 Мои достижения в StretchWell!\n\n` +
                     `✅ Тренировок завершено: ${stats.totalLessons}\n` +
                     `📊 Общий прогресс: ${stats.progress}%\n` +
                     `⏱️ Минут тренировок: ${stats.totalMinutes}\n` +
                     `🔥 Дней подряд: ${stats.streak}\n\n` +
                     `Присоединяйся ко мне!`;
    
    // Показываем модальное окно
    document.getElementById('shareText').textContent = shareText;
    document.getElementById('shareModal').classList.add('active');
}

// Закрыть модальное окно
window.closeShareModal = function() {
    document.getElementById('shareModal').classList.remove('active');
}

// Поделиться в Telegram
window.shareToTelegram = function() {
    const text = document.getElementById('shareText').textContent;
    const url = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    closeShareModal();
}

// Поделиться в WhatsApp
window.shareToWhatsApp = function() {
    const text = document.getElementById('shareText').textContent;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    closeShareModal();
}

// Поделиться ВКонтакте
window.shareToVK = function() {
    const text = document.getElementById('shareText').textContent;
    const url = `https://vk.com/share.php?comment=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    closeShareModal();
}

// Копировать в буфер обмена
window.copyToClipboard = function() {
    const text = document.getElementById('shareText').textContent;
    navigator.clipboard.writeText(text).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Скопировано!',
            text: 'Текст скопирован в буфер обмена',
            timer: 2000,
            showConfirmButton: false
        });
        closeShareModal();
    }).catch(err => {
        console.error('❌ Ошибка копирования:', err);
        Swal.fire('Ошибка', 'Не удалось скопировать', 'error');
    });
}

// Закрытие по клику вне модального окна
document.getElementById('shareModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeShareModal();
});
// Обновление недавних результатов
function updateRecentResults() {
    const activityLog = userData.activityLog || [];
    const container = document.querySelector('.results-list');
    
    if (!container) return;
    
    // Берём последние 4 записи
    const recent = activityLog.slice(-4).reverse();
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">Пока нет результатов</p>';
        return;
    }
    
    container.innerHTML = recent.map(log => {
        const date = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        
        // Определяем относительную дату
        let relativeDate = dateStr;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            relativeDate = 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            relativeDate = 'Вчера';
        }
        
        return `
            <div class="result-item">
                <div class="result-icon" style="background: linear-gradient(135deg, #6198FF 0%, #8DA4CE 100%);">
                    <i class="fas fa-check"></i>
                </div>
                <div class="result-info">
                    <h5>Тренировка</h5>
                    <p>${log.lessonsCompleted || 1} урок(ов) • ${(log.minutesWatched || 0)} мин</p>
                    <span class="result-date">${relativeDate}, ${timeStr}</span>
                </div>
                <div class="result-stats">
                    <span class="result-stat">
                        <i class="fas fa-fire"></i> ${Math.round((log.minutesWatched || 0) * 5)} ккал
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Обновление информации пользователя в шапке
function updateUserInfo() {
    const name = userData.name || 'Пользователь';
    
    const userNameEls = document.querySelectorAll('.user-name');
    userNameEls.forEach(el => el.textContent = name);
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

console.log('📊 Progress.js загружен');