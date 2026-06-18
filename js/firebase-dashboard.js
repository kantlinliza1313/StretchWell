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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('✅ Пользователь авторизован:', user.email);
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('📋 Данные пользователя:', userData);
                
                //  СНАЧАЛА ОЧИЩАЕМ НЕСУЩЕСТВУЮЩИЕ ПРОГРАММЫ
                const cleanedUserData = await cleanupEnrolledPrograms(userData);
                
                // ПЕРЕСЧИТЫВАЕМ ПРОГРЕСС ВСЕХ ПРОГРАММ
                const recalculatedData = await recalculateAllProgress(cleanedUserData);
                
                updateUI(recalculatedData, user);
                await loadActiveProgram(recalculatedData, user);
                setupProfileForm();
                
                // Загружаем количество непрочитанных сообщений
                await loadUnreadMessagesCount();
                
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

async function recalculateAllProgress(userData) {
    const enrolledPrograms = userData.enrolledPrograms || [];
    
    if (enrolledPrograms.length === 0) {
        return userData;
    }
    
    console.log('📊 Пересчёт прогресса всех программ...');
    
    let needsUpdate = false;
    const updatedPrograms = [];
    let totalMinutesAll = 0;
    let totalLessonsAll = 0;
    
    for (const enrollment of enrolledPrograms) {
        if (!enrollment.slug) {
            updatedPrograms.push(enrollment);
            continue;
        }
        
        try {
            // Загружаем программу из Firestore
            const q = query(
                collection(db, 'programs'),
                where('slug', '==', enrollment.slug)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                // Программа не найдена — оставляем как есть (очистка уже прошла)
                updatedPrograms.push(enrollment);
                continue;
            }
            
            const program = snapshot.docs[0].data();
            const lessons = program.lessons || [];
            const totalLessons = program.videosCount || lessons.length || 0;
        
            //  СЧИТАЕМ реальные завершённые уроки
            const completedLessons = enrollment.completedLessons || [];
            
            // ФИЛЬТРУЕМ некорректные индексы уроков
            const validCompletedLessons = completedLessons.filter(idx => {
                return typeof idx === 'number' && idx >= 0 && idx < totalLessons;
            });
            
            //  СЧИТАЕМ реальный прогресс
            const realProgress = totalLessons > 0 
                ? Math.round((validCompletedLessons.length / totalLessons) * 100) 
                : 0;
            
            // СЧИТАЕМ минуты из завершённых уроков
            let programMinutes = 0;
            validCompletedLessons.forEach(lessonIndex => {
                if (lessons[lessonIndex]) {
                    const duration = parseDuration(lessons[lessonIndex].duration);
                    programMinutes += duration;
                }
            });
            
            //  Проверяем, нужно ли обновлять
            const oldProgress = enrollment.progress || 0;
            const oldCompletedCount = (enrollment.completedLessons || []).length;
            
            if (realProgress !== oldProgress || 
                validCompletedLessons.length !== oldCompletedCount) {
                console.log(`🔄 ${enrollment.slug}: прогресс ${oldProgress}% → ${realProgress}%, уроки: ${oldCompletedCount} → ${validCompletedLessons.length}`);
                needsUpdate = true;
            }
            
            //  Определяем статус
            let status = enrollment.status || 'paused';
            if (realProgress >= 100) {
                status = 'completed';
            } else if (status === 'active' && realProgress === 0) {
                // Активная, но нет прогресса — оставляем active
            }
            
            //  Формируем обновлённую запись
            const updatedEnrollment = {
                ...enrollment,
                progress: realProgress,
                completedLessons: validCompletedLessons,
                completedCount: validCompletedLessons.length,
                totalLessons: totalLessons,
                minutesSpent: programMinutes,
                status: status,
                lastUpdated: serverTimestamp()
            };
            
            updatedPrograms.push(updatedEnrollment);
            
            // Считаем общую статистику (только для активных/завершённых)
            if (status === 'active' || status === 'completed') {
                totalMinutesAll += programMinutes;
                totalLessonsAll += validCompletedLessons.length;
            }
            
        } catch (error) {
            console.error('❌ Ошибка пересчёта программы:', enrollment.slug, error);
            updatedPrograms.push(enrollment);
        }
    }
    
    //  Обновляем Firestore если были изменения
    if (needsUpdate) {
        try {
            const stats = userData.stats || {};
            
            await updateDoc(doc(db, 'users', currentUser.uid), {
                enrolledPrograms: updatedPrograms,
                'stats.totalMinutes': totalMinutesAll,
                'stats.totalLessons': totalLessonsAll,
                'stats.progress': calculateOverallProgress(updatedPrograms),
                updatedAt: serverTimestamp()
            });
            
            console.log('✅ Прогресс пересчитан и сохранён');
            
            return {
                ...userData,
                enrolledPrograms: updatedPrograms,
                stats: {
                    ...stats,
                    totalMinutes: totalMinutesAll,
                    totalLessons: totalLessonsAll,
                    progress: calculateOverallProgress(updatedPrograms)
                }
            };
        } catch (error) {
            console.error('❌ Ошибка сохранения пересчёта:', error);
        }
    }
    
    // Если не было изменений, всё равно возвращаем актуальные данные
    return {
        ...userData,
        enrolledPrograms: updatedPrograms,
        stats: {
            ...(userData.stats || {}),
            totalMinutes: totalMinutesAll,
            totalLessons: totalLessonsAll,
            progress: calculateOverallProgress(updatedPrograms)
        }
    };
}

