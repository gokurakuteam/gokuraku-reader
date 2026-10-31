// transition-manager.js
// Керує апаратним GPU-прискореним переходом Card Expansion для каталогу
// та чистим кросфейдом для інших сторінок без зависань (Zero-jank 60/120 FPS).

const EASING_SPRING = 'cubic-bezier(0.2, 0, 0, 1)';
const EXPAND_DURATION = 350;
const COLLAPSE_DURATION = 320;

class TransitionManager {
    constructor() {
        this.origin = null;
        this.scrollPositions = new Map();
        this.isTransitioning = false;
        this.setupGlobalClickInterceptor();
    }

    /**
     * Зберігає позицію скролу для конкретного маршруту
     */
    saveScrollPosition(route) {
        if (!route) return;
        this.scrollPositions.set(route, window.scrollY || window.pageYOffset || 0);
    }

    /**
     * Повертає збережену позицію скролу
     */
    getScrollPosition(route) {
        return this.scrollPositions.get(route) || 0;
    }

    /**
     * Перехоплює кліки ВИКЛЮЧНО на картки каталогу (<manga-card>)
     * (ігноруючи горизонтальні банери каруселі та текстові списки)
     */
    setupGlobalClickInterceptor() {
        document.addEventListener('click', (e) => {
            const path = e.composedPath();
            
            // Шукаємо посилання на сторінку тайтлу
            const anchor = path.find(el => 
                el && el.tagName === 'A' && 
                el.getAttribute && 
                el.getAttribute('href') && 
                el.getAttribute('href').startsWith('#title?')
            );

            if (!anchor) return;

            const href = anchor.getAttribute('href');
            const urlParams = new URLSearchParams(href.split('?')[1] || '');
            const mangaId = urlParams.get('id');
            if (!mangaId) return;

            // Зберігаємо скрол поточної сторінки
            const currentHash = window.location.hash.substring(1).split('?')[0] || 'home';
            this.saveScrollPosition(currentHash);

            // Hero-анімація застосовується тільки для вертикальних карток каталогу (<manga-card>)
            const mangaCard = path.find(el => el && el.tagName === 'MANGA-CARD');
            if (!mangaCard) {
                // Для головної сторінки чи інших елементів очищуємо origin — використовуватиметься чистий кросфейд
                this.origin = null;
                return;
            }

            const imgEl = mangaCard.shadowRoot ? mangaCard.shadowRoot.querySelector('img') : mangaCard.querySelector('img');
            const h3 = mangaCard.shadowRoot ? mangaCard.shadowRoot.querySelector('h3') : mangaCard.querySelector('h3');
            const titleText = h3 ? h3.textContent.trim() : '';

            if (imgEl) {
                const coverRect = imgEl.getBoundingClientRect();
                
                this.origin = {
                    mangaId,
                    titleText,
                    coverUrl: imgEl.currentSrc || imgEl.src || imgEl.getAttribute('src'),
                    coverRect: {
                        top: coverRect.top,
                        left: coverRect.left,
                        width: coverRect.width,
                        height: coverRect.height
                    },
                    scrollY: window.scrollY || 0,
                    route: currentHash,
                    timestamp: Date.now()
                };
            }
        }, { capture: true });
    }

    getOrigin() {
        if (this.origin && Date.now() - this.origin.timestamp > 15000) {
            this.origin = null;
        }
        return this.origin;
    }

    clearOrigin() {
        this.origin = null;
    }

    prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * 100% GPU-прискорена анімація розширення через transform: translate3d + scale
     */
    async animateExpansion({ titleCoverEl, bgImageEl, mangaId }) {
        if (!titleCoverEl) return;

        const origin = this.getOrigin();
        const reducedMotion = this.prefersReducedMotion();

        // М'який розквіт фонового зображення (тільки opacity та blur)
        if (bgImageEl) {
            bgImageEl.classList.remove('ambient-bloom');
            void bgImageEl.offsetWidth; // Force reflow
            bgImageEl.classList.add('ambient-bloom');
        }

        // Якщо перехід був не з manga-card або увімкнено Reduced Motion
        if (!origin || String(origin.mangaId) !== String(mangaId) || reducedMotion) {
            if (titleCoverEl) {
                titleCoverEl.style.animation = 'scaleUp 0.25s var(--md-sys-motion-easing-emphasized) forwards';
            }
            return;
        }

        this.isTransitioning = true;

        // Отримуємо точні цільові координати обкладинки на сторінці тайтлу (вже при scrollY = 0)
        let targetRect = titleCoverEl.getBoundingClientRect();
        if (targetRect.width === 0 || targetRect.height === 0) {
            targetRect = {
                top: 30,
                left: window.innerWidth > 768 ? (window.innerWidth - 1200) / 2 + 32 : (window.innerWidth - 220) / 2,
                width: 220,
                height: 330
            };
        }

        // Тимчасово ховаємо справжній img
        titleCoverEl.style.visibility = 'hidden';

        // Розрахунок FLIP-трансформації для GPU
        const dx = origin.coverRect.left - targetRect.left;
        const dy = origin.coverRect.top - targetRect.top;
        const scaleX = origin.coverRect.width / targetRect.width;
        const scaleY = origin.coverRect.height / targetRect.height;

        // Створюємо клон з базовими розмірами цільової обкладинки
        const clone = document.createElement('div');
        clone.className = 'transition-flying-cover';
        clone.style.top = `${targetRect.top}px`;
        clone.style.left = `${targetRect.left}px`;
        clone.style.width = `${targetRect.width}px`;
        clone.style.height = `${targetRect.height}px`;
        clone.style.transformOrigin = 'top left';
        clone.style.willChange = 'transform, box-shadow';

        const cloneImg = document.createElement('img');
        cloneImg.src = origin.coverUrl;
        clone.appendChild(cloneImg);

        // Оверлей та назва картки для повного усунення стрибка
        let overlayEl = null;
        let infoEl = null;
        if (origin.titleText) {
            overlayEl = document.createElement('div');
            overlayEl.className = 'flying-overlay';
            clone.appendChild(overlayEl);

            infoEl = document.createElement('div');
            infoEl.className = 'flying-info';
            const h3 = document.createElement('h3');
            h3.textContent = origin.titleText;
            infoEl.appendChild(h3);
            clone.appendChild(infoEl);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (overlayEl) overlayEl.style.opacity = '0';
                    if (infoEl) infoEl.style.opacity = '0';
                });
            });
        }

        document.body.appendChild(clone);

        try {
            // Анімація виконується виключно через GPU-композитор (transform)
            const animation = clone.animate([
                {
                    transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`,
                    borderRadius: `${24 / Math.min(scaleX, scaleY)}px`,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
                },
                {
                    transform: 'translate3d(0, 0, 0) scale(1, 1)',
                    borderRadius: '24px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 5px 15px var(--glow-color, rgba(230, 81, 0, 0.3))'
                }
            ], {
                duration: EXPAND_DURATION,
                easing: EASING_SPRING,
                fill: 'forwards'
            });

            await animation.finished;
        } catch (err) {
            console.warn('Expansion animation interrupted:', err);
        } finally {
            titleCoverEl.style.visibility = '';
            clone.remove();
            this.isTransitioning = false;
        }
    }

    /**
     * 100% GPU-прискорена зворотна анімація згортання в картку каталогу
     */
    async animateCollapse({ titleCoverEl, bgImageEl, titlePageEl, targetPage, onMountTargetPage }) {
        const origin = this.getOrigin();
        const reducedMotion = this.prefersReducedMotion();

        // Якщо перехід був не з каталогу або користувач повернувся на іншу сторінку
        if (!origin || origin.route !== targetPage || reducedMotion || !titleCoverEl) {
            if (onMountTargetPage) await onMountTargetPage();
            return;
        }

        this.isTransitioning = true;
        const fromRect = titleCoverEl.getBoundingClientRect();
        const coverUrl = titleCoverEl.src || origin.coverUrl;

        // Плавний вихід контенту тайтлу
        if (titlePageEl) {
            titlePageEl.classList.add('title-page-exit');
        }

        if (bgImageEl) {
            bgImageEl.style.transition = `opacity ${COLLAPSE_DURATION * 0.6}ms ease, filter ${COLLAPSE_DURATION * 0.6}ms ease`;
            bgImageEl.style.opacity = '0';
            bgImageEl.style.filter = 'blur(20px)';
        }

        // Рендеримо каталог
        if (onMountTargetPage) {
            await onMountTargetPage();
        }

        // Відновлюємо скрол
        window.scrollTo(0, origin.scrollY);

        // Шукаємо виключно відповідну manga-card в каталозі
        const targetCard = document.querySelector(`manga-card[url*="${origin.mangaId}"]`);
        let targetImg = null;

        if (targetCard) {
            targetImg = targetCard.shadowRoot ? targetCard.shadowRoot.querySelector('img') : targetCard.querySelector('img');
        }

        if (targetImg) {
            const toRect = targetImg.getBoundingClientRect();
            const isInView = toRect.top < window.innerHeight + 100 && toRect.bottom > -100;

            if (isInView && toRect.width > 0 && toRect.height > 0) {
                targetImg.style.visibility = 'hidden';

                // FLIP розрахунок
                const dx = toRect.left - fromRect.left;
                const dy = toRect.top - fromRect.top;
                const scaleX = toRect.width / fromRect.width;
                const scaleY = toRect.height / fromRect.height;

                const clone = document.createElement('div');
                clone.className = 'transition-flying-cover';
                clone.style.top = `${fromRect.top}px`;
                clone.style.left = `${fromRect.left}px`;
                clone.style.width = `${fromRect.width}px`;
                clone.style.height = `${fromRect.height}px`;
                clone.style.transformOrigin = 'top left';
                clone.style.willChange = 'transform, box-shadow';

                const cloneImg = document.createElement('img');
                cloneImg.src = coverUrl;
                clone.appendChild(cloneImg);

                let overlayEl = null;
                let infoEl = null;
                if (origin.titleText) {
                    overlayEl = document.createElement('div');
                    overlayEl.className = 'flying-overlay';
                    overlayEl.style.opacity = '0';
                    clone.appendChild(overlayEl);

                    infoEl = document.createElement('div');
                    infoEl.className = 'flying-info';
                    infoEl.style.opacity = '0';
                    const h3 = document.createElement('h3');
                    h3.textContent = origin.titleText;
                    infoEl.appendChild(h3);
                    clone.appendChild(infoEl);

                    setTimeout(() => {
                        if (overlayEl) overlayEl.style.opacity = '1';
                        if (infoEl) infoEl.style.opacity = '1';
                    }, COLLAPSE_DURATION * 0.4);
                }

                document.body.appendChild(clone);

                try {
                    const animation = clone.animate([
                        {
                            transform: 'translate3d(0, 0, 0) scale(1, 1)',
                            borderRadius: '24px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
                        },
                        {
                            transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`,
                            borderRadius: `${24 / Math.min(scaleX, scaleY)}px`,
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
                        }
                    ], {
                        duration: COLLAPSE_DURATION,
                        easing: EASING_SPRING,
                        fill: 'forwards'
                    });

                    await animation.finished;
                } catch (err) {
                    console.warn('Collapse animation interrupted:', err);
                } finally {
                    targetImg.style.visibility = '';
                    clone.remove();
                    this.clearOrigin();
                    this.isTransitioning = false;
                }
                return;
            }
        }

        this.clearOrigin();
        this.isTransitioning = false;
    }
}

export const transitionManager = new TransitionManager();
