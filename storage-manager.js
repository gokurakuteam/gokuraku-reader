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
    if (history.length > 100) { // Keep last 100 read chapters
        history.pop();
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getLatestChapterForManga(mangaId) {
    const history = getHistory();
    return history.find(item => item.mangaId === mangaId);
}
