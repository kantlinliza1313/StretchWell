// Импорт Firebase
import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// === ЗАГРУЗКА ОТЗЫВОВ ===
export async function loadReviews() {
    const container = document.getElementById('reviewsGrid');
    if (!container) return; // Если нет контейнера — выходим
    
    try {
        const q = query(
            collection(db, 'reviews'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (reviews.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
                    <i class="fas fa-inbox" style="font-size: 48px; color: #d1d5db; margin-bottom: 20px;"></i>
                    <p style="color: #7f8c8d; font-size: 16px;">Пока нет отзывов. Будьте первым!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reviews.map(review => {
            const initial = review.userInitial || review.userName?.charAt(0) || 'П';
            const stars = '★'.repeat(review.rating || 5);
            
            return `
                <div class="review-card">
                    <p class="review-text">${review.text}</p>
                    <div class="review-footer">
                        <div class="review-avatar">${initial}</div>
                        <div class="review-name">${review.userName || 'Пользователь'}</div>
                    </div>
                    <div class="review-rating">
                        ${'<span class="star">★</span>'.repeat(review.rating || 5)}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Отзывы загружены:', reviews.length);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки отзывов:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #e74c3c; margin-bottom: 20px;"></i>
                <p style="color: #7f8c8d; font-size: 16px;">Не удалось загрузить отзывы</p>
            </div>
        `;
    }
}