import { loadMangaData, fetchMangaDetails, getAllManga, getMangaById, getLatestUpdates, getChapterById } from '../data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory, addCategory, deleteCategory, getMangaCategory, getSelectedCover, saveSelectedCover } from '../storage-manager.js';
import { initCatalog } from '../catalog.js';
import { setupDynamicCarousel } from './carousel.js';
import { setupTabs, timeAgo, renderChapterList, updateReadButton, getStatusClass, handleChapterListClicks, showBookmarkModal, updateBookmarkButton, showCategoryManagerModal, initReaderSettings, initReaderHeaderBehavior } from './ui.js';
import { loadGiscusForPage } from './giscus-loader.js';
import { initClicker } from './clicker.js';

const routes = {
    'home': 'home.html',
    'catalog': 'catalog.html',
    'cabinet': 'cabinet.html',
    'title': 'title.html',
    'reader': 'reader.html'
};

let currentRouteId = 0;

async function loadPage(page, params, routeId) {
    const main = document.querySelector('main');
    
    main.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (routeId !== currentRouteId) return;

    main.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 50vh;">
            <svg class="spinner" viewBox="0 0 50 50" style="width: 50px; height: 50px; stroke: var(--accent-color); stroke-width: 4; fill: none;">
                <circle cx="25" cy="25" r="20" stroke-dasharray="100" stroke-dashoffset="30"></circle>
            </svg>
        </div>
    `;
    main.classList.remove('fade-out');

    try {
        const response = await fetch(routes[page]);
        const content = await response.text();
        
        if (routeId !== currentRouteId) return; 

        // Очікуємо завантаження даних ПЕРЕД рендерингом сторінки, 
        // поки користувач бачить спінер
        await loadMangaData();

        main.classList.add('fade-out');
        await new Promise(resolve => setTimeout(resolve, 150));
        if (routeId !== currentRouteId) return;
        
        main.innerHTML = content;
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                main.classList.remove('fade-out');
            });
        });
    } catch (e) {
        console.error(e);
        main.innerHTML = 'Error loading page';
        main.classList.remove('fade-out');
    }

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
                        <img src="${getSelectedCover(manga.id) || manga.coverImage}" alt="${manga.title}">
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
        const mangaId = params.get('id');
        await fetchMangaDetails(mangaId);
        const manga = getMangaById(mangaId);

        if (manga) {
            // -- Covers Logic --
            let currentCoverUrl = getSelectedCover(manga.id);
            if (!currentCoverUrl) {
                currentCoverUrl = manga.coverImage;
                // Determine active cover from history
                const history = getHistory();
                const mangaHistory = history.filter(item => item.mangaId === manga.id);
                if (mangaHistory.length > 0 && manga.volumeCovers && manga.chapters) {
                    // Find highest read volume
                    let maxReadVol = -1;
                    for (const h of mangaHistory) {
                        const chapter = getChapterById(h.chapterId);
                        if (chapter && chapter.volume > maxReadVol) {
                            maxReadVol = chapter.volume;
                        }
                    }
                    if (maxReadVol > 0 && manga.volumeCovers[maxReadVol]) {
                        currentCoverUrl = manga.volumeCovers[maxReadVol];
                    }
                }
            }

            const coverImgEl = main.querySelector('.title-cover img');
            const bgImageDiv = main.querySelector('#background-image');
            
            const setCover = (url, isInitial = false) => {
                if (isInitial) {
                    if (coverImgEl) coverImgEl.src = url;
                    if (bgImageDiv) bgImageDiv.style.backgroundImage = `url(${url})`;
                    return;
                }
                if (coverImgEl) {
                    coverImgEl.style.opacity = '0';
                    setTimeout(() => {
                        coverImgEl.src = url;
                        coverImgEl.onload = () => {
                            coverImgEl.style.opacity = '1';
                        };
                    }, 300);
                }
                if (bgImageDiv) {
                    bgImageDiv.style.opacity = '0';
                    setTimeout(() => {
                        bgImageDiv.style.backgroundImage = `url(${url})`;
                        bgImageDiv.style.opacity = '0.2';
                    }, 300);
                }
            };
            
            setCover(currentCoverUrl, true);

            // Populate Covers Tab
            const coversGrid = main.querySelector('.covers-grid');
            if (coversGrid) {
                coversGrid.innerHTML = '';
                
                const addCoverItem = (title, url) => {
                    const item = document.createElement('div');
                    item.className = 'cover-item';
                    if (url === currentCoverUrl) item.classList.add('active');
                    item.innerHTML = `
                        <img src="${url}" alt="${title}">
                        <span>${title}</span>
                    `;
                    item.addEventListener('click', () => {
                        coversGrid.querySelectorAll('.cover-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        setCover(url);
                        saveSelectedCover(manga.id, url);
                    });
                    coversGrid.appendChild(item);
                };
                
                addCoverItem('Головна', manga.coverImage);
                if (manga.volumeCovers) {
                    // Sort volumes numerically
                    const vols = Object.keys(manga.volumeCovers).sort((a,b) => parseFloat(a) - parseFloat(b));
                    vols.forEach(v => {
                        addCoverItem(`Том ${v}`, manga.volumeCovers[v]);
                    });
                }
            }
            // -- End Covers Logic --

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
        setTimeout(() => {
            loadGiscusForPage('title', mangaId);
        }, 500);
    } else if (page === 'cabinet') {
        setupTabs();
        setupCabinetBookmarks();
        
        // Ініціалізація клікера
        await initClicker();
        
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
                        <a href="#reader?mangaId=${manga.slug || manga.id}&chapterId=${chapter.chapter}">
                            <img src="${getSelectedCover(manga.id) || manga.coverImage}" alt="${manga.title}">
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
        const mangaId = params.get('mangaId');
        await fetchMangaDetails(mangaId);
        const chapterIdParam = parseFloat(params.get('chapterId'));
        const manga = getMangaById(mangaId);
        let chapter = manga?.chapters.find(ch => ch.chapter === chapterIdParam);

        // Fallback for old links where chapterId was the internal id
        if (!chapter && manga) {
             chapter = manga.chapters.find(ch => ch.id === parseInt(params.get('chapterId')));
        }

        if (manga && chapter) {
            if (chapter.externalUrl) {
                window.location.replace(chapter.externalUrl);
                return;
            }

            window.scrollTo(0, 0);

            // Using numeric IDs for history tracking internally
            addChapterToHistory(manga.id, chapter.id);

            main.querySelector('.back-button').href = `#title?id=${manga.slug || manga.id}`;
            main.querySelector('.chapter-title').textContent = `Том ${chapter.volume}, Розділ ${chapter.chapter}${chapter.title ? `: ${chapter.title}` : ''}`;
            
            const readerContentWrapper = main.querySelector('.reader-content-wrapper');
            const readerContent = main.querySelector('.reader-content');
            
            // Initialize settings FIRST so we know how to render
            const settings = initReaderSettings(readerContentWrapper, manga, !!chapter.content);
            initReaderHeaderBehavior(readerContentWrapper);

            if (chapter.content) {
                // Novel content
                readerContent.innerHTML = `<div class="novel-content">${chapter.content}</div>`;
                readerContent.classList.add('novel-view');
            } else if (chapter.pages) {
                // Manga content
                const preloadCount = settings.preloadImages || 3;
                
                readerContent.innerHTML = chapter.pages.map((pageUrl, index) => {
                    const lazyAttr = index < preloadCount ? '' : 'loading="lazy"';
                    const fetchPriority = index === 0 ? 'fetchpriority="high"' : '';
                    return `
                        <div class="page-wrapper loading" id="page-wrapper-${index}">
                            <img src="${pageUrl}" alt="Сторінка ${index + 1}" ${lazyAttr} ${fetchPriority}
                                 onload="this.parentElement.classList.remove('loading')">
                        </div>
                    `;
                }).join('');
                
                readerContent.classList.remove('novel-view');

                // Dynamic tap to scroll on reader content
                readerContentWrapper.addEventListener('click', (e) => {
                    // Check current settings dynamically
                    const currentSettings = JSON.parse(localStorage.getItem('reader-settings') || '{}');
                    const tapEnabled = currentSettings.tapToScroll ?? true;
                    // Get current mode directly from DOM class or settings
                    const mode = currentSettings.mangaReadingMode || 'horizontal-ltr';

                    if (!tapEnabled || !mode.startsWith('horizontal')) return;
                    
                    // Don't trigger if clicked on UI elements
                    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.reader-header')) return;

                    const rect = readerContentWrapper.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    
                    const scrollContent = (direction) => {
                        const amount = direction === 'left' ? -readerContent.clientWidth : readerContent.clientWidth;
                        readerContent.scrollBy({ left: amount, behavior: 'smooth' });
                    };

                    if (x < rect.width * 0.3) {
                        if (mode === 'horizontal-ltr') scrollContent('left');
                        else scrollContent('right');
                    } else if (x > rect.width * 0.7) {
                        if (mode === 'horizontal-ltr') scrollContent('right');
                        else scrollContent('left');
                    }
                });
            }

            const chapterIndex = manga.chapters.findIndex(ch => ch.id === chapter.id);
            
            const prevBtn = main.querySelector('.prev-chapter-btn');
            if (chapterIndex > 0) {
                const prevChapter = manga.chapters[chapterIndex - 1];
                prevBtn.href = `#reader?mangaId=${manga.slug || manga.id}&chapterId=${prevChapter.chapter}`;
                prevBtn.style.display = 'inline-flex';
            } else {
                 prevBtn.style.display = 'none';
            }

            const nextBtn = main.querySelector('.next-chapter-btn');
            if (chapterIndex < manga.chapters.length - 1) {
                const nextChapter = manga.chapters[chapterIndex + 1];
                nextBtn.href = `#reader?mangaId=${manga.slug || manga.id}&chapterId=${nextChapter.chapter}`;
                nextBtn.style.display = 'inline-flex';
            } else {
                nextBtn.style.display = 'none';
            }

            main.querySelector('.home-btn').href = `#title?id=${manga.slug || manga.id}`;

            const appHeader = document.querySelector('app-header');
            if (appHeader) {
                appHeader.classList.add('hidden');
            }
        } else {
            await showNotFoundPage();
        }
        setTimeout(() => {
            loadGiscusForPage('reader', mangaId, chapter?.id);
        }, 500);
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
                card.setAttribute('image', getSelectedCover(manga.id) || manga.coverImage);
                card.setAttribute('url', manga.pageUrl);
                card.setAttribute('type', manga.type);
                 if (manga.chapters && manga.chapters.length > 0) {
                    const maxChapter = manga.chapters.reduce((max, ch) => Math.max(max, parseFloat(ch.chapter)), -Infinity);
                    card.setAttribute('last-chapter', `Розділ ${maxChapter}`);
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
    const routeId = ++currentRouteId;
    const hash = window.location.hash.substring(1);
    const [page, query] = hash.split('?');
    const params = new URLSearchParams(query);
    const pageName = page || 'home';

    const appHeader = document.querySelector('app-header');
    if (pageName !== 'reader' && appHeader) {
        appHeader.classList.remove('hidden');
    }
    
    const main = document.querySelector('main');
    
    if (routes[pageName]) {
        await loadPage(pageName, params, routeId);
        if (routeId !== currentRouteId) return; // Abort if navigation changed
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
        if (window.lucide) {
            lucide.createIcons();
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