import { isChapterRead, removeChapterFromHistory, addChapterToHistory, addAllChaptersToHistory, removeAllChaptersFromHistory, getBookmarks, getMangaCategory, addBookmark, removeBookmark } from '../storage-manager.js';
import { downloadChapterAsPdf } from './pdf-generator.js';
import { downloadChapterAsEpub, downloadMultipleChaptersAsEpub } from './epub-generator.js';
import { addCategory, deleteCategory, updateCategory } from '../storage-manager.js';
import { getMangaById } from '../data-manager.js';


let chapterSortOrder = 'desc'; // 'asc' or 'desc'

// === НОВИЙ КОД ДЛЯ МОДАЛЬНОГО ВІКНА ЗАКЛАДОК ===

const activeDownloads = new Map();
let globalDownloadManager = null;

function getGlobalDownloadManager() {
    if (!globalDownloadManager) {
        globalDownloadManager = document.createElement('div');
        globalDownloadManager.id = 'global-download-manager';
        globalDownloadManager.className = 'hidden';
        globalDownloadManager.innerHTML = `
            <div class="gdm-header">
                <h4>Завантаження</h4>
                <button class="icon-button" id="gdm-toggle"><i data-lucide="chevron-down"></i></button>
            </div>
            <div class="gdm-list" id="gdm-list"></div>
        `;
        document.body.appendChild(globalDownloadManager);
        
        globalDownloadManager.querySelector('#gdm-toggle').addEventListener('click', () => {
            globalDownloadManager.classList.toggle('collapsed');
        });
        
        if (window.lucide) {
            lucide.createIcons({ root: globalDownloadManager });
        }
    }
    return globalDownloadManager;
}

function updateGlobalDownloadManager() {
    const manager = getGlobalDownloadManager();
    const list = manager.querySelector('#gdm-list');
    
    if (activeDownloads.size === 0) {
        manager.classList.add('hidden');
        return;
    }
    
    manager.classList.remove('hidden');
    list.innerHTML = '';
    
    activeDownloads.forEach((task, id) => {
        const item = document.createElement('div');
        item.className = 'gdm-item';
        item.innerHTML = `
            <div class="gdm-item-info">
                <span class="gdm-item-title">${task.title}</span>
                <span class="gdm-item-status">${task.status}</span>
            </div>
            <div class="gdm-item-progress">
                <div class="gdm-item-bar" style="width: ${task.percent}%"></div>
            </div>
            <button class="icon-button gdm-item-cancel" title="Скасувати" data-id="${id}">
                <i data-lucide="x"></i>
            </button>
        `;
        
        item.querySelector('.gdm-item-cancel').addEventListener('click', () => {
            if(task.controller) task.controller.abort();
            activeDownloads.delete(id);
            updateGlobalDownloadManager();
        });
        
        list.appendChild(item);
    });
    
    if (window.lucide) {
        lucide.createIcons({ root: list });
    }
}

export function updateBookmarkButton(mangaId) {
    const bookmarkBtn = document.querySelector('#bookmark-btn');
    if (!bookmarkBtn) return;

    const category = getMangaCategory(mangaId);
    const btnText = bookmarkBtn.querySelector('.text');
    
    // Скидаємо стилі перед застосуванням нових
    bookmarkBtn.style.backgroundColor = '';
    bookmarkBtn.style.borderColor = '';
    bookmarkBtn.style.color = '';
    bookmarkBtn.classList.remove('active');

    if (category) {
        bookmarkBtn.classList.add('active');
        btnText.textContent = category.name;
        // Застосовуємо колір категорії
        bookmarkBtn.style.backgroundColor = category.color;
        bookmarkBtn.style.borderColor = category.color;
        bookmarkBtn.style.color = 'var(--background-dark)'; // Для кращого контрасту
    } else {
        btnText.textContent = 'Зберегти';
    }
}

