// Импорт Firebase
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    collection, query, where, getDocs, orderBy, 
    doc, updateDoc, serverTimestamp, addDoc, getDoc,
    deleteDoc  // 🔥 Добавлено для удаления
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUser = null;
let clientData = null;
let allMessages = [];

// ============================================
// 🔹 ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists() || userDoc.data().role !== 'client') {
                window.location.href = 'login.html';
                return;
            }
            
            clientData = userDoc.data();
            updateUI(clientData);
            await loadMessages();
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
        }
    } else {
        window.location.href = 'login.html';
    }
});

function updateUI(data) {
    const name = data.name || 'Клиент';
    document.getElementById('topUserName').textContent = name;
    document.getElementById('userAvatar').src = data.photoUrl || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6198FF&color=fff`;
}

// ============================================
// 🔹 ЗАГРУЗКА СООБЩЕНИЙ
// ============================================
async function loadMessages() {
    const list = document.getElementById('messagesList');
    if (!list) return;
    
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';
    
    try {
        // Упрощённый запрос (без orderBy, чтобы не требовать индекс)
        const q = query(
            collection(db, 'messages'),
            where('to', '==', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        let messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Фильтруем только от тренеров и сортируем в JS
        messages = messages
            .filter(m => m.fromRole === 'trainer')
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
        
        allMessages = messages;
        
        console.log('📧 Загружено сообщений:', allMessages.length);
        
        // Считаем непрочитанные
        const unreadCount = allMessages.filter(m => !m.read).length;
        const countEl = document.getElementById('msgCount');
        if (countEl) {
            countEl.textContent = unreadCount;
            countEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }
        
        if (allMessages.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 64px; color: #e1e8ed; margin-bottom: 20px; display: block;"></i>
                    <h3>Нет сообщений</h3>
                    <p>Когда тренер напишет вам, сообщения появятся здесь</p>
                </div>
            `;
            return;
        }
        
        renderMessages(allMessages);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        list.innerHTML = '<p style="color: #e74c3c; text-align: center;">Ошибка загрузки сообщений</p>';
    }
}

// ============================================
// 🔹 РЕНДЕР СООБЩЕНИЙ (С КНОПКОЙ УДАЛЕНИЯ)
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
        
        return `
            <div class="message-item ${msg.read ? '' : 'unread'}">
                <div class="message-avatar" onclick="window.openMessage('${msg.id}')">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(msg.fromName || 'Т')}&background=43e97b&color=fff" alt="">
                </div>
                <div class="message-content" onclick="window.openMessage('${msg.id}')">
                    <div class="message-header">
                        <span class="message-from">${escapeHtml(msg.fromName)}</span>
                        <span class="message-date">${date}</span>
                    </div>
                    <div class="message-subject">${escapeHtml(msg.subject)}</div>
                    <div class="message-preview">${escapeHtml(msg.text.substring(0, 100))}${msg.text.length > 100 ? '...' : ''}</div>
                </div>
                
                <!-- 🔥 КНОПКА УДАЛЕНИЯ В СПИСКЕ -->
                <button class="btn-delete-message" 
                        onclick="event.stopPropagation(); window.confirmDeleteMessage('${msg.id}', '${escapeHtml(msg.subject).replace(/'/g, "\\'")}')"
                        title="Удалить сообщение"
                        style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 10px; font-size: 16px; opacity: 0.5; transition: opacity 0.3s;"
                        onmouseover="this.style.opacity='1'" 
                        onmouseout="this.style.opacity='0.5'">
                    <i class="fas fa-trash"></i>
                </button>
                
                ${!msg.read ? '<div class="message-unread-badge"></div>' : ''}
            </div>
        `;
    }).join('');
}

