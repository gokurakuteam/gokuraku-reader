function getStatusClass(status) {
    switch (status) {
        case 'Виходить': return 'status-ongoing';
        case 'Завершено': return 'status-completed';
        case 'Закинуто': return 'status-frozen';
        default: return '';
    }
}

export class AppHeader extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 1rem;
                    background: linear-gradient(to bottom, var(--background-dark) 60%, transparent);
                    position: sticky;
                    top: 0;
                    z-index: 10000;
                    pointer-events: none;
                }
                :host(.hidden) {
                    display: none !important;
                }
                .header {
                    pointer-events: auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: var(--card-background);
                    padding: 0.5rem 1.5rem;
                    border-radius: 100px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                    margin: 0 auto;
                    max-width: 1200px;
                }
                .logo {
                    display: inline-flex;
                    align-items: center;
                    text-decoration: none;
                    color: var(--accent-color);
                    padding: 0.2rem 0.4rem;
                    cursor: pointer;
                    user-select: none;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 1.8rem;
                    font-weight: 800;
                    line-height: 1;
                    transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), filter 0.25s ease;
                }
                .logo:hover {
                    filter: drop-shadow(0 2px 10px var(--glow-color));
                }
                .logo:hover .flower-spin {
                    animation-duration: 6s;
                }
                .logo:hover .logo-flower {
                    opacity: 0.38;
                    filter: drop-shadow(0 0 6px var(--glow-color));
                }
                .logo-mark {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }
                .logo-flower {
                    position: absolute;
                    left: calc(50% + 0.5px);
                    top: calc(50% + 1.5px);
                    width: 38px;
                    height: 38px;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    fill: currentColor;
                    opacity: 0.22;
                    transition: opacity 0.3s ease, filter 0.3s ease;
                }
                .flower-spin {
                    transform-origin: 0 0;
                    animation: flower-idle 14s linear infinite;
                }
                .logo-g {
                    position: relative;
                    z-index: 2;
                    color: var(--accent-color);
                    line-height: 1;
                    display: inline-block;
                }
                .logo-text {
                    color: var(--accent-color);
                    line-height: 1;
                    letter-spacing: -0.02em;
                    display: inline-block;
                    margin-inline-start: 0.4rem;
                }
                @keyframes flower-idle {
                    0% {
                        transform: rotate(0deg) scale(1);
                    }
                    50% {
                        transform: rotate(180deg) scale(1.06);
                    }
                    100% {
                        transform: rotate(360deg) scale(1);
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .flower-spin {
                        animation: none !important;
                    }
                }
                nav {
                    display: flex;
                }
                nav a {
                    color: var(--text-light);
                    text-decoration: none;
                    margin-inline-start: 0.5rem;
                    padding: 0.5rem 1rem;
                    border-radius: 100px;
                    display: flex;
                    align-items: center;
                    font-weight: 600;
                    transition: background-color 0.3s ease, color 0.3s ease;
                }
                nav a.active, nav a:hover {
                    background-color: var(--hover-state);
                }
                nav a.active {
                    color: var(--accent-color);
                    background-color: var(--glow-color);
                }
                .icon {
                    display: none;
                    width: 28px;
                    height: 28px;
                    fill: currentColor;
                }
                .text {
                    display: inline;
                }

                @media (max-width: 768px) {
                    :host {
                        position: fixed;
                        top: auto;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        padding: 0;
                        z-index: 10000;
                        background: none;
                        pointer-events: auto;
                        transition: transform 0.3s ease;
                    }
                     :host(.hidden) {
                        transform: translateY(100%);
                    }
                    .header {
                        justify-content: center;
                        border-radius: 32px 32px 0 0;
                        padding: 0.5rem 1rem;
                        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
                    }
                    .logo {
                        display: none;
                    }
                    nav {
                        width: 100%;
                        justify-content: space-around;
                    }
                    nav a {
                        flex-direction: column;
                        margin-inline-start: 0;
                        padding: 0.5rem;
                        color: var(--secondary-text);
                        border-radius: 16px;
                    }
                    nav a.active {
                        color: var(--accent-color);
                        background-color: var(--glow-color);
                    }
                    .icon {
                        display: inline;
                        margin-bottom: 4px;
                    }
                    .text {
                        font-size: 0.75rem;
                    }
                    .header-search-wrap {
                        display: none;
                    }
                }

                /* Header Search Bar (Desktop) */
                .header-search-wrap {
                    position: relative;
                    flex: 1 1 300px;
                    margin: 0 1.25rem;
                    margin-left: 15rem;
                }
                .header-search {
                    position: relative;
                    display: flex;
                    align-items: center;
                    background: var(--background-dark);
                    border: 1px solid var(--border-color);
                    border-radius: 100px;
                    padding: 0.42rem 0.9rem;
                    gap: 0.6rem;
                    transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
                }
                .header-search:focus-within {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 3px var(--glow-color);
                    background: var(--card-background);
                }
                .header-search input {
                    border: none;
                    background: transparent;
                    color: var(--text-light);
                    font-family: inherit;
                    font-size: 0.88rem;
                    width: 100%;
                    outline: none;
                }
                .header-search input::placeholder {
                    color: var(--secondary-text);
                    font-size: 0.85rem;
                }
                .search-icon-svg {
                    width: 16px;
                    height: 16px;
                    color: var(--secondary-text);
                    flex-shrink: 0;
                }
                .search-clear-btn {
                    background: transparent;
                    border: none;
                    color: var(--secondary-text);
                    cursor: pointer;
                    padding: 0.2rem;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .search-clear-btn:hover { color: var(--text-light); }

                /* Suggestions Popover */
                .search-suggestions-popover {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: var(--card-background);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
                    padding: 0.5rem;
                    display: none;
                    z-index: 1001;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .search-suggestions-popover.active {
                    display: block;
                    animation: sugFade 0.2s cubic-bezier(0.05, 0.7, 0.1, 1);
                }
                @keyframes sugFade {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .sug-header {
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--secondary-text);
                    padding: 0.3rem 0.5rem;
                }
                .sug-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.45rem 0.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    color: var(--text-light);
                    transition: background-color 0.2s;
                }
                .sug-item:hover {
                    background: var(--hover-state);
                }
                .sug-thumb {
                    width: 30px;
                    height: 42px;
                    border-radius: 6px;
                    object-fit: cover;
                    flex-shrink: 0;
                }
                .sug-info { flex: 1; overflow: hidden; text-align: left; }
                .sug-title {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .sug-meta {
                    display: block;
                    font-size: 0.72rem;
                    color: var(--secondary-text);
                }
            </style>
            <header class="header">
                <a href="#" class="logo" data-page="home" title="Gokuraku — На головну" aria-label="Gokuraku">
                    <span class="logo-mark">
                        <svg class="logo-flower" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
                            <g class="flower-spin">
                                <path d="M 0.00 -44.00 C 4.59 -44.00, 8.59 -35.41, 13.78 -33.26 C 18.96 -31.11, 27.87 -34.36, 31.11 -31.11 C 34.36 -27.87, 31.11 -18.96, 33.26 -13.78 C 35.41 -8.59, 44.00 -4.59, 44.00 0.00 C 44.00 4.59, 35.41 8.59, 33.26 13.78 C 31.11 18.96, 34.36 27.87, 31.11 31.11 C 27.87 34.36, 18.96 31.11, 13.78 33.26 C 8.59 35.41, 4.59 44.00, 0.00 44.00 C -4.59 44.00, -8.59 35.41, -13.78 33.26 C -18.96 31.11, -27.87 34.36, -31.11 31.11 C -34.36 27.87, -31.11 18.96, -33.26 13.78 C -35.41 8.59, -44.00 4.59, -44.00 0.00 C -44.00 -4.59, -35.41 -8.59, -33.26 -13.78 C -31.11 -18.96, -34.36 -27.87, -31.11 -31.11 C -27.87 -34.36, -18.96 -31.11, -13.78 -33.26 C -8.59 -35.41, -4.59 -44.00, 0.00 -44.00 Z" />
                            </g>
                        </svg>
                        <span class="logo-g">G</span>
                    </span><span class="logo-text">okuraku</span>
                </a>

                <!-- Десктопний пошук -->
                <div class="header-search-wrap">
                    <div class="header-search" id="header-search-bar">
                        <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" placeholder="Пошук манґи, авторів..." id="header-search-input" autocomplete="off">
                        <button class="search-clear-btn" id="header-search-clear" aria-label="Очистити">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="search-suggestions-popover" id="header-search-popover"></div>
                </div>

                <nav>
                     <a href="#" data-page="home" class="active">
                        <i data-lucide="home" class="icon"></i>
                        <span class="text">Головна</span>
                    </a>
                    <a href="#catalog" data-page="catalog">
                        <i data-lucide="library" class="icon"></i>
                        <span class="text">Каталог</span>
                    </a>
                    <a href="#cabinet" data-page="cabinet">
                         <i data-lucide="user" class="icon"></i>
                        <span class="text">Кабінет</span>
                    </a>
                </nav>
            </header>
        `;
        shadow.appendChild(wrapper);
        
        // Пошукова логіка в шапці
        const searchInput = shadow.getElementById('header-search-input');
        const searchClear = shadow.getElementById('header-search-clear');
        const searchPopover = shadow.getElementById('header-search-popover');
        let searchDataCache = null;

        const loadSearchData = async () => {
            if (searchDataCache) return searchDataCache;
            try {
                const res = await fetch('api/manga-list.json');
                if (res.ok) {
                    searchDataCache = await res.json();
                }
            } catch (e) {
                console.error(e);
            }
            return searchDataCache || [];
        };

        const renderSuggestions = (query, list) => {
            if (!query) {
                // Показати швидкі рекомендації
                const top5 = list.slice(0, 4);
                searchPopover.innerHTML = `
                    <div class="sug-header">Рекомендації</div>
                    ${top5.map(m => `
                        <a href="${m.pageUrl}" class="sug-item">
                            <img src="${m.coverImage}" alt="${m.title}" class="sug-thumb">
                            <div class="sug-info">
                                <span class="sug-title">${m.title}</span>
                                <span class="sug-meta">${m.type || 'Манхва'} • ${m.genres ? m.genres.slice(0, 2).join(', ') : ''}</span>
                            </div>
                        </a>
                    `).join('')}
                `;
            } else {
                const filtered = list.filter(m => 
                    m.title.toLowerCase().includes(query.toLowerCase())
                ).slice(0, 5);

                if (filtered.length === 0) {
                    searchPopover.innerHTML = `<div class="sug-header" style="text-align: center; padding: 0.8rem 0;">Нічого не знайдено</div>`;
                } else {
                    searchPopover.innerHTML = `
                        <div class="sug-header">Результати пошуку</div>
                        ${filtered.map(m => `
                            <a href="${m.pageUrl}" class="sug-item">
                                <img src="${m.coverImage}" alt="${m.title}" class="sug-thumb">
                                <div class="sug-info">
                                    <span class="sug-title">${m.title}</span>
                                    <span class="sug-meta">${m.type || 'Манхва'} • ${m.genres ? m.genres.slice(0, 2).join(', ') : ''}</span>
                                </div>
                            </a>
                        `).join('')}
                    `;
                }
            }
            searchPopover.classList.add('active');
        };

        searchInput?.addEventListener('focus', async () => {
            const list = await loadSearchData();
            renderSuggestions(searchInput.value.trim(), list);
        });

        searchInput?.addEventListener('input', async (e) => {
            const val = e.target.value.trim();
            if (val.length > 0) {
                searchClear.style.display = 'inline-flex';
            } else {
                searchClear.style.display = 'none';
            }
            const list = await loadSearchData();
            renderSuggestions(val, list);
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = searchInput.value.trim();
                searchPopover.classList.remove('active');
                window.location.hash = val ? `#catalog?search=${encodeURIComponent(val)}` : '#catalog';
            }
        });

        searchClear?.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            searchInput.focus();
            loadSearchData().then(list => renderSuggestions('', list));
        });

        const handleOutsideClick = (e) => {
            const path = e.composedPath ? e.composedPath() : [];
            const isInside = path.includes(this) && (path.includes(searchInput) || path.includes(searchPopover) || path.includes(searchClear));
            if (!isInside) {
                searchPopover?.classList.remove('active');
            }
        };

        window.addEventListener('pointerdown', handleOutsideClick);
        window.addEventListener('click', handleOutsideClick);

        // Wait for Lucide to load before creating icons
        if (window.lucide) {
            lucide.createIcons({ root: shadow });
        } else {
            window.addEventListener('load', () => {
                if (window.lucide) lucide.createIcons({ root: shadow });
            });
        }
    }
}