export function showBookmarkModal(mangaId, onUpdateCallback) {
    const existingModal = document.querySelector('.bookmark-modal-overlay');
    if (existingModal) existingModal.remove();

    const bookmarks = getBookmarks();
    const currentCategory = getMangaCategory(mangaId);
    
    // ЗАХИСНЕ ВИПРАВЛЕННЯ: Створюємо змінну categories і гарантуємо, що це завжди масив.
    const categories = (bookmarks && Array.isArray(bookmarks.categories)) ? bookmarks.categories : [];

    const overlay = document.createElement('div');
    overlay.className = 'bookmark-modal-overlay';
    overlay.innerHTML = `
        <div class="bookmark-modal">
            <h3>Зберегти в...</h3>
            <div class="category-list">
                ${categories.map(category => `
                    <button class="category-btn ${currentCategory && category.name === currentCategory.name ? 'active' : ''}" 
                            data-category="${category.name}"
                            style="${currentCategory && category.name === currentCategory.name ? `background-color:${category.color}; border-color:${category.color}; color: var(--background-dark);` : ''}">
                        ${category.name}
                    </button>
                `).join('')}
            </div>
            ${currentCategory ? '<button class="remove-bookmark-btn">Видалити із закладок</button>' : ''}
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    overlay.querySelector('.bookmark-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target;
        
        if (target.classList.contains('category-btn')) {
            const categoryName = target.dataset.category;
            addBookmark(mangaId, categoryName);
            overlay.remove();
            onUpdateCallback();
        }
        
        if (target.classList.contains('remove-bookmark-btn')) {
            removeBookmark(mangaId);
            overlay.remove();
            onUpdateCallback();
        }
    });
}

// === ІСНУЮЧИЙ КОД ЗАЛИШАЄТЬСЯ НИЖЧЕ ===

export function getStatusClass(status) {
    switch (status) {
        case 'Виходить': return 'status-ongoing';
        case 'Завершено': return 'status-completed';
        case 'Закинуто': return 'status-frozen';
        default: return '';
    }
}

export function setupTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            tabContents.forEach(c => c.classList.remove('active'));
            document.getElementById(tab)?.classList.add('active');
        });
    });
}

export function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " р. тому";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " міс. тому";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " д. тому";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " г. тому";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " хв. тому";
    return "Щойно";
}

export function renderChapterList(manga, sortOrder) {
    const chapterList = document.querySelector('.chapter-list ul');
    if (!chapterList || !manga.chapters || manga.chapters.length === 0) return;

    const sortedChapters = [...manga.chapters].sort((a, b) => {
        const chapterA = a.chapter;
        const chapterB = b.chapter;
        return sortOrder === 'asc' ? chapterA - chapterB : chapterB - chapterA;
    });

    chapterList.innerHTML = sortedChapters.map(ch => {
        const isRead = isChapterRead(manga.id, ch.id);
        const chapterUrl = ch.externalUrl ? ch.externalUrl : `#reader?mangaId=${manga.slug || manga.id}&chapterId=${ch.chapter}`;
        const targetAttr = ch.externalUrl ? 'target="_blank" rel="noopener noreferrer"' : '';
        const externalIcon = ch.externalUrl ? `<i data-lucide="external-link" style="width: 14px; height: 14px; margin-left: 4px; vertical-align: middle;"></i>` : '';
        
        return `
            <li class="${isRead ? 'read-chapter' : ''}">
                <a href="${chapterUrl}" ${targetAttr}>Том ${ch.volume}, Розділ ${ch.chapter}${ch.title ? `: ${ch.title}` : ''}${externalIcon}</a>
                <span class="chapter-meta">
                    <i data-lucide="eye" class="eye-icon ${isRead ? 'read' : ''}" data-manga-id="${manga.id}" data-chapter-id="${ch.id}"></i>
                    ${new Date(ch.date).toLocaleDateString()}
                    <button class="icon-button download-chapter-btn" title="Завантажити розділ" data-manga-id="${manga.id}" data-chapter-id="${ch.id}">
                        <i data-lucide="download"></i>
                    </button>
                </span>
            </li>
        `;
    }).join('');

    if (window.lucide) {
        lucide.createIcons({ root: chapterList });
    }
}

export function updateReadButton(manga) {
    const readButton = document.querySelector('.read-button');
    if (!readButton || !manga.chapters || manga.chapters.length === 0) return;

    const sortedChapters = [...manga.chapters].sort((a,b) => a.chapter - b.chapter);
    let firstUnreadChapter = sortedChapters.find(ch => !isChapterRead(manga.id, ch.id));

    if (!firstUnreadChapter) {
        firstUnreadChapter = sortedChapters[0]; 
    }

    if (firstUnreadChapter.externalUrl) {
        readButton.href = firstUnreadChapter.externalUrl;
        readButton.target = '_blank';
        readButton.rel = 'noopener noreferrer';
    } else {
        readButton.href = `#reader?mangaId=${manga.slug || manga.id}&chapterId=${firstUnreadChapter.chapter}`;
        readButton.removeAttribute('target');
        readButton.removeAttribute('rel');
    }
}

