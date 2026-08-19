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
                    z-index: 1000;
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
                    font-size: 1.8rem;
                    font-weight: bold;
                    color: var(--accent-color);
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
                        z-index: 1000;
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
                }
            </style>
            <header class="header">
                <div class="logo">Gokuraku</div>
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

export class MangaCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
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

        this.shadowRoot.innerHTML = `
            <style>
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
                    /* Текст адаптується під градієнт (світлий на темному, темний на світлому) */
                    color: var(--text-on-overlay); 
                }
                 .last-chapter {
                    font-size: 0.9rem;
                    /* Вторинний текст також адаптується */
                    color: var(--text-secondary-on-overlay); 
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                 }
                /* -------------------------------------- */
                
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
                    color: white; /* Мета-теги завжди темні з білим текстом для читабельності поверх картинки */
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
            </style>
            <a href="${url}" class="card">
                <div class="card-image-container">
                    <img src="${image}" alt="${name}">
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
}