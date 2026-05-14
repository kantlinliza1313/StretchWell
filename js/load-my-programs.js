// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// Глобальные переменные
let allPrograms = [];
let currentUser = null;

// === ЗАГРУЗКА ПРОГРАММ ИЗ FIREBASE ===
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
        document.getElementById('programsGrid').innerHTML = '<p>Не удалось загрузить программы</p>';
    }
}

// === РЕНДЕР КАРТОЧЕК ПРОГРАММ ===
function renderPrograms(programs) {
    const grid = document.getElementById('programsGrid');
    const noResults = document.getElementById('noResults');
    
    if (programs.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'flex';
        return;
    }
    
    noResults.style.display = 'none';
    
    grid.innerHTML = programs.map(program => {
        const levelLabels = {
            beginner: 'Новичок',
            intermediate: 'Средний',
            advanced: 'Продвинутый'
        };
        
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
                        <span class="tag"><i class="fas fa-clock"></i> ${program.timePerDay}</span>
                        <span class="tag"><i class="fas fa-calendar"></i> ${program.duration}</span>
                    </div>
                    <h3 class="program-card-title">${program.title}</h3>
                    <p class="program-card-desc">${program.shortDescription}</p>
                    <div class="program-card-meta">
                        <span><i class="fas fa-video"></i> ${program.videosCount} уроков</span>
                        <span><i class="fas fa-star"></i> ${program.rating || '4.5'} (${program.reviewsCount || 0})</span>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="window.enrollProgram('${program.slug}', '${program.title}')">
                        <i class="fas fa-plus-circle"></i> Выбрать программу
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// === ФИЛЬТРАЦИЯ ===
window.applyFilters = function() {
    const level = document.getElementById('levelFilter').value;
    const goal = document.getElementById('goalFilter').value;
    const duration = document.getElementById('durationFilter').value;
    
    let filtered = [...allPrograms];
    
    if (level !== 'all') {
        filtered = filtered.filter(p => p.level === level);
    }
    if (goal !== 'all') {
        filtered = filtered.filter(p => p.goal === goal);
    }
    if (duration !== 'all') {
        filtered = filtered.filter(p => p.durations === duration);
    }
    
    renderPrograms(filtered);
}

// === СБРОС ФИЛЬТРОВ ===
window.resetFilters = function() {
    document.getElementById('levelFilter').value = 'all';
    document.getElementById('goalFilter').value = 'all';
    document.getElementById('durationFilter').value = 'all';
    renderPrograms(allPrograms);
}

// === ЗАПИСЬ НА ПРОГРАММУ ===
window.enrollProgram = async function(slug, title) {
    console.log('📝 Запись на программу:', slug, title);
    
    const user = auth.currentUser;
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Войдите в аккаунт',
            text: 'Чтобы записаться на программу, необходимо авторизоваться',
            confirmButtonColor: '#6198FF',
            confirmButtonText: 'Войти'
        }).then(() => {
            window.location.href = 'login.html';
        });
        return;
    }
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            console.error('❌ Документ пользователя не найден!');
            Swal.fire({
                icon: 'error',
                title: 'Ошибка',
                text: 'Пользователь не найден в базе'
            });
            return;
        }
        
        const userData = userDoc.data();
        const enrolledPrograms = userData.enrolledPrograms || [];
        
        // Проверяем не записан ли уже на эту программу
        const alreadyEnrolled = enrolledPrograms.find(p => p.slug === slug);
        if (alreadyEnrolled) {
            Swal.fire({
                icon: 'info',
                title: 'Вы уже записаны',
                text: `Вы уже записаны на программу "${alreadyEnrolled.title}"`,
                confirmButtonColor: '#6198FF'
            });
            return;
        }
        
        // Добавляем программу
        const newProgram = {
            slug: slug,
            title: title,
            enrolledAt: new Date().toISOString(),
            progress: 0,
            status: 'active',
            completedLessons: 0,
            lastAccessedAt: null
        };
        
        await updateDoc(userRef, {
            enrolledPrograms: [...enrolledPrograms, newProgram]
        });
        
        console.log('✅ Программа успешно добавлена!');
        
        Swal.fire({
            icon: 'success',
            title: 'Программа добавлена!',
            text: `"${title}" теперь доступна в вашем профиле`,
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Перенаправляем в профиль
            window.location.href = 'dashboard.html';
        });
        
    } catch (error) {
        console.error('❌ Ошибка записи на программу:', error);
        Swal.fire({
            icon: 'error',
            title: 'Ошибка',
            text: 'Не удалось записаться на программу: ' + error.message
        });
    }
}

// === КВИЗ: ПОДБОР ПРОГРАММЫ ===
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
    document.getElementById('quizModal').classList.add('active');
    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizQuestions').style.display = 'block';
    showQuestion();
}

function showQuestion() {
    const q = quizQuestions[currentQuestion];
    const container = document.getElementById('quizQuestions');
    
    const progress = ((currentQuestion) / quizQuestions.length) * 100;
    document.getElementById('quizProgress').style.width = progress + '%';
    document.getElementById('quizProgressText').textContent = `Вопрос ${currentQuestion + 1} из ${quizQuestions.length}`;
    
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
    document.getElementById('quizQuestions').style.display = 'none';
    document.getElementById('quizResult').style.display = 'block';
    document.getElementById('quizProgress').style.width = '100%';
    document.getElementById('quizProgressText').textContent = 'Готово!';
    
    // Ищем по всем параметрам (используем durations вместо duration)
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
        recommended = allPrograms.find(p => 
            p.goal === quizAnswers.goal
        );
    }
    
    if (!recommended) {
        recommended = allPrograms[Math.floor(Math.random() * allPrograms.length)];
    }
    
    if (recommended) {
        document.getElementById('resultProgram').innerHTML = `
            <div class="result-program-card">
                <img src="${recommended.image}" alt="${recommended.title}">
                <div class="result-program-info">
                    <h5>${recommended.title}</h5>
                    <p>${recommended.shortDescription}</p>
                    <div class="result-meta">
                        <span><i class="fas fa-clock"></i> ${recommended.timePerDay}</span>
                        <span><i class="fas fa-video"></i> ${recommended.videosCount} уроков</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('resultProgram').dataset.slug = recommended.slug;
        document.getElementById('resultProgram').dataset.title = recommended.title;
    }
}

window.enrollFromQuiz = function() {
    const container = document.getElementById('resultProgram');
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
    document.getElementById('quizModal').classList.remove('active');
}

// === ИНИЦИАЛИЗАЦИЯ ===
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        const userName = user.displayName || user.email?.split('@')[0] || 'Пользователь';
        if (document.getElementById('topUserName')) {
            document.getElementById('topUserName').textContent = userName;
        }
        if (document.getElementById('userAvatar')) {
            document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6198FF&color=fff`;
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadPrograms();
});