import { loadMangaData, fetchMangaDetails, getAllManga, getMangaById, getLatestUpdates, getChapterById } from '../data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory, removeAllChaptersFromHistory, clearAllHistory, addCategory, deleteCategory, getMangaCategory, getSelectedCover, saveSelectedCover, getEffectiveCover, getAutoCover, isChapterRead } from '../storage-manager.js';
import { initCatalog } from '../catalog.js';
import { setupDynamicCarousel } from './carousel.js';
import { setupTabs, timeAgo, renderChapterList, updateReadButton, getStatusClass, handleChapterListClicks, showBookmarkModal, updateBookmarkButton, showCategoryManagerModal, initReaderSettings, initReaderHeaderBehavior, showCustomConfirm } from './ui.js';
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
        const allManga = getAllManga();

        // 1. Динамічний Hero Crossfade Слайдер
        await setupDynamicCarousel();

        // 2. Плашка «Продовжити читання»
        const crContainer = main.querySelector('#continue-reading-container');
        if (crContainer) {
            const history = getHistory();
            if (history && history.length > 0) {
                const lastItem = history[0];
                const manga = getMangaById(lastItem.mangaId);
                if (manga) {
                    const ch = manga.chapters?.find(c => c.id === lastItem.chapterId || c.chapter === lastItem.chapterId) || manga.chapters?.[manga.chapters.length - 1];
                    const chTitle = ch ? `Том ${ch.volume}, Розділ ${ch.chapter}` : 'Почати читання';
                    const readCount = manga.chapters ? manga.chapters.filter(c => isChapterRead(manga.id, c.id)).length : 1;
                    const totalCount = manga.chapters?.length || 1;
                    const pct = Math.min(100, Math.max(1, Math.round((readCount / totalCount) * 100)));

                    const crCover = crContainer.querySelector('#cr-cover');
                    const crTitle = crContainer.querySelector('#cr-title');
                    const crChapter = crContainer.querySelector('#cr-chapter');
                    const crPercent = crContainer.querySelector('#cr-percent');
                    const crFill = crContainer.querySelector('#cr-fill');
                    const crBtn = crContainer.querySelector('#cr-btn');

                    if (crCover) crCover.src = getEffectiveCover(manga);
                    if (crTitle) crTitle.textContent = manga.title;
                    if (crChapter) crChapter.textContent = chTitle;
                    if (crPercent) crPercent.textContent = `${pct}%`;
                    if (crFill) crFill.style.width = `${pct}%`;
                    if (crBtn) {
                        crBtn.href = ch ? `#reader?mangaId=${manga.slug || manga.id}&chapterId=${ch.chapter}` : manga.pageUrl;
                    }
                    crContainer.style.display = 'flex';
                } else {
                    crContainer.style.display = 'none';
                }
            } else {
                crContainer.style.display = 'none';
            }
        }

        // 3. Свіжі оновлення з широкими обкладинками та градієнтом
        const updatesList = main.querySelector('.update-list');
        const latestUpdates = getLatestUpdates(5);
        if (updatesList) {
            updatesList.innerHTML = latestUpdates.map(manga => {
                if (!manga.chapters || manga.chapters.length === 0) return '';
                const latestChapter = manga.chapters[manga.chapters.length - 1];
                const cover = manga.backgroundImage || getEffectiveCover(manga);
                return `
                    <li>
                        <a href="${manga.pageUrl}">
                            <img src="${cover}" alt="${manga.title}" loading="lazy">
                            <div class="update-info">
                                <h3>${manga.title}</h3>
                                <p>Том ${latestChapter.volume}, Розділ ${latestChapter.chapter}</p>
                            </div>
                            <span class="update-time">${timeAgo(new Date(manga.latestUpdate))}</span>
                        </a>
                    </li>
                `;
            }).join('');
        }

        // 4. Лідери оновлень тижня (+X розділів за тиждень)
        const leadersContainer = main.querySelector('#weekly-leaders-list');
        if (leadersContainer) {
            let maxUpdate = 0;
            allManga.forEach(m => {
                if (m.latestUpdate) {
                    const t = new Date(m.latestUpdate).getTime();
                    if (t > maxUpdate) maxUpdate = t;
                }
            });
            const refDate = Math.max(Date.now(), maxUpdate);
            const sevenDaysAgo = refDate - 7 * 24 * 60 * 60 * 1000;

            const leaders = allManga.map(manga => {
                let count = 0;
                if (manga.chapters && manga.chapters.length > 0) {
                    count = manga.chapters.filter(ch => {
                        if (!ch.date) return false;
                        return new Date(ch.date).getTime() >= sevenDaysAgo;
                    }).length;
                }
                if (count === 0 && manga.latestUpdate && new Date(manga.latestUpdate).getTime() >= sevenDaysAgo) {
                    count = 1;
                }
                return {
                    manga,
                    count: count > 0 ? count : (manga.chapters?.length ? 1 : 0),
                    latestUpdate: manga.latestUpdate ? new Date(manga.latestUpdate).getTime() : 0
                };
            });

            leaders.sort((a, b) => b.count - a.count || b.latestUpdate - a.latestUpdate);
            const top5 = leaders.slice(0, 5);

            const formatAddedChapters = (cnt) => {
                const mod10 = cnt % 10;
                const mod100 = cnt % 100;
                if (mod10 === 1 && mod100 !== 11) return `+${cnt} розділ за тиждень`;
                if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `+${cnt} розділи за тиждень`;
                return `+${cnt} розділів за тиждень`;
            };

            leadersContainer.innerHTML = top5.map((item, index) => {
                const m = item.manga;
                return `
                    <li>
                        <a href="${m.pageUrl}" class="leader-item">
                            <span class="leader-rank">${index + 1}</span>
                            <img src="${getEffectiveCover(m)}" class="leader-thumb" alt="${m.title}" loading="lazy">
                            <div class="leader-info">
                                <h4>${m.title}</h4>
                                <span class="leader-chapters-badge">${formatAddedChapters(item.count)}</span>
                            </div>
                        </a>
                    </li>
                `;
            }).join('');
        }

        // 5. Компактна статистика (Тайтли та Розділи)
        const statTitlesCount = main.querySelector('#stat-titles-count');
        const statChaptersCount = main.querySelector('#stat-chapters-count');
        if (statTitlesCount) statTitlesCount.textContent = allManga.length;
        if (statChaptersCount) {
            const totalChapters = allManga.reduce((sum, m) => sum + (m.totalChapters || (m.chapters ? m.chapters.length : 0)), 0);
            statChaptersCount.textContent = totalChapters > 0 ? `${totalChapters}+` : '800+';
        }

        // 6. Мобільний рядок пошуку на головній
        const mobileHomeSearch = main.querySelector('#mobile-home-search');
        if (mobileHomeSearch) {
            mobileHomeSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = mobileHomeSearch.value.trim();
                    if (q) {
                        window.location.hash = `#catalog?search=${encodeURIComponent(q)}`;
                    }
                }
            });
        }

        // 7. Оновлення Lucide іконок на головній сторінці
        if (window.lucide) {
            window.lucide.createIcons({ root: main });
        }
    } else if (page === 'catalog') {
        const allManga = getAllManga();
        let genres = params ? params.get('genres') : null;
        let search = params ? params.get('search') : null;
        initCatalog(allManga, genres ? genres.split(',') : [], search || '');
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
            const renderMetaInfo = (m) => {
                const teamsHtml = (m.teams && m.teams.length > 0)
                    ? m.teams.map(t => `<a href="${t.url}" target="_blank" rel="noopener noreferrer" class="meta-tag team-tag" title="Команда співпраці: ${t.name}"><i data-lucide="users" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>${t.name}</a>`).join('')
                    : '';
                return `
                    <span class="meta-tag">${m.type || ''}</span>
                    <span class="meta-tag status-tag ${getStatusClass(m.status)}">${m.status || ''}</span>
                    ${teamsHtml}
                `;
            };
            if (metaInfo) {
                metaInfo.innerHTML = renderMetaInfo(manga);
                if (window.lucide) {
                    lucide.createIcons({ root: metaInfo });
                }
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
            if (metaInfo) {
                metaInfo.innerHTML = renderMetaInfo(manga);
                if (window.lucide) {
                    lucide.createIcons({ root: metaInfo });
                }
            }

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
        setupTabs((tab) => {
            if (tab === 'history') {
                renderCabinetHistory(main);
            }
        });
        setupCabinetBookmarks();
        
        // Перевірка вкладки з URL параметрів (наприклад, #cabinet?tab=history)
        const subTab = params.get('tab');
        if (subTab) {
            const targetTabLink = main.querySelector(`.tab-link[data-tab="${subTab}"]`);
            if (targetTabLink) {
                main.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                targetTabLink.classList.add('active');
                main.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                main.querySelector(`#${subTab}`)?.classList.add('active');
            }
        }

        // Ініціалізація клікера
        await initClicker();
        
        // Рендеринг історії читання
        await renderCabinetHistory(main);

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

            // Using numeric IDs for history tracking internally with chapter metadata
            addChapterToHistory(manga.id, chapter.id, chapter.chapter, chapter.volume);

            main.querySelector('.back-button').href = `#title?id=${manga.slug || manga.id}`;
            main.querySelector('.chapter-title').textContent = `Том ${chapter.volume}, Розділ ${chapter.chapter}${chapter.title ? `: ${chapter.title}` : ''}`;
            
            const teamInfoEl = main.querySelector('.reader-team-info');
            const chapterTeams = (chapter.teams && chapter.teams.length > 0) ? chapter.teams : (manga.teams || []);
            if (teamInfoEl) {
                if (chapterTeams.length > 0) {
                    teamInfoEl.innerHTML = `
                        <div class="reader-team-content">
                            <i data-lucide="users" class="icon" style="width: 16px; height: 16px; margin-right: 4px; vertical-align: middle;"></i>
                            <span>Співпраця:</span>
                            ${chapterTeams.map(t => `<a href="${t.url}" target="_blank" rel="noopener noreferrer" class="reader-team-link">${t.name}</a>`).join(', ')}
                        </div>
                    `;
                    teamInfoEl.style.display = 'flex';
                    if (window.lucide) {
                        lucide.createIcons({ root: teamInfoEl });
                    }
                } else {
                    teamInfoEl.style.display = 'none';
                }
            }
            
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
                            <img src="${pageUrl}" data-src="${pageUrl}" alt="Сторінка ${index + 1}" ${lazyAttr} ${fetchPriority}
                                 onload="this.parentElement.classList.remove('loading'); this.parentElement.classList.remove('error');"
                                 onerror="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('error');">
                            <div class="page-error-fallback">
                                <p>Не вдалося завантажити сторінку ${index + 1}</p>
                                <button type="button" class="button retry-load-btn">Спробувати знову</button>
                            </div>
                        </div>
                    `;
                }).join('');
                
                readerContent.classList.remove('novel-view');

                readerContent.addEventListener('click', (e) => {
                    const retryBtn = e.target.closest('.retry-load-btn');
                    if (retryBtn) {
                        const wrapper = retryBtn.closest('.page-wrapper');
                        const img = wrapper?.querySelector('img');
                        if (img && wrapper) {
                            wrapper.classList.add('loading');
                            wrapper.classList.remove('error');
                            const originalSrc = img.dataset.src || img.src;
                            const cacheBust = originalSrc.includes('?') ? `&retry=${Date.now()}` : `?retry=${Date.now()}`;
                            img.src = originalSrc + cacheBust;
                        }
                    }
                });

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

function pluralizeTitles(count) {
    const abs = Math.abs(count) % 100;
    const rem = abs % 10;
    if (abs > 10 && abs < 20) return 'тайтлів';
    if (rem > 1 && rem < 5) return 'тайтли';
    if (rem === 1) return 'тайтл';
    return 'тайтлів';
}

async function renderCabinetHistory(main) {
    const historyContainer = main.querySelector('#history-items-container');
    const emptyHistoryMsg = main.querySelector('#empty-history-message');
    const countBadge = main.querySelector('#history-count-badge');
    const clearBtn = main.querySelector('#clear-history-btn');

    if (!historyContainer) return;

    const rawHistory = getHistory();
    if (!rawHistory || rawHistory.length === 0) {
        historyContainer.innerHTML = '';
        if (emptyHistoryMsg) emptyHistoryMsg.style.display = 'block';
        if (countBadge) countBadge.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    // 1. Групування записів за mangaId (кожен тайтл з останнім прочитаним розділом)
    const mangaMap = new Map();
    for (const item of rawHistory) {
        if (!item || !item.mangaId) continue;
        if (!mangaMap.has(item.mangaId)) {
            mangaMap.set(item.mangaId, {
                mangaId: item.mangaId,
                latestItem: item,
                allReadChapterIds: new Set([item.chapterId]),
                latestTimestamp: item.timestamp || new Date().toISOString()
            });
        } else {
            const entry = mangaMap.get(item.mangaId);
            entry.allReadChapterIds.add(item.chapterId);
            if (new Date(item.timestamp) > new Date(entry.latestTimestamp)) {
                entry.latestTimestamp = item.timestamp;
                entry.latestItem = item;
            }
        }
    }

    const titleEntries = Array.from(mangaMap.values());
    titleEntries.sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));

    if (titleEntries.length === 0) {
        historyContainer.innerHTML = '';
        if (emptyHistoryMsg) emptyHistoryMsg.style.display = 'block';
        if (countBadge) countBadge.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    // 2. Асинхронно завантажуємо повні дані манґи для отримання всіх розділів
    await Promise.all(titleEntries.map(e => fetchMangaDetails(e.mangaId)));

    // 3. Формування карток
    const cardsHtml = titleEntries.map(entry => {
        const manga = getMangaById(entry.mangaId);
        if (!manga) return '';

        // Пошук прочитаного розділу
        let chapter = null;
        if (manga.chapters && manga.chapters.length > 0) {
            chapter = manga.chapters.find(c => c.id === entry.latestItem.chapterId);
            if (!chapter && entry.latestItem.chapterNumber !== undefined) {
                chapter = manga.chapters.find(c => c.chapter === entry.latestItem.chapterNumber);
            }
            if (!chapter) {
                chapter = manga.chapters[manga.chapters.length - 1];
            }
        }

        const chapterLabel = chapter ? `Том ${chapter.volume}, Розділ ${chapter.chapter}` : 'Почати читання';
        const chapterTitle = chapter?.title ? `: ${chapter.title}` : '';
        const continueChapter = chapter ? chapter.chapter : (manga.chapters?.[0]?.chapter || 1);

        // Прогрес читання
        const totalCount = manga.chapters?.length || 1;
        const readCount = manga.chapters
            ? manga.chapters.filter(c => isChapterRead(manga.id, c.id)).length
            : entry.allReadChapterIds.size;
        const pct = Math.min(100, Math.max(1, Math.round((readCount / totalCount) * 100)));

        return `
            <div class="history-card" data-manga-id="${manga.id}">
                <div class="history-card-left">
                    <div class="history-card-cover">
                        <a href="#title?id=${manga.slug || manga.id}" title="${manga.title}">
                            <img src="${getEffectiveCover(manga)}" alt="${manga.title}" loading="lazy">
                        </a>
                    </div>
                    <div class="history-card-body">
                        <div class="history-card-meta">
                            <span class="history-tag history-type-tag">${manga.type || 'Манґа'}</span>
                            ${manga.status ? `<span class="history-tag ${getStatusClass(manga.status)}">${manga.status}</span>` : ''}
                            <span class="history-card-time" title="Час останнього читання">
                                <i data-lucide="clock" class="history-icon-mini"></i>
                                ${timeAgo(entry.latestTimestamp)}
                            </span>
                        </div>
                        <h3 class="history-card-title">
                            <a href="#title?id=${manga.slug || manga.id}">${manga.title}</a>
                        </h3>
                        <div class="history-card-chapter-info">
                            <span class="history-chapter-pill">
                                <i data-lucide="bookmark" class="history-icon-mini"></i>
                                <span>${chapterLabel}</span>
                            </span>
                            ${chapterTitle ? `<span class="history-chapter-title-text" title="${chapterTitle}">${chapterTitle}</span>` : ''}
                        </div>
                        <div class="history-card-progress">
                            <div class="history-progress-header">
                                <span>Прогрес читання</span>
                                <span class="history-progress-val">${readCount} з ${totalCount} (${pct}%)</span>
                            </div>
                            <div class="history-progress-track">
                                <div class="history-progress-fill" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="history-card-actions">
                    <a href="#reader?mangaId=${manga.slug || manga.id}&chapterId=${continueChapter}" 
                       class="button button-primary history-btn-resume" title="Продовжити читання">
                        <i data-lucide="book-open"></i>
                        <span>Продовжити</span>
                    </a>
                    <button class="history-btn-remove" data-manga-id="${manga.id}" title="Видалити тайтл з історії">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    if (!cardsHtml) {
        historyContainer.innerHTML = '';
        if (emptyHistoryMsg) emptyHistoryMsg.style.display = 'block';
        if (countBadge) countBadge.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    historyContainer.innerHTML = cardsHtml;
    if (emptyHistoryMsg) emptyHistoryMsg.style.display = 'none';
    if (countBadge) {
        countBadge.textContent = `${titleEntries.length} ${pluralizeTitles(titleEntries.length)}`;
        countBadge.style.display = 'inline-block';
    }
    if (clearBtn) {
        clearBtn.style.display = 'inline-flex';
        clearBtn.onclick = async () => {
            const confirmed = await showCustomConfirm('Ви впевнені, що хочете очистити всю історію читання?');
            if (confirmed) {
                clearAllHistory();
                await renderCabinetHistory(main);
            }
        };
    }

    // Слухачі видалення окремого тайтла
    historyContainer.querySelectorAll('.history-btn-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mangaId = parseInt(btn.dataset.mangaId);
            const card = btn.closest('.history-card');
            if (card) {
                card.classList.add('removing');
                setTimeout(async () => {
                    removeAllChaptersFromHistory(mangaId);
                    await renderCabinetHistory(main);
                }, 250);
            } else {
                removeAllChaptersFromHistory(mangaId);
                await renderCabinetHistory(main);
            }
        });
    });

    if (window.lucide) {
        lucide.createIcons({ root: historyContainer });
        if (clearBtn) lucide.createIcons({ root: clearBtn });
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