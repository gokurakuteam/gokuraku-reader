import { getMangaById, getChapterById } from '../data-manager.js';
import { getSavedThemeId, getThemeMode } from '../storage-manager.js';
import { SHOP_ITEMS } from './clicker.js'; 

const GiscusConfig = {
    repo: 'gokurakuteam/gokuraku-reader',
    repoId: 'R_kgDOQLqvmQ', 
    lang: 'uk',
    categories: {
        title: {
            name: 'Коментарі до тайтлів',
            id: 'DIC_kwDOQLqvmc4Cx0zW'
        },
        reader: {
            name: 'Коментарі до розділів',
            id: 'DIC_kwDOQLqvmc4Cx0yg'
        }
    }
};

function generateThemeDataUrl(colors, themeMode, baseCss = '') {
    if (!colors) {
         colors = { primary: '#00ff99', glow: 'rgba(0, 255, 153, 0.5)' };
    }

    // Визначаємо чи активна темна тема
    let isDark = themeMode === 'dark';
    if (themeMode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Налаштування кольорів для Giscus (Темна / Світла)
    const vars = isDark ? {
        bg: '#1e1e1e',
        inputBg: '#121212',
        border: '#333333',
        text: '#e0e0e0',
        secText: '#a0a0a0',
        btnText: '#121212'
    } : {
        bg: '#ffffff',
        inputBg: '#f0f2f5',
        border: '#e0e0e0',
        text: '#1c1e21',     /* Темний текст для світлої теми */
        secText: '#65676b',
        btnText: '#ffffff'   /* Білий текст на кнопці акцентного кольору */
    };

    let primaryLight = 'rgba(0, 255, 153, 0.1)';
    if (colors.primary.startsWith('#')) {
        primaryLight = colors.primary + '1a';
    }

    const dynamicCss = `
        :root {
            --giscus-main-background: transparent !important;
            --giscus-card-background: ${vars.bg} !important;
            --giscus-input-background: ${vars.inputBg} !important;
            --giscus-border-color: ${vars.border} !important;
            --giscus-text-color: ${vars.text} !important;
            --giscus-secondary-text-color: ${vars.secText} !important;
            --giscus-accent-color: ${colors.primary} !important;
            --giscus-accent-color-light: ${primaryLight} !important;
            --giscus-button-text-color: ${vars.btnText} !important;
            --giscus-glow-color: ${colors.glow} !important;
        }
        main {
            --color-prettylights-syntax-comment: #8b949e;
            --color-prettylights-syntax-constant: #79c0ff;
            --color-canvas-default: transparent;
            --color-canvas-overlay: ${vars.bg};
            --color-canvas-inset: ${vars.inputBg};
            --color-border-default: ${vars.border};
            --color-border-muted: ${vars.border};
            
            /* Акцентні кольори */
            --color-accent-fg: ${colors.primary};
            --color-accent-emphasis: ${colors.primary};
            --color-accent-muted: ${colors.glow};
            
            /* Текст */
            --color-fg-default: ${vars.text};
            --color-fg-muted: ${vars.secText};
            
            /* Кнопки */
            --color-btn-primary-bg: ${colors.primary};
            --color-btn-primary-hover-bg: ${colors.primary};
            --color-btn-primary-text: ${vars.btnText};
            --color-btn-primary-border: ${vars.border};
            --color-btn-primary-shadow: 0 0 transparent;
            --color-btn-primary-inset-shadow: 0 0 transparent;
            --color-btn-primary-hover-border: ${vars.border};
            --color-btn-primary-selected-bg: ${colors.primary};
        }
    `;
    
    const finalCss = baseCss + "\n" + dynamicCss;
    return `data:text/css;base64,${btoa(unescape(encodeURIComponent(finalCss)))}`;
}

export async function loadGiscusForPage(pageType, mangaId, chapterId = null) {
    const container = document.getElementById('giscus-container');
    if (!container) return;

    container.innerHTML = `
        <div id="giscus-skeleton" style="padding: 20px; border-radius: 15px; background: var(--card-background); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 15px;">
            <div style="height: 30px; background: var(--background-dark); border-radius: 8px; width: 30%; animation: skeleton-loading 1.5s infinite;"></div>
            <div style="height: 80px; background: var(--background-dark); border-radius: 10px; width: 100%; animation: skeleton-loading 1.5s infinite;"></div>
            <div style="display: flex; gap: 15px; margin-top: 10px;">
                <div style="height: 45px; background: var(--background-dark); border-radius: 50%; width: 45px; animation: skeleton-loading 1.5s infinite;"></div>
                <div style="height: 45px; background: var(--background-dark); border-radius: 10px; flex: 1; animation: skeleton-loading 1.5s infinite;"></div>
            </div>
        </div>
    `;

    const handleGiscusLoad = (event) => {
        if (event.origin !== 'https://giscus.app') return;
        if (!(typeof event.data === 'object' && event.data.giscus)) return;
        
        const skeleton = document.getElementById('giscus-skeleton');
        if (skeleton) skeleton.remove();
        window.removeEventListener('message', handleGiscusLoad);
    };
    window.addEventListener('message', handleGiscusLoad);

    const themeId = getSavedThemeId();
    const themeMode = getThemeMode(); 
    let activeColors = { primary: '#00ff99', glow: 'rgba(0, 255, 153, 0.5)' }; 

    if (SHOP_ITEMS && SHOP_ITEMS.themes) {
        const themeObj = SHOP_ITEMS.themes.find(t => t.id === themeId);
        if (themeObj) {
            activeColors = themeObj.colors;
        }
    }

    let baseCss = '';
    try {
        const resp = await fetch('css/giscus-theme.css');
        if (resp.ok) baseCss = await resp.text();
    } catch (e) {
        console.error('Failed to load giscus theme CSS', e);
    }

    const themeUrl = generateThemeDataUrl(activeColors, themeMode, baseCss);

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.setAttribute('data-repo', GiscusConfig.repo);
    script.setAttribute('data-repo-id', GiscusConfig.repoId);
    script.setAttribute('data-lang', GiscusConfig.lang);
    script.setAttribute('data-theme', themeUrl);
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-mapping', 'specific');

    let term;
    let categoryConfig;

    const manga = getMangaById(mangaId);
    if (!manga) return;

    if (pageType === 'title') {
        categoryConfig = GiscusConfig.categories.title;
        term = `[Обговорення] ${manga.title}`;
    } else if (pageType === 'reader' && chapterId) {
        categoryConfig = GiscusConfig.categories.reader;
        const chapter = getChapterById(chapterId);
        if (!chapter) {
            term = `[Невідомий розділ] ${manga.title}`;
        } else {
            term = `[Розділ ${chapter.chapter}] ${manga.title}`;
        }
    } else {
        return;
    }

    script.setAttribute('data-term', term);
    script.setAttribute('data-category', categoryConfig.name);
    script.setAttribute('data-category-id', categoryConfig.id);

    container.appendChild(script);
}