// ЗАМІНІТЬ ЦЮ ФУНКЦІЮ ПОВНІСТЮ
export function handleChapterListClicks(manga) {
    const chapterListUl = document.querySelector('.chapter-list ul');
    if (chapterListUl) {
        chapterListUl.addEventListener('click', (e) => {
            const target = e.target;
            const eyeIcon = target.closest('.eye-icon');
            const downloadBtn = target.closest('.download-chapter-btn');

            if (eyeIcon) {
                e.preventDefault();
                e.stopPropagation();
                const mangaId = parseInt(eyeIcon.dataset.mangaId);
                const chapterId = parseInt(eyeIcon.dataset.chapterId);
                const chapterItem = eyeIcon.closest('li');
                
                if (eyeIcon.classList.contains('read')) {
                    removeChapterFromHistory(mangaId, chapterId);
                    eyeIcon.classList.remove('read');
                    chapterItem.classList.remove('read-chapter');
                } else {
                    addChapterToHistory(mangaId, chapterId);
                    eyeIcon.classList.add('read');
                    chapterItem.classList.add('read-chapter');
                }
                updateReadButton(manga);
            }

            if (downloadBtn) {
                e.preventDefault();
                e.stopPropagation();
                const mangaId = parseInt(downloadBtn.dataset.mangaId);
                const chapterId = parseInt(downloadBtn.dataset.chapterId);
                showDownloadOptionsModal(mangaId, chapterId);
            }
        });
    }

    const sortButton = document.querySelector('#sort-chapters-btn');
    if (sortButton) {
        sortButton.addEventListener('click', () => {
            chapterSortOrder = chapterSortOrder === 'desc' ? 'asc' : 'desc';
            sortButton.classList.toggle('asc', chapterSortOrder === 'asc');
            renderChapterList(manga, chapterSortOrder);
        });
    }
    
    // Додаємо обробник для нової кнопки
    const batchDownloadBtn = document.querySelector('#batch-download-btn');
    if(batchDownloadBtn) {
        batchDownloadBtn.addEventListener('click', () => {
            showBatchDownloadModal(manga);
        });
    }

    const readAllButton = document.querySelector('#read-all-btn');
    if(readAllButton) {
        readAllButton.addEventListener('click', () => {
            const allChaptersRead = manga.chapters.every(ch => isChapterRead(manga.id, ch.id));

            if (allChaptersRead) {
                removeAllChaptersFromHistory(manga.id);
            } else {
                addAllChaptersToHistory(manga.id);
            }
            
            renderChapterList(manga, chapterSortOrder);
            updateReadButton(manga);
        });
    }
}


// ДОДАЙТЕ ЦІ ДВІ НОВІ ФУНКЦІЇ ПІСЛЯ handleChapterListClicks