const MANGA_CARD_CSS = `
    :host {
        display: block;
    }
    .card {
        position: relative;
        background-color: var(--card-background);
        border-radius: 24px;
        overflow: hidden;
        text-decoration: none;
        color: var(--text-light);
        display: flex;
        flex-direction: column;
        height: 100%;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        transition: transform 0.4s var(--md-sys-motion-easing-emphasized), box-shadow 0.4s var(--md-sys-motion-easing-emphasized);
    }
    .card:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2), 0 0 20px var(--glow-color);
    }
    .card-image-container {
        width: 100%;
        aspect-ratio: 2 / 3;
        position: relative;
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        overflow: hidden;
        background-color: rgba(255, 255, 255, 0.05);
    }
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s var(--md-sys-motion-easing-emphasized);
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
    }
    .card:hover img {
        transform: scale(1.08);
    }
    .card-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(to top, var(--overlay-color-start) 25%, var(--overlay-color-end) 70%);
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        transition: background 0.3s ease;
    }
    .card-info {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 1rem;
        text-align: left;
    }
    h3 {
        margin: 0 0 0.25rem 0;
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.3;
        text-shadow: 0 2px 5px rgba(0,0,0,0.1);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: var(--text-on-overlay); 
    }
    .last-chapter {
        font-size: 0.9rem;
        color: var(--text-secondary-on-overlay); 
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .card-meta {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        right: 0.5rem;
        display: flex;
        justify-content: space-between;
        gap: 0.25rem;
    }
    .meta-tag {
        background-color: rgba(20, 20, 20, 0.8);
        backdrop-filter: blur(5px);
        color: white;
        padding: 0.2rem 0.4rem;
        border-radius: 6px;
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 48%;
    }
    .status-tag {
        color: white;
    }
    .status-ongoing { background-color: #28a745; }
    .status-completed { background-color: #007bff; }
    .status-frozen { background-color: #6c757d; }
`;

