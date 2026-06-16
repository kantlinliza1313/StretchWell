// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, orderBy, 
    doc, updateDoc, serverTimestamp, addDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUser = null;
let trainerData = null;
let allMessages = [];
let currentFilter = 'inbox'; // inbox = входящие, sent = исходящие, all = все

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists() || userDoc.data().role !== 'trainer') {
                window.location.href = 'login.html';
                return;
            }
            
            trainerData = userDoc.data();
            updateUI(trainerData);
            await loadMessages();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
        }
    } else {
        window.location.href = 'login.html';
    }
});

function updateUI(data) {
    const name = data.name || 'Тренер';
    document.getElementById('topUserName').textContent = name;
    document.getElementById('userAvatar').src = data.photoUrl || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
}

// ============================================
// 🔹 ЗАГРУЗКА СООБЩЕНИЙ (УПРОЩЁННЫЙ ЗАПРОС)
// ============================================
async function loadMessages() {
    const list = document.getElementById('messagesList');
    if (!list) return;
    
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
    
    try {
        // 🔥 УПРОЩЁННЫЙ ЗАПРОС - только один where (не требует индекс)
        const q = query(
            collection(db, 'messages'),
            where('to', '==', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        let incomingMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Также загружаем исходящие сообщения
        const q2 = query(
            collection(db, 'messages'),
            where('from', '==', currentUser.uid)
        );
        const snapshot2 = await getDocs(q2);
        let sentMsgs = snapshot2.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Объединяем все сообщения
        const allMsgs = [...incomingMsgs, ...sentMsgs];
        
        // Сортируем по дате (новые первыми)
        allMsgs.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        // Фильтруем по текущему фильтру
        if (currentFilter === 'inbox') {
            allMessages = allMsgs.filter(m => m.to === currentUser.uid);
        } else if (currentFilter === 'sent') {
            allMessages = allMsgs.filter(m => m.from === currentUser.uid);
        } else {
            allMessages = allMsgs;
        }
        
        console.log('📧 Загружено сообщений:', allMessages.length);
        
        // Считаем непрочитанные входящие
        const unreadCount = incomingMsgs.filter(m => !m.read).length;
        const countEl = document.getElementById('unreadCount');
        if (countEl) {
            countEl.textContent = unreadCount;
            countEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }
        
        if (allMessages.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 64px; color: #e1e8ed; margin-bottom: 20px;"></i>
                    <h3>Нет сообщений</h3>
                    <p>Сообщения от клиентов появятся здесь</p>
                </div>
            `;
            return;
        }
        
        renderMessages(allMessages);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        list.innerHTML = '<p style="color: #e74c3c; text-align: center;">Ошибка загрузки: ' + error.message + '</p>';
    }
}

// ============================================
// 🔹 ПЕРЕКЛЮЧЕНИЕ ФИЛЬТРА
// ============================================
window.setFilter = function(filter) {
    currentFilter = filter;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    loadMessages();
}

// ============================================
// 🔹 РЕНДЕР СООБЩЕНИЙ
// ============================================
function renderMessages(messages) {
    const list = document.getElementById('messagesList');
    if (!list) return;
    
    list.innerHTML = messages.map(msg => {
        const date = msg.createdAt?.toDate 
            ? msg.createdAt.toDate().toLocaleString('ru-RU', { 
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : '—';
        
        // Определяем направление сообщения
        const isIncoming = msg.to === currentUser.uid;
        const otherPersonName = isIncoming ? msg.fromName : msg.toName;
        const otherPersonRole = isIncoming ? msg.fromRole : msg.toRole;
        
        // Иконка и цвет в зависимости от роли собеседника
        const avatarBg = otherPersonRole === 'client' ? '43e97b' : '6198FF';
        const icon = otherPersonRole === 'client' ? 'fa-user' : 'fa-user-tie';
        
        return `
            <div class="message-item ${msg.read ? '' : 'unread'} ${isIncoming ? '' : 'sent'}" 
                 onclick="window.openMessage('${msg.id}')">
                <div class="message-avatar">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(otherPersonName || '?')}&background=${avatarBg}&color=fff" alt="">
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-from">
                            <i class="fas ${icon}"></i>
                            ${escapeHtml(otherPersonName)}
                        </span>
                        <span class="message-date">${date}</span>
                    </div>
                    <div class="message-subject">
                        ${isIncoming ? '📥 ' : '📤 '}${escapeHtml(msg.subject)}
                    </div>
                    <div class="message-preview">${escapeHtml(msg.text.substring(0, 100))}${msg.text.length > 100 ? '...' : ''}</div>
                </div>
                ${!msg.read && isIncoming ? '<div class="message-unread-badge"></div>' : ''}
            </div>
        `;
    }).join('');
}

// ============================================
// 🔹 ОТКРЫТИЕ СООБЩЕНИЯ
// ============================================
window.openMessage = async function(messageId) {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg) return;
    
    const isIncoming = msg.to === currentUser.uid;
    
    // Отмечаем как прочитанное (только если входящее)
    if (isIncoming && !msg.read) {
        await updateDoc(doc(db, 'messages', messageId), { read: true });
        msg.read = true;
        loadMessages();
    }
    
    const modal = document.getElementById('messageModal');
    const body = document.getElementById('messageBody');
    
    const date = msg.createdAt?.toDate 
        ? msg.createdAt.toDate().toLocaleString('ru-RU', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        : '—';
    
    const otherPersonName = isIncoming ? msg.fromName : msg.toName;
    const otherPersonId = isIncoming ? msg.from : msg.to;
    const otherPersonRole = isIncoming ? msg.fromRole : msg.toRole;
    
    body.innerHTML = `
        <div class="message-full">
            <div class="message-full-header">
                <div>
                    <h4>${escapeHtml(msg.subject)}</h4>
                    <p style="color: #7f8c8d; margin-top: 5px;">
                        <i class="fas fa-${isIncoming ? 'user' : 'user-tie'}"></i> 
                        ${isIncoming ? 'От' : 'Кому'}: ${escapeHtml(otherPersonName)}
                        <i class="fas fa-clock" style="margin-left: 15px;"></i> ${date}
                        ${isIncoming ? '' : '<span style="margin-left: 15px; color: #6198FF;"><i class="fas fa-paper-plane"></i> Исходящее</span>'}
                    </p>
                </div>
            </div>
            
            <div class="message-full-body" style="margin-top: 20px; padding: 20px; background: ${isIncoming ? '#f0fff4' : '#f0f7ff'}; border-radius: 8px; white-space: pre-wrap; border-left: 4px solid ${isIncoming ? '#43e97b' : '#6198FF'};">
                ${escapeHtml(msg.text)}
            </div>
            
            <div class="message-full-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                ${isIncoming ? `
                    <button class="btn btn-primary" onclick="window.replyToClient('${otherPersonId}', '${escapeHtml(otherPersonName).replace(/'/g, "\\'")}')">
                        <i class="fas fa-reply"></i> Ответить
                    </button>
                ` : ''}
                <button class="btn btn-outline" onclick="window.closeMessageModal()">
                    <i class="fas fa-times"></i> Закрыть
                </button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// ============================================
// 🔹 ОТВЕТ КЛИЕНТУ
// ============================================
window.replyToClient = function(clientId, clientName) {
    window.closeMessageModal();
    
    Swal.fire({
        title: `<i class="fas fa-reply"></i> Ответить ${escapeHtml(clientName)}`,
        html: `
            <div style="text-align: left;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Тема:</label>
                <input type="text" id="reply-subject" class="swal2-input" 
                       placeholder="Re: ..." style="margin-bottom: 15px;">
                
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Сообщение:</label>
                <textarea id="reply-text" class="swal2-textarea" rows="5" 
                          placeholder="Ваш ответ..." style="min-height: 150px;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Отправить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#6198FF',
        cancelButtonColor: '#95a5a6',
        width: '600px',
        preConfirm: async () => {
            const subject = document.getElementById('reply-subject').value;
            const text = document.getElementById('reply-text').value;
            
            if (!subject || !text) {
                Swal.showValidationMessage('Заполните тему и сообщение');
                return false;
            }
            
            try {
                await addDoc(collection(db, 'messages'), {
                    from: currentUser.uid,
                    to: clientId,
                    fromName: trainerData.name,
                    toName: clientName,
                    fromRole: 'trainer',
                    toRole: 'client',
                    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                    text: text,
                    read: false,
                    createdAt: serverTimestamp(),
                    conversationId: `${currentUser.uid}_${clientId}`
                });
                return true;
            } catch (error) {
                console.error('❌ Ошибка:', error);
                Swal.showValidationMessage('Ошибка: ' + error.message);
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                icon: 'success',
                title: 'Ответ отправлен!',
                timer: 2000,
                showConfirmButton: false
            });
            loadMessages();
        }
    });
}

window.closeMessageModal = function() {
    const modal = document.getElementById('messageModal');
    if (modal) modal.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.logout = function() {
    signOut(auth).then(() => window.location.href = 'login.html');
};

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (sidebarClose && sidebar) sidebarClose.addEventListener('click', () => sidebar.classList.remove('active'));
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.closeMessageModal();
    });
});

console.log('📧 Trainer Messages загружен');