import { isChapterRead, removeChapterFromHistory, addChapterToHistory, addAllChaptersToHistory, removeAllChaptersFromHistory, getBookmarks, getMangaCategory, addBookmark, removeBookmark } from '../storage-manager.js';
import { downloadChapterAsPdf } from './pdf-generator.js';
import { addCategory, renameCategory, deleteCategory } from '../storage-manager.js';


let chapterSortOrder = 'desc'; // 'asc' or 'desc'

// === НОВИЙ КОД ДЛЯ МОДАЛЬНОГО ВІКНА ЗАКЛАДОК ===

export function updateBookmarkButton(mangaId) {
    const bookmarkBtn = document.querySelector('#bookmark-btn');
    if (!bookmarkBtn) return;

    const category = getMangaCategory(mangaId);
    const btnText = bookmarkBtn.querySelector('.text');

    if (category) {
        bookmarkBtn.classList.add('active'); // Використовуємо .active для стилізації
        btnText.textContent = `В закладках (${category})`;
    } else {
        bookmarkBtn.classList.remove('active');
        btnText.textContent = 'В закладки';
    }
}

export function showBookmarkModal(mangaId, onUpdateCallback) {
    // Видаляємо старе вікно, якщо воно існує
    const existingModal = document.querySelector('.bookmark-modal-overlay');
    if (existingModal) existingModal.remove();

    const bookmarks = getBookmarks();
    const currentCategory = getMangaCategory(mangaId);

    const overlay = document.createElement('div');
    overlay.className = 'bookmark-modal-overlay';
    overlay.innerHTML = `
        <div class="bookmark-modal">
            <h3>Зберегти в...</h3>
            <div class="category-list">
                ${Object.keys(bookmarks).map(category => `
                    <button class="category-btn ${category === currentCategory ? 'active' : ''}" data-category="${category}">
                        ${category}
                    </button>
                `).join('')}
            </div>
            ${currentCategory ? '<button class="remove-bookmark-btn">Видалити з закладок</button>' : ''}
        </div>
    `;
    document.body.appendChild(overlay);

    // Закриття по кліку на фон
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    // Обробка кліків всередині модального вікна
    overlay.querySelector('.bookmark-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target;
        
        if (target.classList.contains('category-btn')) {
            const category = target.dataset.category;
            addBookmark(mangaId, category);
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
        case 'Заморожено': return 'status-frozen';
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
                downloadChapterAsPdf(mangaId, chapterId, downloadBtn);
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

// === НОВА ФУНКЦІЯ ДЛЯ КЕРУВАННЯ КАТЕГОРІЯМИ ===
export function showCategoryManagerModal(onUpdateCallback) {
    // Видаляємо старе модальне вікно, якщо воно є
    const existingModal = document.querySelector('.category-manager-overlay');
    if (existingModal) existingModal.remove();

    const bookmarks = getBookmarks();
    const categories = Object.keys(bookmarks);
    const baseCategories = ["Читаю", "В планах", "Прочитано"];

    const overlay = document.createElement('div');
    overlay.className = 'category-manager-overlay';

    let categoryListHTML = categories.map(cat => `
        <li data-category-name="${cat}">
            <span class="category-text">${cat}</span>
            <div class="category-item-actions">
                ${!baseCategories.includes(cat) ? `
                    <button class="icon-button rename-cat-btn" title="Перейменувати">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="icon-button delete-cat-btn" title="Видалити">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                ` : ''}
            </div>
        </li>
    `).join('');

    overlay.innerHTML = `
        <div class="category-manager-modal">
            <h3>Керування категоріями</h3>
            <div class="add-category-form">
                <input type="text" id="new-category-input" placeholder="Назва нової категорії...">
                <button id="add-new-category-btn" class="button">+</button>
            </div>
            <ul class="category-manager-list">${categoryListHTML}</ul>
        </div>
    `;

    document.body.appendChild(overlay);

    // --- Обробники подій ---
    const modal = overlay.querySelector('.category-manager-modal');
    const list = overlay.querySelector('.category-manager-list');
    const input = overlay.querySelector('#new-category-input');

    // Закриття модального вікна
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });

    // Додавання нової категорії
    overlay.querySelector('#add-new-category-btn').addEventListener('click', () => {
        const newName = input.value.trim();
        if (newName && !categories.includes(newName)) {
            addCategory(newName);
            onUpdateCallback(); // Оновлюємо кабінет
            overlay.remove(); // Закриваємо вікно
        } else {
            // Можна додати повідомлення про помилку
            input.style.borderColor = 'red';
        }
    });

    // Обробка дій в списку (перейменування, видалення)
    list.addEventListener('click', e => {
        const renameBtn = e.target.closest('.rename-cat-btn');
        const deleteBtn = e.target.closest('.delete-cat-btn');

        if (renameBtn) {
            const li = renameBtn.closest('li');
            const oldName = li.dataset.categoryName;
            const textSpan = li.querySelector('.category-text');
            
            const newName = prompt(`Перейменувати категорію "${oldName}":`, oldName);
            
            if (newName && newName.trim() !== '' && oldName !== newName.trim() && !categories.includes(newName.trim())) {
                renameCategory(oldName, newName.trim());
                onUpdateCallback();
                overlay.remove();
            } else if (newName) {
                alert("Помилка: така назва вже існує або назва некоректна.");
            }
        }

        if (deleteBtn) {
            const li = deleteBtn.closest('li');
            const nameToDelete = li.dataset.categoryName;

            if (confirm(`Ви впевнені, що хочете видалити категорію "${nameToDelete}"? Всі закладки з неї буде видалено.`)) {
                // Важливо: логіка видалення закладок з категорії має бути в storage-manager
                // Наша поточна функція deleteCategory просто видаляє категорію.
                // Для кращого UX, варто було б запитати, куди перемістити закладки.
                // Але за поточним планом - просто видаляємо.
                deleteCategory(nameToDelete);
                onUpdateCallback();
                overlay.remove();
            }
        }
    });
}