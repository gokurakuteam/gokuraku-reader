// transition-manager.js
// Керує плавною анімацією розширення картки в тайтл (Card Expansion),
// розквітом фону (Ambient Bloom), каскадною появою та зворотним згортанням.

const EASING_SPRING = 'cubic-bezier(0.2, 0, 0, 1)';
const EXPAND_DURATION = 360;
const COLLAPSE_DURATION = 340;

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
     * Глобальне перехоплення кліків на картки манґи для миттєвого збереження геометрії
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

            // Знаходимо картку: custom element manga-card, банер або рядок оновлень
            const cardEl = path.find(el => 
                el && (
                    el.tagName === 'MANGA-CARD' ||
                    (el.classList && (el.classList.contains('manga-banner') || el.classList.contains('card') || el.closest?.('.update-list li')))
                )
            );

            let imgEl = null;
            let titleText = '';

            if (cardEl) {
                if (cardEl.shadowRoot) {
                    imgEl = cardEl.shadowRoot.querySelector('img');
                    const h3 = cardEl.shadowRoot.querySelector('h3');
                    if (h3) titleText = h3.textContent.trim();
                } else if (cardEl.tagName === 'IMG') {
                    imgEl = cardEl;
                } else {
                    imgEl = cardEl.querySelector('img');
                    const h3 = cardEl.querySelector('h3');
                    if (h3) titleText = h3.textContent.trim();
                }
            } else if (anchor) {
                imgEl = anchor.querySelector('img');
                const h3 = anchor.querySelector('h3');
                if (h3) titleText = h3.textContent.trim();
            }

            const currentHash = window.location.hash.substring(1).split('?')[0] || 'home';
            this.saveScrollPosition(currentHash);

            if (imgEl) {
                const coverRect = imgEl.getBoundingClientRect();
                const cardRect = cardEl ? cardEl.getBoundingClientRect() : coverRect;
                
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
                    cardRect: {
                        top: cardRect.top,
                        left: cardRect.left,
                        width: cardRect.width,
                        height: cardRect.height
                    },
                    scrollY: window.scrollY || 0,
                    route: currentHash,
                    timestamp: Date.now()
                };
            }
        }, { capture: true });
    }

    /**
     * Повертає поточні дані вихідної картки
     */
    getOrigin() {
        if (this.origin && Date.now() - this.origin.timestamp > 15000) {
            this.origin = null;
        }
        return this.origin;
    }

    clearOrigin() {
        this.origin = null;
    }

    /**
     * Перевірка преференції користувача щодо зменшеного руху
     */
    prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Виконує анімацію Card Expansion та Ambient Bloom при вході на сторінку тайтлу
     */
    async animateExpansion({ titleCoverEl, titleHeaderEl, bgImageEl, mangaId }) {
        if (!titleCoverEl) return;

        const origin = this.getOrigin();
        const reducedMotion = this.prefersReducedMotion();

        // Активуємо Ambient Bloom для розмитого фону (без горизонтального розтягування)
        if (bgImageEl) {
            bgImageEl.classList.remove('ambient-bloom');
            void bgImageEl.offsetWidth; // Force reflow
            bgImageEl.classList.add('ambient-bloom');
        }

        // Якщо немає збереженої картки або увімкнено Reduced Motion
        if (!origin || String(origin.mangaId) !== String(mangaId) || reducedMotion) {
            if (titleCoverEl) {
                titleCoverEl.style.animation = 'scaleUp 0.3s var(--md-sys-motion-easing-emphasized) forwards';
            }
            return;
        }

        this.isTransitioning = true;

        // Вимірюємо цільові координати обкладинки на сторінці тайтлу (вже при scrollY = 0)
        let targetRect = titleCoverEl.getBoundingClientRect();
        if (targetRect.width === 0 || targetRect.height === 0) {
            targetRect = {
                top: 30,
                left: window.innerWidth > 768 ? (window.innerWidth - 1200) / 2 + 32 : (window.innerWidth - 220) / 2,
                width: 220,
                height: 330
            };
        }

        // Тимчасово ховаємо справжній img, поки летить клон
        titleCoverEl.style.visibility = 'hidden';

        // Створюємо летючий клон картки
        const clone = document.createElement('div');
        clone.className = 'transition-flying-cover';
        clone.style.top = `${origin.coverRect.top}px`;
        clone.style.left = `${origin.coverRect.left}px`;
        clone.style.width = `${origin.coverRect.width}px`;
        clone.style.height = `${origin.coverRect.height}px`;
        clone.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';

        const cloneImg = document.createElement('img');
        cloneImg.src = origin.coverUrl;
        clone.appendChild(cloneImg);

        // Якщо була назва або оверлей картки — додаємо їх для усунення стрибка
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

            // М'яко розчиняємо оверлей та назву під час першої третини польоту
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (overlayEl) overlayEl.style.opacity = '0';
                    if (infoEl) infoEl.style.opacity = '0';
                });
            });
        }

        document.body.appendChild(clone);

        try {
            // Анімація геометрії через WAAPI (апаратне GPU-прискорення)
            const animation = clone.animate([
                {
                    top: `${origin.coverRect.top}px`,
                    left: `${origin.coverRect.left}px`,
                    width: `${origin.coverRect.width}px`,
                    height: `${origin.coverRect.height}px`,
                    borderRadius: '24px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
                },
                {
                    top: `${targetRect.top}px`,
                    left: `${targetRect.left}px`,
                    width: `${targetRect.width}px`,
                    height: `${targetRect.height}px`,
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
            console.warn('Transition animation interrupted:', err);
        } finally {
            titleCoverEl.style.visibility = '';
            clone.remove();
            this.isTransitioning = false;
        }
    }

    /**
     * Виконує зворотне симетричне згортання тайтлу назад у картку при навігації «Назад»
     */
    async animateCollapse({ titleCoverEl, bgImageEl, titlePageEl, targetPage, onMountTargetPage }) {
        const origin = this.getOrigin();
        const reducedMotion = this.prefersReducedMotion();

        if (!origin || origin.route !== targetPage || reducedMotion || !titleCoverEl) {
            if (onMountTargetPage) await onMountTargetPage();
            return;
        }

        this.isTransitioning = true;
        const fromRect = titleCoverEl.getBoundingClientRect();
        const coverUrl = titleCoverEl.src || origin.coverUrl;

        // Плавний вихід контенту сторінки тайтлу
        if (titlePageEl) {
            titlePageEl.classList.add('title-page-exit');
        }

        // Плавне згасання фонового зображення
        if (bgImageEl) {
            bgImageEl.style.transition = `opacity ${COLLAPSE_DURATION * 0.6}ms ease, filter ${COLLAPSE_DURATION * 0.6}ms ease`;
            bgImageEl.style.opacity = '0';
            bgImageEl.style.filter = 'blur(20px)';
        }

        // Даємо короткий час на початок згасання контенту тайтлу
        await new Promise(resolve => setTimeout(resolve, 80));

        // Рендеримо цільову сторінку
        if (onMountTargetPage) {
            await onMountTargetPage();
        }

        // Відновлюємо скрол до початкового
        window.scrollTo(0, origin.scrollY);

        // Шукаємо картку у відновленому DOM
        const selector = `manga-card[url*="${origin.mangaId}"], a[href*="${origin.mangaId}"]`;
        let targetCard = document.querySelector(selector);
        let targetImg = null;

        if (targetCard) {
            if (targetCard.shadowRoot) {
                targetImg = targetCard.shadowRoot.querySelector('img');
            } else if (targetCard.tagName === 'IMG') {
                targetImg = targetCard;
            } else {
                targetImg = targetCard.querySelector('img');
            }
        }

        // Якщо картка знайдена і знаходиться в зоні видимості
        if (targetImg) {
            const toRect = targetImg.getBoundingClientRect();
            const isInView = toRect.top < window.innerHeight + 100 && toRect.bottom > -100;

            if (isInView && toRect.width > 0 && toRect.height > 0) {
                targetImg.style.visibility = 'hidden';

                const clone = document.createElement('div');
                clone.className = 'transition-flying-cover';
                clone.style.top = `${fromRect.top}px`;
                clone.style.left = `${fromRect.left}px`;
                clone.style.width = `${fromRect.width}px`;
                clone.style.height = `${fromRect.height}px`;
                clone.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.4)';

                const cloneImg = document.createElement('img');
                cloneImg.src = coverUrl;
                clone.appendChild(cloneImg);

                // Оверлей та назва починають прозорими і плавно проявляються перед приземленням
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

                    // Проявляємо за 150мс до завершення польоту
                    setTimeout(() => {
                        if (overlayEl) overlayEl.style.opacity = '1';
                        if (infoEl) infoEl.style.opacity = '1';
                    }, COLLAPSE_DURATION * 0.4);
                }

                document.body.appendChild(clone);

                try {
                    const animation = clone.animate([
                        {
                            top: `${fromRect.top}px`,
                            left: `${fromRect.left}px`,
                            width: `${fromRect.width}px`,
                            height: `${fromRect.height}px`,
                            borderRadius: '24px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
                        },
                        {
                            top: `${toRect.top}px`,
                            left: `${toRect.left}px`,
                            width: `${toRect.width}px`,
                            height: `${toRect.height}px`,
                            borderRadius: '24px',
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
