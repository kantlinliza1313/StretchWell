// load-reviews.js - простой просмотр отзывов
import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

export async function loadReviews() {
    const container = document.getElementById('reviewsGrid');
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
                <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
                    <i class="fas fa-inbox" style="font-size: 48px; color: #d1d5db; margin-bottom: 20px;"></i>
                    <p style="color: #7f8c8d; font-size: 16px;">Пока нет отзывов</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = reviews.map(review => {
            const initial = review.userName?.charAt(0) || 'П';
            const date = review.createdAt?.toDate ? review.createdAt.toDate() : new Date(review.createdAt);
            const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            
            return `
                <div class="review-card" style="background: white; border-radius: 15px; padding: 25px; margin-bottom: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.08);">
                    <p style="font-size: 15px; line-height: 1.6; color: #2c3e50; margin-bottom: 15px;">${review.text}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #e1e8ed;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, #6198FF 0%, #8DA4CE 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                ${initial}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: #2c3e50;">${review.userName || 'Пользователь'}</div>
                                <div style="font-size: 13px; color: #95a5a6;">${dateStr}</div>
                            </div>
                        </div>
                        <div style="color: #f39c12; font-size: 18px; letter-spacing: 2px;">
                            ${'★'.repeat(review.rating || 5)}
                        </div>
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

// Автозагрузка при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadReviews();
});