import { loadMangaData, fetchMangaDetails, getAllManga, getMangaById, getLatestUpdates, getChapterById } from '../data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory, addCategory, deleteCategory, getMangaCategory, getSelectedCover, saveSelectedCover, getEffectiveCover, getAutoCover } from '../storage-manager.js';
import { initCatalog } from '../catalog.js';
import { setupDynamicCarousel } from './carousel.js';
import { setupTabs, timeAgo, renderChapterList, updateReadButton, getStatusClass, handleChapterListClicks, showBookmarkModal, updateBookmarkButton, showCategoryManagerModal, initReaderSettings, initReaderHeaderBehavior } from './ui.js';
import { loadGiscusForPage } from './giscus-loader.js';
import { initClicker } from './clicker.js';
import { transitionManager } from './transition-manager.js';

const routes = {
    'home': 'home.html',
    'catalog': 'catalog.html',
    'cabinet': 'cabinet.html',
    'title': 'title.html',
    'reader': 'reader.html'
};

const pageCache = new Map();

async function fetchPageContent(page) {
    if (pageCache.has(page)) {
        return pageCache.get(page);
    }
    const response = await fetch(routes[page]);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const content = await response.text();
    pageCache.set(page, content);
    return content;
}

let currentRouteId = 0;

async function loadPage(page, params, routeId, skipAnimation = false) {
    const main = document.querySelector('main');
    
    try {
        if (page === 'title') {
            // Для тайтлу рендеримо розмітку миттєво без спінера, щоб запустити анімацію розширення картки
            const content = await fetchPageContent('title');
            if (routeId !== currentRouteId) return;
            main.innerHTML = content;
            main.classList.remove('fade-out');
            window.scrollTo(0, 0);
        } else if (skipAnimation) {
            const content = await fetchPageContent(page);
            if (routeId !== currentRouteId) return;
            await loadMangaData();
            main.innerHTML = content;
            main.classList.remove('fade-out');
        } else {
            // Швидкий плавний fade-out для інших сторінок
            main.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 120));
            if (routeId !== currentRouteId) return;

            const content = await fetchPageContent(page);
            if (routeId !== currentRouteId) return;
            await loadMangaData();

            main.innerHTML = content;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    main.classList.remove('fade-out');
                });
            });
        }
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
                        <img src="${getEffectiveCover(manga)}" alt="${manga.title}">
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
        let manga = getMangaById(mangaId);

        if (!manga) {
            await loadMangaData();
            manga = getMangaById(mangaId);
        }

        if (manga) {
            // 1. Попереднє заповнення відомими даними для миттєвої анімації
            let currentCoverUrl = getEffectiveCover(manga);

            const coverImgEl = main.querySelector('.title-cover img');
            const bgImageDiv = main.querySelector('#background-image');
            const titleHeaderEl = main.querySelector('.title-header');
            
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

            // Встановлюємо вже відому назву, статус і жанри
            const titleH1 = main.querySelector('.title-info h1');
            if (titleH1) titleH1.textContent = manga.title || '';

            const metaInfo = main.querySelector('.title-meta-info');
            const statusClass = getStatusClass(manga.status);
            if (metaInfo) {
                metaInfo.innerHTML = `
                    <span class="meta-tag">${manga.type || ''}</span>
                    <span class="meta-tag status-tag ${statusClass}">${manga.status || ''}</span>
                `;
            }

            const genresDiv = main.querySelector('.genres');
            if (genresDiv && manga.genres) {
                genresDiv.innerHTML = manga.genres.map(g => `<a href="#catalog?genres=${encodeURIComponent(g)}">${g}</a>`).join('');
            }

            // Запускаємо анімацію розширення картки та розквіту фону
            let expansionPromise = null;
            if (!skipAnimation) {
                expansionPromise = transitionManager.animateExpansion({
                    titleCoverEl: coverImgEl,
                    bgImageEl: bgImageDiv,
                    mangaId
                });
            }

            // Асинхронне довантаження повних деталей (опису та розділів)
            const detailsPromise = fetchMangaDetails(mangaId);

            // Очікуємо завершення польоту обкладинки, щоб важкий рендеринг розділів не спричиняв фризів
            await Promise.all([expansionPromise, detailsPromise]);
            if (routeId !== currentRouteId) return;
            manga = getMangaById(mangaId);

            // Відображаємо опис, приховуючи скелетон
            const descP = main.querySelector('.title-description') || main.querySelector('.title-info p');
            const skeletonDesc = main.querySelector('.title-skeleton-description');
            if (descP) {
                descP.textContent = manga.description || '';
                descP.style.display = '';
            }
            if (skeletonDesc) {
                skeletonDesc.style.display = 'none';
            }

            // Заповнення вкладки обкладинок (Автоматично, по томах, додаткові)
            const coversGrid = main.querySelector('.covers-grid');
            if (coversGrid) {
                coversGrid.innerHTML = '';
                const selectedMode = getSelectedCover(manga.id);
                const autoCoverUrl = getAutoCover(manga);

                const addCoverItem = (title, url, isAuto = false) => {
                    const item = document.createElement('div');
                    item.className = 'cover-item';
                    const isActive = isAuto ? (selectedMode === 'auto') : (selectedMode === url);
                    if (isActive) item.classList.add('active');
                    item.innerHTML = `
                        <img src="${url}" alt="${title}">
                        <span>${title}</span>
                    `;
                    item.addEventListener('click', () => {
                        coversGrid.querySelectorAll('.cover-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        if (isAuto) {
                            saveSelectedCover(manga.id, 'auto');
                            setCover(getAutoCover(manga));
                        } else {
                            saveSelectedCover(manga.id, url);
                            setCover(url);
                        }
                    });
                    coversGrid.appendChild(item);
                };

                // 1. Автоматична обкладинка
                if (autoCoverUrl) {
                    addCoverItem('Автоматично', autoCoverUrl, true);
                }

                // 2. Обкладинки по томах
                if (manga.volumeCovers) {
                    const vols = Object.keys(manga.volumeCovers).sort((a, b) => parseFloat(a) - parseFloat(b));
                    vols.forEach(v => {
                        if (manga.volumeCovers[v]) {
                            addCoverItem(`Том ${v}`, manga.volumeCovers[v], false);
                        }
                    });
                }

                // 3. Додаткові обкладинки
                if (manga.extraCovers && Array.isArray(manga.extraCovers)) {
                    manga.extraCovers.forEach((url, idx) => {
                        if (url) {
                            addCoverItem(`Додаткова ${idx + 1}`, url, false);
                        }
                    });
                }
            }

            // Кнопка читання та список розділів
            const readButton = main.querySelector('.read-button');
            const chapterActions = main.querySelector('.chapter-actions');
            
            if (manga.chapters && manga.chapters.length > 0) {
                if (readButton) readButton.style.display = 'flex';
                if (chapterActions) chapterActions.style.display = 'flex';

                updateReadButton(manga);
                renderChapterList(manga, 'desc');
                handleChapterListClicks(manga);
            } else {
                if (readButton) readButton.style.display = 'none';
                if (chapterActions) chapterActions.style.display = 'none';
                const chapterListContainer = main.querySelector('.chapter-list');
                if (chapterListContainer) {
                    chapterListContainer.innerHTML = `
                        <div class="list-header"><h2>Розділи</h2></div>
                        <div class="empty-category-message" style="padding: 2rem; text-align: center;">
                           <p>Розділів ще немає. Слідкуйте за оновленнями!</p>
                        </div>
                    `;
                }
            }

            const bookmarkBtn = main.querySelector('#bookmark-btn');
            if (bookmarkBtn) {
                updateBookmarkButton(manga.id);
                bookmarkBtn.addEventListener('click', () => {
                    showBookmarkModal(manga.id, () => updateBookmarkButton(manga.id));
                });
            }
            setupTabs((tab) => {
                if (tab === 'comments') {
                    loadGiscusForPage('title', mangaId);
                }
            });
            if (main.querySelector('.tab-link[data-tab="comments"]')?.classList.contains('active')) {
                loadGiscusForPage('title', mangaId);
            }

            if (window.lucide) {
                lucide.createIcons();
            }
        } else {
            await showNotFoundPage();
        }
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
                            <img src="${getEffectiveCover(manga)}" alt="${manga.title}">
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

            // Ліниве завантаження коментарів за допомогою IntersectionObserver
            const commentsContainer = main.querySelector('#giscus-container');
            if (commentsContainer) {
                if ('IntersectionObserver' in window) {
                    const observer = new IntersectionObserver((entries, obs) => {
                        if (entries[0].isIntersecting) {
                            obs.disconnect();
                            loadGiscusForPage('reader', mangaId, chapter?.id);
                        }
                    }, { rootMargin: '300px' });
                    observer.observe(commentsContainer);
                } else {
                    setTimeout(() => {
                        loadGiscusForPage('reader', mangaId, chapter?.id);
                    }, 2000);
                }
            }
        } else {
            await showNotFoundPage();
        }
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
                card.setAttribute('image', getEffectiveCover(manga));
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

