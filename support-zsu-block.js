class SupportZSUBlock extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                }
                
                * {
                    box-sizing: border-box;
                }

                .support-zsu {
                    /* Використовуємо CSS змінні, щоб блок адаптувався під тему */
                    /* Фон: у темній темі темний, у світлій - світлий (через var(--overlay-color-start)) */
                    /* Але блок ЗСУ зазвичай має бути виразним. Тому зробимо його трохи "спеціальним" */
                    
                    /* Базовий фон карток + легкий градієнт акцентного кольору */
                    background: linear-gradient(var(--overlay-color-start), var(--overlay-color-start)),
                                radial-gradient(circle at top right, var(--glow-color), transparent 40%);
                    
                    padding: 3rem 2rem;
                    border: 1px solid var(--accent-color, #00ff99);
                    border-radius: 15px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 0 20px var(--glow-color, rgba(0, 255, 153, 0.5));
                    transition: border-color 0.5s ease, box-shadow 0.5s ease, background 0.5s ease;
                    width: 100%;
                    max-width: 100%;
                }

                .support-zsu-content {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                }

                .support-zsu h2 {
                    color: var(--accent-color, #00ff99);
                    font-size: 2.5rem;
                    text-shadow: 0 0 8px var(--glow-color, rgba(0, 255, 153, 0.5));
                    transition: color 0.5s ease, text-shadow 0.5s ease;
                    margin-bottom: 1rem;
                    margin-top: 0;
                    line-height: 1.2;
                }

                .support-zsu p {
                    font-size: 1.1rem;
                    /* Колір тексту тепер залежить від теми */
                    color: var(--text-light, #e0e0e0);
                    margin-bottom: 2rem;
                    line-height: 1.5;
                }

                .support-buttons {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .button-support {
                    background-color: transparent;
                    border: 1px solid var(--accent-color, #00ff99);
                    color: var(--accent-color, #00ff99);
                    padding: 0.75rem 1.5rem;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.4s ease;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .button-support:hover {
                    background-color: var(--accent-color, #00ff99);
                    /* У темній темі текст стає темним, у світлій - білим (щоб читався на яскравому фоні) */
                    /* Ми використовуємо інверсію: var(--background-dark) зазвичай дає потрібний контраст */
                    color: var(--background-dark, #121212);
                    box-shadow: 0 0 20px var(--glow-color, rgba(0, 255, 153, 0.5));
                }
                
                /* Специфічний хак для світлої теми в shadow dom (оскільки ми не маємо доступу до html[data-theme])
                   Але ми маємо доступ до змінних. 
                   Якщо --background-dark світлий (світла тема), то hover колір буде світлим.
                   Це добре, якщо accent color темний. Але наші accent color яскраві.
                   Тому краще примусово робити текст білим на ховері у світлій темі? 
                   Або завжди білим? Давайте зробимо завжди темним на ховері, бо акценти яскраві.
                */
                .button-support:hover {
                    color: #121212; /* Завжди темний текст на кнопці при наведенні */
                }

                 @media (max-width: 768px) {
                    .support-zsu {
                        padding: 2rem 1rem; 
                    }
                    .support-zsu h2 {
                        font-size: 1.8rem; 
                    }
                    .support-zsu p {
                        font-size: 1rem;
                    }
                    .button-support {
                        padding: 0.6rem 1.2rem;
                        font-size: 0.9rem;
                        flex: 1 1 auto; 
                        text-align: center;
                    }
                }
            </style>
            <section class="support-zsu">
                <div class="support-zsu-content">
                    <h2>Підтримайте Збройні Сили України!</h2>
                    <p>Кожен ваш внесок наближає нашу перемогу. Оберіть фонд, якому довіряєте.</p>
                    <div class="support-buttons">
                        <a href="https://savelife.in.ua/" target="_blank" rel="noopener noreferrer" class="button-support">Повернись живим</a>
                        <a href="https://prytulafoundation.org/" target="_blank" rel="noopener noreferrer" class="button-support">Фонд Притули</a>
                        <a href="https://u24.gov.ua/" target="_blank" rel="noopener noreferrer" class="button-support">United24</a>
                    </div>
                </div>
            </section>
        `;
    }
}

customElements.define('support-zsu-block', SupportZSUBlock);