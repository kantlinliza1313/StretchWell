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

// Глобальные переменные
let currentUser = null;
let userData = null;
let currentWeekStart = null;

// Проверка авторизации
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadScheduleData();
        setupEventListeners();
    } else {
        window.location.href = 'login.html';
    }
});

// Загрузка данных расписания
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
        
        // Устанавливаем текущую неделю
        currentWeekStart = getWeekStart(new Date());
        console.log('📅 Текущая неделя:', currentWeekStart);
        
        // Отображаем
        renderWeekView();
        updateUserInfo();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки расписания:', error);
    }
}

// Генерация расписания для ВСЕХ программ
async function generateAllSchedules() {
    console.log('🔄 Генерация расписаний для всех программ...');
    
    const enrolledPrograms = userData.enrolledPrograms || [];
    let needsUpdate = false;
    
    for (let i = 0; i < enrolledPrograms.length; i++) {
        const program = enrolledPrograms[i];
        
        if (program.status !== 'active' && program.status !== 'paused') continue;
        
        // Если расписания нет или оно пустое — генерируем
        if (!program.schedule || program.schedule.length === 0) {
            console.log(`📅 Генерация расписания для программы: ${program.title}`);
            
            // Загружаем данные программы из базы
            const programQuery = query(collection(db, 'programs'), where('slug', '==', program.slug));
            const programSnap = await getDocs(programQuery);
            
            if (!programSnap.empty) {
                const programData = programSnap.docs[0].data();
                
                // Генерируем расписание с последовательной разблокировкой
                program.schedule = generateProgramSchedule(program, programData);
                needsUpdate = true;
                
                console.log(`✅ Сгенерировано ${program.schedule.length} уроков`);
            } else {
                console.warn(`⚠️ Программа не найдена: ${program.slug}`);
            }
        } else {
            // Обновляем статус разблокировки для существующих уроков
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

// Генерация расписания для одной программы
function generateProgramSchedule(enrollment, programData) {
    const schedule = [];
    const lessons = programData?.lessons || [];
    
    if (lessons.length === 0) {
        console.warn('⚠️ В программе нет уроков');
        return [];
    }
    
    // Начальная дата: с даты записи или сегодня
    let currentDate = enrollment.enrolledAt ? new Date(enrollment.enrolledAt) : new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    console.log(`📅 Генерация ${lessons.length} уроков, старт: ${currentDate.toISOString()}`);
    
    // Для каждого урока в программе
    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const isCompleted = enrollment.completedLessons?.includes(i) || false;
        
        schedule.push({
            lessonIndex: i,
            date: currentDate.toISOString().split('T')[0],  // YYYY-MM-DD
            time: '10:00',  // Или берите из настроек
            completed: isCompleted,
            unlocked: i === 0 || isCompleted || (enrollment.completedLessons?.includes(i - 1) || false),
            lessonTitle: lesson.title || lesson.dayTitle || `День ${i + 1}`,
            duration: lesson.duration || '20 мин',
            videoUrl: lesson.videoUrl || '',
            notes: '',
            dayNumber: i + 1  // Номер дня из программы (День 1, День 2...)
        });
        
        // 🔥 СЛЕДУЮЩИЙ ДЕНЬ (каждый день подряд, без пропусков!)
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('✅ Сгенерировано расписание:', schedule.length, 'уроков');
    console.log('📅 Первый урок:', schedule[0]?.date);
    console.log('📅 Последний урок:', schedule[schedule.length - 1]?.date);
    
    return schedule;
}

// Обновление статуса разблокировки
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

// Отображение недельного вида
function renderWeekView() {
    const weekDays = getWeekDays(currentWeekStart);
    const enrolledPrograms = (userData.enrolledPrograms || []).filter(p => p.status === 'active' || p.status === 'paused');
    
    console.log('📊 Отрисовка недели:', currentWeekStart);
    console.log('📋 Программ:', enrolledPrograms.length);
    
    // Для каждого дня недели
    weekDays.forEach((day, index) => {
        const dayColumn = document.querySelectorAll('.day-column')[index];
        if (!dayColumn) return;
        
        const dayEvents = dayColumn.querySelector('.day-events');
        const dayLabel = dayColumn.querySelector('.day-label');
        const dayDateEl = dayColumn.querySelector('[data-day="date"]');
        const dayTodayEl = dayColumn.querySelector('.day-today');
        
        const dateStr = day.toISOString().split('T')[0];
        
        // Обновляем отображение даты
        if (dayDateEl) dayDateEl.textContent = day.getDate();
        
        if (dayLabel) {
            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            dayLabel.textContent = `${day.getDate()} ${months[day.getMonth()]}`;
        }
        
        if (dayTodayEl) {
            const isToday = day.toDateString() === new Date().toDateString();
            dayTodayEl.style.display = isToday ? 'inline' : 'none';
            
            if (isToday) {
                dayColumn.classList.add('today-column');
            } else {
                dayColumn.classList.remove('today-column');
            }
        }
        
        // Находим занятия на этот день из ВСЕХ программ
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
        periodEl.textContent = `${currentWeekStart.getDate()} — ${weekEnd.getDate()} ${monthName} 2026`;
    }
}

// Создание карточки урока
function createLessonCard(lesson, dateStr) {
    const isCompleted = lesson.completed;
    const isUnlocked = lesson.unlocked !== false; // по умолчанию true если не указано
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
    
    // Определяем класс
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
                <h5>${lesson.lessonTitle}</h5>
                <p>${lesson.duration} • ${lesson.programTitle || 'Программа'}</p>
                ${lesson.notes ? `<small style="color: #95a5a6;">📝 ${lesson.notes}</small>` : ''}
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

// Редактирование времени урока
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
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось изменить время', 'error');
    }
}

// Добавление заметки к уроку
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
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// Переключение выполнения урока
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
                // Обновляем расписание
                const schedule = p.schedule.map(s => {
                    if (s.lessonIndex === lessonIndex) {
                        return { ...s, completed: isCompleted };
                    }
                    return s;
                });
                
                // Обновляем completedLessons
                let completedLessons = p.completedLessons || [];
                if (isCompleted) {
                    if (!completedLessons.includes(lessonIndex)) {
                        completedLessons.push(lessonIndex);
                    }
                } else {
                    completedLessons = completedLessons.filter(i => i !== lessonIndex);
                }
                
                // Пересчитываем прогресс
                const totalLessons = p.schedule?.length || 1;
                const progress = Math.round((completedLessons.length / totalLessons) * 100);
                
                // Обновляем статус разблокировки для всех уроков
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

// Настройка обработчиков
function setupEventListeners() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const view = this.dataset.view;
            document.getElementById('weekView').style.display = view === 'week' ? 'block' : 'none';
            document.getElementById('monthView').style.display = view === 'month' ? 'block' : 'none';
            document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
        });
    });
    
    document.getElementById('prevWeek')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderWeekView();
    });
    
    document.getElementById('nextWeek')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderWeekView();
    });
    
    document.getElementById('todayBtn')?.addEventListener('click', () => {
        currentWeekStart = getWeekStart(new Date());
        renderWeekView();
    });
}

// Вспомогательные функции
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

console.log('📅 Schedule.js загружен');