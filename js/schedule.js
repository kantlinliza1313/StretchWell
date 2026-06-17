// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ============================================
// 🔹 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================
let currentUser = null;
let userData = null;
let currentWeekStart = null;
let currentMonthDate = null; // 🔥 Для навигации по месяцам

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadScheduleData();
        setupEventListeners();
    } else {
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ЗАГРУЗКА ДАННЫХ РАСПИСАНИЯ
// ============================================
async function loadScheduleData() {
    try {
        console.log('📅 Загрузка расписания...');
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists()) {
            console.error('❌ Документ пользователя не найден');
            return;
        }
        
        userData = userDoc.data();
        console.log('✅ Данные пользователя загружены');
        
        // Генерируем расписание для всех программ если нет
        await generateAllSchedules();
        
        // Устанавливаем текущую неделю и месяц
        currentWeekStart = getWeekStart(new Date());
        currentMonthDate = new Date(); // 🔥 Текущий месяц
        console.log('📅 Текущая неделя:', currentWeekStart);
        
        // Отображаем
        renderWeekView();
        renderMonthView(); // 🔥 Сразу рендерим месяц
        updateUserInfo();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки расписания:', error);
    }
}

// ============================================
// 🔹 ГЕНЕРАЦИЯ РАСПИСАНИЯ ДЛЯ ВСЕХ ПРОГРАММ
// ============================================
async function generateAllSchedules() {
    console.log('🔄 Генерация расписаний для всех программ...');
    
    const enrolledPrograms = userData.enrolledPrograms || [];
    let needsUpdate = false;
    
    for (let i = 0; i < enrolledPrograms.length; i++) {
        const program = enrolledPrograms[i];
        
        if (program.status !== 'active' && program.status !== 'paused') continue;
        
        if (!program.schedule || program.schedule.length === 0) {
            console.log(`📅 Генерация расписания для программы: ${program.title}`);
            
            const programQuery = query(collection(db, 'programs'), where('slug', '==', program.slug));
            const programSnap = await getDocs(programQuery);
            
            if (!programSnap.empty) {
                const programData = programSnap.docs[0].data();
                program.schedule = generateProgramSchedule(program, programData);
                needsUpdate = true;
                console.log(`✅ Сгенерировано ${program.schedule.length} уроков`);
            } else {
                console.warn(`⚠️ Программа не найдена: ${program.slug}`);
            }
        } else {
            program.schedule = updateUnlockedStatus(program.schedule, program.completedLessons || []);
        }
    }
    
    if (needsUpdate) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            enrolledPrograms: userData.enrolledPrograms,
            updatedAt: serverTimestamp()
        });
        console.log('✅ Расписания сохранены в базу');
    }
}

