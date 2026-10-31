import { getMangaById } from '../data-manager.js';
import { getEffectiveCover } from '../storage-manager.js';

let currentHeroIndex = 0;
let heroTimer = null;
let heroSlides = [];
let heroThumbs = [];
let heroPills = [];

// Індивідуальні focal points (objectPosition) для ідеального фокусування на персонажах
const FOCAL_POINTS = {
    'kokhannia-tse-iliuziia': 'center 18%',
    'vidma-ichi': 'center 30%',
    'shchaslyvyi-marmur': 'center 38%',
    'khaski-ta-ioho-vchytel-bilyi-kit': 'center 22%',
    'khlopets-u-meni': 'center 25%',
    'forma-sympatii': 'center 20%',
    'solodke-sobache-zhyttia': 'center 25%',
    'mii-kit-trokhy-inshyi': 'center 30%',
    'hra-v-kokhannia': 'center 28%',
    'kon-kon-ton-ton': 'center 25%',
    'mahichna-bytva-prysviachuietsia-tobi': 'center 30%',
    'toi-khto-podobaietsia': 'center 22%',
    '11-ta-shkilna-poizdka': 'center 25%',
    'shakh-i-mat-pidkory-moie-sertse': 'center 20%',
    'nevdalyi-pryklad-bezdohannoho-prokliattia': 'center 28%',
    'rabovlasnyk-z-inshoho-svitu': 'center 20%',
    'ian-ilvu-ta-ia': 'center 25%'
};

function switchSlide(index) {
    if (heroSlides.length === 0) return;
    const total = heroSlides.length;
    currentHeroIndex = (index + total) % total;

    heroSlides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentHeroIndex);
    });

    heroThumbs.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentHeroIndex);
    });

    heroPills.forEach((pill, i) => {
        pill.classList.toggle('active', i === currentHeroIndex);
    });

    // Плавне горизонтальне прокручування ЛИШЕ всередині контейнера пігулок (без стрибків сторінки наверх!)
    const mobileSwitcher = document.querySelector('.mobile-hero-switcher');
    if (mobileSwitcher && heroPills[currentHeroIndex]) {
        const pill = heroPills[currentHeroIndex];
        const pillLeft = pill.offsetLeft;
        const pillWidth = pill.offsetWidth;
        const containerWidth = mobileSwitcher.clientWidth;
        mobileSwitcher.scrollTo({
            left: pillLeft - (containerWidth / 2) + (pillWidth / 2),
            behavior: 'smooth'
        });
    }
}

function resetTimer() {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        switchSlide(currentHeroIndex + 1);
    }, 8500);
}

export async function setupDynamicCarousel() {
    try {
        const response = await fetch('site-data.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const carouselItems = await response.json();

        const slidesContainer = document.querySelector('.hero-slides-container');
        const switcher = document.querySelector('.hero-switcher');
        const mobileSwitcher = document.querySelector('.mobile-hero-switcher');

        if (!slidesContainer) return;

        // Очищаємо контейнери перед новим рендером
        slidesContainer.innerHTML = '';
        if (switcher) switcher.innerHTML = '';
        if (mobileSwitcher) mobileSwitcher.innerHTML = '';

        heroSlides = [];
        heroThumbs = [];
        heroPills = [];
        if (heroTimer) clearInterval(heroTimer);

        // Відбираємо 5 цікавинок випадковим чином
        const selectedItems = [...carouselItems].sort(() => 0.5 - Math.random()).slice(0, 5);

        selectedItems.forEach((item, index) => {
            const slugMatch = item.mangaUrl ? item.mangaUrl.match(/id=([^&]+)/) : null;
            const slug = slugMatch ? slugMatch[1] : null;
            const manga = slug ? getMangaById(slug) : null;

            const title = manga ? manga.title : (item.caption ? item.caption.split('.')[0] : 'Манґа');
            const desc = item.caption || item.description || '';
            const focalPoint = (slug && FOCAL_POINTS[slug]) ? FOCAL_POINTS[slug] : 'center 25%';
            const thumbUrl = manga ? getEffectiveCover(manga) : item.imageUrl;
            const readUrl = (manga && manga.chapters && manga.chapters.length > 0)
                ? `#reader?mangaId=${manga.slug || manga.id}&chapterId=${manga.chapters[0].chapter}`
                : item.mangaUrl;

            // 1. Слайд у контейнер (окремий DOM шар для безшовного кросфейду)
            const slide = document.createElement('div');
            slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;
            slide.innerHTML = `
                <img src="${item.imageUrl}" class="hero-banner-img" alt="${title}" style="object-position: ${focalPoint};" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <div class="hero-title-box">
                        <h2 class="hero-title">${title}</h2>
                    </div>
                    <p class="hero-desc">${desc}</p>
                    <div class="hero-actions">
                        <a href="${readUrl}" class="btn btn-primary">
                            <i data-lucide="book-open" style="width: 17px; height: 17px;"></i>
                            <span>Читати</span>
                        </a>
                        <a href="${item.mangaUrl}" class="btn btn-secondary">
                            <span>Детальніше</span>
                            <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
                        </a>
                    </div>
                </div>
            `;
            slidesContainer.appendChild(slide);
            heroSlides.push(slide);

            // 2. Десктопна мініатюра
            if (switcher) {
                const thumb = document.createElement('div');
                thumb.className = `hero-thumb ${index === 0 ? 'active' : ''}`;
                thumb.title = title;
                thumb.innerHTML = `<img src="${thumbUrl}" alt="${title}" loading="lazy">`;
                thumb.addEventListener('click', () => {
                    switchSlide(index);
                    resetTimer();
                });
                switcher.appendChild(thumb);
                heroThumbs.push(thumb);
            }

            // 3. Мобільна пігулка
            if (mobileSwitcher) {
                const pill = document.createElement('div');
                pill.className = `mobile-thumb-pill ${index === 0 ? 'active' : ''}`;
                pill.textContent = title;
                pill.addEventListener('click', () => {
                    switchSlide(index);
                    resetTimer();
                });
                mobileSwitcher.appendChild(pill);
                heroPills.push(pill);
            }
        });

        // Ініціалізація Lucide для створених слайдів
        if (window.lucide) {
            window.lucide.createIcons({ root: slidesContainer });
        }

        // Керування паузою при наведенні
        const heroSection = document.querySelector('.hero-showcase');
        if (heroSection) {
            heroSection.addEventListener('mouseenter', () => {
                if (heroTimer) clearInterval(heroTimer);
            });
            heroSection.addEventListener('mouseleave', () => {
                resetTimer();
            });
        }

        currentHeroIndex = 0;
        resetTimer();

    } catch (error) {
        console.error('Failed to load hero carousel data:', error);
        const container = document.querySelector('.hero-slides-container');
        if (container) {
            container.innerHTML = '<p class="error-message" style="padding: 2rem; color: var(--secondary-text); text-align: center;">Не вдалося завантажити цікавинки. Спробуйте оновити сторінку.</p>';
        }
    }
}
