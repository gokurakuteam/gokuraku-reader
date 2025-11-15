import { isChapterRead, removeChapterFromHistory, addChapterToHistory, addAllChaptersToHistory, removeAllChaptersFromHistory, getBookmarks, getMangaCategory, addBookmark, removeBookmark } from '../storage-manager.js';
import { downloadChapterAsPdf } from './pdf-generator.js';
import { addCategory, deleteCategory } from '../storage-manager.js';


let chapterSortOrder = 'desc'; // 'asc' or 'desc'

// === НОВИЙ КОД ДЛЯ МОДАЛЬНОГО ВІКНА ЗАКЛАДОК ===

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
        return `
            <li class="${isRead ? 'read-chapter' : ''}">
                <a href="#reader?mangaId=${manga.id}&chapterId=${ch.id}">Том ${ch.volume}, Розділ ${ch.chapter}${ch.title ? `: ${ch.title}` : ''}</a>
                <span class="chapter-meta">
                    <svg class="eye-icon ${isRead ? 'read' : ''}" data-manga-id="${manga.id}" data-chapter-id="${ch.id}" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-134 0-244.5-72T61-462q-5-9-7.5-18.5T51-500q0-10 2.5-19.5T61-538q64-118 174.5-190T480-800q134 0 244.5 72T899-538q5 9 7.5 18.5T909-500q0 10-2.5 19.5T899-462q-64 118-174.5 190T480-200Z"/></svg>
                    ${new Date(ch.date).toLocaleDateString()}
                    <button class="icon-button download-chapter-btn" title="Завантажити розділ у PDF" data-manga-id="${manga.id}" data-chapter-id="${ch.id}">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    </button>
                </span>
            </li>
        `;
    }).join('');
}

export function updateReadButton(manga) {
    const readButton = document.querySelector('.read-button');
    if (!readButton || !manga.chapters || manga.chapters.length === 0) return;

    const sortedChapters = [...manga.chapters].sort((a,b) => a.chapter - b.chapter);
    let firstUnreadChapter = sortedChapters.find(ch => !isChapterRead(manga.id, ch.id));

    if (!firstUnreadChapter) {
        firstUnreadChapter = sortedChapters[0]; 
    }

    readButton.href = `#reader?mangaId=${manga.id}&chapterId=${firstUnreadChapter.id}`;
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

async function startBatchDownload(mangaId, chapters, quality, uiElements) {
    const { overallLabel, currentLabel, currentBar, modal } = uiElements;

    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        overallLabel.textContent = `Розділ ${i + 1} з ${chapters.length} (Розділ ${chapter.chapter})`;

        try {
            const onProgress = (percent, status) => {
                currentLabel.textContent = `${status}: ${Math.round(percent)}%`;
                currentBar.style.width = `${percent}%`;
            };

            await downloadChapterAsPdf(mangaId, chapter.id, { quality, onProgress });
        } catch (error) {
            overallLabel.textContent = `Помилка при завантаженні розділу ${chapter.chapter}. Пропускаємо...`;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза, щоб користувач побачив помилку
        }
    }

    overallLabel.textContent = 'Усі завантаження завершено!';
    setTimeout(() => modal.remove(), 2000);
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
                            <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                        </div>
                        <p class="quality-text-main">Стиснутий</p>
                        <p class="quality-text-secondary">Менший розмір</p>
                    </div>
                    <div class="download-quality-option" data-quality="original">
                        <div class="quality-icon">
                            <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>
                        </div>
                        <p class="quality-text-main">Оригінал</p>
                        <p class="quality-text-secondary">Краща якість</p>
                    </div>
                </div>
            </div>

            <!-- View 3: Progress -->
            <div id="progress-view" class="view hidden">
                 <p id="batch-progress-overall-label">Підготовка...</p>
                 <div id="batch-progress-current-container" class="progress-container" style="display: block;">
                    <p class="progress-label" id="batch-progress-current-label">Поточний розділ: 0%</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="batch-progress-current-bar"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let chaptersToDownload = [];
    
    const batchSelectionView = overlay.querySelector('#batch-selection-view');
    const qualitySelectionView = overlay.querySelector('#quality-selection-view');
    const progressView = overlay.querySelector('#progress-view');

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

        qualitySelectionView.classList.add('hidden');
        progressView.classList.remove('hidden');

        const uiElements = {
            overallLabel: overlay.querySelector('#batch-progress-overall-label'),
            currentLabel: overlay.querySelector('#batch-progress-current-label'),
            currentBar: overlay.querySelector('#batch-progress-current-bar'),
            modal: overlay
        };
        
        startBatchDownload(manga.id, chaptersToDownload, quality, uiElements);
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
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="icon-button delete-cat-btn" title="Видалити">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
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

    list.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-cat-btn');
        const deleteBtn = e.target.closest('.delete-cat-btn');

        if (editBtn) {
            const li = editBtn.closest('li');
            const oldName = li.dataset.categoryName;
            const currentCategory = bookmarks.categories.find(c => c.name === oldName);
            
            const newName = prompt(`Введіть нову назву для "${oldName}":`, oldName);
            
            if (newName && newName.trim() !== '') {
                 if (oldName !== newName.trim() && bookmarks.categories.some(c => c.name === newName.trim())) {
                    alert("Помилка: Категорія з такою назвою вже існує.");
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
            
            if (bookmarks.categories.find(c => c.name === nameToDelete).mangaIds.length > 0) {
                 if (!confirm(`Категорія "${nameToDelete}" не порожня. Ви впевнені, що хочете її видалити? Всі закладки з неї буде втрачено.`)) {
                    return;
                }
            } else {
                 if (!confirm(`Ви впевнені, що хочете видалити категорію "${nameToDelete}"?`)) {
                    return;
                }
            }
            
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
                        <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                    </div>
                    <p class="quality-text-main">Стиснутий</p>
                    <p class="quality-text-secondary">Менший розмір</p>
                </div>
                <div class="download-quality-option" data-quality="original">
                    <div class="quality-icon">
                        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>
                    </div>
                    <p class="quality-text-main">Оригінал</p>
                    <p class="quality-text-secondary">Краща якість</p>
                </div>
            </div>
            <div class="progress-container">
                <p class="progress-label">Завантаження: 0%</p>
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
            </div>
            <p class="download-note">Завантаження розділу через телеграм може не працювати</p>
        </div>
    `;
    document.body.appendChild(overlay);

    const optionsDiv = overlay.querySelector('.download-options');
    const progressContainer = overlay.querySelector('.progress-container');
    const progressBar = overlay.querySelector('.progress-bar');
    const progressLabel = overlay.querySelector('.progress-label');

    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    optionsDiv.addEventListener('click', e => {
        const qualityOption = e.target.closest('.download-quality-option');
        if (!qualityOption) return;

        const quality = qualityOption.dataset.quality;
        
        optionsDiv.style.display = 'none';
        progressContainer.style.display = 'block';

        const onProgress = (percent, status) => {
            const p = Math.round(percent);
            progressBar.style.width = `${p}%`;
            progressLabel.textContent = `${status}: ${p}%`;
        };

        downloadChapterAsPdf(mangaId, chapterId, { quality, onProgress })
            .then(() => {
                progressLabel.textContent = 'Завершено!';
                setTimeout(() => overlay.remove(), 1500);
            })
            .catch(err => {
                progressLabel.textContent = 'Помилка!';
                console.error(err);
                setTimeout(() => overlay.remove(), 3000);
            });
    });
}