//  ВЫЧИСЛЕНИЕ ОБЩЕГО ПРОГРЕССА

function calculateOverallProgress(userData) {
 
    if (!userData) {
        console.warn('⚠️ userData не передан в calculateOverallProgress');
        return 0;
    }
    
    const enrolledPrograms = userData.enrolledPrograms || [];
    
    if (!Array.isArray(enrolledPrograms)) {
        console.warn('⚠️ enrolledPrograms не является массивом:', enrolledPrograms);
        return 0;
    }
    
    if (enrolledPrograms.length === 0) return 0;
    
    const activePrograms = enrolledPrograms.filter(p => p.status === 'active');
    const programsToCount = activePrograms.length > 0 ? activePrograms : enrolledPrograms;
    
    console.log('📊 Подсчёт общего прогресса:');
    console.log('  Всего программ:', enrolledPrograms.length);
    console.log('  Активных:', activePrograms.length);
    console.log('  Для подсчёта:', programsToCount.length);
    
    let totalProgress = 0;
    programsToCount.forEach((p, index) => {
        const progress = p.progress || 0;
        totalProgress += progress;
        console.log(`  ${index + 1}. ${p.title || p.slug}: ${progress}%`);
    });
    
    const averageProgress = Math.round(totalProgress / programsToCount.length);
    
    console.log('  Средний прогресс:', averageProgress + '%');
    
    return Math.min(averageProgress, 100);
}
// ============================================
// ОЧИСТКА НЕСУЩЕСТВУЮЩИХ ПРОГРАММ
// ============================================
async function cleanupEnrolledPrograms(userData) {
    const enrolledPrograms = userData.enrolledPrograms || [];
    
    if (enrolledPrograms.length === 0) {
        return userData;
    }
    
    console.log('🧹 Проверка программ на существование...');
    
    const validPrograms = [];
    let hasInvalid = false;
    
    for (const program of enrolledPrograms) {
        if (!program.slug) {
            console.warn('⚠️ Программа без slug, пропускаем:', program);
            hasInvalid = true;
            continue;
        }
        
        try {
            const q = query(
                collection(db, 'programs'),
                where('slug', '==', program.slug)
            );
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                validPrograms.push(program);
            } else {
                console.log('🗑️ Удаляю несуществующую программу:', program.slug);
                hasInvalid = true;
            }
        } catch (error) {
            console.error('❌ Ошибка проверки программы:', program.slug, error);
            validPrograms.push(program);
        }
    }
    
    if (hasInvalid && validPrograms.length !== enrolledPrograms.length) {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                enrolledPrograms: validPrograms,
                updatedAt: serverTimestamp()
            });
            console.log(`✅ Очищено программ: ${enrolledPrograms.length - validPrograms.length}`);
            
            return {
                ...userData,
                enrolledPrograms: validPrograms
            };
        } catch (error) {
            console.error('❌ Ошибка обновления:', error);
        }
    }
    
    return userData;
}

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
function updateUI(userData, user) {
    const name = userData.name || user.displayName || user.email?.split('@')[0] || 'Пользователь';
    
    if (document.getElementById('topUserName')) {
        document.getElementById('topUserName').textContent = name;
    }
    
    if (document.getElementById('welcomeName')) {
        document.getElementById('welcomeName').textContent = `Здравствуйте, ${name.split(' ')[0]}! 👋`;
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
        const date = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        document.getElementById('profileRegDate').textContent = date.toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    

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
    
    if (document.getElementById('profileExperience')) {
        const expLabels = {
            beginner: 'Новичок',
            intermediate: 'Средний',
            advanced: 'Продвинутый'
        };
        document.getElementById('profileExperience').textContent = expLabels[userData.experience] || 'Не указан';
    }
    
    if (document.getElementById('userAvatar')) {
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
    }
    
    const stats = userData.stats || {};
    
    if (document.getElementById('statLessons')) {
        document.getElementById('statLessons').textContent = stats.totalLessons || 0;
    }
    if (document.getElementById('statFlexibility')) {
        document.getElementById('statFlexibility').textContent = (stats.progress || 0) + '%';
    }
    if (document.getElementById('statMinutes')) {
        document.getElementById('statMinutes').textContent = stats.totalMinutes || 0;
    }
    if (document.getElementById('statStreak')) {
        document.getElementById('statStreak').textContent = stats.streak || 0;
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('userStats', JSON.stringify(stats));
}
// ЗАГРУЗКА АКТИВНОЙ ПРОГРАММЫ
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
    
    //  ИЩЕМ активную программу
    const activeEnrollment = enrolledPrograms.find(p => p.status === 'active') 
        || enrolledPrograms.find(p => p.status === 'completed');
    
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
            console.warn('⚠️ Программа не найдена по slug:', activeEnrollment.slug);
            currentProgramData = null;
            
            if (noProgramEl) {
                noProgramEl.style.display = 'block';
                const titleEl = noProgramEl.querySelector('.program-name');
                const descEl = noProgramEl.querySelector('.program-desc');
                
                if (titleEl) {
                    titleEl.textContent = `Программа "${activeEnrollment.title || activeEnrollment.slug}" недоступна`;
                }
                if (descEl) {
                    descEl.textContent = 'Возможно, она была удалена или временно недоступна. Выберите другую программу из каталога.';
                }
            }
            
            Swal.fire({
                icon: 'warning',
                title: 'Программа недоступна',
                html: `
                    <p>Программа "<strong>${activeEnrollment.title || activeEnrollment.slug}</strong>" не найдена.</p>
                    <p style="color: #7f8c8d; font-size: 13px; margin-top: 10px;">
                        Возможно, она была удалена тренером или временно недоступна.
                    </p>
                `,
                confirmButtonText: 'Выбрать другую программу',
                confirmButtonColor: '#6198FF',
                showCancelButton: true,
                cancelButtonText: 'Позже'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = 'my_programs.html';
                }
            });
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки программы:', error);
        if (noProgramEl) noProgramEl.style.display = 'block';
    }
}

