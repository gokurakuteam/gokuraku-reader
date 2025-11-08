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

export async function setupDynamicCarousel() {
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