async function startBatchDownload(mangaId, chapters, quality) {
    const taskId = 'batch_' + mangaId + '_' + Date.now();
    const controller = new AbortController();
    const task = { title: `Пакет (${chapters.length})`, status: 'Підготовка...', percent: 0, controller };
    activeDownloads.set(taskId, task);
    updateGlobalDownloadManager();

    const allNovel = chapters.every(ch => !!ch.content);

    if (allNovel) {
        try {
            const onProgress = (percent, status) => {
                task.percent = percent;
                task.status = `${status} ${Math.round(percent)}%`;
                updateGlobalDownloadManager();
            };
            await downloadMultipleChaptersAsEpub(mangaId, chapters, { onProgress, signal: controller.signal });
            activeDownloads.delete(taskId);
            updateGlobalDownloadManager();
        } catch (error) {
            if (error.message !== 'Aborted') {
                task.status = 'Помилка';
                updateGlobalDownloadManager();
                setTimeout(() => { activeDownloads.delete(taskId); updateGlobalDownloadManager(); }, 3000);
            }
        }
        return;
    }

    for (let i = 0; i < chapters.length; i++) {
        if (controller.signal.aborted) break;
        const chapter = chapters[i];
        task.title = `Розділ ${chapter.chapter} (${i+1}/${chapters.length})`;
        updateGlobalDownloadManager();

        try {
            const onProgress = (percent, status) => {
                task.percent = percent;
                task.status = `${status} ${Math.round(percent)}%`;
                updateGlobalDownloadManager();
            };

            const isNovel = !!chapter.content;
            if (isNovel) {
                await downloadChapterAsEpub(mangaId, chapter.id, { onProgress, signal: controller.signal });
            } else {
                await downloadChapterAsPdf(mangaId, chapter.id, { quality, onProgress, signal: controller.signal });
            }
        } catch (error) {
            if (error.message === 'Aborted') break;
            task.status = 'Пропущено';
            updateGlobalDownloadManager();
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    if (!controller.signal.aborted) {
        activeDownloads.delete(taskId);
        updateGlobalDownloadManager();
    }
}


function showBatchDownloadModal(manga) {
    const existingModal = document.querySelector('.batch-download-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'batch-download-modal-overlay';
    overlay.innerHTML = `
        <div class="batch-download-modal">
            <!-- View 1: Batch Selection -->
            <div id="batch-selection-view" class="view">
                <h3>Завантажити...</h3>
                <button class="button" data-batch="5">Останні 5 розділів</button>
                <button class="button" data-batch="10">Останні 10 розділів</button>
                <button class="button" data-batch="15">Останні 15 розділів</button>
                <button class="button" data-batch="unread">Всі непрочитані</button>
            </div>

            <!-- View 2: Quality Selection -->
            <div id="quality-selection-view" class="view hidden">
                <h3>Виберіть якість</h3>
                 <div class="download-options">
                    <div class="download-quality-option" data-quality="compressed">
                        <div class="quality-icon">
                            <i data-lucide="archive"></i>
                        </div>
                        <p class="quality-text-main">Стиснутий</p>
                        <p class="quality-text-secondary">Менший розмір</p>
                    </div>
                    <div class="download-quality-option" data-quality="original">
                        <div class="quality-icon">
                            <i data-lucide="file-check-2"></i>
                        </div>
                        <p class="quality-text-main">Оригінал</p>
                        <p class="quality-text-secondary">Краща якість</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    if (window.lucide) {
        lucide.createIcons({ root: overlay });
    }

    let chaptersToDownload = [];
    
    const batchSelectionView = overlay.querySelector('#batch-selection-view');
    const qualitySelectionView = overlay.querySelector('#quality-selection-view');

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });

    batchSelectionView.addEventListener('click', e => {
        const batchType = e.target.dataset.batch;
        if (!batchType) return;
        
        const sortedChapters = [...manga.chapters].sort((a, b) => b.chapter - a.chapter);
        
        if (batchType === 'unread') {
            chaptersToDownload = [...manga.chapters]
                .filter(ch => !isChapterRead(manga.id, ch.id))
                .sort((a,b) => a.chapter - b.chapter); // Завантажувати непрочитані по порядку
        } else {
            const count = parseInt(batchType, 10);
            chaptersToDownload = sortedChapters.slice(0, count).reverse(); // reverse, щоб завантажувати від старішого до новішого
        }

        if (chaptersToDownload.length === 0) {
            alert('Немає розділів для завантаження за цим критерієм.');
            overlay.remove();
            return;
        }

        batchSelectionView.classList.add('hidden');
        qualitySelectionView.classList.remove('hidden');
    });

    qualitySelectionView.addEventListener('click', e => {
        const qualityOption = e.target.closest('.download-quality-option');
        if (!qualityOption) return;
        const quality = qualityOption.dataset.quality;

        overlay.remove();
        
        startBatchDownload(manga.id, chaptersToDownload, quality);
    });
}

// === КАСТОМНІ МОДАЛЬНІ ВІКНА (ПІДТВЕРДЖЕННЯ / ВВІД) ===
export function showCustomAlert(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        overlay.innerHTML = `
            <div class="custom-dialog">
                <p>${message}</p>
                <div class="custom-dialog-actions">
                    <button class="button primary" id="dialog-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => { overlay.remove(); resolve(); };
        overlay.querySelector('#dialog-ok').addEventListener('click', close);
    });
}

export function showCustomConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        overlay.innerHTML = `
            <div class="custom-dialog">
                <p>${message}</p>
                <div class="custom-dialog-actions">
                    <button class="button secondary" id="dialog-cancel">Скасувати</button>
                    <button class="button primary" id="dialog-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#dialog-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
        overlay.querySelector('#dialog-ok').addEventListener('click', () => { overlay.remove(); resolve(true); });
    });
}

export function showCustomPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        overlay.innerHTML = `
            <div class="custom-dialog">
                <p>${message}</p>
                <input type="text" id="dialog-input" value="${defaultValue}">
                <div class="custom-dialog-actions">
                    <button class="button secondary" id="dialog-cancel">Скасувати</button>
                    <button class="button primary" id="dialog-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#dialog-input');
        input.focus();
        
        overlay.querySelector('#dialog-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
        overlay.querySelector('#dialog-ok').addEventListener('click', () => { overlay.remove(); resolve(input.value); });
    });
}