// ============================================
// 🔹 ОТКРЫТИЕ СООБЩЕНИЯ (С КНОПКОЙ УДАЛЕНИЯ)
// ============================================
window.openMessage = async function(messageId) {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg) return;
    
    // Отмечаем как прочитанное
    if (!msg.read) {
        try {
            await updateDoc(doc(db, 'messages', messageId), { read: true });
            msg.read = true;
            loadMessages(); // Перезагружаем список
        } catch (error) {
            console.error('❌ Ошибка обновления:', error);
        }
    }
    
    const modal = document.getElementById('messageModal');
    const body = document.getElementById('messageBody');
    
    const date = msg.createdAt?.toDate 
        ? msg.createdAt.toDate().toLocaleString('ru-RU', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        : '—';
    
    body.innerHTML = `
        <div class="message-full">
            <div class="message-full-header">
                <div>
                    <h4>${escapeHtml(msg.subject)}</h4>
                    <p style="color: #7f8c8d; margin-top: 5px;">
                        <i class="fas fa-user-tie"></i> От тренера: ${escapeHtml(msg.fromName)} 
                        <i class="fas fa-clock" style="margin-left: 15px;"></i> ${date}
                    </p>
                </div>
            </div>
            
            <div class="message-full-body" style="margin-top: 20px; padding: 20px; background: #f0fff4; border-radius: 8px; white-space: pre-wrap; border-left: 4px solid #43e97b;">
                ${escapeHtml(msg.text)}
            </div>
            
            <div class="message-full-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: space-between; align-items: center;">
                <!-- 🔥 КНОПКА УДАЛЕНИЯ СЛЕВА -->
                <button class="btn btn-danger" onclick="window.confirmDeleteMessage('${msg.id}', '${escapeHtml(msg.subject).replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i> Удалить
                </button>
                
                <!-- КНОПКИ ОТВЕТА И ЗАКРЫТИЯ СПРАВА -->
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-outline" onclick="window.replyToTrainer('${msg.from}', '${escapeHtml(msg.fromName).replace(/'/g, "\\'")}')">
                        <i class="fas fa-reply"></i> Ответить
                    </button>
                    <button class="btn btn-outline" onclick="window.closeMessageModal()">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// ============================================
// 🔥 ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ СООБЩЕНИЯ
// ============================================
window.confirmDeleteMessage = async function(messageId, subject) {
    const result = await Swal.fire({
        title: 'Удалить сообщение?',
        html: `
            <p>Вы уверены, что хотите удалить это сообщение?</p>
            <p style="color: #e74c3c; font-size: 13px; margin-top: 10px;">
                ⚠️ Действие необратимо
            </p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: '<i class="fas fa-trash"></i> Да, удалить',
        cancelButtonText: 'Отмена'
    });
    
    if (result.isConfirmed) {
        await deleteMessage(messageId);
    }
};

// ============================================
// 🔥 УДАЛЕНИЕ СООБЩЕНИЯ
// ============================================
async function deleteMessage(messageId) {
    try {
        // 🔥 Проверяем что сообщение принадлежит пользователю
        const msgRef = doc(db, 'messages', messageId);
        const msgDoc = await getDoc(msgRef);
        
        if (!msgDoc.exists()) {
            Swal.fire('Ошибка', 'Сообщение не найдено', 'error');
            return;
        }
        
        const msgData = msgDoc.data();
        
        // Проверяем права: можно удалить только если я получатель ИЛИ отправитель
        if (msgData.to !== currentUser.uid && msgData.from !== currentUser.uid) {
            Swal.fire('Ошибка', 'У вас нет прав на удаление этого сообщения', 'error');
            return;
        }
        
        // 🔥 Удаляем из Firebase
        await deleteDoc(msgRef);
        
        // Удаляем из локального массива
        allMessages = allMessages.filter(m => m.id !== messageId);
        
        // Закрываем модальное окно если оно открыто
        const modal = document.getElementById('messageModal');
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
        
        // Показываем уведомление
        Swal.fire({
            icon: 'success',
            title: 'Сообщение удалено',
            timer: 1500,
            showConfirmButton: false
        });
        
        // Перезагружаем список
        await loadMessages();
        
        console.log('✅ Сообщение удалено:', messageId);
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        Swal.fire('Ошибка', 'Не удалось удалить сообщение: ' + error.message, 'error');
    }
}

// ============================================
// 🔹 ОТВЕТ ТРЕНЕРУ
// ============================================
window.replyToTrainer = function(trainerId, trainerName) {
    window.closeMessageModal();
    
    Swal.fire({
        title: `<i class="fas fa-reply"></i> Ответить ${trainerName}`,
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
        confirmButtonColor: '#43e97b',
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
                    to: trainerId,
                    fromName: clientData.name,
                    toName: trainerName,
                    fromRole: 'client',
                    toRole: 'trainer',
                    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                    text: text,
                    read: false,
                    createdAt: serverTimestamp(),
                    conversationId: `${trainerId}_${currentUser.uid}`
                });
                
                return true;
            } catch (error) {
                console.error('❌ Ошибка отправки:', error);
                Swal.showValidationMessage('Ошибка отправки: ' + error.message);
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
    if (modal) {
        modal.classList.remove('active');
    }
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
    signOut(auth).then(() => {
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    
    if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.add('active'));
    if (sidebarClose && sidebar) sidebarClose.addEventListener('click', () => sidebar.classList.remove('active'));
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.closeMessageModal();
        }
    });
});

console.log('📧 Client Messages загружен');