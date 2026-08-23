class SupportZSUBlock extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentSlide = 0;
        this.slidesData = [
            {
                title: "Повернись живим",
                desc: "Фонд компетентної допомоги армії. Кожен ваш внесок наближає нашу перемогу.",
                url: "https://savelife.in.ua/",
                image: "images/savelife_bg.webp"
            },
            {
                title: "Фонд Притули",
                desc: "Забезпечення військових всім необхідним: від дронів до бронетехніки.",
                url: "https://prytulafoundation.org/",
                image: "images/prytula_bg.webp"
            },
            {
                title: "United24",
                desc: "Глобальна ініціатива на підтримку України, започаткована Президентом.",
                url: "https://u24.gov.ua/",
                image: "images/u24_bg.webp"
            }
        ];
    }

    connectedCallback() {
        this.render();
        this.setupSlider();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    --zsu-accent: #ffd700;
                    --zsu-blue: #0057b7;
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    margin-bottom: 3rem;
                }
                
                * { box-sizing: border-box; }

                .carousel-wrapper {
                    position: relative;
                    width: 100%;
                    height: 450px;
                    border-radius: 32px;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .slides-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .slide {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    transition: opacity 0.8s ease-in-out;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    pointer-events: none;
                }
                
                .slide.active {
                    opacity: 1;
                    z-index: 2;
                    pointer-events: auto;
                }

                .slide-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-size: cover;
                    background-position: center;
                    z-index: -2;
                    transform: scale(1.05);
                    transition: transform 8s ease-out;
                }
                
                .slide.active .slide-bg {
                    transform: scale(1);
                }

                .slide-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%);
                    z-index: -1;
                }

                .slide-content {
                    position: relative;
                    z-index: 10;
                    max-width: 800px;
                    padding: 2rem;
                    transform: translateY(30px);
                    opacity: 0;
                    transition: all 0.8s cubic-bezier(0.2, 0, 0, 1);
                    transition-delay: 0.1s;
                }
                
                .slide.active .slide-content {
                    transform: translateY(0);
                    opacity: 1;
                }

                .slide-content h2 {
                    color: white;
                    font-size: 3.5rem;
                    font-weight: 800;
                    margin: 0 0 1rem 0;
                    text-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    background: linear-gradient(45deg, #fff, var(--zsu-accent));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .slide-content p {
                    color: #f0f0f0;
                    font-size: 1.25rem;
                    line-height: 1.6;
                    margin: 0 0 2.5rem 0;
                    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                }

                .button-support {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 1.2rem 2.5rem;
                    border-radius: 100px;
                    font-weight: 600;
                    font-size: 1.1rem;
                    text-decoration: none;
                    text-align: center;
                    transition: all 0.4s cubic-bezier(0.2, 0, 0, 1);
                    position: relative;
                    overflow: hidden;
                }
                
                .button-support::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s ease;
                }

                .button-support:hover {
                    background: var(--zsu-accent);
                    color: #000;
                    border-color: var(--zsu-accent);
                    box-shadow: 0 5px 20px rgba(255, 215, 0, 0.4);
                    transform: translateY(-2px);
                }
                
                .button-support:hover::before {
                    left: 100%;
                }

                .nav-btn {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0,0,0,0.3);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 10;
                    transition: all 0.3s ease;
                }
                
                .nav-btn:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateY(-50%) scale(1.1);
                    border-color: rgba(255,255,255,0.5);
                }
                
                .nav-btn.prev { left: 20px; }
                .nav-btn.next { right: 20px; }
                
                .nav-btn svg {
                    width: 28px;
                    height: 28px;
                }

                .dots {
                    position: absolute;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 12px;
                    z-index: 10;
                }

                .dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.3);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
                }
                
                .dot:hover {
                    background: rgba(255,255,255,0.8);
                }
                
                .dot.active {
                    background: var(--zsu-accent);
                    transform: scale(1.4);
                    box-shadow: 0 0 10px rgba(255,215,0,0.5);
                }

                @media (max-width: 768px) {
                    .carousel-wrapper {
                        height: 380px;
                        border-radius: 24px;
                    }
                    .slide-content h2 {
                        font-size: 2.2rem;
                    }
                    .slide-content p {
                        font-size: 1rem;
                    }
                    .nav-btn {
                        width: 40px;
                        height: 40px;
                    }
                    .nav-btn.prev { left: 10px; }
                    .nav-btn.next { right: 10px; }
                }
            </style>
            
            <div class="carousel-wrapper">
                <div class="slides-container">
                    ${this.slidesData.map((slide, index) => `
                        <div class="slide ${index === 0 ? 'active' : ''}">
                            <div class="slide-bg" style="background-image: url('${slide.image}')"></div>
                            <div class="slide-overlay"></div>
                            <div class="slide-content">
                                <h2>${slide.title}</h2>
                                <p>${slide.desc}</p>
                                <a href="${slide.url}" target="_blank" rel="noopener noreferrer" class="button-support">Задонатити</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button class="nav-btn prev" aria-label="Previous">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button class="nav-btn next" aria-label="Next">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                
                <div class="dots">
                    ${this.slidesData.map((_, index) => `
                        <span class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setupSlider() {
        this.slides = this.shadowRoot.querySelectorAll('.slide');
        this.dots = this.shadowRoot.querySelectorAll('.dot');
        const prevBtn = this.shadowRoot.querySelector('.prev');
        const nextBtn = this.shadowRoot.querySelector('.next');
        
        prevBtn.addEventListener('click', () => this.goToSlide(this.currentSlide - 1));
        nextBtn.addEventListener('click', () => this.goToSlide(this.currentSlide + 1));
        
        this.dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                this.goToSlide(parseInt(e.target.dataset.index));
            });
        });

        this.autoSlideInterval = setInterval(() => this.goToSlide(this.currentSlide + 1), 6000);

        const wrapper = this.shadowRoot.querySelector('.carousel-wrapper');
        wrapper.addEventListener('mouseenter', () => clearInterval(this.autoSlideInterval));
        wrapper.addEventListener('mouseleave', () => {
            this.autoSlideInterval = setInterval(() => this.goToSlide(this.currentSlide + 1), 6000);
        });
    }

    goToSlide(index) {
        this.slides[this.currentSlide].classList.remove('active');
        this.dots[this.currentSlide].classList.remove('active');
        
        this.currentSlide = (index + this.slidesData.length) % this.slidesData.length;
        
        this.slides[this.currentSlide].classList.add('active');
        this.dots[this.currentSlide].classList.add('active');
    }
}

customElements.define('support-zsu-block', SupportZSUBlock);