// РЕНДЕР АКТИВНОЙ ПРОГРАММЫ
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
    
    // ПРАВИЛЬНЫЙ РАСЧЁТ ПРОГРЕССА
    const totalLessons = program.videosCount || program.lessons?.length || 0;
    const completedLessons = (enrollment.completedLessons || []).filter(
        idx => typeof idx === 'number' && idx >= 0 && idx < totalLessons
    );
    const completedCount = completedLessons.length;
    
    // Прогресс = завершённые / всего * 100
    const progress = totalLessons > 0 
        ? Math.round((completedCount / totalLessons) * 100) 
        : 0;
    
    console.log(`📊 Прогресс программы "${program.title}":`);
    console.log(`   Всего уроков: ${totalLessons}`);
    console.log(`   Завершено: ${completedCount}`);
    console.log(`   Прогресс: ${progress}%`);
    
    const progressValue = document.getElementById('activeProgramProgress');
    const progressFill = document.getElementById('activeProgramFill');
    const completedEl = document.getElementById('activeCompletedLessons');
    const totalEl = document.getElementById('activeTotalLessons');
    const timeEl = document.getElementById('activeTimePerDay');
    
    if (progressValue) progressValue.textContent = progress + '%';
    if (progressFill) progressFill.style.width = progress + '%';
    if (completedEl) completedEl.textContent = completedCount;
    if (totalEl) totalEl.textContent = totalLessons;
    if (timeEl) timeEl.textContent = program.timePerDay || '';
    
    // Обновляем дашборд
    updateDashboardStatsForProgram(enrollment, program, progress, completedCount);
    
    const btnContinue = document.getElementById('btnContinue');
    if (btnContinue) {
        if (progress >= 100) {
            btnContinue.innerHTML = '<i class="fas fa-check-circle"></i> Программа завершена!';
            btnContinue.style.background = '#27ae60';
        } else {
            btnContinue.innerHTML = '<i class="fas fa-play"></i> Продолжить';
            btnContinue.style.background = '#6198FF';
        }
        btnContinue.onclick = function() { openLessonsPage(); };
    }
    
    console.log('✅ Программа отрисована, прогресс:', progress + '%');
}

