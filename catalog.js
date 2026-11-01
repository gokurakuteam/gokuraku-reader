import { MangaCard } from './js/components.js';
import { getEffectiveCover } from './storage-manager.js';

export function initCatalog(mangaData, initialGenres = [], initialSearch = '') {
    // DOM Elements
    const mangaGrid = document.getElementById('catalog-manga-grid') || document.querySelector('.manga-grid');
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const sortSelect = document.getElementById('catalog-sort');
    const counterText = document.getElementById('catalog-count-num');
    const activeChipsStrip = document.getElementById('active-chips-strip');
    const sidebarGenreChips = document.getElementById('sidebar-genre-chips');
    const sidebarGenreSearch = document.getElementById('sidebar-genre-search');
    const sidebarResetBtn = document.getElementById('sidebar-reset-btn');
    const vtGrid = document.getElementById('vt-grid');
    const vtStream = document.getElementById('vt-stream');

    // Random Showcase Elements
    const randomShowcase = document.getElementById('random-showcase');
    const scBgBlur = document.getElementById('sc-bg-blur');
    const scCover = document.getElementById('sc-cover');
    const scTitle = document.getElementById('sc-title');
    const scType = document.getElementById('sc-type');
    const scStatus = document.getElementById('sc-status');
    const scMetaSub = document.getElementById('sc-meta-sub');
    const scReadLink = document.getElementById('sc-read-link');
    const scRollBtn = document.getElementById('sc-roll-btn');
    const scCloseBtn = document.getElementById('sc-close-btn');

    // Mobile Elements
    const mobileDockFilterBtn = document.getElementById('mobile-dock-filter-btn');
    const mobileDockRandomBtn = document.getElementById('mobile-dock-random-btn');
    const mobileDockCounter = document.getElementById('mobile-dock-counter');
    const sheetBackdrop = document.getElementById('sheet-backdrop');
    const bottomSheet = document.getElementById('bottom-sheet');
    const sheetCloseBtn = document.getElementById('sheet-close-btn');
    const sheetContentBody = document.getElementById('sheet-content-body');
    const sheetResetBtn = document.getElementById('sheet-reset-btn');
    const sheetApplyBtn = document.getElementById('sheet-apply-btn');

    // Quick View Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const qvCloseBtn = document.getElementById('qv-close-btn');
    const modalContentArea = document.getElementById('modal-content-area');

    if (!mangaGrid || !searchInput) {
        console.error("One or more essential catalog elements are missing from the DOM.");
        return;
    }

    // Genre extraction and counts
    const genreCounts = {};
    mangaData.forEach(m => {
        (m.genres || []).forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    });
    const sortedGenres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]);

    // Active state
    const savedViewMode = localStorage.getItem('catalog_view_mode') || 'grid';
    let currentShowcaseId = null;

    let activeFilters = {
        search: (initialSearch || '').trim(),
        type: 'all',
        status: 'all',
        length: 'all',
        sort: 'newest',
        view: savedViewMode,
        genres: {
            include: Array.isArray(initialGenres) ? [...initialGenres].filter(Boolean) : [],
            exclude: []
        }
    };

    if (searchInput && activeFilters.search) {
        searchInput.value = activeFilters.search;
        if (searchClearBtn) searchClearBtn.style.display = 'block';
    }

    function getChapterCount(manga) {
        if (manga.lastChapter !== undefined && manga.lastChapter !== null) {
            return Number(manga.lastChapter);
        }
        if (manga.totalChapters !== undefined && manga.totalChapters !== null) {
            return Number(manga.totalChapters);
        }
        if (manga.chapters && manga.chapters.length > 0) {
            const last = manga.chapters[manga.chapters.length - 1];
            return Number(last.chapter || manga.chapters.length);
        }
        return 1;
    }

    function getStatusClass(status) {
        switch (status) {
            case 'Виходить': return 'ongoing';
            case 'Завершено': return 'completed';
            case 'Закинуто': return 'frozen';
            default: return '';
        }
    }

    // 1. RANDOM SHOWCASE LOGIC
    function rollNextRandomTitle(autoScroll = false) {
        if (!mangaData || mangaData.length === 0) return;
        const candidates = mangaData.filter(m => m.id !== currentShowcaseId);
        const selected = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : mangaData[0];

        currentShowcaseId = selected.id;
        const coverUrl = getEffectiveCover(selected);
        const lastCh = getChapterCount(selected);

        if (scBgBlur) scBgBlur.style.backgroundImage = `url('${coverUrl}')`;
        if (scCover) {
            scCover.src = coverUrl;
            scCover.alt = selected.title;
        }
        if (scTitle) scTitle.textContent = selected.title;
        if (scType) scType.textContent = selected.type || 'Манхва';
        if (scStatus) scStatus.textContent = selected.status || 'Виходить';

        if (scMetaSub) {
            const chapterText = `Розділ ${lastCh}`;
            const genresText = (selected.genres || []).slice(0, 3).join(', ');
            scMetaSub.textContent = [chapterText, genresText].filter(Boolean).join(' • ');
        }

        if (scReadLink) {
            scReadLink.href = selected.pageUrl || `#title?id=${selected.slug || selected.id}`;
        }

        if (randomShowcase) {
            randomShowcase.style.display = 'block';
            if (autoScroll) {
                randomShowcase.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function dismissShowcase() {
        if (randomShowcase) {
            randomShowcase.style.display = 'none';
        }
    }

    if (scRollBtn) scRollBtn.addEventListener('click', () => rollNextRandomTitle(false));
    if (scCloseBtn) scCloseBtn.addEventListener('click', dismissShowcase);
    if (mobileDockRandomBtn) mobileDockRandomBtn.addEventListener('click', () => rollNextRandomTitle(true));

    // 2. 3-STATE GENRE LOGIC
    function getGenreState(genre) {
        if (activeFilters.genres.include.includes(genre)) return 'include';
        if (activeFilters.genres.exclude.includes(genre)) return 'exclude';
        return 'none';
    }

    function toggleGenre(genre) {
        const currentState = getGenreState(genre);
        let nextState;

        if (currentState === 'none') {
            nextState = 'include';
            activeFilters.genres.include.push(genre);
        } else if (currentState === 'include') {
            nextState = 'exclude';
            activeFilters.genres.include = activeFilters.genres.include.filter(g => g !== genre);
            activeFilters.genres.exclude.push(genre);
        } else {
            nextState = 'none';
            activeFilters.genres.exclude = activeFilters.genres.exclude.filter(g => g !== genre);
        }

        syncGenreChipUI(genre, nextState);
        renderManga();
        updateActiveFiltersUI();
    }

    function syncGenreChipUI(genre, state) {
        document.querySelectorAll(`.tri-chip[data-genre="${genre}"]`).forEach(btn => {
            btn.classList.remove('include', 'exclude');
            if (state === 'include') btn.classList.add('include');
            if (state === 'exclude') btn.classList.add('exclude');
        });
    }

    function filterGenreList(query, listContainer) {
        const q = query.trim().toLowerCase();
        if (!listContainer) return;
        listContainer.querySelectorAll('.tri-chip').forEach(btn => {
            const name = (btn.dataset.genre || '').toLowerCase();
            btn.style.display = name.includes(q) ? 'inline-flex' : 'none';
        });
    }

    // Populate Sidebar Genre Chips
    if (sidebarGenreChips) {
        sidebarGenreChips.innerHTML = sortedGenres.map(g => {
            const state = getGenreState(g);
            const stateClass = state === 'none' ? '' : ` ${state}`;
            return `
                <button type="button" class="tri-chip${stateClass}" data-genre="${g}">
                    <span class="chip-state-indicator"></span>
                    <span class="genre-name">${g}</span>
                    <span class="tri-chip-cnt">${genreCounts[g]}</span>
                </button>
            `;
        }).join('');

        sidebarGenreChips.addEventListener('click', (e) => {
            const btn = e.target.closest('.tri-chip');
            if (btn && btn.dataset.genre) {
                toggleGenre(btn.dataset.genre);
            }
        });
    }

    if (sidebarGenreSearch && sidebarGenreChips) {
        sidebarGenreSearch.addEventListener('input', (e) => {
            filterGenreList(e.target.value, sidebarGenreChips);
        });
    }

    // 3. FAST BENTO & SIDEBAR FILTER HANDLERS
    function setFilter(key, value) {
        activeFilters[key] = value;

        // Synchronize all matching button chips across Bento ribbon, sidebar, and mobile sheet
        const attrName = key === 'length' ? 'data-len' : `data-${key}`;
        document.querySelectorAll(`[${attrName}]`).forEach(b => {
            const matches = b.getAttribute(attrName) === value;
            b.classList.toggle('active', matches);
        });

        renderManga();
        updateActiveFiltersUI();
    }

    function bindFilterChipContainer(container) {
        if (!container) return;
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('.b-filter-chip');
            if (!chip) return;

            if (chip.hasAttribute('data-type')) {
                setFilter('type', chip.getAttribute('data-type'));
            } else if (chip.hasAttribute('data-status')) {
                setFilter('status', chip.getAttribute('data-status'));
            } else if (chip.hasAttribute('data-len')) {
                setFilter('length', chip.getAttribute('data-len'));
            }
        });
    }

    document.querySelectorAll('.hybrid-bento-strip, .classic-sidebar').forEach(bindFilterChipContainer);

    // 4. RESET ALL FILTERS
    function resetAllFilters() {
        activeFilters.search = '';
        activeFilters.type = 'all';
        activeFilters.status = 'all';
        activeFilters.length = 'all';
        activeFilters.genres.include = [];
        activeFilters.genres.exclude = [];

        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.style.display = 'none';

        // Reset sort to newest
        activeFilters.sort = 'newest';
        if (sortSelect) sortSelect.value = 'newest';

        // Reset fast chips UI
        ['type', 'status', 'length'].forEach(key => {
            const attr = key === 'length' ? 'data-len' : `data-${key}`;
            document.querySelectorAll(`[${attr}]`).forEach(b => {
                b.classList.toggle('active', b.getAttribute(attr) === 'all');
            });
        });

        // Reset genre chips
        document.querySelectorAll('.tri-chip').forEach(btn => {
            btn.classList.remove('include', 'exclude');
        });

        // Reset genre search inputs
        if (sidebarGenreSearch) {
            sidebarGenreSearch.value = '';
            filterGenreList('', sidebarGenreChips);
        }
        const mobileGenreSearch = document.getElementById('mobile-genre-search');
        if (mobileGenreSearch) {
            mobileGenreSearch.value = '';
            const mobileGenreChips = document.getElementById('mobile-genre-chips');
            filterGenreList('', mobileGenreChips);
        }

        renderManga();
        updateActiveFiltersUI();
    }

    if (sidebarResetBtn) sidebarResetBtn.addEventListener('click', resetAllFilters);

    // 5. VIEW MODE (GRID vs STREAM)
    function setViewMode(mode) {
        activeFilters.view = mode;
        localStorage.setItem('catalog_view_mode', mode);

        if (vtGrid) vtGrid.classList.toggle('active', mode === 'grid');
        if (vtStream) vtStream.classList.toggle('active', mode === 'stream');

        if (mangaGrid) {
            mangaGrid.classList.toggle('stream-mode', mode === 'stream');
        }

        renderManga();
    }

    if (vtGrid) vtGrid.addEventListener('click', () => setViewMode('grid'));
    if (vtStream) vtStream.addEventListener('click', () => setViewMode('stream'));

    // 6. SEARCH & SORT CONTROLS
    let searchDebounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            const val = e.target.value.trim();
            if (searchClearBtn) searchClearBtn.style.display = val ? 'block' : 'none';

            searchDebounceTimer = setTimeout(() => {
                activeFilters.search = val;
                renderManga();
                updateActiveFiltersUI();
            }, 150);
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchClearBtn.style.display = 'none';
            activeFilters.search = '';
            renderManga();
            updateActiveFiltersUI();
            if (searchInput) searchInput.focus();
        });
    }

    if (sortSelect) {
        sortSelect.value = activeFilters.sort;
        sortSelect.addEventListener('change', (e) => {
            activeFilters.sort = e.target.value;
            renderManga();
            updateActiveFiltersUI();
        });
    }

    // 7. ACTIVE CHIPS BAR
    function updateActiveFiltersUI() {
        if (!activeChipsStrip) return;

        const totalActive = (activeFilters.search ? 1 : 0) +
            (activeFilters.type !== 'all' ? 1 : 0) +
            (activeFilters.status !== 'all' ? 1 : 0) +
            (activeFilters.length !== 'all' ? 1 : 0) +
            activeFilters.genres.include.length +
            activeFilters.genres.exclude.length;

        if (mobileDockCounter) {
            mobileDockCounter.textContent = totalActive;
        }

        if (totalActive === 0) {
            activeChipsStrip.style.display = 'none';
            activeChipsStrip.innerHTML = '';
            return;
        }

        activeChipsStrip.style.display = 'flex';
        let html = '';

        if (activeFilters.search) {
            html += `
                <div class="act-chip" data-role="remove-search">
                    Пошук: "${activeFilters.search}"
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        }

        if (activeFilters.type !== 'all') {
            html += `
                <div class="act-chip" data-role="remove-type">
                    Тип: ${activeFilters.type}
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        }

        if (activeFilters.status !== 'all') {
            html += `
                <div class="act-chip" data-role="remove-status">
                    Статус: ${activeFilters.status}
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        }

        if (activeFilters.length !== 'all') {
            const lengthName = activeFilters.length === 'short'
                ? '< 10 розділів'
                : (activeFilters.length === 'medium' ? '10–50 розділів' : '50+ розділів');
            html += `
                <div class="act-chip" data-role="remove-length">
                    Обсяг: ${lengthName}
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        }

        activeFilters.genres.include.forEach(g => {
            html += `
                <div class="act-chip" data-role="toggle-genre" data-genre="${g}">
                    ✓ ${g}
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        });

        activeFilters.genres.exclude.forEach(g => {
            html += `
                <div class="act-chip exclude" data-role="toggle-genre" data-genre="${g}">
                    ✕ ${g}
                    <span class="act-chip-remove">&times;</span>
                </div>
            `;
        });

        html += `<button type="button" class="act-clear-all" id="act-clear-all-btn">Скинути всі</button>`;
        activeChipsStrip.innerHTML = html;
    }

    if (activeChipsStrip) {
        activeChipsStrip.addEventListener('click', (e) => {
            const target = e.target.closest('[data-role], #act-clear-all-btn');
            if (!target) return;

            if (target.id === 'act-clear-all-btn') {
                resetAllFilters();
                return;
            }

            const role = target.dataset.role;
            if (role === 'remove-search') {
                activeFilters.search = '';
                if (searchInput) searchInput.value = '';
                if (searchClearBtn) searchClearBtn.style.display = 'none';
                renderManga();
                updateActiveFiltersUI();
            } else if (role === 'remove-type') {
                setFilter('type', 'all');
            } else if (role === 'remove-status') {
                setFilter('status', 'all');
            } else if (role === 'remove-length') {
                setFilter('length', 'all');
            } else if (role === 'toggle-genre') {
                const g = target.dataset.genre;
                if (g) toggleGenre(g);
            }
        });
    }

    // 8. RENDER CATALOG (GRID or STREAM)
    function renderManga() {
        let filtered = [...mangaData];

        // Search Filter
        if (activeFilters.search) {
            const q = activeFilters.search.toLowerCase();
            filtered = filtered.filter(m => {
                const titleMatch = m.title && m.title.toLowerCase().includes(q);
                const genreMatch = m.genres && m.genres.some(g => g.toLowerCase().includes(q));
                return titleMatch || genreMatch;
            });
        }

        // Type Filter
        if (activeFilters.type !== 'all') {
            filtered = filtered.filter(m => m.type === activeFilters.type);
        }

        // Status Filter
        if (activeFilters.status !== 'all') {
            filtered = filtered.filter(m => m.status === activeFilters.status);
        }

        // Length (Обсяг у розділах) Filter
        if (activeFilters.length === 'short') {
            filtered = filtered.filter(m => getChapterCount(m) < 10);
        } else if (activeFilters.length === 'medium') {
            filtered = filtered.filter(m => {
                const count = getChapterCount(m);
                return count >= 10 && count <= 50;
            });
        } else if (activeFilters.length === 'long') {
            filtered = filtered.filter(m => getChapterCount(m) > 50);
        }

        // Genres (Include - AND logic)
        if (activeFilters.genres.include.length > 0) {
            filtered = filtered.filter(m =>
                activeFilters.genres.include.every(g => m.genres && m.genres.includes(g))
            );
        }

        // Genres (Exclude - OR logic)
        if (activeFilters.genres.exclude.length > 0) {
            filtered = filtered.filter(m =>
                !activeFilters.genres.exclude.some(g => m.genres && m.genres.includes(g))
            );
        }

        // Sorting
        switch (activeFilters.sort) {
            case 'az':
                filtered.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
                break;
            case 'za':
                filtered.sort((a, b) => b.title.localeCompare(a.title, 'uk'));
                break;
            case 'chapters':
                filtered.sort((a, b) => getChapterCount(b) - getChapterCount(a));
                break;
            case 'newest':
            default:
                filtered.sort((a, b) => {
                    const timeA = a.latestUpdate ? new Date(a.latestUpdate).getTime() : 0;
                    const timeB = b.latestUpdate ? new Date(b.latestUpdate).getTime() : 0;
                    return timeB - timeA;
                });
                break;
        }

        // Update count indicators
        if (counterText) counterText.textContent = filtered.length;
        if (sheetApplyBtn) sheetApplyBtn.textContent = `Показати ${filtered.length} тайтлів`;

        mangaGrid.innerHTML = '';

        // Empty state
        if (filtered.length === 0) {
            mangaGrid.innerHTML = `
                <div class="catalog-empty-state">
                    <i data-lucide="search-x" class="catalog-empty-icon"></i>
                    <h3>Нічого не знайдено</h3>
                    <p>За вашим запитом не знайдено жодного тайтлу. Спробуйте змінити фільтри або скинути параметри пошуку.</p>
                    <button type="button" class="b-filter-chip active" id="empty-reset-btn">Скинути всі фільтри</button>
                </div>
            `;
            const emptyResetBtn = mangaGrid.querySelector('#empty-reset-btn');
            if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);
            if (window.lucide) window.lucide.createIcons({ root: mangaGrid });
            return;
        }

        // Stream View (List Mode)
        if (activeFilters.view === 'stream') {
            mangaGrid.innerHTML = filtered.map(m => {
                const cover = getEffectiveCover(m);
                const lastCh = getChapterCount(m);
                const stClass = getStatusClass(m.status);
                const pageUrl = m.pageUrl || `#title?id=${m.slug || m.id}`;
                return `
                    <article class="hm-card">
                        <div class="hm-cover-wrap">
                            <img src="${cover}" alt="${m.title}" class="hm-cover" loading="lazy" decoding="async">
                        </div>
                        <div class="hm-card-info">
                            <div>
                                <div class="stream-head-row">
                                    <h3 class="hm-title"><a href="${pageUrl}">${m.title}</a></h3>
                                    <span class="hm-status-tag ${stClass}">${m.status || 'Виходить'}</span>
                                </div>
                                <div class="stream-tag-row">
                                    <span class="stream-tag format-tag">${m.type || 'Манхва'}</span>
                                    ${(m.genres || []).slice(0, 4).map(g => `<span class="stream-tag">${g}</span>`).join('')}
                                </div>
                            </div>
                            <div class="stream-foot-row">
                                <span class="hm-chapter">Розділ ${lastCh}</span>
                                <div class="stream-actions">
                                    <button type="button" class="stream-quick-btn" data-quick-id="${m.id}">
                                        <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Огляд
                                    </button>
                                    <a href="${pageUrl}" class="stream-read-btn">
                                        <i data-lucide="book-open" style="width: 13px; height: 13px;"></i> Читати
                                    </a>
                                </div>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

            // Bind quick view buttons
            mangaGrid.querySelectorAll('[data-quick-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.getAttribute('data-quick-id'));
                    openQuickView(id);
                });
            });
        } else {
            // Poster Grid Mode (Using native custom element <manga-card> for Hero transitions)
            const fragment = document.createDocumentFragment();
            filtered.forEach((manga, index) => {
                const card = document.createElement('manga-card');
                card.setAttribute('name', manga.title);
                card.setAttribute('image', getEffectiveCover(manga));
                card.setAttribute('url', manga.pageUrl || `#title?id=${manga.slug || manga.id}`);
                card.setAttribute('type', manga.type || 'Манхва');

                const lastCh = getChapterCount(manga);
                card.setAttribute('last-chapter', `Розділ ${lastCh}`);
                card.setAttribute('status', manga.status || 'Виходить');

                if (index < 12) {
                    card.classList.add('manga-card-animate');
                    card.style.animationDelay = `${index * 0.02}s`;
                }

                fragment.appendChild(card);
            });
            mangaGrid.appendChild(fragment);
        }

        if (window.lucide) {
            window.lucide.createIcons({ root: mangaGrid });
        }
    }

    // 9. QUICK-VIEW MODAL
    function openQuickView(mangaId) {
        if (!modalOverlay || !modalContentArea) return;
        const manga = mangaData.find(m => m.id === mangaId);
        if (!manga) return;

        const cover = getEffectiveCover(manga);
        const lastCh = getChapterCount(manga);
        const stClass = getStatusClass(manga.status);
        const pageUrl = manga.pageUrl || `#title?id=${manga.slug || manga.id}`;

        modalContentArea.innerHTML = `
            <div class="qv-body">
                <img src="${cover}" alt="${manga.title}" class="qv-poster">
                <div class="qv-details">
                    <div class="qv-badges">
                        <span class="sc-badge featured">${manga.type || 'Манхва'}</span>
                        <span class="sc-badge ${stClass}">${manga.status || 'Виходить'}</span>
                        <span class="sc-badge">Розділ ${lastCh}</span>
                    </div>
                    <h2 class="qv-title">${manga.title}</h2>
                    <div class="stream-tag-row">
                        ${(manga.genres || []).map(g => `<span class="stream-tag">${g}</span>`).join('')}
                    </div>
                    <p class="qv-desc">
                        Якісний український переклад від команди Gokuraku. Читайте зручно, без реклами та у високій роздільній здатності.
                    </p>
                    <div class="qv-foot">
                        <a href="${pageUrl}" class="sc-read-btn qv-main-btn">
                            <i data-lucide="book-open" style="width: 15px; height: 15px;"></i> Почати читати
                        </a>
                    </div>
                </div>
            </div>
        `;

        modalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        if (window.lucide) {
            window.lucide.createIcons({ root: modalContentArea });
        }
    }

    function closeQuickView() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (qvCloseBtn) qvCloseBtn.addEventListener('click', closeQuickView);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeQuickView();
        });
    }

    // 10. MOBILE BOTTOM SHEET
    function populateMobileSheet() {
        if (!sheetContentBody) return;

        sheetContentBody.innerHTML = `
            <div class="cs-section">
                <div class="cs-section-title"><span>Формат контенту</span></div>
                <div class="b-chips-row" data-filter-group="type">
                    <button type="button" class="b-filter-chip ${activeFilters.type === 'all' ? 'active' : ''}" data-type="all">Всі</button>
                    <button type="button" class="b-filter-chip ${activeFilters.type === 'Манхва' ? 'active' : ''}" data-type="Манхва">Манхва</button>
                    <button type="button" class="b-filter-chip ${activeFilters.type === 'Манґа' ? 'active' : ''}" data-type="Манґа">Манґа</button>
                    <button type="button" class="b-filter-chip ${activeFilters.type === 'Маньхва' ? 'active' : ''}" data-type="Маньхва">Маньхва</button>
                    <button type="button" class="b-filter-chip ${activeFilters.type === 'Роман' ? 'active' : ''}" data-type="Роман">Роман</button>
                </div>
            </div>
            <div class="cs-section">
                <div class="cs-section-title"><span>Статус перекладу</span></div>
                <div class="b-chips-row" data-filter-group="status">
                    <button type="button" class="b-filter-chip ${activeFilters.status === 'all' ? 'active' : ''}" data-status="all">Всі</button>
                    <button type="button" class="b-filter-chip ${activeFilters.status === 'Виходить' ? 'active' : ''}" data-status="Виходить">Виходить</button>
                    <button type="button" class="b-filter-chip ${activeFilters.status === 'Завершено' ? 'active' : ''}" data-status="Завершено">Завершено</button>
                    <button type="button" class="b-filter-chip ${activeFilters.status === 'Закинуто' ? 'active' : ''}" data-status="Закинуто">Закинуто</button>
                </div>
            </div>
            <div class="cs-section">
                <div class="cs-section-title"><span>Обсяг тайтла (розділи)</span></div>
                <div class="b-chips-row" data-filter-group="length">
                    <button type="button" class="b-filter-chip ${activeFilters.length === 'all' ? 'active' : ''}" data-len="all">Будь-який</button>
                    <button type="button" class="b-filter-chip ${activeFilters.length === 'short' ? 'active' : ''}" data-len="short">&lt; 10</button>
                    <button type="button" class="b-filter-chip ${activeFilters.length === 'medium' ? 'active' : ''}" data-len="medium">10–50</button>
                    <button type="button" class="b-filter-chip ${activeFilters.length === 'long' ? 'active' : ''}" data-len="long">50+</button>
                </div>
            </div>
            <div class="cs-section">
                <div class="cs-section-title">
                    <span>Жанри</span>
                </div>
                <div class="genre-search-field" style="margin-bottom: 0.5rem;">
                    <input type="text" id="mobile-genre-search" placeholder="Пошук жанру..." autocomplete="off">
                </div>
                <div class="genre-chips-wrap" id="mobile-genre-chips">
                    ${sortedGenres.map(g => {
                        const state = getGenreState(g);
                        const stateClass = state === 'none' ? '' : ` ${state}`;
                        return `
                            <button type="button" class="tri-chip${stateClass}" data-genre="${g}">
                                <span class="chip-state-indicator"></span>
                                <span class="genre-name">${g}</span>
                                <span class="tri-chip-cnt">${genreCounts[g]}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        bindFilterChipContainer(sheetContentBody);

        const mobileGenreSearch = document.getElementById('mobile-genre-search');
        const mobileGenreChips = document.getElementById('mobile-genre-chips');

        if (mobileGenreChips) {
            mobileGenreChips.addEventListener('click', (e) => {
                const btn = e.target.closest('.tri-chip');
                if (btn && btn.dataset.genre) {
                    toggleGenre(btn.dataset.genre);
                }
            });
        }

        if (mobileGenreSearch && mobileGenreChips) {
            mobileGenreSearch.addEventListener('input', (e) => {
                filterGenreList(e.target.value, mobileGenreChips);
            });
        }

        if (window.lucide) {
            window.lucide.createIcons({ root: sheetContentBody });
        }
    }

    function openMobileSheet() {
        if (!sheetBackdrop || !bottomSheet) return;
        sheetBackdrop.classList.add('open');
        bottomSheet.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSheet() {
        if (!sheetBackdrop || !bottomSheet) return;
        sheetBackdrop.classList.remove('open');
        bottomSheet.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (mobileDockFilterBtn) mobileDockFilterBtn.addEventListener('click', openMobileSheet);
    if (sheetCloseBtn) sheetCloseBtn.addEventListener('click', closeMobileSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeMobileSheet);
    if (sheetApplyBtn) sheetApplyBtn.addEventListener('click', closeMobileSheet);
    if (sheetResetBtn) sheetResetBtn.addEventListener('click', resetAllFilters);

    // 11. INITIALIZATION
    setViewMode(savedViewMode);
    rollNextRandomTitle(false);
    populateMobileSheet();
    renderManga();
    updateActiveFiltersUI();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}
