import { getMangaById } from './data-manager.js';

const BOOKMARKS_KEY = 'mangaBookmarks';
const HISTORY_KEY = 'mangaHistory';
const CLICKER_KEY = 'gokuClickerData';
const THEME_KEY = 'gokuActiveThemeId';
const THEME_MODE_KEY = 'gokuThemeMode'; // 'light', 'dark', 'system'

// --- Bookmarks ---
// ... (код закладок без змін) ...
function createDefaultBookmarks() {
    return {
        "categories": [
            { name: "Читаю", color: "#00ff99", mangaIds: [] },
            { name: "В планах", color: "#007bff", mangaIds: [] },
            { name: "Прочитано", color: "#6c757d", mangaIds: [] }
        ]
    };
}

export function getBookmarks() {
    const rawData = localStorage.getItem(BOOKMARKS_KEY);
    if (!rawData) {
        const defaultBookmarks = createDefaultBookmarks();
        saveBookmarks(defaultBookmarks);
        return defaultBookmarks;
    }
    try {
        const parsed = JSON.parse(rawData);
        if (parsed && Array.isArray(parsed.categories)) return parsed;
        // Migration logic
        const newStructure = createDefaultBookmarks();
        if (Array.isArray(parsed)) {
            newStructure.categories[0].mangaIds = parsed;
        } else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            Object.keys(parsed).forEach(categoryName => {
                if (categoryName === 'categories') return;
                if (Array.isArray(parsed[categoryName])) {
                    const existingCat = newStructure.categories.find(c => c.name === categoryName);
                    if (existingCat) {
                        existingCat.mangaIds = parsed[categoryName];
                    } else {
                        newStructure.categories.push({
                            name: categoryName, color: '#888888', mangaIds: parsed[categoryName]
                        });
                    }
                }
            });
        }
        saveBookmarks(newStructure);
        return newStructure;
    } catch (e) {
        return createDefaultBookmarks();
    }
}

function saveBookmarks(bookmarks) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(mangaId) {
    const bookmarks = getBookmarks();
    return bookmarks.categories.some(cat => cat.mangaIds.includes(mangaId));
}

export function getMangaCategory(mangaId) {
    const bookmarks = getBookmarks();
    return bookmarks.categories.find(cat => cat.mangaIds.includes(mangaId)) || null;
}

export function addBookmark(mangaId, categoryName) {
    let bookmarks = getBookmarks();
    bookmarks.categories.forEach(cat => {
        cat.mangaIds = cat.mangaIds.filter(id => id !== mangaId);
    });
    const targetCategory = bookmarks.categories.find(cat => cat.name === categoryName);
    if (targetCategory && !targetCategory.mangaIds.includes(mangaId)) {
        targetCategory.mangaIds.push(mangaId);
    }
    saveBookmarks(bookmarks);
}

export function removeBookmark(mangaId) {
    let bookmarks = getBookmarks();
    bookmarks.categories.forEach(cat => {
        cat.mangaIds = cat.mangaIds.filter(id => id !== mangaId);
    });
    saveBookmarks(bookmarks);
}

// --- Category Management ---
export function addCategory(name, color) {
    const bookmarks = getBookmarks();
    if (!bookmarks.categories.some(cat => cat.name === name)) {
        bookmarks.categories.push({ name, color, mangaIds: [] });
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}

export function updateCategory(oldName, newName, newColor) {
    const bookmarks = getBookmarks();
    if (oldName !== newName && bookmarks.categories.some(cat => cat.name === newName)) return false;
    const categoryToUpdate = bookmarks.categories.find(cat => cat.name === oldName);
    if (categoryToUpdate) {
        categoryToUpdate.name = newName;
        categoryToUpdate.color = newColor;
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}

export function deleteCategory(categoryName) {
    let bookmarks = getBookmarks();
    const initialLength = bookmarks.categories.length;
    bookmarks.categories = bookmarks.categories.filter(cat => cat.name !== categoryName);
    if (bookmarks.categories.length < initialLength) {
        saveBookmarks(bookmarks);
        return true;
    }
    return false;
}

// --- History ---
export function getHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

export function addChapterToHistory(mangaId, chapterId) {
    let history = getHistory();
    history = history.filter(item => !(item.mangaId === mangaId && item.chapterId === chapterId));
    history.unshift({ mangaId, chapterId, timestamp: new Date().toISOString() });
    if (history.length > 200) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function addAllChaptersToHistory(mangaId) {
    const manga = getMangaById(mangaId);
    if (!manga || !manga.chapters || manga.chapters.length === 0) return;
    let history = getHistory();
    history = history.filter(item => item.mangaId !== mangaId);
    const chaptersToAdd = manga.chapters.map(ch => ({
        mangaId: mangaId, chapterId: ch.id, timestamp: new Date().toISOString()
    }));
    const updatedHistory = [...chaptersToAdd, ...history];
    if (updatedHistory.length > 200) updatedHistory.length = 200;
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

// --- Clicker & Theme ---

export function getClickerData() {
    const data = localStorage.getItem(CLICKER_KEY);
    const defaultData = {
        coins: 0,
        clickCount: 0,
        unlockedCharacters: ['char_1'], // ID відкритого персонажа
        unlockedSkins: ['skin_1_default'], // ID відкритого скіна
        activeSkinId: 'skin_1_default',
        activeCharacterId: 'char_1',
        unlockedThemes: ['theme_neon_green'],
        activeThemeId: 'theme_neon_green'
    };
    
    if (!data) return defaultData;
    
    try {
        const parsed = JSON.parse(data);
        // Migration for old data structure
        if (parsed.unlockedChibiks) {
            return defaultData; // Reset if structure changed significantly
        }
        return { ...defaultData, ...parsed };
    } catch (e) {
        return defaultData;
    }
}

export function saveClickerData(data) {
    localStorage.setItem(CLICKER_KEY, JSON.stringify(data));
}

export function saveThemeId(themeId) {
    localStorage.setItem(THEME_KEY, themeId);
    const clickerData = getClickerData();
    clickerData.activeThemeId = themeId;
    saveClickerData(clickerData);
}

export function getSavedThemeId() {
    return localStorage.getItem(THEME_KEY) || 'theme_neon_green';
}

export function saveThemeMode(mode) {
    localStorage.setItem(THEME_MODE_KEY, mode);
}

export function getThemeMode() {
    return localStorage.getItem(THEME_MODE_KEY) || 'system';
}