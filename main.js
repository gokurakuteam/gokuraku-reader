import { loadMangaData } from './data-manager.js';
import { AppHeader, MangaCard } from './js/components.js';
import { handleNavigation } from './js/router.js';

customElements.define('app-header', AppHeader);
customElements.define('manga-card', MangaCard);

document.addEventListener('DOMContentLoaded', async () => {
    await loadMangaData(); 

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
