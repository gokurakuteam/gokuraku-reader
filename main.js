import { loadMangaData, getAllManga, getMangaById, getLatestUpdates, getChapterById } from './data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory } from './storage-manager.js';

class AppHeader extends HTMLElement {
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

class MangaCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        const name = this.getAttribute('name');
        const image = this.getAttribute('image');
        const url = this.getAttribute('url');

        if (this.shadowRoot.innerHTML !== '') return; // Avoid re-rendering

        this.shadowRoot.innerHTML = `
            <style>
                .card {
                    background-color: var(--card-background);
                    border-radius: 10px;
                    text-align: center;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.5);
                    overflow: hidden;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    text-decoration: none;
                    color: var(--text-light);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 25px rgba(0,0,0,0.7);
                }
                .card-image-container {
                    width: 100%;
                    aspect-ratio: 2 / 3;
                    overflow: hidden;
                }
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                h3 {
                    margin: 1rem 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            </style>
            <a href="${url}" class="card">
                <div class="card-image-container">
                    <img src="${image}" alt="${name}">
                </div>
                <h3>${name}</h3>
            </a>
        `;
    }
}


customElements.define('app-header', AppHeader);
customElements.define('manga-card', MangaCard);

const routes = {
    'home': 'home.html',
    'catalog': 'catalog.html',
    'cabinet': 'cabinet.html',
    'title': 'title.html',
    'reader': 'reader.html'
};

let currentSlide = 0;

function showSlide(n) {
    const slides = document.querySelectorAll('.manga-banner');
    const dots = document.querySelectorAll('.banner-dot');
    if (slides.length === 0) return;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    currentSlide = (n + slides.length) % slides.length;

    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function setupCarousel() {
    const dots = document.querySelectorAll('.banner-dot');
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            showSlide(parseInt(dot.dataset.slide));
        });
    });

    setInterval(() => {
        showSlide(currentSlide + 1);
    }, 10000);
}

function setupTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;

            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabContents.forEach(c => c.classList.remove('active'));
            document.getElementById(tab).classList.add('active');
        });
    });
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " р. тому";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " міс. тому";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " д. тому";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " г. тому";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " хв. тому";
    return "Щойно";
}

async function loadPage(page, params) {
    const main = document.querySelector('main');
    const response = await fetch(routes[page]);
    const content = await response.text();
    main.innerHTML = content;


    if (page === 'home') {
        setupCarousel();
        const updatesList = main.querySelector('.update-list');
        const latestUpdates = getLatestUpdates(5);
        updatesList.innerHTML = latestUpdates.map(manga => {
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
        const mangaGrid = main.querySelector('.manga-grid');
        const allManga = getAllManga();
        allManga.forEach(manga => {
            const card = document.createElement('manga-card');
            card.setAttribute('name', manga.title);
            card.setAttribute('image', manga.coverImage);
            card.setAttribute('url', manga.pageUrl);
            mangaGrid.appendChild(card);
        });

    } else if (page === 'title') {
        const mangaId = parseInt(params.get('id'));
        const manga = getMangaById(mangaId);
        if (manga) {
            main.querySelector('.title-cover img').src = manga.coverImage;
            main.querySelector('.title-info h1').textContent = manga.title;
            main.querySelector('.title-info p').textContent = manga.description;
            main.querySelector('.genres').innerHTML = manga.genres.map(g => `<span>${g}</span>`).join('');
            
            const readButton = main.querySelector('.read-button');
            if (manga.chapters && manga.chapters.length > 0) {
                readButton.href = `#reader?mangaId=${manga.id}&chapterId=${manga.chapters[0].id}`;
            } else {
                readButton.style.display = 'none';
            }

            const chapterList = main.querySelector('.chapter-list ul');
            chapterList.innerHTML = manga.chapters.map(ch => `
                 <li>
                    <a href="#reader?mangaId=${manga.id}&chapterId=${ch.id}">Том ${ch.volume}, Розділ ${ch.chapter}: ${ch.title}</a>
                    <span>${new Date(ch.date).toLocaleDateString()}</span>
                </li>
            `).join('');

            const bookmarkToggle = main.querySelector('#bookmark-toggle');
            bookmarkToggle.checked = isBookmarked(manga.id);
            bookmarkToggle.addEventListener('change', () => {
                if (bookmarkToggle.checked) {
                    addBookmark(manga.id);
                } else {
                    removeBookmark(manga.id);
                }
            });
        }
    } else if (page === 'cabinet') {
        setupTabs();
        const bookmarksGrid = main.querySelector('.bookmarks-grid');
        const bookmarkedIds = getBookmarks();
        if (bookmarkedIds.length > 0) {
            bookmarkedIds.forEach(id => {
                const manga = getMangaById(id);
                if (!manga) return;
                const card = document.createElement('manga-card');
                card.setAttribute('name', manga.title);
                card.setAttribute('image', manga.coverImage);
                card.setAttribute('url', manga.pageUrl);
                bookmarksGrid.appendChild(card);
            });
        } else {
            main.querySelector('#bookmarks .empty-list-message').style.display = 'block';
        }

        const historyList = main.querySelector('.history-list');
        const historyItems = getHistory();
        if (historyItems.length > 0) {
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
             main.querySelector('#history .empty-list-message').style.display = 'block';
        }

    } else if (page === 'reader') {
        const mangaId = parseInt(params.get('mangaId'));
        const chapterId = parseInt(params.get('chapterId'));
        const manga = getMangaById(mangaId);
        const chapter = getChapterById(chapterId);

        if (manga && chapter) {
            addChapterToHistory(mangaId, chapterId);

            main.querySelector('.back-button').href = `#title?id=${mangaId}`;
            main.querySelector('.chapter-title').textContent = `Том ${chapter.volume}, Розділ ${chapter.chapter}: ${chapter.title}`;
            const readerContent = main.querySelector('.reader-content');
            readerContent.innerHTML = chapter.pages.map(pageUrl => `<img src="${pageUrl}" alt="Сторінка розділу">`).join('');

            const chapterIndex = manga.chapters.findIndex(ch => ch.id === chapterId);
            const readerNav = main.querySelector('.reader-nav');

            if (manga.chapters.length === 1) {
                readerNav.classList.add('single-chapter');
            }

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

            const homeBtn = main.querySelector('.home-btn');
            homeBtn.href = `#title?id=${mangaId}`;

            const appHeader = document.querySelector('app-header');
            if (window.innerWidth <= 768) {
                appHeader.classList.add('hidden');
            }
        }
    }
}

async function handleNavigation() {
    const hash = window.location.hash.substring(1);
    const [page, query] = hash.split('?');
    const params = new URLSearchParams(query);
    const pageName = page || 'home';

    const appHeader = document.querySelector('app-header');
    if (pageName !== 'reader') {
        appHeader.classList.remove('hidden');
    }

    if (routes[pageName]) {
        await loadPage(pageName, params);
        window.scrollTo(0, 0);

        const appHeaderShadowRoot = appHeader.shadowRoot;
        appHeaderShadowRoot.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageName) {
                link.classList.add('active');
            }
        });
    } else {
        window.location.hash = 'home';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadMangaData(); 

    window.addEventListener('hashchange', handleNavigation);

    await handleNavigation();

    document.querySelector('app-header').shadowRoot.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            if (window.location.hash.substring(1).startsWith(page)) {
                 e.preventDefault();
            }
        });
    });
});
