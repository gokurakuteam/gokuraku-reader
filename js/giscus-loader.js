import { getMangaById, getChapterById } from '../data-manager.js';

// Обов'язково замініть значення [ВАШ-...] на ваші реальні дані з сайту giscus.app
const GiscusConfig = {
    repo: 'gokurakuteam/gokuraku-reader',
    repoId: 'R_kgDOQLqvmQ', 
    theme: 'https://cdn.jsdelivr.net/gh/gokurakuteam/gokuraku-reader@latest/css/giscus-theme.css', // Або будь-яка інша тема, яка вам подобається
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

/**
 * Завантажує Giscus для конкретної сторінки (тайтлу або розділу).
 * @param {'title' | 'reader'} pageType - Тип сторінки.
 * @param {number} mangaId - ID манґи.
 * @param {number | null} chapterId - ID розділу (тільки для 'reader').
 */
// js/giscus-loader.js

export function loadGiscusForPage(pageType, mangaId, chapterId = null) {
    const container = document.getElementById('giscus-container');
    if (!container) {
        console.log('Контейнер для Giscus не знайдено. Пропускаємо завантаження.');
        return;
    }

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.setAttribute('data-repo', GiscusConfig.repo);
    script.setAttribute('data-repo-id', GiscusConfig.repoId);
    script.setAttribute('data-lang', GiscusConfig.lang);
    script.setAttribute('data-theme', GiscusConfig.theme);
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-loading', 'lazy');
    script.setAttribute('data-mapping', 'specific');

    let term;
    let categoryConfig;

    // === ОСНОВНА ЗМІНА ТУТ ===
    // 1. Отримуємо дані про манґу
    const manga = getMangaById(mangaId);
    if (!manga) {
        console.error(`Giscus: Не вдалося знайти манґу з ID ${mangaId}`);
        return;
    }

    // 2. Формуємо зрозумілий заголовок залежно від сторінки
    if (pageType === 'title') {
        categoryConfig = GiscusConfig.categories.title;
        term = `[Обговорення] ${manga.title}`; // Новий, зрозумілий заголовок
    } else if (pageType === 'reader' && chapterId) {
        categoryConfig = GiscusConfig.categories.reader;
        const chapter = getChapterById(chapterId);
        if (!chapter) {
            console.error(`Giscus: Не вдалося знайти розділ ID ${chapterId} для манґи "${manga.title}"`);
            term = `[Невідомий розділ] ${manga.title}`;
        } else {
            term = `[Розділ ${chapter.chapter}] ${manga.title}`; // Новий, зрозумілий заголовок
        }
    } else {
        return;
    }
    // === КІНЕЦЬ ЗМІНИ ===

    script.setAttribute('data-term', term);
    script.setAttribute('data-category', categoryConfig.name);
    script.setAttribute('data-category-id', categoryConfig.id);

    container.appendChild(script);
}

// --- END OF FILE js/giscus-loader.js ---

