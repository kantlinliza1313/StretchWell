// Импорт Firebase
import { db } from './firebase-config.js';
import { collection, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// === ЗАГРУЗКА ПРЕИМУЩЕСТВ (features) ===
export async function loadFeatures() {
    try {
        const q = query(
            collection(db, 'features'),
            where('isActive', '==', true),
            orderBy('order', 'asc')
        );
        
        const snapshot = await getDocs(q);
        const features = snapshot.docs.map(doc => doc.data());
        
        const container = document.querySelector('.choice-grid');
        
        if (container && features.length > 0) {
            container.innerHTML = features.map(feature => `
                <div class="choice-card">
                    <div class="choice-number">${feature.number}</div>
                    <h3 class="choice-title">${feature.title}</h3>
                    <p class="choice-desc">${feature.description}</p>
                </div>
            `).join('');
            console.log('✅ Преимущества загружены:', features.length);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки преимуществ:', error);
    }
}

// === ЗАГРУЗКА УСЛУГ (services) ===
export async function loadServices() {
    try {
        const q = query(
            collection(db, 'services'),
            where('isActive', '==', true),
            orderBy('order', 'asc')
        );
        
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map(doc => doc.data());
        
        const track = document.querySelector('.services-track');
        
        if (track && services.length > 0) {
            track.innerHTML = services.map(service => `
                <div class="service-card">
                    <div class="card-image">
                        <img src="${service.image}" alt="${service.title}">
                        <div class="card-overlay"></div>
                    </div>
                    <div class="card-content">
                        <h3 class="service-title">${service.title}</h3>
                        <p class="service-desc">${service.description}</p>
                    </div>
                </div>
            `).join('');
            console.log('✅ Услуги загружены:', services.length);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки услуг:', error);
    }
}

// === ГЛАВНАЯ ФУНКЦИЯ ===
export async function loadHomepage() {
    console.log('🔄 Загрузка главной страницы из Firebase...');
    await Promise.all([loadFeatures(), loadServices()]);
    console.log('✅ Главная страница загружена');
}

// === 🔥 АВТО-ОБНОВЛЕНИЕ: слушаем изменения из админки ===
// Добавляем ЭТОТ КОД В САМЫЙ НИЗ ФАЙЛА:
window.addEventListener('storage', (e) => {
    if (e.key === 'programsUpdated' || e.key === 'servicesUpdated' || e.key === 'featuresUpdated') {
        console.log('🔄 Контент обновлён в админке, перезагружаем...');
        loadHomepage();
    }
});