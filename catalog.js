import { MangaCard } from './js/components.js';

export function initCatalog(mangaData, initialGenres = []) {
    // DOM Elements
    const mangaGrid = document.querySelector('.manga-grid');
    const searchInput = document.getElementById('search-input');
    const sidebarContent = document.querySelector('.sidebar-content');
    const mobileFiltersContent = document.querySelector('.mobile-filters-content');
    const activeFiltersContainer = document.getElementById('active-filters');
    const mobileFilterTrigger = document.querySelector('.mobile-filter-trigger');
    const mobilePanelOverlay = document.querySelector('.mobile-filters-panel-overlay');
    const mobilePanel = document.querySelector('.mobile-filters-panel');
    const closeFiltersBtn = document.querySelector('.close-filters-btn');

    if (!mangaGrid || !searchInput || !sidebarContent || !mobileFiltersContent) {
        console.error("One or more catalog elements are missing from the DOM.");
        return;
    }
    
    // Data
    const allGenres = [...new Set(mangaData.flatMap(m => m.genres))];
    const allTypes = [...new Set(mangaData.map(m => m.type))];
    const sortOptions = [
        { id: 'newest', name: 'За оновленням (новіші)' },
        { id: 'oldest', name: 'За оновленням (старіші)' },
        { id: 'az', name: 'За алфавітом (А-Я)' },
        { id: 'za', name: 'За алфавітом (Я-А)' },
    ];

    // State
    let activeFilters = {
        search: '',
        genres: { include: initialGenres, exclude: [] },
        types: { include: [], exclude: [] },
        sort: 'newest'
    };

    function getFilterState(type, value) {
        if (activeFilters[type].include.includes(value)) return 'include';
        if (activeFilters[type].exclude.includes(value)) return 'exclude';
        return 'none';
    }
    
    function populateFilters(container) {
        container.innerHTML = `
            <div class="filter-group">
                <h3>Жанри</h3>
                <div class="filter-options genres-list">
                    ${allGenres.map(genre => `
                        <label data-type="genres" data-value="${genre}">
                            <span class="custom-checkbox" data-state="${getFilterState('genres', genre)}"></span>
                            ${genre}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="filter-group">
                <h3>Тип</h3>
                <div class="filter-options types-list">
                    ${allTypes.map(type => `
                        <label data-type="types" data-value="${type}">
                            <span class="custom-checkbox" data-state="${getFilterState('types', type)}"></span>
                            ${type}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="filter-group">
                <h3>Сортувати</h3>
                <div class="filter-options sort-list">
                     ${sortOptions.map(opt => `
                        <label>
                            <input type="radio" name="sort-group-${container.className}" data-type="sort" value="${opt.id}" ${activeFilters.sort === opt.id ? 'checked' : ''}>
                            <span class="custom-radio"></span>
                            ${opt.name}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderManga() {
        let filteredManga = [...mangaData];

        // Search filter
        if (activeFilters.search) {
            filteredManga = filteredManga.filter(m => 
                m.title.toLowerCase().includes(activeFilters.search.toLowerCase())
            );
        }

        // Include filters (AND logic)
        if (activeFilters.genres.include.length > 0) {
            filteredManga = filteredManga.filter(m =>
                activeFilters.genres.include.every(g => m.genres.includes(g))
            );
        }
        if (activeFilters.types.include.length > 0) {
            filteredManga = filteredManga.filter(m => 
                activeFilters.types.include.every(t => m.type === t)
            );
        }

        // Exclude filters (OR logic)
        if (activeFilters.genres.exclude.length > 0) {
            filteredManga = filteredManga.filter(m =>
                !activeFilters.genres.exclude.some(g => m.genres.includes(g))
            );
        }
        if (activeFilters.types.exclude.length > 0) {
            filteredManga = filteredManga.filter(m =>
                !activeFilters.types.exclude.some(t => m.type === t)
            );
        }

        // Apply sort
        switch(activeFilters.sort) {
            case 'az': filteredManga.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'za': filteredManga.sort((a, b) => b.title.localeCompare(a.title)); break;
            case 'oldest': filteredManga.sort((a, b) => new Date(a.latestUpdate) - new Date(b.latestUpdate)); break;
            case 'newest': default: filteredManga.sort((a, b) => new Date(b.latestUpdate) - new Date(a.latestUpdate)); break;
        }

        mangaGrid.innerHTML = '';
        if (filteredManga.length === 0) {
            mangaGrid.innerHTML = '<p style="color: var(--secondary-text); text-align: center; grid-column: 1 / -1;">Нічого не знайдено за вашим запитом.</p>';
            return;
        }

        filteredManga.forEach(manga => {
            const card = document.createElement('manga-card');
            card.setAttribute('name', manga.title);
            card.setAttribute('image', manga.coverImage);
            card.setAttribute('url', manga.pageUrl);
            card.setAttribute('type', manga.type);
            if (manga.chapters && manga.chapters.length > 0) {
                 card.setAttribute('last-chapter', `Розділ ${manga.chapters[manga.chapters.length - 1].chapter}`);
            }
            card.setAttribute('status', manga.status);
            mangaGrid.appendChild(card);
        });
    }

    function updateActiveFiltersUI() {
        activeFiltersContainer.innerHTML = '';
        const hasFilters = activeFilters.search || activeFilters.genres.include.length || activeFilters.genres.exclude.length || activeFilters.types.include.length || activeFilters.types.exclude.length || activeFilters.sort !== 'newest';
        
        if (!hasFilters) {
            activeFiltersContainer.style.display = 'none';
            return;
        }
        activeFiltersContainer.style.display = 'flex';
        
        if (activeFilters.search) createFilterTag('search', 'search', activeFilters.search, '');
        
        activeFilters.genres.include.forEach(v => createFilterTag('genres', v, v, 'include'));
        activeFilters.genres.exclude.forEach(v => createFilterTag('genres', v, v, 'exclude'));
        activeFilters.types.include.forEach(v => createFilterTag('types', v, v, 'include'));
        activeFilters.types.exclude.forEach(v => createFilterTag('types', v, v, 'exclude'));

        if (activeFilters.sort !== 'newest') {
             const sortOption = sortOptions.find(opt => opt.id === activeFilters.sort);
             if (sortOption) createFilterTag('sort', 'sort', `Сорт: ${sortOption.name}`, '');
        }
    }

    function createFilterTag(type, value, text, mode) {
        const tag = document.createElement('div');
        tag.className = `filter-tag ${mode}`;
        tag.textContent = text;
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-tag';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => removeFilter(type, value, mode);
        
        tag.appendChild(removeBtn);
        activeFiltersContainer.appendChild(tag);
    }

    function syncFilterStates(type, value, newState) {
        document.querySelectorAll(`label[data-type="${type}"][data-value="${value}"] .custom-checkbox`).forEach(el => {
            el.dataset.state = newState;
        });
    }

    function removeFilter(type, value, mode) {
        if (type === 'search') {
            activeFilters.search = '';
            searchInput.value = '';
        } else if (type === 'sort') {
            activeFilters.sort = 'newest';
            document.querySelectorAll('input[data-type="sort"]').forEach(input => {
                input.checked = input.value === 'newest';
            });
        } else {
            if (mode === 'include') {
                activeFilters[type].include = activeFilters[type].include.filter(item => item !== value);
            } else if (mode === 'exclude') {
                activeFilters[type].exclude = activeFilters[type].exclude.filter(item => item !== value);
            }
            syncFilterStates(type, value, 'none');
        }

        renderManga();
        updateActiveFiltersUI();
    }
    
    function handleFilterClick(e) {
        const label = e.target.closest('label');
        if (!label) return;

        // Handle radio buttons for sorting
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
            if (radio.checked) {
                activeFilters.sort = radio.value;
                document.querySelectorAll(`input[data-type="sort"]`).forEach(r => r.checked = r.value === radio.value);
                renderManga();
                updateActiveFiltersUI();
            }
            return;
        }

        // Handle 3-state checkboxes
        const type = label.dataset.type;
        const value = label.dataset.value;
        if (!type || !value) return;
        
        const checkbox = label.querySelector('.custom-checkbox');
        const currentState = checkbox.dataset.state;
        let nextState;

        // Cycle through states: none -> include -> exclude -> none
        if (currentState === 'none') nextState = 'include';
        else if (currentState === 'include') nextState = 'exclude';
        else nextState = 'none';

        // Update state object
        activeFilters[type].include = activeFilters[type].include.filter(item => item !== value);
        activeFilters[type].exclude = activeFilters[type].exclude.filter(item => item !== value);
        if (nextState === 'include') activeFilters[type].include.push(value);
        if (nextState === 'exclude') activeFilters[type].exclude.push(value);
        
        // Update UI
        syncFilterStates(type, value, nextState);
        renderManga();
        updateActiveFiltersUI();
    }
    
    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        renderManga();
        updateActiveFiltersUI();
    });

    sidebarContent.addEventListener('click', handleFilterClick);
    mobileFiltersContent.addEventListener('click', handleFilterClick);

    // Mobile Panel Logic
    mobileFilterTrigger.addEventListener('click', () => {
        mobilePanelOverlay.style.display = 'block';
        setTimeout(() => { mobilePanel.style.transform = 'translateY(0)'; }, 10);
    });

    const closePanel = () => {
        mobilePanel.style.transform = 'translateY(100%)';
        setTimeout(() => { mobilePanelOverlay.style.display = 'none'; }, 300);
    };

    closeFiltersBtn.addEventListener('click', closePanel);
    mobilePanelOverlay.addEventListener('click', (e) => {
        if (e.target === mobilePanelOverlay) closePanel();
    });

    // Initial Load
    populateFilters(sidebarContent);
    populateFilters(mobileFiltersContent);
    renderManga();
    updateActiveFiltersUI();
}