// === ПОВНІСТЮ ОНОВЛЕНА ФУНКЦІЯ КЕРУВАННЯ КАТЕГОРІЯМИ ===
export function showCategoryManagerModal(onUpdateCallback) {
    const existingModal = document.querySelector('.category-manager-overlay');
    if (existingModal) existingModal.remove();

    const bookmarks = getBookmarks();
    
    const overlay = document.createElement('div');
    overlay.className = 'category-manager-overlay';

    let categoryListHTML = bookmarks.categories.map(cat => `
        <li data-category-name="${cat.name}">
            <span class="color-swatch" style="background-color: ${cat.color};"></span>
            <span class="category-text">${cat.name}</span>
            <div class="category-item-actions">
                <button class="icon-button edit-cat-btn" title="Редагувати">
                    <i data-lucide="pencil" style="width: 18px; height: 18px;"></i>
                </button>
                <button class="icon-button delete-cat-btn" title="Видалити">
                    <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        </li>
    `).join('');

    overlay.innerHTML = `
        <div class="category-manager-modal">
            <h3>Керування категоріями</h3>
            <div class="add-category-form">
                <input type="text" id="new-category-input" placeholder="Назва нової категорії..." required>
                <input type="color" id="new-category-color" value="#333333">
                <button id="add-new-category-btn" class="button">+</button>
            </div>
            <ul class="category-manager-list">${categoryListHTML}</ul>
        </div>
    `;

    document.body.appendChild(overlay);

    if (window.lucide) {
        lucide.createIcons({ root: overlay });
    }

    const list = overlay.querySelector('.category-manager-list');
    const nameInput = overlay.querySelector('#new-category-input');
    const colorInput = overlay.querySelector('#new-category-color');

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#add-new-category-btn').addEventListener('click', () => {
        const newName = nameInput.value.trim();
        const newColor = colorInput.value;
        if (newName && !bookmarks.categories.some(c => c.name === newName)) {
            addCategory(newName, newColor);
            onUpdateCallback();
            overlay.remove();
        } else {
            nameInput.style.borderColor = 'red';
        }
    });

    list.addEventListener('click', async e => {
        const editBtn = e.target.closest('.edit-cat-btn');
        const deleteBtn = e.target.closest('.delete-cat-btn');

        if (editBtn) {
            const li = editBtn.closest('li');
            const oldName = li.dataset.categoryName;
            const currentCategory = bookmarks.categories.find(c => c.name === oldName);
            
            const newName = await showCustomPrompt(`Введіть нову назву для "${oldName}":`, oldName);
            
            if (newName && newName.trim() !== '') {
                 if (oldName !== newName.trim() && bookmarks.categories.some(c => c.name === newName.trim())) {
                    await showCustomAlert("Помилка: Категорія з такою назвою вже існує.");
                    return;
                }
                // Замість другого prompt, можна було б відкрити color picker, але це ускладнить код.
                // Для простоти, залишимо як є, користувач може видалити і створити нову з іншим кольором.
                updateCategory(oldName, newName.trim(), currentCategory.color);
                onUpdateCallback();
                overlay.remove();
            }
        }

        if (deleteBtn) {
            const li = deleteBtn.closest('li');
            const nameToDelete = li.dataset.categoryName;
            
            let shouldDelete = false;
            if (bookmarks.categories.find(c => c.name === nameToDelete).mangaIds.length > 0) {
                 shouldDelete = await showCustomConfirm(`Категорія "${nameToDelete}" не порожня. Ви впевнені, що хочете її видалити? Всі закладки з неї буде втрачено.`);
            } else {
                 shouldDelete = await showCustomConfirm(`Ви впевнені, що хочете видалити категорію "${nameToDelete}"?`);
            }
            
            if (!shouldDelete) return;
            
            deleteCategory(nameToDelete);
            onUpdateCallback();
            overlay.remove();
        }
    });
}

