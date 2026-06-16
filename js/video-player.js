// Простой видео-плеер для демо
export function showVideoPlayer(programSlug, lessonTitle) {
    // Создаём модальное окно с видео
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeVideoPlayer()"></div>
        <div class="modal-content" style="max-width: 900px; padding: 20px;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">${lessonTitle || 'Тренировка'}</h3>
                <button class="modal-close" onclick="closeVideoPlayer()" style="font-size: 24px; background: none; border: none; cursor: pointer;">&times;</button>
            </div>
            <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; background: #000; border-radius: 12px; overflow: hidden;">
                <!-- Заглушка вместо реального видео -->
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-play-circle" style="font-size: 80px; margin-bottom: 20px; opacity: 0.8;"></i>
                    <p style="font-size: 18px; opacity: 0.9;">Видео тренировка</p>
                    <p style="font-size: 14px; opacity: 0.7; margin-top: 10px;">${programSlug}</p>
                </div>
                <!-- Для реального видео раскомментируйте:
                <video controls style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;">
                    <source src="videos/${programSlug}.mp4" type="video/mp4">
                    Ваш браузер не поддерживает видео.
                </video>
                -->
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-outline" onclick="markLessonComplete('${programSlug}')">
                    <i class="fas fa-check"></i> Завершить урок
                </button>
                <button class="btn btn-primary" onclick="nextLesson('${programSlug}')">
                    <i class="fas fa-arrow-right"></i> Следующий урок
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Закрытие по ESC
    const closeHandler = (e) => {
        if (e.key === 'Escape') closeVideoPlayer();
    };
    document.addEventListener('keydown', closeHandler);
    modal.dataset.closeHandler = 'true';
}

window.closeVideoPlayer = function() {
    const modal = document.querySelector('.modal.active');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
        // Удаляем обработчик ESC
        document.querySelectorAll('[data-close-handler="true"]').forEach(el => {
            el.removeAttribute('data-close-handler');
        });
    }
}

// Завершение урока
window.markLessonComplete = async function(programSlug) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        // Обновляем прогресс программы
        const enrolledPrograms = userData.enrolledPrograms?.map(p => {
            if (p.slug === programSlug && p.status === 'active') {
                const newCompleted = (p.completedLessons || 0) + 1;
                const totalLessons = 10; // Заглушка, можно взять из программы
                return {
                    ...p,
                    completedLessons: newCompleted,
                    progress: Math.round((newCompleted / totalLessons) * 100),
                    lastAccessedAt: new Date().toISOString()
                };
            }
            return p;
        }) || [];
        
        // Обновляем статистику
        const stats = userData.stats || {};
        const newStats = {
            lessons: (stats.lessons || 0) + 1,
            minutes: (stats.minutes || 0) + 20,
            flexibility: Math.min((stats.flexibility || 0) + 2, 100),
            streak: (stats.streak || 0) + 1
        };
        
        await updateDoc(userRef, {
            enrolledPrograms: enrolledPrograms,
            stats: newStats,
            updatedAt: serverTimestamp()
        });
        
        closeVideoPlayer();
        
        Swal.fire({
            icon: 'success',
            title: 'Урок завершён! 🎉',
            text: 'Прогресс обновлён',
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            window.location.reload();
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        Swal.fire('Ошибка', 'Не удалось сохранить прогресс', 'error');
    }
}

// Следующий урок (заглушка)
window.nextLesson = function(programSlug) {
    Swal.fire({
        icon: 'info',
        title: 'Следующий урок',
        text: 'В демо-версии доступен только один урок',
        confirmButtonColor: '#6198FF'
    });
}