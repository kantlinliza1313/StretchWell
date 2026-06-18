// dashboard-reviews.js
import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, query, where, orderBy, 
    updateDoc, deleteDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

let currentUser = null;
let userData = null;

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('✅ Пользователь авторизован:', user.email);
        
        // Обновляем имя в шапке
        const topUserName = document.getElementById('topUserName');
        if (topUserName) {
            topUserName.textContent = user.email?.split('@')[0] || 'Пользователь';
        }
        
        // Загружаем данные пользователя
        try {
            const { getDoc } = await import("https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js");
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                userData = userDoc.data();
                
                // Обновляем аватар
                const userAvatar = document.getElementById('userAvatar');
                if (userAvatar && userData.name) {
                    userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=6198FF&color=fff`;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных пользователя:', error);
        }
        
        // Загружаем программы для селекта
        loadUserPrograms();
        
        // Загружаем отзывы
        await loadMyReviews();
        await loadAllReviews();
        
    } else {
        console.log('❌ Пользователь не авторизован');
        window.location.href = 'login.html';
    }
});

// ============================================
// 🔹 ЗАГРУЗКА ПРОГРАММ ПОЛЬЗОВАТЕЛЯ
// ============================================
function loadUserPrograms() {
    const select = document.getElementById('reviewProgram');
    if (!select || !userData?.enrolledPrograms) return;
    
    const programs = userData.enrolledPrograms || [];
    
    programs.forEach(program => {
        const option = document.createElement('option');
        option.value = program.slug;
        option.textContent = program.title;
        select.appendChild(option);
    });
}

// ============================================
// 🔹 ОТПРАВКА ОТЗЫВА
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reviewForm');
    if (form) {
        form.addEventListener('submit', submitReview);
    }
});

async function submitReview(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Необходимо войти в систему');
        return;
    }
    
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) {
        alert('Пожалуйста, выберите оценку');
        return;
    }
    
    const rating = parseInt(ratingInput.value);
    const programSelect = document.getElementById('reviewProgram');
    const programSlug = programSelect ? programSelect.value : '';
    const programTitle = programSelect && programSelect.selectedIndex > 0 
        ? programSelect.options[programSelect.selectedIndex].text 
        : null;
    
    const textEl = document.getElementById('reviewText');
    const text = textEl ? textEl.value.trim() : '';
    
    if (text.length < 10) {
        alert('Отзыв должен содержать минимум 10 символов');
        return;
    }
    
    if (text.length > 500) {
        alert('Отзыв не должен превышать 500 символов');
        return;
    }
    
    try {
        const reviewData = {
            userId: currentUser.uid,
            userName: userData?.name || currentUser.email?.split('@')[0] || 'Пользователь',
            userEmail: currentUser.email,
            userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.name || 'User')}&background=6198FF&color=fff`,
            rating: rating,
            text: text,
            programSlug: programSlug || null,
            programTitle: programSlug ? programTitle : null,
            likes: 0,
            likedBy: [],
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'reviews'), reviewData);
        
        console.log('✅ Отзыв добавлен');
        
        // Сбрасываем форму
        document.getElementById('reviewForm').reset();
        
        // Перезагружаем отзывы
        await loadMyReviews();
        await loadAllReviews();
        
        // Уведомление
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Спасибо за ваш отзыв!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            alert('Спасибо за ваш отзыв!');
        }
        
    } catch (error) {
        console.error('❌ Ошибка добавления отзыва:', error);
        alert('Не удалось добавить отзыв: ' + error.message);
    }
}

// ============================================
//  ЗАГРУЗКА МОИХ ОТЗЫВОВ
// ============================================
async function loadMyReviews() {
    if (!currentUser) return;
    
    const container = document.getElementById('myReviewsList');
    if (!container) return;
    
    try {
        const q = query(
            collection(db, 'reviews'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-comment-dots" style="font-size: 48px; color: #e1e8ed; margin-bottom: 15px;"></i>
                    <p>Вы ещё не оставили ни одного отзыва</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reviews.map(review => renderReviewCard(review, true)).join('');
        
    } catch (error) {
        console.error(' Ошибка загрузки моих отзывов:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Ошибка загрузки</p>';
    }
}

// ============================================
// 🔹 ЗАГРУЗКА ВСЕХ ОТЗЫВОВ
// ============================================
async function loadAllReviews() {
    const container = document.getElementById('allReviewsList');
    if (!container) return;
    
    try {
        const q = query(
            collection(db, 'reviews'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <i class="fas fa-comment-dots" style="font-size: 48px; color: #e1e8ed; margin-bottom: 15px;"></i>
                    <p>Пока нет отзывов. Будьте первым!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reviews.map(review => renderReviewCard(review, false)).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки всех отзывов:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Ошибка загрузки</p>';
    }
}

// ============================================
// 🔹 РЕНДЕР КАРТОЧКИ ОТЗЫВА
// ============================================
function renderReviewCard(review, isOwn) {
    const date = review.createdAt?.toDate ? review.createdAt.toDate() : new Date(review.createdAt);
    const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const avatar = review.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName)}&background=6198FF&color=fff`;
    
    return `
        <div class="review-card" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); ${isOwn ? 'border-left: 3px solid #43e97b;' : 'border-left: 3px solid #6198FF;'}">
            <p style="font-size: 15px; line-height: 1.6; color: #2c3e50; margin-bottom: 15px;">${review.text}</p>
            
            ${review.programTitle ? `
                <div style="display: inline-block; padding: 5px 12px; background: #f0f7ff; border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: #6198FF;">
                    <i class="fas fa-dumbbell"></i> ${review.programTitle}
                </div>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #f0f0f0;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${avatar}" alt="${review.userName}" style="width: 40px; height: 40px; border-radius: 50%;"
                         onerror="this.src='https://ui-avatars.com/api/?name=U&background=6198FF&color=fff'">
                    <div>
                        <div style="font-weight: 600; color: #2c3e50;">
                            ${review.userName}
                            ${isOwn ? '<span style="display: inline-block; padding: 2px 8px; background: #43e97b; color: white; border-radius: 12px; font-size: 11px; margin-left: 8px;">Мой отзыв</span>' : ''}
                        </div>
                        <div style="font-size: 13px; color: #95a5a6;">${dateStr}</div>
                    </div>
                </div>
                <div style="color: #f39c12; font-size: 16px; letter-spacing: 2px;">
                    ${stars}
                </div>
            </div>
            
            ${isOwn ? `
                <button onclick="window.deleteMyReview('${review.id}')" style="margin-top: 10px; padding: 6px 12px; background: #fee; border: none; border-radius: 6px; color: #e74c3c; cursor: pointer; font-size: 13px;">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            ` : ''}
        </div>
    `;
}

// ============================================
// 🔹 УДАЛЕНИЕ СВОЕГО ОТЗЫВА
// ============================================
window.deleteMyReview = async function(reviewId) {
    if (!confirm('Вы уверены, что хотите удалить отзыв?')) return;
    
    try {
        await deleteDoc(doc(db, 'reviews', reviewId));
        
        console.log('✅ Отзыв удалён');
        
        await loadMyReviews();
        await loadAllReviews();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Отзыв удалён',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            alert('Отзыв удалён');
        }
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        alert('Не удалось удалить отзыв');
    }
}

console.log('📝 Dashboard Reviews.js загружен');