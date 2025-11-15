import { getAllManga, getMangaById, getLatestUpdates, getChapterById } from '../data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory, addCategory, deleteCategory, getMangaCategory } from '../storage-manager.js';
import { initCatalog } from '../catalog.js';
import { setupDynamicCarousel } from './carousel.js';
import { setupTabs, timeAgo, renderChapterList, updateReadButton, getStatusClass, handleChapterListClicks, showBookmarkModal, updateBookmarkButton, showCategoryManagerModal } from './ui.js';
import { loadGiscusForPage } from './giscus-loader.js';

const routes = {
    'home': 'home.html',
    'catalog': 'catalog.html',
    'cabinet': 'cabinet.html',
    'title': 'title.html',
    'reader': 'reader.html'
};

async function loadPage(page, params) {
    const main = document.querySelector('main');
    const response = await fetch(routes[page]);
    const content = await response.text();
    main.innerHTML = content;

    if (page === 'home') {
        await setupDynamicCarousel();
        const updatesList = main.querySelector('.update-list');
        const latestUpdates = getLatestUpdates(5);
        updatesList.innerHTML = latestUpdates.map(manga => {
            if (!manga.chapters || manga.chapters.length === 0) return '';
            const latestChapter = manga.chapters[manga.chapters.length - 1];
            return `
                <li>
                    <a href="${manga.pageUrl}">
                        <img src="${manga.coverImage}" alt="${manga.title}">
                        <div class="update-info">
                            <h3>${manga.title}</h3>
                            <p>Том ${latestChapter.volume}, Розділ ${latestChapter.chapter}</p>
                        </div>
                        <span class="update-time">${timeAgo(new Date(manga.latestUpdate))}</span>
                    </a>
                </li>
            `;
        }).join('');
    } else if (page === 'catalog') {
        const allManga = getAllManga();
        let genres = params ? params.get('genres') : null;
        initCatalog(allManga, genres ? genres.split(',') : []);
    } else if (page === 'title') {
        const mangaId = parseInt(params.get('id'));
        const manga = getMangaById(mangaId);

        if (manga) {
            if (manga.backgroundImage) {
                const bgImageDiv = main.querySelector('#background-image');
                if (bgImageDiv) bgImageDiv.style.backgroundImage = `url(${manga.backgroundImage})`;
            }
            main.querySelector('.title-cover img').src = manga.coverImage;
            main.querySelector('.title-info h1').textContent = manga.title;
            main.querySelector('.title-info p').textContent = manga.description;

            const metaInfo = main.querySelector('.title-meta-info');
            const statusClass = getStatusClass(manga.status);
            if (metaInfo) {
                metaInfo.innerHTML = `
                    <span class="meta-tag">${manga.type}</span>
                    <span class="meta-tag status-tag ${statusClass}">${manga.status}</span>
                `;
            }

            const genresDiv = main.querySelector('.genres');
            if (genresDiv) {
                genresDiv.innerHTML = manga.genres.map(g => `<a href="#catalog?genres=${encodeURIComponent(g)}">${g}</a>`).join('');
            }

            const readButton = main.querySelector('.read-button');
            const chapterActions = main.querySelector('.chapter-actions');
            
            if (manga.chapters && manga.chapters.length > 0) {
                if(readButton) readButton.style.display = 'flex';
                if (chapterActions) chapterActions.style.display = 'flex';

                updateReadButton(manga);
                renderChapterList(manga, 'desc');
                handleChapterListClicks(manga);

            } else {
                if(readButton) readButton.style.display = 'none';
                if (chapterActions) chapterActions.style.display = 'none';
                const chapterListContainer = main.querySelector('.chapter-list');
                if(chapterListContainer) {
                    chapterListContainer.innerHTML = `
                        <div class="list-header"><h2>Розділи</h2></div>
                        <div class="empty-category-message" style="padding: 2rem; text-align: center;">
                           <p>Розділів ще немає. Слідкуйте за оновленнями!</p>
                        </div>
                    `;
                }
            }

            const bookmarkBtn = main.querySelector('#bookmark-btn');
            if(bookmarkBtn) {
                updateBookmarkButton(manga.id);
                bookmarkBtn.addEventListener('click', () => {
                    showBookmarkModal(manga.id, () => updateBookmarkButton(manga.id));
                });
            }
            setupTabs();
        } else {
            await showNotFoundPage();
        }
        loadGiscusForPage('title', mangaId);
    } else if (page === 'cabinet') {
        setupTabs();
        setupCabinetBookmarks();
        
        const historyList = main.querySelector('.history-list');
        const historyItems = getHistory();
        const emptyHistoryMsg = main.querySelector('#history .empty-list-message');

        if (historyItems.length > 0) {
            if(emptyHistoryMsg) emptyHistoryMsg.style.display = 'none';
            historyList.innerHTML = historyItems.map(item => {
                 const manga = getMangaById(item.mangaId);
                 const chapter = getChapterById(item.chapterId);
                 if (!manga || !chapter) return '';
                 return `
                    <li>
                        <a href="#reader?mangaId=${manga.id}&chapterId=${chapter.id}">
                            <img src="${manga.coverImage}" alt="${manga.title}">
                            <div class="update-info">
                                <h3>${manga.title}</h3>
                                <p>Том ${chapter.volume}, Розділ ${chapter.chapter}</p>
                            </div>
                            <span class="update-time">${timeAgo(item.timestamp)}</span>
                        </a>
                    </li>
                 `;
            }).join('');
        } else {
            if(emptyHistoryMsg) emptyHistoryMsg.style.display = 'block';
        }

    } else if (page === 'reader') {
        const mangaId = parseInt(params.get('mangaId'));
        const chapterId = parseInt(params.get('chapterId'));
        const manga = getMangaById(mangaId);
        const chapter = manga?.chapters.find(ch => ch.id === chapterId);

        if (manga && chapter) {
            addChapterToHistory(mangaId, chapterId);

            main.querySelector('.back-button').href = `#title?id=${mangaId}`;
            main.querySelector('.chapter-title').textContent = `Том ${chapter.volume}, Розділ ${chapter.chapter}${chapter.title ? `: ${chapter.title}` : ''}`;
            const readerContent = main.querySelector('.reader-content');
            readerContent.innerHTML = chapter.pages.map(pageUrl => `<img src="${pageUrl}" alt="Сторінка розділу" loading="lazy">`).join('');

            const chapterIndex = manga.chapters.findIndex(ch => ch.id === chapterId);
            
            const prevBtn = main.querySelector('.prev-chapter-btn');
            if (chapterIndex > 0) {
                const prevChapter = manga.chapters[chapterIndex - 1];
                prevBtn.href = `#reader?mangaId=${mangaId}&chapterId=${prevChapter.id}`;
                prevBtn.style.display = 'inline-flex';
            } else {
                 prevBtn.style.display = 'none';
            }

            const nextBtn = main.querySelector('.next-chapter-btn');
            if (chapterIndex < manga.chapters.length - 1) {
                const nextChapter = manga.chapters[chapterIndex + 1];
                nextBtn.href = `#reader?mangaId=${mangaId}&chapterId=${nextChapter.id}`;
                nextBtn.style.display = 'inline-flex';
            } else {
                nextBtn.style.display = 'none';
            }

            main.querySelector('.home-btn').href = `#title?id=${mangaId}`;

            const appHeader = document.querySelector('app-header');
            if (window.innerWidth <= 768) {
                appHeader.classList.add('hidden');
            }
        } else {
            await showNotFoundPage();
        }
        loadGiscusForPage('reader', mangaId, chapterId);
    }
}

