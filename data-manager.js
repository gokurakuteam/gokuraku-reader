let mangaData = [];

let loadPromise = null;

export function loadMangaData() {
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const response = await fetch('api/manga-list.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                mangaData = await response.json();
                mangaData.forEach(m => {
                    m._updateTime = m.latestUpdate ? new Date(m.latestUpdate).getTime() : 0;
                });
                console.log('Manga list loaded successfully!');
            } catch (error) {
                console.error("Could not load manga list:", error);
                loadPromise = null; // Дозволяємо спробувати ще раз при помилці
            }
        })();
    }
    return loadPromise;
}

const detailedMangaFetched = new Set();

export async function fetchMangaDetails(id) {
    let identifier = id;
    if (typeof id === 'number' || (typeof id === 'string' && !isNaN(id))) {
        // Find slug if it's a numeric ID
        const manga = mangaData.find(m => m.id === parseInt(id));
        if (manga && manga.slug) {
            identifier = manga.slug;
        }
    }

    if (detailedMangaFetched.has(identifier)) return;

    try {
        const response = await fetch(`api/manga/${identifier}.json`);
        if (!response.ok) throw new Error(`Failed to load details for ${identifier}`);
        
        const fullData = await response.json();
        
        // Update local mangaData with the full data
        const index = mangaData.findIndex(m => m.id === fullData.id);
        if (index !== -1) {
            mangaData[index] = fullData;
        } else {
            mangaData.push(fullData);
        }
        
        detailedMangaFetched.add(identifier);
    } catch (error) {
        console.error("Could not fetch manga details:", error);
    }
}

export function getAllManga() {
    return mangaData;
}

export function getMangaById(id) {
    if (typeof id === 'string' && isNaN(id)) {
        return mangaData.find(manga => manga.slug === id);
    }
    return mangaData.find(manga => manga.id === parseInt(id));
}

export function getLatestUpdates(limit = 5) {
    const withChapters = mangaData.filter(manga => manga.chapters && manga.chapters.length > 0);
    const sorted = [...withChapters].sort((a, b) => (b._updateTime || 0) - (a._updateTime || 0));
    return sorted.slice(0, limit);
}

export function getChapterById(id) {
    for (const manga of mangaData) {
        const chapter = manga.chapters.find(ch => ch.id === id);
        if (chapter) {
            return chapter;
        }
    }
    return null;
}
