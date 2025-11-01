import { getMangaById } from './data-manager.js';

const BOOKMARKS_KEY = 'mangaBookmarks';
const HISTORY_KEY = 'mangaHistory';

// --- Bookmarks ---

export function getBookmarks() {
    const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
    return bookmarks ? JSON.parse(bookmarks) : [];
}

export function isBookmarked(mangaId) {
    const bookmarks = getBookmarks();
    return bookmarks.includes(mangaId);
}

export function addBookmark(mangaId) {
    const bookmarks = getBookmarks();
    if (!bookmarks.includes(mangaId)) {
        bookmarks.push(mangaId);
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    }
}

export function removeBookmark(mangaId) {
    let bookmarks = getBookmarks();
    bookmarks = bookmarks.filter(id => id !== mangaId);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
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

export function isChapterRead(mangaId, chapterId) {
    const history = getHistory();
    return history.some(item => item.mangaId === mangaId && item.chapterId === chapterId);
}

export function getLatestChapterForManga(mangaId) {
    const history = getHistory();
    return history.find(item => item.mangaId === mangaId);
}
