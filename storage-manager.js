import { getMangaById } from './data-manager.js';

const BOOKMARKS_KEY = 'mangaBookmarks';
const HISTORY_KEY = 'mangaHistory';

// --- Bookmarks ---

export function getBookmarks() {
    const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
    if (bookmarks) {
        // Проста міграція: якщо дані старого формату (простий масив), конвертуємо їх
        try {
            const parsed = JSON.parse(bookmarks);
            if (Array.isArray(parsed)) {
                const migratedBookmarks = {
                    "Читаю": parsed,
                    "В планах": [],
                    "Прочитано": []
                };
                localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(migratedBookmarks));
                return migratedBookmarks;
            }
            return parsed;
        } catch (e) {
             // Якщо дані пошкоджені, скидаємо до стандартних
        }
    }
    
    // Створюємо структуру за замовчуванням
    const defaultBookmarks = {
        "Читаю": [],
        "В планах": [],
        "Прочитано": []
    };
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(defaultBookmarks));
    return defaultBookmarks;
}

function saveBookmarks(bookmarks) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(mangaId) {
    const bookmarks = getBookmarks();
    return Object.values(bookmarks).some(categoryArray => categoryArray.includes(mangaId));
}

export function getMangaCategory(mangaId) {
    const bookmarks = getBookmarks();
    for (const category in bookmarks) {
        if (bookmarks[category].includes(mangaId)) {
            return category;
        }
    }
    return null;
}

export function addBookmark(mangaId, category = "Читаю") {
    let bookmarks = getBookmarks();
    // Спочатку видаляємо манґу з будь-якої іншої категорії
    for (const cat in bookmarks) {
        bookmarks[cat] = bookmarks[cat].filter(id => id !== mangaId);
    }
    // Тепер додаємо в потрібну категорію
    if (!bookmarks[category]) {
        bookmarks[category] = [];
    }
    if (!bookmarks[category].includes(mangaId)) {
        bookmarks[category].push(mangaId);
    }
    saveBookmarks(bookmarks);
}

export function removeBookmark(mangaId) {
    let bookmarks = getBookmarks();
    for (const category in bookmarks) {
        bookmarks[category] = bookmarks[category].filter(id => id !== mangaId);
    }
    saveBookmarks(bookmarks);
}

// --- Category Management ---

export function addCategory(categoryName) {
    const bookmarks = getBookmarks();
    if (!bookmarks[categoryName]) {
        bookmarks[categoryName] = [];
        saveBookmarks(bookmarks);
        return true;
    }
    return false; // Категорія вже існує
}

export function renameCategory(oldName, newName) {
    const bookmarks = getBookmarks();
    // Забороняємо перейменовувати в існуючу назву або якщо стара назва не існує
    if (!bookmarks[oldName] || bookmarks[newName]) {
        return false;
    }
    bookmarks[newName] = bookmarks[oldName];
    delete bookmarks[oldName];
    saveBookmarks(bookmarks);
    return true;
}

export function deleteCategory(categoryName) {
    const bookmarks = getBookmarks();
    // Забороняємо видаляти базові категорії
    if (["Читаю", "В планах", "Прочитано"].includes(categoryName)) {
        return false;
    }
    if (bookmarks[categoryName]) {
        delete bookmarks[categoryName];
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}


// --- History ---

export function getHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    // Returns an array of { mangaId, chapterId, timestamp }
    return history ? JSON.parse(history) : [];
}

export function addChapterToHistory(mangaId, chapterId) {
    let history = getHistory();
    // Remove previous entry for the same chapter to keep it updated
    history = history.filter(item => !(item.mangaId === mangaId && item.chapterId === chapterId));
    // Add new entry to the beginning of the array
    history.unshift({ mangaId, chapterId, timestamp: new Date().toISOString() });
    // Optional: Limit history size
    if (history.length > 200) { // Keep last 200 read chapters
        history.pop();
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function addAllChaptersToHistory(mangaId) {
    const manga = getMangaById(mangaId);
    if (!manga || !manga.chapters || manga.chapters.length === 0) return;

    let history = getHistory();
    // Filter out any existing history for this manga to avoid duplicates
    history = history.filter(item => item.mangaId !== mangaId);

    const chaptersToAdd = manga.chapters.map(ch => ({
        mangaId: mangaId,
        chapterId: ch.id,
        timestamp: new Date().toISOString()
    }));

    // Add all chapters for this manga to the beginning of the history
    const updatedHistory = [...chaptersToAdd, ...history];

    // Optional: Limit history size
    if (updatedHistory.length > 200) {
        updatedHistory.length = 200;
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
}


export function removeChapterFromHistory(mangaId, chapterId) {
    let history = getHistory();
    history = history.filter(item => !(item.mangaId === mangaId && item.chapterId === chapterId));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function removeAllChaptersFromHistory(mangaId) {
    let history = getHistory();
    history = history.filter(item => item.mangaId !== mangaId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function isChapterRead(mangaId, chapterId) {
    const history = getHistory();
    return history.some(item => item.mangaId === mangaId && item.chapterId === chapterId);
}

export function getLatestChapterForManga(mangaId) {
    const history = getHistory();
    return history.find(item => item.mangaId === mangaId);
}