function setupCabinetBookmarks() {
    const bookmarksData = getBookmarks();
    const tabsContainer = document.querySelector('.category-tabs');
    const contentContainer = document.querySelector('.category-content-container');
    const bookmarksContainer = document.querySelector('#bookmarks-container');

    if (!tabsContainer || !contentContainer || !bookmarksContainer) return;

    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';
    
    // Завжди показуємо контейнер вкладок
    bookmarksContainer.style.display = 'block';
    
    // Ховаємо загальне повідомлення про порожнечу, оскільки логіка тепер всередині кожної вкладки
    const emptyAllBookmarksMessage = document.querySelector('#bookmarks .empty-list-message');
    if (emptyAllBookmarksMessage) {
        emptyAllBookmarksMessage.style.display = 'none';
    }

    if (!bookmarksData.categories || bookmarksData.categories.length === 0) {
        // Якщо категорій взагалі немає, показуємо повідомлення
        contentContainer.innerHTML = `<div class="empty-category-message"><p>У вас ще немає категорій. Створіть одну!</p></div>`;
        return;
    }

    bookmarksData.categories.forEach((category, index) => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category.name;
        tab.dataset.category = category.name;
        tabsContainer.appendChild(tab);

        const content = document.createElement('div');
        content.className = 'category-content';
        content.dataset.categoryContent = category.name;

        if (category.mangaIds.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'manga-grid';
            category.mangaIds.forEach(id => {
                const manga = getMangaById(id);
                if (!manga) return;
                const card = document.createElement('manga-card');
                card.setAttribute('name', manga.title);
                card.setAttribute('image', manga.coverImage);
                card.setAttribute('url', manga.pageUrl);
                card.setAttribute('type', manga.type);
                 if (manga.chapters && manga.chapters.length > 0) {
                    const lastChapter = manga.chapters[manga.chapters.length - 1];
                    card.setAttribute('last-chapter', `Розділ ${lastChapter.chapter}`);
                }
                card.setAttribute('status', manga.status);
                grid.appendChild(card);
            });
            content.appendChild(grid);
        } else {
            content.innerHTML = `
                <div class="empty-category-message">
                    <p>У цій категорії ще немає закладок.</p>
                </div>
            `;
        }
        contentContainer.appendChild(content);

        if (index === 0) {
            tab.classList.add('active');
            content.classList.add('active');
        }
    });

    const parentTabsContainer = tabsContainer.parentNode;
    if (!parentTabsContainer.hasAttribute('data-tabs-listener')) {
        parentTabsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('category-tab')) {
                const categoryName = e.target.dataset.category;
                parentTabsContainer.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                contentContainer.querySelectorAll('.category-content').forEach(c => c.classList.remove('active'));
                const activeContent = contentContainer.querySelector(`[data-category-content="${categoryName}"]`);
                if (activeContent) activeContent.classList.add('active');
            }
        });
        parentTabsContainer.setAttribute('data-tabs-listener', 'true');
    }

    const manageBtn = document.querySelector('#manage-categories-btn');
    if (manageBtn && !manageBtn.hasAttribute('data-listener-added')) {
        manageBtn.addEventListener('click', () => {
            showCategoryManagerModal(setupCabinetBookmarks);
        });
        manageBtn.setAttribute('data-listener-added', 'true');
    }
}

