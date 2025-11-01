export function initCatalog(mangaData, initialGenres = []) {
    const allGenres = [...new Set(mangaData.flatMap(m => m.genres))];
    const allTypes = [...new Set(mangaData.map(m => m.type))];
    const sortOptions = [
        { id: 'az', name: 'За алфавітом (А-Я)' },
        { id: 'za', name: 'За алфавітом (Я-А)' },
        { id: 'newest', name: 'За оновленням (новіші)' },
        { id: 'oldest', name: 'За оновленням (старіші)' },
    ];

    const mangaGrid = document.querySelector('.manga-grid');
    const searchInput = document.getElementById('search-input');
    const genreDropdown = document.getElementById('genre-dropdown');
    const typeDropdown = document.getElementById('type-dropdown');
    const sortDropdown = document.getElementById('sort-dropdown');
    const activeFiltersContainer = document.getElementById('active-filters');

    if (!mangaGrid || !searchInput || !genreDropdown || !typeDropdown || !sortDropdown || !activeFiltersContainer) {
        console.error("One or more catalog elements are missing from the DOM.");
        return;
    }

    let activeFilters = {
        search: '',
        genres: initialGenres,
        types: [],
        sort: 'newest'
    };

    function populateDropdown(dropdownElem, items, type) {
        dropdownElem.innerHTML = '';
        items.forEach(item => {
            const id = typeof item === 'object' ? item.id : item;
            const name = typeof item === 'object' ? item.name : item;

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = (type === 'sort') ? 'radio' : 'checkbox';
            checkbox.value = id;
            checkbox.dataset.type = type;
            checkbox.name = (type === 'sort') ? 'sort-group' : id;
            
            if (type === 'genres' && activeFilters.genres.includes(id)) {
                checkbox.checked = true;
            }

            const customCheckmark = document.createElement('span');
            customCheckmark.className = `custom-${checkbox.type}`;

            label.appendChild(checkbox);
            label.appendChild(customCheckmark);
            label.append(name);
            dropdownElem.appendChild(label);
        });
    }

    populateDropdown(genreDropdown, allGenres, 'genres');
    populateDropdown(typeDropdown, allTypes, 'types');
    populateDropdown(sortDropdown, sortOptions, 'sort');
    
    const defaultSort = sortDropdown.querySelector('input[value="newest"]');
    if (defaultSort) {
        defaultSort.checked = true;
    }

    function renderManga() {
        let filteredManga = [...mangaData];

        // Apply filters
        if (activeFilters.search) {
            filteredManga = filteredManga.filter(m => 
                m.title.toLowerCase().includes(activeFilters.search.toLowerCase())
            );
        }
        if (activeFilters.genres.length > 0) {
            filteredManga = filteredManga.filter(m =>
                activeFilters.genres.every(g => m.genres.includes(g))
            );
        }
        if (activeFilters.types.length > 0) {
            filteredManga = filteredManga.filter(m => activeFilters.types.includes(m.type));
        }

        // Apply sort
        switch(activeFilters.sort) {
            case 'az':
                filteredManga.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'za':
                filteredManga.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'oldest':
                filteredManga.sort((a, b) => new Date(a.latestUpdate) - new Date(b.latestUpdate));
                break;
            case 'newest':
            default:
                filteredManga.sort((a, b) => new Date(b.latestUpdate) - new Date(a.latestUpdate));
                break;
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
        
        if (activeFilters.search) {
            createFilterTag('search', activeFilters.search, activeFilters.search);
        }
        activeFilters.genres.forEach(value => createFilterTag('genres', value, value));
        activeFilters.types.forEach(value => createFilterTag('types', value, value));

        if (activeFilters.sort && activeFilters.sort !== 'newest') {
             const sortOption = sortOptions.find(opt => opt.id === activeFilters.sort);
             if (sortOption) {
                createFilterTag('sort', sortOption.id, sortOption.name);
             }
        }
    }

    function createFilterTag(type, value, text) {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.textContent = text;
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-tag';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => removeFilter(type, value);
        
        tag.appendChild(removeBtn);
        activeFiltersContainer.appendChild(tag);
    }

    function removeFilter(type, value) {
        if (type === 'search') {
            activeFilters.search = '';
            searchInput.value = '';
        } else if (type === 'sort') {
            activeFilters.sort = 'newest';
            document.querySelector('input[data-type="sort"][value="newest"]').checked = true;
        } else {
            activeFilters[type] = activeFilters[type].filter(item => item !== value);
            document.querySelector(`input[data-type="${type}"][value="${value}"]`).checked = false;
        }

        renderManga();
        updateActiveFiltersUI();
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
    }

    searchInput.addEventListener('input', (e) => {
        setTimeout(() => {
            activeFilters.search = e.target.value;
            renderManga();
            updateActiveFiltersUI();
        }, 300);
    });

    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('change', (e) => {
            const input = e.target;
            const type = input.dataset.type;
            const value = input.value;

            if (type === 'sort') {
                activeFilters.sort = value;
            } else {
                if (input.checked) {
                    if (!activeFilters[type].includes(value)) {
                        activeFilters[type].push(value);
                    }
                } else {
                    activeFilters[type] = activeFilters[type].filter(item => item !== value);
                }
            }
            renderManga();
            updateActiveFiltersUI();
        });
    });

    document.querySelectorAll('.dropdown-toggle').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdownId = button.dataset.dropdown;
            const dropdownMenu = document.getElementById(dropdownId);
            const isCurrentlyShown = dropdownMenu.classList.contains('show');
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
            if (!isCurrentlyShown) {
                dropdownMenu.classList.add('show');
            }
        });
    });

    window.addEventListener('click', function(e) {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
      }
    });

    renderManga();
    updateActiveFiltersUI();
}
