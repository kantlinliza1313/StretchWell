// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Глобальные переменные для графиков
window.activityChart = null;
window.flexibilityChart = null;
window.workoutTypesChart = null;
window.timeChart = null;

// Глобальные переменные
let currentUser = null;
let userData = null;

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadProgressData();
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ЗАГРУЗКА ДАННЫХ ПРОГРЕССА
// ============================================
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
        
        // 🔥 ПЕРЕСЧИТЫВАЕМ ПРОГРЕСС ВСЕХ ПРОГРАММ
        userData = await recalculateAllProgramsProgress(userData);
        
        // 🔥 ПЕРЕСЧИТЫВАЕМ ОБЩУЮ СТАТИСТИКУ
        userData.stats = recalculateStats(userData);
        
        // 🔥 ПЕРЕСЧИТЫВАЕМ STREAK (серию дней)
        userData.stats.streak = calculateStreak(userData.activityLog || []);
        
        // 🔥 ОБНОВЛЯЕМ В FIRESTORE (если были изменения)
        await saveRecalculatedData(userData);
        
        // Обновляем интерфейс
        updateStatsSummary();
        updateCharts();
        updateAchievements();
        updateRecentResults();
        updateUserInfo();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки прогресса:', error);
    }
}

// ============================================
// 🔥 ПЕРЕСЧЁТ ПРОГРЕССА ВСЕХ ПРОГРАММ
// ============================================
async function recalculateAllProgramsProgress(userData) {
    const enrolledPrograms = userData.enrolledPrograms || [];
    
    if (enrolledPrograms.length === 0) {
        return userData;
    }
    
    console.log('🔄 Пересчёт прогресса программ...');
    
    const updatedPrograms = [];
    let hasChanges = false;
    
    for (const enrollment of enrolledPrograms) {
        if (!enrollment.slug) {
            updatedPrograms.push(enrollment);
            continue;
        }
        
        try {
            // Получаем информацию о программе (из кэша или из Firestore)
            const programInfo = await getProgramInfo(enrollment.slug);
            
            if (!programInfo) {
                updatedPrograms.push(enrollment);
                continue;
            }
            
            const totalLessons = programInfo.videosCount || programInfo.lessons?.length || 0;
            const completedLessons = (enrollment.completedLessons || []).filter(
                idx => typeof idx === 'number' && idx >= 0 && idx < totalLessons
            );
            
            // 🔥 ПРАВИЛЬНЫЙ РАСЧЁТ ПРОГРЕССА
            const realProgress = totalLessons > 0 
                ? Math.round((completedLessons.length / totalLessons) * 100) 
                : 0;
            
            // 🔥 СЧИТАЕМ МИНУТЫ
            let minutesSpent = 0;
            const lessons = programInfo.lessons || [];
            completedLessons.forEach(idx => {
                if (lessons[idx]) {
                    minutesSpent += parseDuration(lessons[idx].duration);
                }
            });
            
            // 🔥 СТАТУС
            let status = enrollment.status || 'paused';
            if (realProgress >= 100) {
                status = 'completed';
            }
            
            // Проверяем, изменилось ли что-то
            if (realProgress !== (enrollment.progress || 0) ||
                completedLessons.length !== (enrollment.completedLessons || []).length ||
                minutesSpent !== (enrollment.minutesSpent || 0)) {
                hasChanges = true;
                console.log(`📊 ${enrollment.slug}: ${enrollment.progress || 0}% → ${realProgress}%`);
            }
            
            updatedPrograms.push({
                ...enrollment,
                progress: realProgress,
                completedLessons: completedLessons,
                completedCount: completedLessons.length,
                totalLessons: totalLessons,
                minutesSpent: minutesSpent,
                status: status,
                goal: enrollment.goal || programInfo.goal || 'flexibility'
            });
            
        } catch (error) {
            console.error('❌ Ошибка пересчёта:', enrollment.slug, error);
            updatedPrograms.push(enrollment);
        }
    }
    
    return {
        ...userData,
        enrolledPrograms: updatedPrograms,
        _hasProgressChanges: hasChanges
    };
}