export async function handleNavigation() {
    const hash = window.location.hash.substring(1);
    const [page, query] = hash.split('?');
    const params = new URLSearchParams(query);
    const pageName = page || 'home';

    const appHeader = document.querySelector('app-header');
    if (pageName !== 'reader' && appHeader) {
        appHeader.classList.remove('hidden');
    }

    if (routes[pageName]) {
        await loadPage(pageName, params);
        window.scrollTo(0, 0);

        const appHeaderShadowRoot = appHeader?.shadowRoot;
        if (appHeaderShadowRoot) {
            appHeaderShadowRoot.querySelectorAll('nav a').forEach(link => {
                link.classList.remove('active');
                if (link.dataset.page === pageName) {
                    link.classList.add('active');
                }
            });
        }
    } else {
        await showNotFoundPage();
    }
}

async function showNotFoundPage() {
    const main = document.querySelector('main');
    try {
        const response = await fetch('404.html');
        if (!response.ok) throw new Error('404.html not found');
        // Потрібно витягнути вміст `main` з 404.html, а не весь документ
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const notFoundContent = doc.querySelector('.not-found-container');
        
        main.innerHTML = ''; // Очищуємо main
        if(notFoundContent) {
            main.appendChild(notFoundContent);
        } else {
            throw new Error('Content for 404 page not found in 404.html');
        }
        document.title = "404 - Сторінку не знайдено";

    } catch (error) {
        console.error("Could not load 404 page:", error);
        main.innerHTML = `
            <div class="not-found-container" style="text-align: center; padding: 50px;">
                <h1>404</h1>
                <p>Сторінку не знайдено.</p>
                <a href="#" class="button">На головну</a>
            </div>
        `;
    }
}