let mangaCardSheet = null;
function getMangaCardSheet() {
    if (!mangaCardSheet && typeof CSSStyleSheet !== 'undefined') {
        try {
            mangaCardSheet = new CSSStyleSheet();
            mangaCardSheet.replaceSync(MANGA_CARD_CSS);
        } catch (e) {
            mangaCardSheet = null;
        }
    }
    return mangaCardSheet;
}

export class MangaCard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const sheet = getMangaCardSheet();
        if (sheet && shadow.adoptedStyleSheets !== undefined) {
            shadow.adoptedStyleSheets = [sheet];
        }
    }

    connectedCallback() {
        const name = this.getAttribute('name');
        const image = this.getAttribute('image');
        const url = this.getAttribute('url');
        const type = this.getAttribute('type');
        const lastChapter = this.getAttribute('last-chapter');
        const status = this.getAttribute('status');
        const statusClass = getStatusClass(status);

        if (this.shadowRoot.innerHTML !== '') return;

        const hasAdoptedSheets = this.shadowRoot.adoptedStyleSheets && this.shadowRoot.adoptedStyleSheets.length > 0;
        const styleTag = hasAdoptedSheets ? '' : `<style>${MANGA_CARD_CSS}</style>`;

        this.shadowRoot.innerHTML = `
            ${styleTag}
            <a href="${url}" class="card">
                <div class="card-image-container">
                    <img src="${image}" alt="${name}" loading="lazy" decoding="async">
                    <div class="card-overlay"></div>
                    <div class="card-meta">
                         ${type ? `<span class="meta-tag">${type}</span>` : ''}
                         ${status ? `<span class="meta-tag status-tag ${statusClass}">${status}</span>` : ''}
                    </div>
                    <div class="card-info">
                        <h3>${name}</h3>
                         ${lastChapter ? `<p class="last-chapter">${lastChapter}</p>` : ''}
                    </div>
                </div>
            </a>
        `;
    }

    getCoverImage() {
        return this.shadowRoot?.querySelector('img');
    }

    getCardElement() {
        return this.shadowRoot?.querySelector('.card');
    }
}