// 🔥 КЭШ для программ (чтобы не загружать повторно)
const programCache = {};

async function getProgramInfo(slug) {
    if (programCache[slug]) {
        return programCache[slug];
    }
    
    try {
        const { collection, query, where, getDocs } = await import(
            "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js"
        );
        
        const q = query(collection(db, 'programs'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const program = snapshot.docs[0].data();
            programCache[slug] = program;
            return program;
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки программы:', slug, error);
    }
    
    return null;
}

// 🔥 ПАРСИНГ ДЛИТЕЛЬНОСТИ УРОКА
function parseDuration(durationStr) {
    if (!durationStr) return 20;
    if (typeof durationStr === 'number') return durationStr;
    
    const str = String(durationStr).trim();
    
    // Формат "1:30" (часы:минуты)
    const timeMatch = str.match(/(\d+):(\d+)/);
    if (timeMatch) {
        return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
    }
    
    // Формат "20 мин" или "20"
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
        return parseInt(numMatch[1]);
    }
    
    return 20;
}

// ============================================
// 🔥 ПЕРЕСЧЁТ ОБЩЕЙ СТАТИСТИКИ
// ============================================
function recalculateStats(userData) {
    const enrolledPrograms = userData.enrolledPrograms || [];
    const stats = userData.stats || {};
    
    let totalLessons = 0;
    let totalMinutes = 0;
    
    enrolledPrograms.forEach(program => {
        // Считаем только завершённые уроки
        totalLessons += (program.completedLessons || []).length;
        totalMinutes += program.minutesSpent || 0;
    });
    
    // 🔥 Если есть activityLog — используем его для точности
    const activityLog = userData.activityLog || [];
    if (activityLog.length > 0) {
        const logMinutes = activityLog.reduce((sum, log) => sum + (log.minutesWatched || 0), 0);
        const logLessons = activityLog.reduce((sum, log) => sum + (log.lessonsCompleted || 0), 0);
        
        // Используем максимум из двух источников
        totalMinutes = Math.max(totalMinutes, logMinutes);
        totalLessons = Math.max(totalLessons, logLessons);
    }
    
    // 🔥 Общий прогресс
    const overallProgress = calculateOverallProgress(userData);
    
    console.log('📊 Пересчёт статистики:');
    console.log('  Уроков:', totalLessons);
    console.log('  Минут:', totalMinutes);
    console.log('  Прогресс:', overallProgress + '%');
    
    return {
        ...stats,
        totalLessons: totalLessons,
        totalMinutes: totalMinutes,
        progress: overallProgress,
        streak: stats.streak || 0 // Пересчитается отдельно
    };
}

// ============================================
// 🔥 РАСЧЁТ STREAK (СЕРИЯ ДНЕЙ ПОДРЯД)
// ============================================
function calculateStreak(activityLog) {
    if (!activityLog || activityLog.length === 0) return 0;
    
    // Получаем уникальные даты тренировок
    const trainingDates = new Set();
    activityLog.forEach(log => {
        const date = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        trainingDates.add(dateKey);
    });
    
    if (trainingDates.size === 0) return 0;
    
    // Сортируем даты
    const sortedDates = Array.from(trainingDates).sort().reverse();
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Проверяем, была ли тренировка сегодня или вчера
    const todayKey = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    // Если последняя тренировка была не сегодня и не вчера — streak = 0
    if (sortedDates[0] !== todayKey && sortedDates[0] !== yesterdayKey) {
        return 0;
    }
    
    // Считаем серию дней подряд
    let currentDate = new Date(today);
    if (sortedDates[0] === yesterdayKey) {
        currentDate = yesterday;
    }
    
    for (let i = 0; i < 365; i++) { // Максимум 365 дней
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (trainingDates.has(dateKey)) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    console.log('🔥 Streak рассчитан:', streak, 'дней');
    return streak;
}

// ============================================
// 🔥 ВЫЧИСЛЕНИЕ ОБЩЕГО ПРОГРЕССА (ИСПРАВЛЕНО)
// ============================================
function calculateOverallProgress(userData) {
    const enrolledPrograms = userData.enrolledPrograms || [];
    
    if (enrolledPrograms.length === 0) return 0;
    
    // Берём активные программы, или все если нет активных
    const activePrograms = enrolledPrograms.filter(p => p.status === 'active');
    const programsToCount = activePrograms.length > 0 ? activePrograms : enrolledPrograms;
    
    console.log('📊 Подсчёт общего прогресса:');
    console.log('  Всего программ:', enrolledPrograms.length);
    console.log('  Активных:', activePrograms.length);
    console.log('  Для подсчёта:', programsToCount.length);
    
    // 🔥 Считаем СРЕДНЕЕ по прогрессу каждой программы
    let totalProgress = 0;
    programsToCount.forEach((p, index) => {
        // 🔥 ПЕРЕсчитываем прогресс если нужно
        const totalLessons = p.totalLessons || 0;
        const completedCount = (p.completedLessons || []).length;
        const progress = totalLessons > 0 
            ? Math.round((completedCount / totalLessons) * 100) 
            : (p.progress || 0);
        
        totalProgress += progress;
        console.log(`  ${index + 1}. ${p.title || p.slug}: ${progress}% (${completedCount}/${totalLessons})`);
    });
    
    const averageProgress = Math.round(totalProgress / programsToCount.length);
    
    console.log('  Средний прогресс:', averageProgress + '%');
    
    return Math.min(averageProgress, 100);
}

// ============================================
// 🔥 СОХРАНЕНИЕ ПЕРЕСЧИТАННЫХ ДАННЫХ
// ============================================
// ============================================
// 🔥 СОХРАНЕНИЕ ПЕРЕСЧИТАННЫХ ДАННЫХ (ИСПРАВЛЕНО!)
// ============================================
async function saveRecalculatedData(userData) {
    if (!userData._hasProgressChanges) {
        console.log('✅ Изменений нет, не сохраняем');
        return;
    }
    
    try {
        // 🔥 Формируем обновлённый массив программ БЕЗ serverTimestamp
        const enrolledPrograms = userData.enrolledPrograms.map(p => ({
            slug: p.slug,
            title: p.title,
            status: p.status,
            progress: p.progress,
            completedLessons: p.completedLessons,
            completedCount: p.completedCount,
            totalLessons: p.totalLessons,
            minutesSpent: p.minutesSpent,
            goal: p.goal,
            enrolledAt: p.enrolledAt
            // ❌ УБРАЛИ: lastUpdated: serverTimestamp() — нельзя в массиве!
        }));
        
        // ✅ ПРАВИЛЬНО: обновляем массив и timestamp ОТДЕЛЬНО
        await updateDoc(doc(db, 'users', currentUser.uid), {
            enrolledPrograms: enrolledPrograms,
            'stats.totalLessons': userData.stats.totalLessons,
            'stats.totalMinutes': userData.stats.totalMinutes,
            'stats.progress': userData.stats.progress,
            'stats.streak': userData.stats.streak,
            updatedAt: serverTimestamp()  // ✅ timestamp на уровне документа
        });
        
        console.log('✅ Пересчитанные данные сохранены в Firestore');
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        Swal.fire('Ошибка', 'Не удалось сохранить прогресс', 'error');
    }
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ ОБЩЕЙ СТАТИСТИКИ
// ============================================
function updateStatsSummary() {
    const stats = userData.stats || {};
    const overallProgress = calculateOverallProgress(userData);
    
    const elements = {
        lessons: document.getElementById('statTotalLessons'),
        progress: document.getElementById('statProgress'),
        minutes: document.getElementById('statTotalMinutes'),
        streak: document.getElementById('statStreak')
    };
    
    if (elements.lessons) elements.lessons.textContent = stats.totalLessons || 0;
    if (elements.progress) elements.progress.textContent = overallProgress + '%';
    if (elements.minutes) elements.minutes.textContent = stats.totalMinutes || 0;
    if (elements.streak) elements.streak.textContent = stats.streak || 0;
    
    console.log('📊 Статистика обновлена:', {
        lessons: stats.totalLessons,
        progress: overallProgress + '%',
        minutes: stats.totalMinutes,
        streak: stats.streak
    });
}

// ============================================
// 🔹 🔥 ОБНОВЛЕНИЕ ГРАФИКОВ
// ============================================
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
        
        // 🔥 Используем пересчитанный прогресс
        const progressData = enrolledPrograms.map(p => p.progress || 0);
        const labels = enrolledPrograms.map(p => {
            const title = p.title || p.slug || 'Программа';
            return title.length > 15 ? title.substring(0, 15) + '...' : title;
        });
        
        // 🔥 ЦВЕТА в зависимости от прогресса
        const colors = progressData.map(progress => {
            if (progress >= 100) return 'rgba(39, 174, 96, 0.6)'; // Зелёный
            if (progress >= 50) return 'rgba(97, 152, 255, 0.6)';  // Синий
            if (progress > 0) return 'rgba(255, 167, 81, 0.6)';    // Оранжевый
            return 'rgba(225, 232, 237, 0.6)';                     // Серый
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
                    backgroundColor: colors.length ? colors : ['rgba(225, 232, 237, 0.6)'],
                    borderColor: '#6198FF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const program = enrolledPrograms[context.dataIndex];
                                const completed = program?.completedCount || 0;
                                const total = program?.totalLessons || 0;
                                return `Прогресс: ${context.parsed.y}% (${completed}/${total} уроков)`;
                            }
                        }
                    }
                },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }
    
    // 🥧 КРУГОВАЯ ДИАГРАММА (ИСПРАВЛЕНО!)
    const typesCtx = document.getElementById('workoutTypesChart');
    if (typesCtx) {
        const enrolledPrograms = userData.enrolledPrograms || [];
        
        // 🔥 ПРАВИЛЬНЫЙ ПОДСЧЁТ — по МИНУТАМ, а не по количеству программ
        const goalLabels = {
            flexibility: 'Гибкость',
            strength: 'Сила',
            relax: 'Расслабление',
            recovery: 'Восстановление',
            health: 'Здоровье'
        };
        
        const goalMinutes = {};
        
        enrolledPrograms.forEach(p => {
            const goal = p.goal || 'flexibility';
            const goalName = goalLabels[goal] || goal;
            const minutes = p.minutesSpent || 0;
            
            if (minutes > 0) {
                goalMinutes[goalName] = (goalMinutes[goalName] || 0) + minutes;
            }
        });
        
        console.log('🥧 Распределение по типам (минуты):', goalMinutes);
        
        let labels = Object.keys(goalMinutes);
        let data = Object.values(goalMinutes);
        
        // 🔥 Если нет минут — считаем по урокам
        if (labels.length === 0) {
            const goalLessons = {};
            enrolledPrograms.forEach(p => {
                const goal = p.goal || 'flexibility';
                const goalName = goalLabels[goal] || goal;
                const lessons = (p.completedLessons || []).length;
                
                if (lessons > 0) {
                    goalLessons[goalName] = (goalLessons[goalName] || 0) + lessons;
                }
            });
            
            labels = Object.keys(goalLessons);
            data = Object.values(goalLessons);
        }
        
        // 🔥 ДИНАМИЧЕСКИЕ ЦВЕТА
        const colorMap = {
            'Гибкость': '#6198FF',
            'Сила': '#f5576c',
            'Расслабление': '#43e97b',
            'Восстановление': '#f093fb',
            'Здоровье': '#ffa751'
        };
        
        const colors = labels.map(label => colorMap[label] || '#4facfe');
        
        if (window.workoutTypesChart && typeof window.workoutTypesChart.destroy === 'function') {
            window.workoutTypesChart.destroy();
        }
        
        if (labels.length === 0) {
            window.workoutTypesChart = new Chart(typesCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Нет данных'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e1e8ed']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        } else {
            window.workoutTypesChart = new Chart(typesCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 3,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { 
                        legend: { 
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                font: { size: 13 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    
                                    // Определяем единицу измерения
                                    const unit = data === Object.values(goalMinutes) ? 'мин' : 'уроков';
                                    return `${label}: ${value} ${unit} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    // 📊 График времени по дням недели
    const timeCtx = document.getElementById('timeChart');
    if (timeCtx) {
        const dailyData = aggregateByDayOfWeek(activityLog);
        
        if (window.timeChart && typeof window.timeChart.destroy === 'function') {
            window.timeChart.destroy();
        }
        
        // 🔥 Подсветка текущего дня
        const today = new Date();
        const currentDayIndex = (today.getDay() + 6) % 7;
        const barColors = dailyData.map((_, index) => 
            index === currentDayIndex ? '#43e97b' : '#6198FF'
        );
        
        window.timeChart = new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Минуты',
                    data: dailyData,
                    backgroundColor: barColors
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

// ============================================
// 🔹 АГРЕГАЦИЯ ДАННЫХ ПО НЕДЕЛЯМ
// ============================================
function aggregateByWeek(activityLog) {
    const weeks = {};
    const today = new Date();
    
    // 🔥 Создаём 4 недели в правильном порядке
    const weekKeys = [];
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekKey = weekStart.toISOString().split('T')[0];
        weeks[weekKey] = { lessons: 0, minutes: 0 };
        weekKeys.push(weekKey);
    }
    
    // Распределяем записи по неделям
    activityLog.forEach(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        
        for (const weekKey of weekKeys) {
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
    
    // 🔥 ПРАВИЛЬНЫЙ ПОРЯДОК: от старых к новым (или наоборот)
    return {
        labels: weekKeys.map((k, i) => {
            if (i === 3) return 'Эта неделя';
            if (i === 2) return 'Прошлая неделя';
            return `${4 - i} нед. назад`;
        }),
        lessons: weekKeys.map(k => weeks[k].lessons),
        minutes: weekKeys.map(k => weeks[k].minutes)
    };
}
// ============================================
// 🔹 АГРЕГАЦИЯ ПО ДНЯМ НЕДЕЛИ
// ============================================
function aggregateByDayOfWeek(activityLog) {
    const days = [0, 0, 0, 0, 0, 0, 0];
    
    activityLog.forEach(log => {
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const dayIndex = (logDate.getDay() + 6) % 7; // Пн = 0, Вс = 6
        days[dayIndex] += log.minutesWatched || 0;
    });
    
    return days;
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ ДОСТИЖЕНИЙ
// ============================================
function updateAchievements() {
    const stats = userData.stats || {};
    const achievements = userData.achievements || [];
    const overallProgress = calculateOverallProgress(userData);
    
    // 🔥 Массив достижений с проверкой условий
    const achievementConfigs = {
        first_workout: { 
            title: 'Первые шаги', 
            desc: 'Завершите первую тренировку', 
            requirement: () => stats.totalLessons >= 1,
            progressText: () => `${stats.totalLessons || 0}/1`
        },
        streak_5: { 
            title: 'Серия из 5 дней', 
            desc: 'Тренируйтесь 5 дней подряд', 
            requirement: () => stats.streak >= 5,
            progressText: () => `${stats.streak || 0}/5 дней`
        },
        lessons_10: { 
            title: '10 тренировок', 
            desc: 'Завершите 10 тренировок', 
            requirement: () => stats.totalLessons >= 10,
            progressText: () => `${stats.totalLessons || 0}/10`
        },
        lessons_50: {
            title: '50 тренировок',
            desc: 'Завершите 50 тренировок',
            requirement: () => stats.totalLessons >= 50,
            progressText: () => `${stats.totalLessons || 0}/50`
        },
        strength_master: { 
            title: 'Силач', 
            desc: 'Завершите программу "Сила"', 
            requirement: () => {
                const enrolledPrograms = userData.enrolledPrograms || [];
                return enrolledPrograms.some(p => 
                    (p.slug?.includes('strength') || p.goal === 'strength') && 
                    p.progress >= 100
                );
            },
            progressText: () => {
                const enrolledPrograms = userData.enrolledPrograms || [];
                const strengthProgram = enrolledPrograms.find(p => 
                    p.slug?.includes('strength') || p.goal === 'strength'
                );
                return strengthProgram ? `Прогресс: ${strengthProgram.progress || 0}%` : 'Нет программы';
            }
        },
        flex_100: { 
            title: 'Мастер гибкости', 
            desc: 'Достигните 100% прогресса', 
            requirement: () => overallProgress >= 100,
            progressText: () => `Прогресс: ${overallProgress}%`
        },
        streak_30: { 
            title: 'Месяц тренировок', 
            desc: 'Занимайтесь 30 дней подряд', 
            requirement: () => stats.streak >= 30,
            progressText: () => `${stats.streak || 0}/30 дней`
        },
        minutes_1000: {
            title: 'Марафонец',
            desc: '1000 минут тренировок',
            requirement: () => stats.totalMinutes >= 1000,
            progressText: () => `${stats.totalMinutes || 0}/1000 мин`
        }
    };
    
    Object.keys(achievementConfigs).forEach(achievementId => {
        const card = document.querySelector(`[data-achievement="${achievementId}"]`);
        if (!card) return;
        
        const config = achievementConfigs[achievementId];
        const isUnlocked = achievements.includes(achievementId) || config.requirement();
        
        console.log(`🏆 ${achievementId}: unlocked=${isUnlocked}`);
        
        if (isUnlocked) {
            card.classList.remove('locked');
            card.classList.add('unlocked');
            
            const lockIcon = card.querySelector('.achievement-lock i');
            if (lockIcon) {
                lockIcon.className = 'fas fa-lock-open';
                lockIcon.style.color = '#43e97b';
            }
            
            // Дата получения
            const achievementData = achievements.find(a => typeof a === 'object' && a.id === achievementId);
            const dateEl = card.querySelector('.achievement-date');
            if (dateEl) {
                if (achievementData?.date) {
                    const date = achievementData.date.toDate ? achievementData.date.toDate() : new Date(achievementData.date);
                    dateEl.textContent = 'Получено ' + date.toLocaleDateString('ru-RU');
                    dateEl.style.display = 'block';
                } else {
                    dateEl.textContent = 'Получено сегодня';
                    dateEl.style.display = 'block';
                }
            }
            
            const progressEl = card.querySelector('.achievement-progress');
            if (progressEl) {
                progressEl.style.display = 'none';
            }
            
        } else {
            card.classList.remove('unlocked');
            card.classList.add('locked');
            
            const lockIcon = card.querySelector('.achievement-lock i');
            if (lockIcon) {
                lockIcon.className = 'fas fa-lock';
                lockIcon.style.color = '#95a5a6';
            }
            
            const dateEl = card.querySelector('.achievement-date');
            if (dateEl) {
                dateEl.style.display = 'none';
            }
            
            const progressEl = card.querySelector('.achievement-progress');
            if (progressEl) {
                progressEl.style.display = 'block';
                progressEl.textContent = config.progressText();
            }
        }
    });
}

// ============================================
// 🔥 ФУНКЦИИ ШЕРИНГА
// ============================================
window.shareAllAchievements = function() {
    const stats = userData.stats || {};
    const overallProgress = calculateOverallProgress(userData);
    
    const shareText = `Мои достижения в StretchWell!\n\n` +
                     `🏋️ Тренировок завершено: ${stats.totalLessons}\n` +
                     `📈 Общий прогресс: ${overallProgress}%\n` +
                     `⏱️ Минут тренировок: ${stats.totalMinutes}\n` +
                     `🔥 Дней подряд: ${stats.streak}\n\n` +
                     `Присоединяйся ко мне! 💪`;
    
    document.getElementById('shareText').textContent = shareText;
    document.getElementById('shareModal').classList.add('active');
}

window.closeShareModal = function() {
    document.getElementById('shareModal').classList.remove('active');
}

window.copyToClipboard = function() {
    const text = document.getElementById('shareText').textContent;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showCopySuccess();
        }).catch(err => {
            console.error('❌ Ошибка копирования:', err);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        const success = document.execCommand('copy');
        if (success) {
            showCopySuccess();
        } else {
            Swal.fire('Ошибка', 'Не удалось скопировать', 'error');
        }
    } catch (e) {
        Swal.fire('Ошибка', 'Не удалось скопировать', 'error');
    }
    
    document.body.removeChild(textarea);
}

function showCopySuccess() {
    closeShareModal();
    
    Swal.fire({
        icon: 'success',
        title: 'Скопировано!',
        html: `
            <p style="margin-bottom: 10px;">Текст скопирован в буфер обмена</p>
            <p style="font-size: 13px; color: #7f8c8d;">
                Теперь вы можете вставить его в любой мессенджер<br>
                (Telegram, WhatsApp, VK, MAX и др.)
            </p>
        `,
        timer: 3000,
        showConfirmButton: false
    });
}

document.getElementById('shareModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeShareModal();
});

// ============================================
// 🔹 ОБНОВЛЕНИЕ НЕДАВНИХ РЕЗУЛЬТАТОВ
// ============================================
function updateRecentResults() {
    const activityLog = userData.activityLog || [];
    const container = document.querySelector('.results-list');
    
    if (!container) return;
    
    const recent = activityLog.slice(-5).reverse();
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">Пока нет результатов. Начните первую тренировку!</p>';
        return;
    }
    
    container.innerHTML = recent.map(log => {
        const date = log.date?.toDate ? log.date.toDate() : new Date(log.date);
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        
        let relativeDate = dateStr;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            relativeDate = 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            relativeDate = 'Вчера';
        }
        
        const lessonsCompleted = log.lessonsCompleted || 1;
        const minutesWatched = log.minutesWatched || 0;
        const calories = Math.round(minutesWatched * 5);
        const programName = log.programTitle || log.programSlug || 'Тренировка';
        
        return `
            <div class="result-item">
                <div class="result-icon" style="background: linear-gradient(135deg, #6198FF 0%, #8DA4CE 100%);">
                    <i class="fas fa-check"></i>
                </div>
                <div class="result-info">
                    <h5>${programName}</h5>
                    <p>${lessonsCompleted} урок(ов) • ${minutesWatched} мин</p>
                    <span class="result-date">${relativeDate}, ${timeStr}</span>
                </div>
                <div class="result-stats">
                    <span class="result-stat">
                        <i class="fas fa-fire"></i> ${calories} ккал
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ ИНФОРМАЦИИ ПОЛЬЗОВАТЕЛЯ
// ============================================
function updateUserInfo() {
    const name = userData.name || 'Пользователь';
    
    const userNameEls = document.querySelectorAll('.user-name');
    userNameEls.forEach(el => el.textContent = name);
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

console.log('📊 Progress.js загружен (с правильным прогрессом)');