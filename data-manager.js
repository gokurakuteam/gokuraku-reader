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

export function getLatestUpdates(limit) {
    const allChapters = mangaData.flatMap(manga => 
        manga.chapters.map(chapter => ({ ...chapter, mangaTitle: manga.title, coverImage: manga.coverImage, pageUrl: manga.pageUrl }))
    );
    
    const sortedUpdates = allChapters.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const latestByManga = {};
    mangaData.forEach(manga => {
        const latestChapter = [...manga.chapters].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        if (latestChapter) {
            latestByManga[manga.id] = { ...manga, latestUpdate: latestChapter.date };
        }
    });

    const sortedManga = Object.values(latestByManga).sort((a, b) => new Date(b.latestUpdate) - new Date(a.latestUpdate));
    
    return sortedManga.slice(0, limit);
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
