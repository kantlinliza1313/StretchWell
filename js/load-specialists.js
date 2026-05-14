// Импорт Firebase
import { db } from './firebase-config.js';
import { collection, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// === ЗАГРУЗКА СПЕЦИАЛИСТОВ ===
export async function loadSpecialists() {
    const container = document.querySelector('.specialists-grid');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 60px; grid-column: 1/-1;"><i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #6198FF;"></i></div>';
    
    try {
        const q = query(
            collection(db, 'specialists'),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const specialists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (specialists.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 60px; grid-column: 1/-1;"><p style="color: #7f8c8d;">Специалисты скоро появятся</p></div>';
            return;
        }
        
        container.innerHTML = specialists.map(spec => `
            <div class="specialist-card">
                <div class="specialist-photo">
                    <img src="${spec.photoUrl || 'https://via.placeholder.com/300x300/6198FF/FFFFFF?text=' + encodeURIComponent(spec.name?.charAt(0) || 'С')}" 
                         alt="${spec.name}" 
                         onerror="this.src='https://via.placeholder.com/300x300/6198FF/FFFFFF?text=${encodeURIComponent(spec.name?.charAt(0) || 'С')}'">
                </div>
                <div class="specialist-info">
                    <h3 class="specialist-name">${spec.name}</h3>
                    <p class="specialist-position">${spec.position}</p>
                    
                    <div class="specialist-details">
                        <div class="detail-item">
                            <strong>Опыт:</strong> ${spec.experience}
                        </div>
                        <div class="detail-item">
                            <strong>Образование:</strong> ${spec.education}
                        </div>
                        <div class="detail-item">
                            <strong>Специализация:</strong> ${spec.specialization}
                        </div>
                    </div>
                    
                    ${spec.quote ? `
                    <div class="specialist-quote">
                        <i class="fas fa-quote-left"></i>
                        <p>${spec.quote}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        console.log('✅ Специалисты загружены:', specialists.length);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки специалистов:', error);
        container.innerHTML = '<div style="text-align: center; padding: 60px; grid-column: 1/-1;"><p style="color: #e74c3c;">Ошибка загрузки</p></div>';
    }
}