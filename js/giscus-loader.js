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

function generateThemeDataUrl(colors, themeMode) {
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

    const css = `
        :root {
            --giscus-main-background: transparent;
            --giscus-card-background: ${vars.bg};
            --giscus-input-background: ${vars.inputBg};
            --giscus-border-color: ${vars.border};
            --giscus-text-color: ${vars.text};
            --giscus-secondary-text-color: ${vars.secText};
            --giscus-accent-color: ${colors.primary};
            --giscus-button-text-color: ${vars.btnText};
            --giscus-glow-color: ${colors.glow};
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
        .gsc-main { font-family: 'Montserrat', sans-serif !important; }
        
        .gsc-comment-box {
            background-color: ${vars.bg} !important;
            border-radius: 15px !important;
        }
        
        .gsc-comment-box-textarea {
            background-color: ${vars.inputBg} !important;
            color: ${vars.text} !important;
            border: 1px solid ${vars.border} !important;
            border-radius: 10px !important;
        }
        
        .gsc-comment-box-textarea:focus {

            box-shadow: 0 0 8px ${colors.glow} !important;
        }
        
        button.btn-primary {
            background-color: ${colors.primary} !important;
            color: ${vars.btnText} !important;
            border: 1px solid ${colors.primary} !important;
            border-radius: 25px !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
        }
        
        button.btn-primary:hover { opacity: 0.9; box-shadow: 0 0 10px ${colors.glow} !important; }
        
        .gsc-timeline > .gsc-comment-anchor > .gsc-comment {
            background-color: transparent !important;
            border: none !important;
        }
        
        .gsc-comment > .color-bg-primary.border {
            background-color: ${vars.bg} !important;
            border: 1px solid ${vars.border} !important;
            border-radius: 15px !important;
            padding: 1rem !important;
        }
        
        .gsc-comment-header {
            color: ${vars.secText} !important;
        }
        
        .gsc-comment-body {
            color: ${vars.text} !important;
        }

        .gsc-reply-box button {
            background-color: ${vars.inputBg} !important;
            border: 1px solid ${vars.border} !important;
            border-radius: 10px !important;
            color: ${vars.secText} !important;
        }
        
        a { color: ${vars.secText} !important; text-decoration: none !important; }
        a:hover { color: ${colors.primary} !important; text-decoration: underline !important; }

        /* --- POPOVER --- */
        .gsc-reactions-popover {
            background-color: ${vars.bg} !important;
            border: 1px solid ${colors.primary} !important;
            border-radius: 16px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
        }
        .gsc-reactions-popover p {
            color: ${vars.text} !important;
            font-weight: 700 !important;
        }
        .gsc-reactions-popover .my-2 {
            border-color: ${vars.border} !important;
        }
        .gsc-emoji-button:hover {
            background-color: ${vars.inputBg} !important;
            border: 1px solid ${colors.primary} !important;
            transform: scale(1.15) !important;
        }

        .gsc-comment-box-textarea-extras {
            display: none !important;
        }

        #__next > main > div > div.gsc-comments > div.gsc-header > div > em {
            display: none !important;
        }
    `;
    
    return `data:text/css;base64,${btoa(unescape(encodeURIComponent(css)))}`;
}

export function loadGiscusForPage(pageType, mangaId, chapterId = null) {
    const container = document.getElementById('giscus-container');
    if (!container) return;

    container.innerHTML = '';

    const themeId = getSavedThemeId();
    const themeMode = getThemeMode(); 
    let activeColors = { primary: '#00ff99', glow: 'rgba(0, 255, 153, 0.5)' }; 

    if (SHOP_ITEMS && SHOP_ITEMS.themes) {
        const themeObj = SHOP_ITEMS.themes.find(t => t.id === themeId);
        if (themeObj) {
            activeColors = themeObj.colors;
        }
    }

    const themeUrl = generateThemeDataUrl(activeColors, themeMode);

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
    script.setAttribute('data-loading', 'lazy');
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