// ОБНОВЛЕНИЕ СТАТИСТИКИ ДАШБОРДА
function updateDashboardStatsForProgram(enrollment, program, progress, completedCount) {
    //  Статистика на дашборде = статистика активной программы
    const progressEl = document.getElementById('statFlexibility');
    if (progressEl) {
        progressEl.textContent = progress + '%';
    }
    
    const lessonsEl = document.getElementById('statLessons');
    if (lessonsEl) {
        lessonsEl.textContent = completedCount;
    }
    
    //  Считаем минуты активной программы
    let programMinutes = 0;
    const lessons = program.lessons || [];
    const completedLessons = (enrollment.completedLessons || []).filter(
        idx => typeof idx === 'number' && idx >= 0 && idx < lessons.length
    );
    
    completedLessons.forEach(lessonIndex => {
        if (lessons[lessonIndex]) {
            programMinutes += parseDuration(lessons[lessonIndex].duration);
        }
    });
    
    const minutesEl = document.getElementById('statMinutes');
    if (minutesEl) {
        minutesEl.textContent = programMinutes;
    }
    
    console.log('📊 Статистика обновлена:', program.title, '| Прогресс:', progress + '%', '| Минуты:', programMinutes);
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getLevelLabel(level) {
    const labels = {
        beginner: 'Новичок',
        intermediate: 'Средний',
        advanced: 'Продвинутый'
    };
    return labels[level] || 'Средний';
}

function parseDuration(durationStr) {
    if (!durationStr) return 20;
    
    // Парсим форматы: "20 мин", "1:30", "90"
    if (typeof durationStr === 'number') return durationStr;
    
    const str = String(durationStr).trim();
    
    // Формат "1:30" (часы:минуты)
    const timeMatch = str.match(/(\d+):(\d+)/);
    if (timeMatch) {
        return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
    }
    
    // Формат "20 мин" или просто "20"
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
        return parseInt(numMatch[1]);
    }
    
    return 20; // По умолчанию
}