// Вставте цю нову функцію у файл ui.js
function showDownloadOptionsModal(mangaId, chapterId) {
    const existingModal = document.querySelector('.download-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'download-modal-overlay';
    overlay.innerHTML = `
        <div class="download-modal">
            <h3>Завантажити розділ</h3>
            <div class="download-options">
                <div class="download-quality-option" data-quality="compressed">
                    <div class="quality-icon">
                        <i data-lucide="archive"></i>
                    </div>
                    <p class="quality-text-main">Стиснутий</p>
                    <p class="quality-text-secondary">Менший розмір</p>
                </div>
                <div class="download-quality-option" data-quality="original">
                    <div class="quality-icon">
                        <i data-lucide="file-check-2"></i>
                    </div>
                    <p class="quality-text-main">Оригінал</p>
                    <p class="quality-text-secondary">Краща якість</p>
                </div>
            </div>
            <p class="download-note">Завантаження розпочнеться у фоні.</p>
        </div>
    `;
    document.body.appendChild(overlay);

    if (window.lucide) {
        lucide.createIcons({ root: overlay });
    }

    const optionsDiv = overlay.querySelector('.download-options');

    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    const manga = getMangaById(mangaId);
    const chapter = manga.chapters.find(c => c.id === chapterId);
    const isNovel = !!chapter.content;

    if (isNovel) {
        overlay.remove();
        const taskId = 'single_' + chapterId + '_' + Date.now();
        const controller = new AbortController();
        const task = { title: `Розділ ${chapter.chapter}`, status: 'Підготовка...', percent: 0, controller };
        activeDownloads.set(taskId, task);
        updateGlobalDownloadManager();

        const onProgress = (percent, status) => {
            task.percent = Math.round(percent);
            task.status = `${status} ${Math.round(percent)}%`;
            updateGlobalDownloadManager();
        };

        downloadChapterAsEpub(mangaId, chapterId, { onProgress, signal: controller.signal })
            .then(() => {
                activeDownloads.delete(taskId);
                updateGlobalDownloadManager();
            })
            .catch(err => {
                if (err.message !== 'Aborted') {
                    task.status = 'Помилка!';
                    updateGlobalDownloadManager();
                    setTimeout(() => { activeDownloads.delete(taskId); updateGlobalDownloadManager(); }, 3000);
                }
            });
        return;
    }

    optionsDiv.addEventListener('click', e => {
        const qualityOption = e.target.closest('.download-quality-option');
        if (!qualityOption) return;

        const quality = qualityOption.dataset.quality;
        
        overlay.remove();
        
        const taskId = 'single_' + chapterId + '_' + Date.now();
        const controller = new AbortController();
        const task = { title: `Розділ ${chapter.chapter}`, status: 'Підготовка...', percent: 0, controller };
        activeDownloads.set(taskId, task);
        updateGlobalDownloadManager();

        const onProgress = (percent, status) => {
            task.percent = Math.round(percent);
            task.status = `${status} ${Math.round(percent)}%`;
            updateGlobalDownloadManager();
        };

        downloadChapterAsPdf(mangaId, chapterId, { quality, onProgress, signal: controller.signal })
            .then(() => {
                activeDownloads.delete(taskId);
                updateGlobalDownloadManager();
            })
            .catch(err => {
                if (err.message !== 'Aborted') {
                    task.status = 'Помилка!';
                    updateGlobalDownloadManager();
                    setTimeout(() => { activeDownloads.delete(taskId); updateGlobalDownloadManager(); }, 3000);
                }
            });
    });
}

// === НАЛАШТУВАННЯ ЧИТАЛКИ ===
import { getReaderSettings, saveReaderSettings } from '../storage-manager.js';

export function initReaderSettings(readerContentWrapper, manga, isNovel) {
    const settingsBtn = document.getElementById('reader-settings-btn');
    const modal = document.getElementById('reader-settings-modal');
    const closeBtn = document.getElementById('close-settings-modal');

    if (!modal) return;

    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'block';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Tabs
    const tabsContainer = modal.querySelector('.settings-tabs');
    const tabContents = modal.querySelectorAll('.settings-tab-content');
    
    // Auto-select and hide tabs based on context
    if (tabsContainer) {
        tabsContainer.style.display = 'none'; // Завжди ховаємо вкладки
    }
    
    tabContents.forEach(c => c.classList.remove('active'));
    if (isNovel) {
        document.getElementById('novel-settings')?.classList.add('active');
        const modalTitle = modal.querySelector('h2');
        if(modalTitle) modalTitle.textContent = "Налаштування (Новела)";
    } else {
        document.getElementById('manga-settings')?.classList.add('active');
        const modalTitle = modal.querySelector('h2');
        if(modalTitle) modalTitle.textContent = "Налаштування (Манґа/Манхва)";
    }

    let settings = getReaderSettings();
    if (!settings.mangaSpecificModes) settings.mangaSpecificModes = {};

    let currentMode = settings.mangaSpecificModes[manga.id];
    if (!currentMode) {
        // Smart defaults
        const type = manga.type ? manga.type.toLowerCase() : '';
        if (type.includes('манґа') || type.includes('manga')) {
            currentMode = 'horizontal-ltr'; // За проханням: зліва направо за замовчуванням
        } else {
            currentMode = 'vertical'; // Манхва, комікс, вебтун - вертикально
        }
    }
    settings.mangaReadingMode = currentMode;

    // DOM Elements
    const elMode = document.getElementById('setting-reading-mode');
    const elFit = document.getElementById('setting-image-fit');
    const elPreload = document.getElementById('setting-preload-images');
    const elBrightness = document.getElementById('setting-brightness');
    const elBrightnessVal = document.getElementById('brightness-val');
    const elTapScroll = document.getElementById('setting-tap-scroll');
    const elNovelFont = document.getElementById('setting-novel-font');
    const elNovelTheme = document.getElementById('setting-novel-theme');
    const elNovelFontVal = document.getElementById('novel-font-val');
    const elNovelLineVal = document.getElementById('novel-line-val');

    // Apply function
    const applySettings = (newSettings) => {
        saveReaderSettings(newSettings);
        settings = newSettings;
        
        const readerContent = readerContentWrapper.querySelector('.reader-content');
        if(!readerContent) return;

        // Brightness via CSS variable on the wrapper
        readerContentWrapper.style.setProperty('--reader-brightness', settings.brightness / 100);

        const readerPage = document.querySelector('.reader-page');

        if (isNovel) {
            readerContent.style.fontSize = settings.novelFontSize + 'rem';
            readerContent.style.lineHeight = settings.novelLineHeight;
            readerContent.style.fontFamily = settings.novelFontFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif';
            
            if (readerPage) {
                readerPage.classList.add('is-novel');
                readerPage.classList.remove('novel-theme-light', 'novel-theme-dark', 'novel-theme-sepia');
                readerPage.classList.add(`novel-theme-${settings.novelTheme}`);
            }
        } else {
            if (readerPage) {
                readerPage.classList.remove('is-novel', 'novel-theme-light', 'novel-theme-dark', 'novel-theme-sepia');
            }
            
            // Remove previous mode classes
            readerContent.classList.remove('mode-vertical', 'mode-horizontal-ltr', 'mode-horizontal-rtl');
            readerContent.classList.add(`mode-${settings.mangaReadingMode}`);

            // Remove previous fit classes
            readerContent.classList.remove('fit-width', 'fit-height', 'fit-original');
            readerContent.classList.add(`fit-${settings.imageFit}`);
        }
    };

    const setupSegmentedControl = (el, currentValue, onChange) => {
        if (!el) return;
        const buttons = el.querySelectorAll('.segment-btn');
        const updateUI = (val) => {
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === String(val));
            });
        };
        updateUI(currentValue);
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('.segment-btn');
            if (!btn) return;
            const val = btn.dataset.value;
            updateUI(val);
            onChange(val);
        });
    };

    // Load initial values and setup listeners
    setupSegmentedControl(elMode, currentMode, (val) => {
        settings.mangaSpecificModes[manga.id] = val;
        applySettings({...settings, mangaReadingMode: val});
    });
    setupSegmentedControl(elFit, settings.imageFit || 'width', (val) => applySettings({...settings, imageFit: val}));
    setupSegmentedControl(elPreload, settings.preloadImages || 3, (val) => applySettings({...settings, preloadImages: parseInt(val)}));
    setupSegmentedControl(elNovelFont, settings.novelFontFamily || 'sans-serif', (val) => applySettings({...settings, novelFontFamily: val}));
    setupSegmentedControl(elNovelTheme, settings.novelTheme || 'dark', (val) => applySettings({...settings, novelTheme: val}));

    if(elBrightness) {
        elBrightness.value = settings.brightness || 100;
        if(elBrightnessVal) elBrightnessVal.textContent = settings.brightness || 100;
        elBrightness.addEventListener('input', (e) => {
            if(elBrightnessVal) elBrightnessVal.textContent = e.target.value;
            applySettings({...settings, brightness: parseInt(e.target.value)});
        });
    }
    
    if(elTapScroll) {
        elTapScroll.checked = settings.tapToScroll ?? true;
        elTapScroll.addEventListener('change', (e) => applySettings({...settings, tapToScroll: e.target.checked}));
    }
    
    if(elNovelFontVal) elNovelFontVal.textContent = (settings.novelFontSize || 1.1) + 'rem';
    if(elNovelLineVal) elNovelLineVal.textContent = (settings.novelLineHeight || 1.6);

    // Font size controls
    document.getElementById('btn-font-decrease')?.addEventListener('click', () => {
        let size = Math.max(0.8, (settings.novelFontSize || 1.1) - 0.1);
        if(elNovelFontVal) elNovelFontVal.textContent = size.toFixed(1) + 'rem';
        applySettings({...settings, novelFontSize: parseFloat(size.toFixed(1))});
    });
    document.getElementById('btn-font-increase')?.addEventListener('click', () => {
        let size = Math.min(2.5, (settings.novelFontSize || 1.1) + 0.1);
        if(elNovelFontVal) elNovelFontVal.textContent = size.toFixed(1) + 'rem';
        applySettings({...settings, novelFontSize: parseFloat(size.toFixed(1))});
    });

    // Line height controls
    document.getElementById('btn-line-decrease')?.addEventListener('click', () => {
        let lh = Math.max(1.0, (settings.novelLineHeight || 1.6) - 0.1);
        if(elNovelLineVal) elNovelLineVal.textContent = lh.toFixed(1);
        applySettings({...settings, novelLineHeight: parseFloat(lh.toFixed(1))});
    });
    document.getElementById('btn-line-increase')?.addEventListener('click', () => {
        let lh = Math.min(2.5, (settings.novelLineHeight || 1.6) + 0.1);
        if(elNovelLineVal) elNovelLineVal.textContent = lh.toFixed(1);
        applySettings({...settings, novelLineHeight: parseFloat(lh.toFixed(1))});
    });

    // Initial apply
    applySettings(settings);
    return settings;
}

