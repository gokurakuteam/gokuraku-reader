
class SupportZSUBlock extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    --accent-color: #00ff99;
                    --background-dark: #121212;
                    --card-background: #1e1e1e;
                    --glow-color: rgba(0, 255, 153, 0.5);
                }

                .support-zsu {
                    background: linear-gradient(rgba(0, 128, 0, 0.3), rgba(0, 0, 0, 0.8));
                    padding: 3rem 2rem;
                    border: 1px solid var(--accent-color);
                    border-radius: 15px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 0 20px rgba(0, 255, 153, 0.3);
                }

                .support-zsu-content {
                    position: relative;
                    z-index: 1;
                }

                .support-zsu h2 {
                    color: var(--accent-color);
                    font-size: 2.5rem;
                    text-shadow: 0 0 8px var(--glow-color);
                }

                .support-zsu p {
                    font-size: 1.1rem;
                    color: var(--text-light);
                    margin-bottom: 2rem;
                }

                .support-buttons {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .button-support {
                    background-color: transparent;
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    padding: 0.75rem 1.5rem;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.4s ease;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    text-decoration: none;
                }

                .button-support:hover {
                    background-color: var(--accent-color);
                    color: var(--background-dark);
                    box-shadow: 0 0 20px var(--glow-color);
                }

                 @media (max-width: 768px) {
                    .support-zsu h2 {
                        font-size: 2rem;
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
