import { loadMangaData, getAllManga, getMangaById, getLatestUpdates, getChapterById } from './data-manager.js';
import { getBookmarks, isBookmarked, addBookmark, removeBookmark, getHistory, addChapterToHistory, isChapterRead, removeChapterFromHistory, addAllChaptersToHistory } from './storage-manager.js';
import { initCatalog } from './catalog.js';

function getStatusClass(status) {
    switch (status) {
        case 'Виходить':
            return 'status-ongoing';
        case 'Завершено':
            return 'status-completed';
        case 'Заморожено':
            return 'status-frozen';
        default:
            return '';
    }
}

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
        const type = this.getAttribute('type');
        const lastChapter = this.getAttribute('last-chapter');
        const status = this.getAttribute('status');
        const statusClass = getStatusClass(status);

        if (this.shadowRoot.innerHTML !== '') return;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    height: 100%;
                }
                .card {
                    position: relative;
                    background-color: var(--card-background);
                    border-radius: 12px;
                    overflow: hidden;
                    text-decoration: none;
                    color: var(--text-light);
                    height: 100%;
                    display: flex;
                    flex-direction: column;
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
                }
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s ease;
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
                    background: linear-gradient(to top, rgba(0,0,0,0.85) 20%, transparent 60%);
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
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 600;
                    line-height: 1.3;
                    text-shadow: 0 2px 5px rgba(0,0,0,0.8);
                }
                 .last-chapter {
                    font-size: 0.9rem;
                    color: var(--secondary-text);
                    margin: 0.25rem 0 0 0;
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
let slides = [];
let dots = [];
let carouselInterval;
const slideWidth = 100;

function showSlide(index) {
    const numSlides = slides.length;
    if (numSlides === 0) return;

    currentSlide = (index + numSlides) % numSlides;

    const banners = document.querySelector('.manga-banners');
    if (banners) {
        banners.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
    }

    slides.forEach((slide, i) => {
        const isActive = i === currentSlide;
        slide.classList.toggle('active', isActive);
        slide.style.transform = `translateX(${i * 100}%)`;
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function setupCarouselControls() {
    const prevButton = document.querySelector('.carousel-prev');
    const nextButton = document.querySelector('.carousel-next');

    if (prevButton && nextButton) {
        prevButton.addEventListener('click', () => {
            showSlide(currentSlide - 1);
            resetCarouselInterval();
        });

        nextButton.addEventListener('click', () => {
            showSlide(currentSlide + 1);
            resetCarouselInterval();
        });
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            showSlide(parseInt(dot.dataset.slide));
            resetCarouselInterval();
        });
    });

    resetCarouselInterval();
}

function resetCarouselInterval() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        showSlide(currentSlide + 1);
    }, 10000);
}