let previousPageName = null;

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
        const origin = transitionManager.getOrigin();
        const isBackFromTitle = previousPageName === 'title' && pageName !== 'title' && origin && origin.route === pageName;

        if (isBackFromTitle) {
            const titleCoverEl = main?.querySelector('.title-cover img');
            const bgImageEl = main?.querySelector('#background-image');
            const titlePageEl = main?.querySelector('.title-page');

            await transitionManager.animateCollapse({
                titleCoverEl,
                bgImageEl,
                titlePageEl,
                targetPage: pageName,
                onMountTargetPage: async () => {
                    await loadPage(pageName, params, routeId, true);
                }
            });
        } else {
            if (previousPageName && previousPageName !== 'title') {
                transitionManager.saveScrollPosition(previousPageName);
            }

            // Якщо виходимо з тайтлу на іншу сторінку — плавно гасимо тайтл для плавного кросфейду
            if (previousPageName === 'title' && pageName !== 'title') {
                const titlePageEl = main?.querySelector('.title-page');
                const bgImageEl = main?.querySelector('#background-image');
                if (titlePageEl) titlePageEl.classList.add('title-page-exit');
                if (bgImageEl) {
                    bgImageEl.style.transition = 'opacity 0.16s ease';
                    bgImageEl.style.opacity = '0';
                }
                await new Promise(r => setTimeout(r, 140));
                if (routeId !== currentRouteId) return;
            }

            await loadPage(pageName, params, routeId, false);
            if (routeId !== currentRouteId) return; // Abort if navigation changed

            if (pageName !== 'title') {
                const savedScroll = transitionManager.getScrollPosition(pageName);
                if (savedScroll > 0) {
                    window.scrollTo(0, savedScroll);
                } else {
                    window.scrollTo(0, 0);
                }
            }
        }

        previousPageName = pageName;

        if (routeId !== currentRouteId) return;

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
        previousPageName = pageName;
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