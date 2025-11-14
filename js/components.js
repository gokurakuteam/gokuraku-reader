function getStatusClass(status) {
    switch (status) {
        case 'Виходить':
            return 'status-ongoing';
        case 'Завершено':
            return 'status-completed';
        case 'Закинуто':
            return 'status-frozen';
        default:
            return '';
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
                    padding: 1rem 2rem;
                    background-color: var(--card-background);
                    border-bottom: 1px solid var(--border-color);
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
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
                    margin-inline-start: 1.5rem;
                    display: flex;
                    align-items: center;
                    font-weight: 500;
                    position: relative;
                }
                nav a::after {
                    content: '';
                    position: absolute;
                    bottom: -5px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background-color: var(--accent-color);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }
                nav a.active::after, nav a:hover::after {
                    transform: scaleX(1);
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
                        bottom: 0;
                        left: 0;
                        right: 0;
                        border-top: 1px solid var(--border-color);
                        border-bottom: none;
                        background-color: var(--card-background);
                        z-index: 1000;
                        padding: 0.5rem 0;
                        transition: transform 0.3s ease;
                    }
                     :host(.hidden) {
                        transform: translateY(100%);
                    }
                    .header {
                        justify-content: center;
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
                    }
                     nav a::after {
                        display: none;
                    }
                    nav a.active {
                        color: var(--accent-color);
                    }
                    .icon {
                        display: inline;
                    }
                    .text {
                        font-size: 0.7rem;
                        margin-top: 0.25rem;
                    }
                }
            </style>
            <header class="header">
                <div class="logo">Gokuraku</div>
                <nav>
                     <a href="#" data-page="home" class="active">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                        <span class="text">Головна</span>
                    </a>
                    <a href="#catalog" data-page="catalog">
                        <svg class="icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                        <span class="text">Каталог</span>
                    </a>
                    <a href="#cabinet" data-page="cabinet">
                         <svg class="icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        <span class="text">Кабінет</span>
                    </a>
                </nav>
            </header>
        `;

        shadow.appendChild(wrapper);
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
                    border-radius: 12px;
                    overflow: hidden;
                    text-decoration: none;
                    color: var(--text-light);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7), 0 0 15px var(--glow-color);
                }
                .card-image-container {
                    width: 100%;
                    aspect-ratio: 2 / 3;
                    position: relative;
                    border-top-left-radius: 12px; /* Додано */
                    border-top-right-radius: 12px; /* Додано */
                    overflow: hidden; /* Додано для обрізки вмісту */
                }
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s ease;
                    border-top-left-radius: 12px; /* Додано */
                    border-top-right-radius: 12px; /* Додано */
                }
                .card:hover img {
                    transform: scale(1.05);
                }
                .card-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to top, rgba(0,0,0,0.85) 25%, transparent 60%);
                    border-top-left-radius: 12px; /* Додано */
                    border-top-right-radius: 12px; /* Додано */
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
                    text-shadow: 0 2px 5px rgba(0,0,0,0.8);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                 .last-chapter {
                    font-size: 0.9rem;
                    color: var(--secondary-text);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                 }
                .card-meta {
                    position: absolute;
                    top: 0.75rem;
                    left: 0.75rem;
                    right: 0.75rem;
                    display: flex;
                    justify-content: space-between;
                    gap: 0.5rem;
                }
                .meta-tag {
                    background-color: rgba(20, 20, 20, 0.8);
                    backdrop-filter: blur(5px);
                    color: var(--text-light);
                    padding: 0.3rem 0.6rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: capitalize;
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