async function setupDynamicCarousel() {
    try {
        const response = await fetch('site-data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const carouselItems = await response.json();

        const randomItems = carouselItems.sort(() => 0.5 - Math.random()).slice(0, 5);

        const bannersContainer = document.querySelector('.manga-banners');
        const dotsContainer = document.querySelector('.banner-dots');

        if (!bannersContainer || !dotsContainer) return;

        bannersContainer.innerHTML = '';
        dotsContainer.innerHTML = '';

        slides = [];
        dots = [];

        randomItems.forEach((item, index) => {
            const banner = document.createElement('a');
            banner.href = item.mangaUrl;
            banner.className = 'manga-banner';
            banner.style.transform = `translateX(${index * 100}%)`;
            banner.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.caption}">
                <div class="banner-caption">
                    <h3>${item.caption}</h3>
                    <p>${item.description || ''}</p>
                </div>
            `;
            bannersContainer.appendChild(banner);
            slides.push(banner);

            const dot = document.createElement('div');
            dot.className = 'banner-dot';
            dot.dataset.slide = index;
            dotsContainer.appendChild(dot);
            dots.push(dot);
        });

        if (randomItems.length > 0) {
            showSlide(0);
            setupCarouselControls();
        }

    } catch (error) {
        console.error('Failed to load carousel data:', error);
        const bannersContainer = document.querySelector('.manga-banners');
        if(bannersContainer) bannersContainer.innerHTML = '<p class="error-message">Не вдалося завантажити цікавинки. Спробуйте оновити сторінку.</p>';
    }
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

let chapterSortOrder = 'desc'; // 'asc' or 'desc'

function renderChapterList(manga, sortOrder) {
    const chapterList = document.querySelector('.chapter-list ul');
    if (!chapterList || !manga.chapters || manga.chapters.length === 0) return;

    const sortedChapters = [...manga.chapters].sort((a, b) => {
        const chapterA = a.chapter;
        const chapterB = b.chapter;
        return sortOrder === 'asc' ? chapterA - chapterB : chapterB - chapterA;
    });

    chapterList.innerHTML = sortedChapters.map(ch => {
        const isRead = isChapterRead(manga.id, ch.id);
        return `
            <li class="${isRead ? 'read-chapter' : ''}">
                <a href="#reader?mangaId=${manga.id}&chapterId=${ch.id}">Том ${ch.volume}, Розділ ${ch.chapter}${ch.title ? `: ${ch.title}` : ''}</a>
                <span class="chapter-meta">
                    <svg class="eye-icon ${isRead ? 'read' : ''}" data-manga-id="${manga.id}" data-chapter-id="${ch.id}" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-134 0-244.5-72T61-462q-5-9-7.5-18.5T51-500q0-10 2.5-19.5T61-538q64-118 174.5-190T480-800q134 0 244.5 72T899-538q5 9 7.5 18.5T909-500q0 10-2.5 19.5T899-462q-64 118-174.5 190T480-200Z"/></svg>
                    ${new Date(ch.date).toLocaleDateString()}
                    <button class="icon-button download-chapter-btn" title="Завантажити розділ у PDF" data-manga-id="${manga.id}" data-chapter-id="${ch.id}">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    </button>
                </span>
            </li>
        `;
    }).join('');

    // Цей код більше не потрібен тут, ми перенесемо логіку в `loadPage`
    // chapterList.querySelectorAll('.eye-icon').forEach(...) 
}

function updateReadButton(manga) {
    const readButton = document.querySelector('.read-button');
    if (!readButton || !manga.chapters || manga.chapters.length === 0) return;

    const sortedChapters = [...manga.chapters].sort((a,b) => a.chapter - b.chapter);
    let firstUnreadChapter = sortedChapters.find(ch => !isChapterRead(manga.id, ch.id));

    if (!firstUnreadChapter) {
        firstUnreadChapter = sortedChapters[0]; 
    }

    readButton.href = `#reader?mangaId=${manga.id}&chapterId=${firstUnreadChapter.id}`;
}

async function loadPage(page, params) {
    const main = document.querySelector('main');
    const response = await fetch(routes[page]);
    const content = await response.text();
    main.innerHTML = content;

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
        const allManga = getAllManga();
        let genres = params ? params.get('genres') : null;
        initCatalog(allManga, genres ? genres.split(',') : []);
// ... (попередній код)
} else if (page === 'title') {
    const mangaId = parseInt(params.get('id'));
    const manga = getMangaById(mangaId);

    if (manga) { // Якщо манґа з таким ID знайдена
        if (manga.backgroundImage) {
            main.querySelector('#background-image').style.backgroundImage = `url(${manga.backgroundImage})`;
        }
        main.querySelector('.title-cover img').src = manga.coverImage;
        main.querySelector('.title-info h1').textContent = manga.title;
        main.querySelector('.title-info p').textContent = manga.description;

        const metaInfo = main.querySelector('.title-meta-info');
        const statusClass = getStatusClass(manga.status);
        metaInfo.innerHTML = `
            <span class="meta-tag">${manga.type}</span>
            <span class="meta-tag status-tag ${statusClass}">${manga.status}</span>
        `;

        main.querySelector('.genres').innerHTML = manga.genres.map(g => `<a href="#catalog?genres=${encodeURIComponent(g)}">${g}</a>`).join('');

        const readButton = main.querySelector('.read-button');
        const chapterActions = main.querySelector('.chapter-actions');
        
        if (manga.chapters && manga.chapters.length > 0) {
            readButton.classList.remove('disabled');
            readButton.style.display = 'flex';
            if (chapterActions) chapterActions.style.display = 'flex';

            updateReadButton(manga);
            renderChapterList(manga, chapterSortOrder);

            const chapterListUl = main.querySelector('.chapter-list ul');
        if (chapterListUl) {
            chapterListUl.addEventListener('click', (e) => {
                const target = e.target;
                const eyeIcon = target.closest('.eye-icon');
                const downloadBtn = target.closest('.download-chapter-btn');

                if (eyeIcon) {
                    e.stopPropagation();
                    const mangaId = parseInt(eyeIcon.dataset.mangaId);
                    const chapterId = parseInt(eyeIcon.dataset.chapterId);
                    const chapterItem = eyeIcon.closest('li');
                    
                    if (eyeIcon.classList.contains('read')) {
                        removeChapterFromHistory(mangaId, chapterId);
                        eyeIcon.classList.remove('read');
                        chapterItem.classList.remove('read-chapter');
                    } else {
                        addChapterToHistory(mangaId, chapterId);
                        eyeIcon.classList.add('read');
                        chapterItem.classList.add('read-chapter');
                    }
                    updateReadButton(manga);
                }

                if (downloadBtn) {
                    e.stopPropagation();
                    const mangaId = parseInt(downloadBtn.dataset.mangaId);
                    const chapterId = parseInt(downloadBtn.dataset.chapterId);
                    downloadChapterAsPdf(mangaId, chapterId, downloadBtn);
                }
            });
        }

            const sortButton = main.querySelector('#sort-chapters-btn');
            sortButton.addEventListener('click', () => {
                chapterSortOrder = chapterSortOrder === 'desc' ? 'asc' : 'desc';
                sortButton.classList.toggle('asc', chapterSortOrder === 'asc');
                renderChapterList(manga, chapterSortOrder);
            });

            const readAllButton = main.querySelector('#read-all-btn');
            readAllButton.addEventListener('click', () => {
                addAllChaptersToHistory(manga.id);
                renderChapterList(manga, chapterSortOrder);
                updateReadButton(manga);
            });

        } else {
            // Ось зміни для випадку, коли розділів немає
            readButton.classList.add('disabled');
            readButton.href = 'javascript:void(0);';
            readButton.style.display = 'flex';
            if (chapterActions) chapterActions.style.display = 'none';
            main.querySelector('.chapter-list').innerHTML = `
                <ul>
                    <li class="chapter-item-none">
                        <div class="chapter-info-none">
                            <span class="chapter-title-none">Розділів ще немає</span>
                            <span class="chapter-date-none">Слідкуйте за оновленнями!</span>
                        </div>
                    </li>
                </ul>
            `;
        }

        const bookmarkToggle = main.querySelector('#bookmark-toggle');
        bookmarkToggle.checked = isBookmarked(manga.id);
        bookmarkToggle.addEventListener('change', () => {
            if (bookmarkToggle.checked) {
                addBookmark(manga.id);
            } else {
                removeBookmark(manga.id);
            }
        });
    } else {
        // Якщо манґа не знайдена, показуємо 404
        await showNotFoundPage();
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
                 card.setAttribute('type', manga.type);
                 if(manga.chapters && manga.chapters.length > 0){
                    card.setAttribute('last-chapter', `Розділ ${manga.chapters[manga.chapters.length - 1].chapter}`);
                 }
                card.setAttribute('status', manga.status);
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
            main.querySelector('.chapter-title').textContent = `Том ${chapter.volume}, Розділ ${chapter.chapter}${chapter.title ? `: ${chapter.title}` : ''}`;
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
        await showNotFoundPage();
    }
}

async function showNotFoundPage() {
    try {
        const response = await fetch('404.html');
        if (!response.ok) throw new Error('404.html not found');
        const html = await response.text();
        document.getElementById('app').innerHTML = html;
        document.title = "404 - Сторінку не знайдено";
    } catch (error) {
        console.error("Could not load 404 page:", error);
        document.getElementById('app').innerHTML = `
            <div class="not-found-container" style="text-align: center; padding: 50px;">
                <h1>404</h1>
                <p>Сторінку не знайдено.</p>
            </div>
        `;
    }
}




document.addEventListener('DOMContentLoaded', async () => {
    await loadMangaData(); 

    // --- ПОЧАТОК КОДУ ДЛЯ РЕЄСТРАЦІЇ SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
    // --- КІНЕЦЬ КОДУ ДЛЯ РЕЄСТРАЦІЇ SERVICE WORKER ---

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

// Функція для завантаження одного зображення
// ЗАМІНІТЬ СТАРУ ФУНКЦІЮ НА ЦЮ
async function loadImage(url) {
    try {
        // Крок 1: Завантажуємо дані зображення за допомогою fetch
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Помилка мережі: статус ${response.status} для ${url}`);
        }
        const blob = await response.blob();

        // Крок 2: Конвертуємо blob у data URL (base64)
        const dataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
        
        // Крок 3: Створюємо об'єкт Image з data URL, щоб отримати його розміри
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    } catch (error) {
        // Якщо виникає помилка, ми її прокидаємо далі, щоб Promise.all її зловив
        console.error(`Не вдалося обробити зображення з ${url}:`, error);
        throw error;
    }
}


// ЗАМІНІТЬ ПОПЕРЕДНЮ ВЕРСІЮ НА ЦЮ ФІНАЛЬНУ
async function downloadChapterAsPdf(mangaId, chapterId, buttonElement) {
    const originalIcon = buttonElement.innerHTML;
    const loadingIcon = '<svg viewBox="0 0 24 24" class="spinner"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

    try {
        buttonElement.innerHTML = loadingIcon;
        buttonElement.disabled = true;

        const manga = getMangaById(mangaId);
        const chapter = getChapterById(chapterId);
        
        console.log(`[PDF Generator] Розпочато завантаження розділу ${chapter.chapter} для '${manga.title}'.`);

        if (!manga || !chapter || !chapter.pages || chapter.pages.length === 0) {
            throw new Error('Не знайдено даних про розділ або сторінок у розділі.');
        }
        
        console.log(`[PDF Generator] Знайдено ${chapter.pages.length} сторінок. Починаю завантаження зображень...`);

        const imagePromises = chapter.pages.map((url, index) => 
            loadImage(url).then(img => {
                console.log(`[PDF Generator] Зображення ${index + 1}/${chapter.pages.length} завантажено успішно.`);
                return img;
            })
        );

        const results = await Promise.allSettled(imagePromises);
        
        const loadedImages = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
        
        const failedCount = results.length - loadedImages.length;

        console.log(`[PDF Generator] Успішно завантажено ${loadedImages.length} з ${chapter.pages.length} зображень.`);
        if (failedCount > 0) {
            console.warn(`[PDF Generator] Не вдалося завантажити ${failedCount} зображень.`);
        }

        if (loadedImages.length === 0) {
            throw new Error("Не вдалося завантажити жодного зображення.");
        }
        
        console.log("[PDF Generator] Розраховую максимальну ширину...");
        
        let maxWidth = 0;
        loadedImages.forEach(img => {
            if (img.width > maxWidth) {
                maxWidth = img.width;
            }
        });

        const MAX_PAGE_HEIGHT = 10000;
        console.log(`[PDF Generator] Максимальна ширина: ${maxWidth}px. Ліміт висоти сторінки: ${MAX_PAGE_HEIGHT}px.`);
        console.log("[PDF Generator] Створюю екземпляр jsPDF...");

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [maxWidth, MAX_PAGE_HEIGHT]
        });

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        console.log("[PDF Generator] Додаю зображення до документа з нарізкою...");

        let currentY = 0;
        let pageCount = 1;
        
        for (let i = 0; i < loadedImages.length; i++) {
            const img = loadedImages[i];
            let sourceY = 0;

            while (sourceY < img.height) {
                let remainingOnPage = MAX_PAGE_HEIGHT - currentY;

                if (remainingOnPage <= 1) { // Залишаємо 1px запасу для уникнення помилок
                    doc.addPage();
                    pageCount++;
                    currentY = 0;
                    remainingOnPage = MAX_PAGE_HEIGHT;
                    console.log(`[PDF Generator] Створено нову сторінку ${pageCount}.`);
                }

                const sliceHeight = Math.min(img.height - sourceY, remainingOnPage);
                
                tempCanvas.width = img.width;
                tempCanvas.height = sliceHeight;
                tempCtx.drawImage(img, 0, sourceY, img.width, sliceHeight, 0, 0, img.width, sliceHeight);

                // ОПТИМІЗАЦІЯ: Передаємо canvas напряму, без конвертації в DataURL
                // Це швидше і зберігає якість краще.
                doc.addImage(tempCanvas, 'JPEG', 0, currentY, img.width, sliceHeight);
                
                currentY += sliceHeight;
                sourceY += sliceHeight;
            }
        }

        // ВИПРАВЛЕННЯ: Більш надійний спосіб очищення назви файлу
        const safeTitle = manga.title.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s-]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `${safeTitle}_Розділ_${chapter.chapter}.pdf`;
        
        console.log(`[PDF Generator] Генерація завершена. Всього сторінок: ${pageCount}. Зберігаю файл: ${fileName}`);
        doc.save(fileName);
        
        console.log("[PDF Generator] PDF успішно збережено!");

    } catch (error) {
        console.error("[PDF Generator] Загальна помилка при створенні PDF:", error);
        alert("Не вдалося завантажити розділ. Деталі помилки дивіться в консолі розробника (F12).");
    } finally {
        buttonElement.innerHTML = originalIcon;
        buttonElement.disabled = false;
    }
}