// ОТКРЫТЬ СТРАНИЦУ УРОКОВ
window.openLessonsPage = function() {
    const programSlug = currentProgramData?.slug;
    
    if (!programSlug) {
        Swal.fire('Ошибка', 'Активная программа не найдена', 'error');
        return;
    }
    
    window.location.href = `lessons.html?slug=${encodeURIComponent(programSlug)}`;
}

// СМЕНИТЬ ПРОГРАММУ
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

//  ПОКАЗАТЬ ВСЕ ПРОГРАММЫ
function showAllProgramsModal(enrolledPrograms) {
    const activeProgram = enrolledPrograms.find(p => p.status === 'active');
    
    const programsList = enrolledPrograms.map(p => {
        const isActive = p.slug === activeProgram?.slug;
        const progress = p.progress || 0;
        const completedCount = p.completedCount || (p.completedLessons || []).length;
        const totalLessons = p.totalLessons || 0;
        
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
                        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${p.title || p.slug}</h4>
                        <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                            Прогресс: <strong>${progress}%</strong> • 
                            ${completedCount} из ${totalLessons} уроков •
                            ${p.minutesSpent || 0} мин
                        </p>
                        
                        <!-- 🔥 ПОЛОСКА ПРОГРЕССА -->
                        <div style="
                            width: 100%;
                            height: 6px;
                            background: #e1e8ed;
                            border-radius: 3px;
                            margin-top: 8px;
                            overflow: hidden;
                        ">
                            <div style="
                                width: ${progress}%;
                                height: 100%;
                                background: ${progress >= 100 ? '#27ae60' : '#6198FF'};
                                border-radius: 3px;
                                transition: width 0.3s ease;
                            "></div>
                        </div>
                        
                        ${isActive ? 
                            '<span style="color: #6198FF; font-size: 12px; margin-top: 5px; display: block;"><i class="fas fa-check-circle"></i> Активная</span>' : 
                            progress >= 100 ?
                            '<span style="color: #27ae60; font-size: 12px; margin-top: 5px; display: block;"><i class="fas fa-trophy"></i> Завершена</span>' :
                            '<span style="color: #95a5a6; font-size: 12px; margin-top: 5px; display: block;"><i class="fas fa-pause-circle"></i> Приостановлена</span>'
                        }
                    </div>
                    
                    ${!isActive ? `
                        <button onclick="deleteProgram('${p.slug}', '${(p.title || p.slug).replace(/'/g, "\\'")}')" style="
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
                        background: ${progress >= 100 ? '#27ae60' : '#6198FF'};
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fas fa-${progress >= 100 ? 'trophy' : 'play'}"></i> 
                        ${progress >= 100 ? 'Программа завершена' : 'Продолжить'}
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

//  УДАЛЕНИЕ ПРОГРАММЫ
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

async function confirmDeleteProgram(slug) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        if (!userData.enrolledPrograms || !Array.isArray(userData.enrolledPrograms)) {
            console.error('❌ enrolledPrograms не найден или не массив');
            Swal.fire('Ошибка', 'Данные программ повреждены', 'error');
            return;
        }
        
        // Находим удаляемую программу
        const programToDelete = userData.enrolledPrograms.find(p => p.slug === slug);
        
        if (!programToDelete) {
            Swal.fire('Ошибка', 'Программа не найдена', 'error');
            return;
        }
        
        const minutesToRemove = programToDelete.minutesSpent || 0;
        const lessonsToRemove = (programToDelete.completedLessons || []).length;
        
        console.log('🗑️ Удаление программы:', programToDelete.title);
        console.log('  Уроков:', lessonsToRemove);
        console.log('  Минут:', minutesToRemove);
        
        const enrolledPrograms = userData.enrolledPrograms.filter(p => p.slug !== slug);
        
        let activityLog = userData.activityLog || [];
        const originalLogCount = activityLog.length;
        
        // Фильтруем activityLog — убираем записи о этой программе
        activityLog = activityLog.filter(log => {
            return log.programSlug !== slug && log.programTitle !== programToDelete.title;
        });
        
        const removedLogCount = originalLogCount - activityLog.length;
        console.log(`🗑️ Удалено записей из activityLog: ${removedLogCount}`);
        
        let newTotalMinutes = 0;
        let newTotalLessons = 0;
        
        for (const enrollment of enrolledPrograms) {
            newTotalMinutes += enrollment.minutesSpent || 0;
            newTotalLessons += (enrollment.completedLessons || []).length;
        }
        
        // Также считаем из activityLog для точности
        const logMinutes = activityLog.reduce((sum, log) => sum + (log.minutesWatched || 0), 0);
        const logLessons = activityLog.reduce((sum, log) => sum + (log.lessonsCompleted || 0), 0);
        
        // Используем максимум из двух источников
        newTotalMinutes = Math.max(newTotalMinutes, logMinutes);
        newTotalLessons = Math.max(newTotalLessons, logLessons);
        
        //  Пересчитываем общий прогресс
        const newOverallProgress = calculateOverallProgress({
            enrolledPrograms: enrolledPrograms
        });
        
        console.log('📊 Новая статистика:');
        console.log('  Минут:', newTotalMinutes);
        console.log('  Уроков:', newTotalLessons);
        console.log('  Прогресс:', newOverallProgress + '%');
        console.log('  Записей в activityLog:', activityLog.length);
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            activityLog: activityLog,  // Сохраняем обновлённый журнал
            'stats.totalMinutes': newTotalMinutes,
            'stats.totalLessons': newTotalLessons,
            'stats.progress': newOverallProgress,
            updatedAt: serverTimestamp()
        });
        
        Swal.fire({
            icon: 'success',
            title: 'Программа удалена',
            html: `
                <p>Удалено ${lessonsToRemove} уроков (${minutesToRemove} мин)</p>
                ${removedLogCount > 0 ? 
                    `<p style="font-size: 13px; color: #7f8c8d; margin-top: 10px;">
                        Также удалено ${removedLogCount} записей из журнала активности
                    </p>` : ''
                }
            `,
            timer: 2500,
            showConfirmButton: false
        }).then(() => {
            window.location.reload();  // Перезагружаем для обновления графиков
        });
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        Swal.fire('Ошибка', 'Не удалось удалить программу: ' + error.message, 'error');
    }
}
// ПЕРЕКЛЮЧЕНИЕ ПРОГРАММЫ
window.switchToProgram = async function(slug) {
    console.log('🔄 Переключение на программу:', slug);
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        const enrolledPrograms = userData.enrolledPrograms?.map(p => ({
            ...p,
            status: p.slug === slug ? 'active' : (p.progress >= 100 ? 'completed' : 'paused')
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

// РЕДАКТИРОВАНИЕ ПРОФИЛЯ
window.editProfile = function() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    const name = document.getElementById('profileName')?.textContent || '';
    const phone = document.getElementById('profilePhone')?.textContent || '';
    const goal = document.getElementById('profileGoal')?.textContent || '';
    
    document.getElementById('editName').value = name;
    document.getElementById('editPhone').value = phone;
    
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

// ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
window.closeModal = function() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// СОХРАНЕНИЕ ПРОФИЛЯ
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
            
            document.getElementById('profileName').textContent = name;
            document.getElementById('topUserName').textContent = name;
            document.getElementById('welcomeName').textContent = `С возвращением, ${name.split(' ')[0]}! 👋`;
            
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

// ВЫХОД
window.logout = function() {
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
};

// ЗАГРУЗКА НЕПРОЧИТАННЫХ СООБЩЕНИЙ
async function loadUnreadMessagesCount() {
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
        
        console.log('📧 Непрочитанных сообщений:', count);
    } catch (error) {
        console.error('❌ Ошибка загрузки сообщений:', error);
    }
}

// Закрытие модального окна по клику вне его
document.addEventListener('click', function(e) {
    const modal = document.getElementById('editProfileModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

console.log('🚀 Dashboard загружен');