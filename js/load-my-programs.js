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

// Глобальные переменные
let allPrograms = [];
let currentUser = null;

// ============================================
// 🔹 ЗАГРУЗКА ПРОГРАММ ИЗ FIREBASE
// ============================================
export async function loadPrograms() {
    try {
        const q = query(
            collection(db, 'programs'),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        allPrograms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log('✅ Программы загружены:', allPrograms.length);
        renderPrograms(allPrograms);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки программ:', error);
        const grid = document.getElementById('programsGrid');
        if (grid) grid.innerHTML = '<p style="text-align:center;color:#e74c3c;">Не удалось загрузить программы</p>';
    }
}

// ============================================
// 🔹 РЕНДЕР КАРТОЧЕК ПРОГРАММ
// ============================================
function renderPrograms(programs) {
    const grid = document.getElementById('programsGrid');
    const noResults = document.getElementById('noResults');
    
    if (!grid) return;
    
    if (programs.length === 0) {
        grid.innerHTML = '';
        if (noResults) noResults.style.display = 'flex';
        return;
    }
    
    if (noResults) noResults.style.display = 'none';
    
    grid.innerHTML = programs.map(program => {
        const levelLabels = {
            beginner: 'Новичок',
            intermediate: 'Средний',
            advanced: 'Продвинутый'
        };
        
        // 🔥 Получаем данные тренера
        const trainerName = program.trainerName || '';
        const hasTrainer = program.trainerId && trainerName;
        
        return `
            <div class="program-card" 
                 data-level="${program.level || 'beginner'}" 
                 data-goal="${program.goal || 'flexibility'}" 
                 data-duration="${program.durations || 'medium'}">
                <div class="program-card-image">
                    <img src="${program.image}" alt="${program.title}">
                    <div class="program-card-overlay">
                        <span class="program-level ${program.level || 'beginner'}">${levelLabels[program.level] || 'Новичок'}</span>
                    </div>
                </div>
                <div class="program-card-content">
                    <div class="program-tags">
                        <span class="tag"><i class="fas fa-clock"></i> ${program.timePerDay || '15-20 мин'}</span>
                        <span class="tag"><i class="fas fa-calendar"></i> ${program.duration || '2 недели'}</span>
                    </div>
                    <h3 class="program-card-title">${escapeHtml(program.title)}</h3>
                    <p class="program-card-desc">${escapeHtml(program.shortDescription || '')}</p>
                    
                    <!-- 🔥 ИНФОРМАЦИЯ О ТРЕНЕРЕ -->
                    ${hasTrainer ? `
                        <div class="program-trainer">
                            <i class="fas fa-user-tie"></i>
                            <span>Тренер: ${escapeHtml(trainerName)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="program-card-meta">
                        <span><i class="fas fa-video"></i> ${program.videosCount || 0} уроков</span>
                        <span><i class="fas fa-star"></i> ${program.rating || '4.5'} (${program.reviewsCount || 0})</span>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="window.enrollProgram('${program.slug}', '${escapeHtml(program.title).replace(/'/g, "\\'")}')">
                        <i class="fas fa-plus-circle"></i> Выбрать программу
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Функция экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================
// 🔹 ФИЛЬТРАЦИЯ
// ============================================
window.applyFilters = function() {
    const level = document.getElementById('levelFilter')?.value || 'all';
    const goal = document.getElementById('goalFilter')?.value || 'all';
    const duration = document.getElementById('durationFilter')?.value || 'all';
    
    let filtered = [...allPrograms];
    
    if (level !== 'all') filtered = filtered.filter(p => p.level === level);
    if (goal !== 'all') filtered = filtered.filter(p => p.goal === goal);
    if (duration !== 'all') filtered = filtered.filter(p => p.durations === duration);
    
    renderPrograms(filtered);
}

// === СБРОС ФИЛЬТРОВ ===
window.resetFilters = function() {
    const levelEl = document.getElementById('levelFilter');
    const goalEl = document.getElementById('goalFilter');
    const durationEl = document.getElementById('durationFilter');
    
    if (levelEl) levelEl.value = 'all';
    if (goalEl) goalEl.value = 'all';
    if (durationEl) durationEl.value = 'all';
    
    renderPrograms(allPrograms);
}

// ============================================
// 🔹 ЗАПИСЬ НА ПРОГРАММУ (с сохранением тренера)
// ============================================
window.enrollProgram = async function(slug, title) {
    console.log('📝 Запись на программу:', slug, title);
    
    const user = auth.currentUser;
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Войдите в аккаунт',
            text: 'Чтобы записаться на программу, необходимо авторизоваться',
            confirmButtonColor: '#6198FF'
        }).then(() => window.location.href = 'login.html');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            Swal.fire('Ошибка', 'Пользователь не найден', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const enrolledPrograms = userData.enrolledPrograms || [];
        
        // Проверка: уже записан?
        if (enrolledPrograms.find(p => p.slug === slug)) {
            Swal.fire('Инфо', 'Вы уже записаны на эту программу', 'info');
            return;
        }
        
        // Загружаем данные программы
        const programQuery = query(collection(db, 'programs'), where('slug', '==', slug));
        const programSnap = await getDocs(programQuery);
        let programData = null;
        if (!programSnap.empty) {
            programData = programSnap.docs[0].data();
        }
        
        // 🔥 Получаем данные тренера из программы
        const trainerId = programData?.trainerId || null;
        const trainerName = programData?.trainerName || 'Тренер';
        
        // ✅ Генерация расписания
        const schedule = generateProgramSchedule(programData);
        
        const newProgram = {
            slug: slug,
            title: title,
            trainerId: trainerId,        // 🔥 ID тренера
            trainerName: trainerName,    // 🔥 Имя тренера
            enrolledAt: new Date().toISOString(),
            progress: 0,
            status: 'active',
            completedLessons: [],
            schedule: schedule,
            lastAccessedAt: null
        };
        
        await updateDoc(userRef, {
            enrolledPrograms: [...enrolledPrograms, newProgram],
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Программа добавлена с тренером:', trainerName);
        
        Swal.fire({
            icon: 'success',
            title: 'Программа добавлена!',
            html: `"${escapeHtml(title)}"<br>Тренер: <strong>${escapeHtml(trainerName)}</strong>`,
            timer: 2500,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'dashboard.html';
        });
        
    } catch (error) {
        console.error('❌ Ошибка записи:', error);
        Swal.fire('Ошибка', 'Не удалось записаться: ' + error.message, 'error');
    }
}

// ✅ Генерация расписания (каждый день подряд)
function generateProgramSchedule(program) {
    if (!program || !program.lessons || program.lessons.length === 0) return [];
    
    const schedule = [];
    const lessons = program.lessons;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        schedule.push({
            lessonIndex: i,
            date: currentDate.toISOString().split('T')[0],
            time: '10:00',
            completed: false,
            unlocked: i === 0,
            lessonTitle: lesson.title || lesson.dayTitle || `День ${i + 1}`,
            duration: lesson.duration || '20 мин',
            videoUrl: lesson.videoUrl || '',
            dayNumber: i + 1
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return schedule;
}

// ============================================
// 🔹 КВИЗ: ПОДБОР ПРОГРАММЫ
// ============================================
const quizQuestions = [
    {
        question: 'Какой у вас уровень подготовки?',
        options: [
            { text: 'Новичок, никогда не занимался', value: 'beginner' },
            { text: 'Есть небольшой опыт', value: 'intermediate' },
            { text: 'Занимаюсь регулярно', value: 'advanced' }
        ],
        key: 'level'
    },
    {
        question: 'Какая у вас основная цель?',
        options: [
            { text: 'Развить гибкость', value: 'flexibility' },
            { text: 'Укрепить мышцы', value: 'strength' },
            { text: 'Снять стресс и расслабиться', value: 'relax' },
            { text: 'Восстановиться после тренировок', value: 'recovery' }
        ],
        key: 'goal'
    },
    {
        question: 'Сколько времени готовы уделять?',
        options: [
            { text: 'До 15 минут в день', value: 'short' },
            { text: '15-30 минут в день', value: 'medium' },
            { text: '30+ минут в день', value: 'long' }
        ],
        key: 'duration'
    }
];

let quizAnswers = {};
let currentQuestion = 0;

window.startQuiz = function() {
    quizAnswers = {};
    currentQuestion = 0;
    const modal = document.getElementById('quizModal');
    const result = document.getElementById('quizResult');
    const questions = document.getElementById('quizQuestions');
    
    if (modal) modal.classList.add('active');
    if (result) result.style.display = 'none';
    if (questions) questions.style.display = 'block';
    showQuestion();
}

function showQuestion() {
    const q = quizQuestions[currentQuestion];
    const container = document.getElementById('quizQuestions');
    if (!container) return;
    
    const progress = ((currentQuestion) / quizQuestions.length) * 100;
    const progressEl = document.getElementById('quizProgress');
    const textEl = document.getElementById('quizProgressText');
    
    if (progressEl) progressEl.style.width = progress + '%';
    if (textEl) textEl.textContent = `Вопрос ${currentQuestion + 1} из ${quizQuestions.length}`;
    
    container.innerHTML = `
        <h4>${q.question}</h4>
        <div class="quiz-options">
            ${q.options.map(opt => `
                <button class="quiz-option" onclick="selectAnswer('${q.key}', '${opt.value}')">
                    ${opt.text}
                </button>
            `).join('')}
        </div>
    `;
}

window.selectAnswer = function(key, value) {
    quizAnswers[key] = value;
    currentQuestion++;
    
    if (currentQuestion < quizQuestions.length) {
        showQuestion();
    } else {
        showResult();
    }
}

function showResult() {
    const questions = document.getElementById('quizQuestions');
    const result = document.getElementById('quizResult');
    const progressEl = document.getElementById('quizProgress');
    const textEl = document.getElementById('quizProgressText');
    
    if (questions) questions.style.display = 'none';
    if (result) result.style.display = 'block';
    if (progressEl) progressEl.style.width = '100%';
    if (textEl) textEl.textContent = 'Готово!';
    
    let recommended = allPrograms.find(p => 
        p.level === quizAnswers.level && 
        p.goal === quizAnswers.goal && 
        p.durations === quizAnswers.duration
    );
    
    if (!recommended) {
        recommended = allPrograms.find(p => 
            p.level === quizAnswers.level && 
            p.goal === quizAnswers.goal
        );
    }
    
    if (!recommended) {
        recommended = allPrograms.find(p => p.goal === quizAnswers.goal);
    }
    
    if (!recommended && allPrograms.length > 0) {
        recommended = allPrograms[Math.floor(Math.random() * allPrograms.length)];
    }
    
    if (recommended) {
        const resultContainer = document.getElementById('resultProgram');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="result-program-card">
                    <img src="${recommended.image}" alt="${escapeHtml(recommended.title)}">
                    <div class="result-program-info">
                        <h5>${escapeHtml(recommended.title)}</h5>
                        <p>${escapeHtml(recommended.shortDescription || '')}</p>
                        ${recommended.trainerName ? `
                            <p style="margin-top: 8px; color: #6198FF; font-weight: 600;">
                                <i class="fas fa-user-tie"></i> Тренер: ${escapeHtml(recommended.trainerName)}
                            </p>
                        ` : ''}
                        <div class="result-meta">
                            <span><i class="fas fa-clock"></i> ${recommended.timePerDay || '15-20 мин'}</span>
                            <span><i class="fas fa-video"></i> ${recommended.videosCount || 0} уроков</span>
                        </div>
                    </div>
                </div>
            `;
            resultContainer.dataset.slug = recommended.slug;
            resultContainer.dataset.title = recommended.title;
        }
    }
}

window.enrollFromQuiz = function() {
    const container = document.getElementById('resultProgram');
    if (!container) return;
    const slug = container.dataset.slug;
    const title = container.dataset.title;
    
    if (slug && title) {
        window.enrollProgram(slug, title);
        closeQuiz();
    }
}

window.showAllPrograms = function() {
    closeQuiz();
    resetFilters();
}

window.closeQuiz = function() {
    const modal = document.getElementById('quizModal');
    if (modal) modal.classList.remove('active');
}

// ============================================
// 🔹 ИНИЦИАЛИЗАЦИЯ
// ============================================
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        const userName = user.displayName || user.email?.split('@')[0] || 'Пользователь';
        const nameEl = document.getElementById('topUserName');
        const avatarEl = document.getElementById('userAvatar');
        
        if (nameEl) nameEl.textContent = userName;
        if (avatarEl) {
            avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6198FF&color=fff`;
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadPrograms();
});

console.log('📋 load-my-programs.js загружен');