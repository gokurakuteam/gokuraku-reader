
let mangaData = [];

export async function loadMangaData() {
    try {
        const response = await fetch('manga-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        mangaData = await response.json();
        console.log('Manga data loaded successfully!');
    } catch (error) {
        console.error("Could not load manga data:", error);
    }
}

export function getAllManga() {
    return mangaData;
}

export function getMangaById(id) {
    return mangaData.find(manga => manga.id === id);
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
