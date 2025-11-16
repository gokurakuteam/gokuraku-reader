import { loadMangaData } from './data-manager.js';
import { AppHeader, MangaCard } from './js/components.js';
import { handleNavigation } from './js/router.js';
import { getSavedThemeId, getThemeMode } from './storage-manager.js';
import { SHOP_ITEMS, applyTheme, applyThemeMode } from './js/clicker.js'; 

customElements.define('app-header', AppHeader);
customElements.define('manga-card', MangaCard);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Apply Theme Mode (Light/Dark)
    const savedMode = getThemeMode();
    applyThemeMode(savedMode);

    // 2. Apply Accent Theme
    const savedThemeId = getSavedThemeId();
    const theme = SHOP_ITEMS.themes.find(t => t.id === savedThemeId);
    if (theme) applyTheme(theme);
    else applyTheme(SHOP_ITEMS.themes[0]);

    await loadMangaData(); 

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .catch(err => console.log('ServiceWorker registration failed: ', err));
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