// ============================================
// 🔹 ГЕНЕРАЦИЯ РАСПИСАНИЯ ДЛЯ ОДНОЙ ПРОГРАММЫ
// ============================================
function generateProgramSchedule(enrollment, programData) {
    const schedule = [];
    const lessons = programData?.lessons || [];
    
    if (lessons.length === 0) {
        console.warn('⚠️ В программе нет уроков');
        return [];
    }
    
    let currentDate = enrollment.enrolledAt ? new Date(enrollment.enrolledAt) : new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    console.log(`📅 Генерация ${lessons.length} уроков, старт: ${currentDate.toISOString()}`);
    
    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const isCompleted = enrollment.completedLessons?.includes(i) || false;
        
        schedule.push({
            lessonIndex: i,
            date: currentDate.toISOString().split('T')[0],
            time: '10:00',
            completed: isCompleted,
            unlocked: i === 0 || isCompleted || (enrollment.completedLessons?.includes(i - 1) || false),
            lessonTitle: lesson.title || lesson.dayTitle || `День ${i + 1}`,
            duration: lesson.duration || '20 мин',
            videoUrl: lesson.videoUrl || '',
            notes: '',
            dayNumber: i + 1
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('✅ Сгенерировано расписание:', schedule.length, 'уроков');
    return schedule;
}

// ============================================
// 🔹 ОБНОВЛЕНИЕ СТАТУСА РАЗБЛОКИРОВКИ
// ============================================
function updateUnlockedStatus(schedule, completedLessons) {
    return schedule.map((item, index) => {
        const isCompleted = completedLessons.includes(index);
        const isUnlocked = index === 0 || isCompleted || completedLessons.includes(index - 1);
        
        return {
            ...item,
            completed: isCompleted,
            unlocked: isUnlocked
        };
    });
}

// ============================================
// 🔹 ОТОБРАЖЕНИЕ НЕДЕЛЬНОГО ВИДА
// ============================================
// Отображение недельного вида
function renderWeekView() {
    const weekDays = getWeekDays(currentWeekStart);
    const enrolledPrograms = (userData.enrolledPrograms || []).filter(p => p.status === 'active' || p.status === 'paused');
    
    console.log('📊 Отрисовка недели:', currentWeekStart);
    console.log('📋 Программ:', enrolledPrograms.length);
    
    // 🔥 ОБНОВЛЯЕМ ДАТЫ В ШАПКЕ (week-day)
    weekDays.forEach((day, index) => {
        const weekDayEl = document.querySelectorAll('.week-day')[index];
        if (!weekDayEl) return;
        
        const dayDateEl = weekDayEl.querySelector('.day-date');
        const dayTodayEl = weekDayEl.querySelector('.day-today');
        
        if (dayDateEl) {
            dayDateEl.textContent = day.getDate();
        }
        
        if (dayTodayEl) {
            const isToday = day.toDateString() === new Date().toDateString();
            dayTodayEl.style.display = isToday ? 'inline' : 'none';
            
            if (isToday) {
                weekDayEl.classList.add('today');
            } else {
                weekDayEl.classList.remove('today');
            }
        }
    });
    
    // 🔥 ЗАПОЛНЯЕМ КОЛОНКИ С РАСПИСАНИЕМ (day-column)
    weekDays.forEach((day, index) => {
        const dayColumn = document.querySelectorAll('.day-column')[index];
        if (!dayColumn) return;
        
        const dayEvents = dayColumn.querySelector('.day-events');
        const dayLabel = dayColumn.querySelector('.day-label');
        
        const dateStr = day.toISOString().split('T')[0];
        
        if (dayLabel) {
            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            dayLabel.textContent = `${day.getDate()} ${months[day.getMonth()]}`;
        }
        
        // Находим занятия на этот день
        const dayLessons = [];
        
        enrolledPrograms.forEach(program => {
            const schedule = program.schedule || [];
            const lessonsForDay = schedule.filter(s => s.date === dateStr);
            
            lessonsForDay.forEach(lesson => {
                dayLessons.push({
                    ...lesson,
                    programSlug: program.slug,
                    programTitle: program.title,
                    programStatus: program.status
                });
            });
        });
        
        // Сортируем по времени
        dayLessons.sort((a, b) => a.time.localeCompare(b.time));
        
        // Отображаем
        if (dayLessons.length === 0) {
            dayEvents.innerHTML = '<span class="no-events" style="color: #95a5a6; font-size: 13px;">Нет тренировок</span>';
        } else {
            dayEvents.innerHTML = dayLessons.map(lesson => createLessonCard(lesson, dateStr)).join('');
        }
    });
    
    // Обновляем период
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const periodEl = document.getElementById('currentWeek');
    if (periodEl) {
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const monthName = months[weekEnd.getMonth()];
        periodEl.textContent = `${currentWeekStart.getDate()} — ${weekEnd.getDate()} ${monthName} ${weekEnd.getFullYear()}`;
    }
}

// ============================================
// 🔹 🔥 ОТОБРАЖЕНИЕ МЕСЯЧНОГО КАЛЕНДАРЯ
// ============================================
function renderMonthView() {
    const currentDate = currentMonthDate || new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    console.log('📅 Отрисовка месяца:', month, year);
    
    // Обновляем заголовок
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const monthNameEl = document.getElementById('monthName');
    if (monthNameEl) {
        monthNameEl.textContent = `${monthNames[month]} ${year}`;
    }
    
    // Получаем все тренировки за месяц
    const enrolledPrograms = (userData.enrolledPrograms || []).filter(p => p.status === 'active' || p.status === 'paused');
    const allLessons = [];
    
    enrolledPrograms.forEach(program => {
        const schedule = program.schedule || [];
        const monthLessons = schedule.filter(s => {
            const lessonDate = new Date(s.date);
            return lessonDate.getMonth() === month && lessonDate.getFullYear() === year;
        });
        
        monthLessons.forEach(lesson => {
            allLessons.push({
                ...lesson,
                programSlug: program.slug,
                programTitle: program.title
            });
        });
    });
    
    // Создаём сетку месяца
    const grid = document.getElementById('monthGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Первый и последний день месяца
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // День недели первого дня (0 = Вс, 1 = Пн, ...)
    let startingDay = firstDay.getDay();
    startingDay = startingDay === 0 ? 6 : startingDay - 1;
    
    // Пустые ячейки до первого дня
    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'month-day empty';
        grid.appendChild(emptyCell);
    }
    
    // Дни месяца
    const today = new Date();
    const totalDays = lastDay.getDate();
    
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cellDate = new Date(year, month, day);
        
        const cell = document.createElement('div');
        cell.className = 'month-day';
        
        // Сегодняшний день
        const isToday = cellDate.toDateString() === today.toDateString();
        if (isToday) {
            cell.classList.add('today');
        }
        
        // Находим тренировки на этот день
        const dayLessons = allLessons.filter(l => l.date === dateStr);
        const hasEvents = dayLessons.length > 0;
        
        if (hasEvents) {
            cell.classList.add('has-events');
        }
        
        // Проверяем завершённость
        const completedCount = dayLessons.filter(l => l.completed).length;
        const totalCount = dayLessons.length;
        
        // HTML ячейки
        let cellContent = `<div class="month-date">${day}</div>`;
        
        if (hasEvents) {
            // Показываем список тренировок (до 3 штук)
            const lessonsHtml = dayLessons.slice(0, 3).map(lesson => {
                const statusIcon = lesson.completed 
                    ? '<i class="fas fa-check-circle" style="color: #43e97b;"></i>' 
                    : (lesson.unlocked === false 
                        ? '<i class="fas fa-lock" style="color: #95a5a6;"></i>' 
                        : '<i class="fas fa-play-circle" style="color: #6198FF;"></i>');
                
                return `
                    <div class="month-event-item ${lesson.completed ? 'completed' : ''}">
                        ${statusIcon}
                        <span class="month-event-title">${escapeHtml(lesson.lessonTitle)}</span>
                    </div>
                `;
            }).join('');
            
            const moreCount = dayLessons.length > 3 ? `<div class="month-more">+${dayLessons.length - 3} ещё</div>` : '';
            
            cellContent += `
                <div class="month-events-list">
                    ${lessonsHtml}
                    ${moreCount}
                </div>
                <div class="month-progress">
                    <div class="month-progress-bar">
                        <div class="month-progress-fill" style="width: ${totalCount > 0 ? (completedCount / totalCount * 100) : 0}%"></div>
                    </div>
                    <span class="month-progress-text">${completedCount}/${totalCount}</span>
                </div>
            `;
        }
        
        cell.innerHTML = cellContent;
        
        // Клик по дню
        cell.addEventListener('click', () => {
            showDayDetails(dateStr, dayLessons);
        });
        
        grid.appendChild(cell);
    }
    
    // 🔥 Обновляем период в навигации
    const periodEl = document.getElementById('currentWeek');
    if (periodEl && document.getElementById('monthView').style.display !== 'none') {
        periodEl.textContent = `${monthNames[month]} ${year}`;
    }
}

// ============================================
// 🔹 ПОКАЗ ДЕТАЛЕЙ ДНЯ
// ============================================
function showDayDetails(dateStr, lessons) {
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('ru-RU', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    if (lessons.length === 0) {
        Swal.fire({
            title: dateFormatted,
            text: 'Нет тренировок на этот день',
            icon: 'info',
            confirmButtonColor: '#6198FF'
        });
        return;
    }
    
    const completedCount = lessons.filter(l => l.completed).length;
    const progress = Math.round((completedCount / lessons.length) * 100);
    
    const lessonsHtml = lessons.map(lesson => {
        const statusIcon = lesson.completed 
            ? '<i class="fas fa-check-circle" style="color: #43e97b; font-size: 20px;"></i>' 
            : (lesson.unlocked === false 
                ? '<i class="fas fa-lock" style="color: #95a5a6; font-size: 20px;"></i>' 
                : '<i class="fas fa-play-circle" style="color: #6198FF; font-size: 20px;"></i>');
        
        const statusClass = lesson.completed ? 'completed' : (lesson.unlocked === false ? 'locked' : 'available');
        
        return `
            <div class="day-detail-item ${statusClass}" style="padding: 12px; margin: 8px 0; background: #f8f9fa; border-radius: 10px; border-left: 4px solid ${lesson.completed ? '#43e97b' : (lesson.unlocked === false ? '#95a5a6' : '#6198FF')}; display: flex; align-items: center; gap: 12px;">
                ${statusIcon}
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #2c3e50;">${escapeHtml(lesson.lessonTitle)}</div>
                    <div style="font-size: 13px; color: #7f8c8d; margin-top: 3px;">
                        <i class="fas fa-clock"></i> ${lesson.time} • ${lesson.duration}
                    </div>
                    <div style="font-size: 12px; color: #6198FF; margin-top: 3px;">
                        <i class="fas fa-dumbbell"></i> ${escapeHtml(lesson.programTitle)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    Swal.fire({
        title: `<strong>${dateFormatted}</strong>`,
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                <div style="background: linear-gradient(135deg, #6198FF 0%, #8DA4CE 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700;">${progress}%</div>
                    <div style="font-size: 13px; opacity: 0.9;">Прогресс дня: ${completedCount} из ${lessons.length}</div>
                </div>
                ${lessonsHtml}
            </div>
        `,
        width: '550px',
        confirmButtonText: 'Закрыть',
        confirmButtonColor: '#6198FF'
    });
}

// ============================================
// 🔹 СОЗДАНИЕ КАРТОЧКИ УРОКА
// ============================================
function createLessonCard(lesson, dateStr) {
    const isCompleted = lesson.completed;
    const isUnlocked = lesson.unlocked !== false;
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
    
    let statusClass = 'planned';
    if (isCompleted) statusClass = 'completed';
    else if (!isUnlocked) statusClass = 'locked';
    else if (isToday) statusClass = 'current';
    else if (isPast) statusClass = 'missed';
    
    return `
        <div class="event-card ${statusClass}" 
             data-program="${lesson.programSlug}" 
             data-lesson="${lesson.lessonIndex}"
             data-unlocked="${isUnlocked}">
            <div class="event-time">
                ${lesson.time}
                ${isUnlocked ? `
                    <button class="btn-edit-time" onclick="editLessonTime('${lesson.programSlug}', ${lesson.lessonIndex}, '${lesson.time}')" title="Изменить время">
                        <i class="fas fa-pencil"></i>
                    </button>
                ` : ''}
            </div>
            <div class="event-content">
                <h5>${escapeHtml(lesson.lessonTitle)}</h5>
                <p>${lesson.duration} • ${escapeHtml(lesson.programTitle || 'Программа')}</p>
                ${lesson.notes ? `<small style="color: #95a5a6;">📝 ${escapeHtml(lesson.notes)}</small>` : ''}
            </div>
            ${!isUnlocked ? `
                <div class="event-locked">
                    <i class="fas fa-lock"></i>
                    <small>Заблокировано</small>
                </div>
            ` : `
                <div class="event-actions">
                    <button class="btn-note" onclick="addLessonNote('${lesson.programSlug}', ${lesson.lessonIndex})" title="Добавить заметку">
                        <i class="fas fa-sticky-note"></i>
                    </button>
                </div>
                <div class="event-checkbox">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" 
                               class="lesson-completed" 
                               data-program="${lesson.programSlug}" 
                               data-lesson="${lesson.lessonIndex}"
                               data-date="${dateStr}"
                               ${isCompleted ? 'checked' : ''}
                               onchange="window.toggleLessonCompletion(this)">
                        <span class="checkmark"></span>
                    </label>
                </div>
            `}
        </div>
    `;
}

// ============================================
// 🔹 РЕДАКТИРОВАНИЕ ВРЕМЕНИ УРОКА
// ============================================
window.editLessonTime = async function(programSlug, lessonIndex, currentTime) {
    const newTime = prompt('Новое время (формат ЧЧ:ММ):', currentTime);
    if (!newTime) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = userData.enrolledPrograms.map(p => {
            if (p.slug === programSlug) {
                const schedule = p.schedule.map(s => {
                    if (s.lessonIndex === lessonIndex) {
                        return { ...s, time: newTime };
                    }
                    return s;
                });
                return { ...p, schedule };
            }
            return p;
        });
        
        await updateDoc(userRef, { enrolledPrograms });
        userData.enrolledPrograms = enrolledPrograms;
        renderWeekView();
        renderMonthView(); // 🔥 Обновляем и месяц
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось изменить время', 'error');
    }
}

// ============================================
// 🔹 ДОБАВЛЕНИЕ ЗАМЕТКИ
// ============================================
window.addLessonNote = async function(programSlug, lessonIndex) {
    const note = prompt('Заметка к уроку:');
    if (note === null) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = userData.enrolledPrograms.map(p => {
            if (p.slug === programSlug) {
                const schedule = p.schedule.map(s => {
                    if (s.lessonIndex === lessonIndex) {
                        return { ...s, notes: note };
                    }
                    return s;
                });
                return { ...p, schedule };
            }
            return p;
        });
        
        await updateDoc(userRef, { enrolledPrograms });
        userData.enrolledPrograms = enrolledPrograms;
        renderWeekView();
        renderMonthView(); // 🔥 Обновляем и месяц
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// ============================================
// 🔹 ПЕРЕКЛЮЧЕНИЕ ВЫПОЛНЕНИЯ УРОКА
// ============================================
window.toggleLessonCompletion = async function(checkbox) {
    const programSlug = checkbox.dataset.program;
    const lessonIndex = parseInt(checkbox.dataset.lesson);
    const date = checkbox.dataset.date;
    const isCompleted = checkbox.checked;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = userData.enrolledPrograms.map(p => {
            if (p.slug === programSlug) {
                const schedule = p.schedule.map(s => {
                    if (s.lessonIndex === lessonIndex) {
                        return { ...s, completed: isCompleted };
                    }
                    return s;
                });
                
                let completedLessons = p.completedLessons || [];
                if (isCompleted) {
                    if (!completedLessons.includes(lessonIndex)) {
                        completedLessons.push(lessonIndex);
                    }
                } else {
                    completedLessons = completedLessons.filter(i => i !== lessonIndex);
                }
                
                const totalLessons = p.schedule?.length || 1;
                const progress = Math.round((completedLessons.length / totalLessons) * 100);
                const updatedSchedule = updateUnlockedStatus(schedule, completedLessons);
                
                return {
                    ...p,
                    schedule: updatedSchedule,
                    completedLessons: completedLessons,
                    progress: progress
                };
            }
            return p;
        });
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            updatedAt: serverTimestamp()
        });
        
        userData.enrolledPrograms = enrolledPrograms;
        renderWeekView();
        renderMonthView(); // 🔥 Обновляем и месяц
        
        Swal.fire({
            icon: isCompleted ? 'success' : 'info',
            title: isCompleted ? 'Урок выполнен! ✓' : 'Урок отменен',
            timer: 1500,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        checkbox.checked = !isCompleted;
        Swal.fire('Ошибка', 'Не удалось сохранить', 'error');
    }
}

// ============================================
// 🔹 🔥 НАВИГАЦИЯ ПО МЕСЯЦАМ
// ============================================
window.navigateMonth = function(direction) {
    if (!currentMonthDate) currentMonthDate = new Date();
    
    currentMonthDate.setMonth(currentMonthDate.getMonth() + direction);
    renderMonthView();
    
    // Обновляем заголовок навигации
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const periodEl = document.getElementById('currentWeek');
    if (periodEl) {
        periodEl.textContent = `${monthNames[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;
    }
}

// ============================================
// 🔹 ОБРАБОТЧИКИ СОБЫТИЙ (ОБНОВЛЁННЫЕ)
// ============================================
function setupEventListeners() {
    // Переключатель вида
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const view = this.dataset.view;
            const weekView = document.getElementById('weekView');
            const monthView = document.getElementById('monthView');
            const navPanel = document.querySelector('.schedule-navigation');
            
            // 🔥 Показываем/скрываем навигацию
            if (navPanel) {
                navPanel.style.display = 'flex';
            }
            
            if (weekView) weekView.style.display = view === 'week' ? 'block' : 'none';
            if (monthView) {
                monthView.style.display = view === 'month' ? 'block' : 'none';
                if (view === 'month') {
                    renderMonthView();
                }
            }
            
            // 🔥 Обновляем заголовок в зависимости от вида
            const periodEl = document.getElementById('currentWeek');
            if (periodEl && view === 'week') {
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                periodEl.textContent = `${currentWeekStart.getDate()} — ${weekEnd.getDate()} ${months[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
            } else if (periodEl && view === 'month') {
                const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                periodEl.textContent = `${monthNames[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;
            }
        });
    });
    
    // 🔥 Навигация недели/месяца
    document.getElementById('prevWeek')?.addEventListener('click', () => {
        const activeView = document.querySelector('.view-btn.active');
        const view = activeView?.dataset.view || 'week';
        
        if (view === 'week') {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            renderWeekView();
        } else if (view === 'month') {
            navigateMonth(-1);
        }
    });
    
    document.getElementById('nextWeek')?.addEventListener('click', () => {
        const activeView = document.querySelector('.view-btn.active');
        const view = activeView?.dataset.view || 'week';
        
        if (view === 'week') {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            renderWeekView();
        } else if (view === 'month') {
            navigateMonth(1);
        }
    });
    
    document.getElementById('todayBtn')?.addEventListener('click', () => {
        const activeView = document.querySelector('.view-btn.active');
        const view = activeView?.dataset.view || 'week';
        
        if (view === 'week') {
            currentWeekStart = getWeekStart(new Date());
            renderWeekView();
        } else if (view === 'month') {
            currentMonthDate = new Date();
            renderMonthView();
        }
    });
}

// ============================================
// 🔹 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getWeekDays(weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        days.push(day);
    }
    return days;
}

function updateUserInfo() {
    const name = userData.name || 'Пользователь';
    document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
}

// 🔥 Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

console.log('📅 Schedule.js загружен');