export function initReaderHeaderBehavior(readerContentWrapper) {
    const header = document.querySelector('.reader-header');
    if (!header || !readerContentWrapper) return;

    let lastScrollY = window.scrollY;
    let isHeaderVisible = true;

    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY < 50) {
            header.classList.add('is-top');
        } else {
            header.classList.remove('is-top');
        }

        // Don't hide at the very top
        if (currentScrollY < 50) {
            if (!isHeaderVisible) {
                header.classList.remove('hidden');
                isHeaderVisible = true;
            }
            lastScrollY = currentScrollY;
            return;
        }

        if (currentScrollY > lastScrollY && isHeaderVisible) {
            // Scrolling down - hide
            header.classList.add('hidden');
            isHeaderVisible = false;
        } else if (currentScrollY < lastScrollY - 10 && !isHeaderVisible) {
            // Scrolling up (with a threshold) - show
            header.classList.remove('hidden');
            isHeaderVisible = true;
        }
        lastScrollY = currentScrollY;
    };

    setReaderScrollHandler(handleScroll);

    // Click anywhere on the reader page to toggle
    const readerPage = document.querySelector('.reader-page');
    if (readerPage) {
        readerPage.addEventListener('click', (e) => {
            // Prevent toggling if clicked on a tap-zone, button, link, header, or modal
            if (e.target.closest('.tap-zone') || 
                e.target.closest('.button') || 
                e.target.closest('a') || 
                e.target.closest('.reader-header') || 
                e.target.closest('.modal')) {
                return;
            }

            // Check if we tapped the edges (which is used for scrolling in horizontal mode)
            const readerContentWrapper = document.querySelector('.reader-content-wrapper');
            if (readerContentWrapper && readerContentWrapper.contains(e.target)) {
                const currentSettings = JSON.parse(localStorage.getItem('reader-settings') || '{}');
                const tapEnabled = currentSettings.tapToScroll ?? true;
                const mode = currentSettings.mangaReadingMode || 'horizontal-ltr';

                if (tapEnabled && mode.startsWith('horizontal')) {
                    const rect = readerContentWrapper.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (x < rect.width * 0.3 || x > rect.width * 0.7) {
                        return; // Click was on the edge, handled by tap-to-scroll
                    }
                }
            }
            
            // Don't toggle header if we're at the very top of the page
            if (window.scrollY < 50) return;
            
            isHeaderVisible = !isHeaderVisible;
            if (isHeaderVisible) {
                header.classList.remove('hidden');
            } else {
                header.classList.add('hidden');
            }
        });
    }
    
    // Initial check to set the correct top state
    handleScroll();
}

let readerScrollHandler = null;
export function setReaderScrollHandler(handler) {
    if (readerScrollHandler) {
        window.removeEventListener('scroll', readerScrollHandler);
    }
    readerScrollHandler = handler;
    if (handler) {
        window.addEventListener('scroll', handler, { passive: true });
    }
}
