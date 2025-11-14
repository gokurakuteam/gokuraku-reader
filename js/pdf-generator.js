import { getMangaById, getChapterById } from '../data-manager.js';

/**
 * Завантажує зображення та повертає його як Data URL.
 * @param {string} url - URL зображення.
 * @returns {Promise<string>} - Promise, що повертає Data URL.
 */
async function loadImageAsDataURL(url) {
    try {
        const response = await fetch(url, { mode: 'cors' }); // Додано CORS для кращої сумісності
        if (!response.ok) {
            throw new Error(`Помилка мережі: статус ${response.status} для ${url}`);
        }
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Не вдалося завантажити зображення з ${url}:`, error);
        throw error;
    }
}

/**
 * Стискає зображення за допомогою Canvas.
 * @param {string} dataUrl - Data URL оригінального зображення.
 * @returns {Promise<string>} - Promise, що повертає стиснутий Data URL у форматі JPEG.
 */
async function compressImage(dataUrl) {
    const MAX_WIDTH = 1000; // Максимальна ширина для стиснутих зображень
    const QUALITY = 0.7;    // Якість JPEG (0.0 - 1.0)

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            // Зменшуємо розмір, якщо ширина більша за максимальну
            if (width > MAX_WIDTH) {
                height = (height * MAX_WIDTH) / width;
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}


export async function downloadChapterAsPdf(mangaId, chapterId, { quality = 'original', onProgress = () => {} }) {
    try {
        onProgress(0, 'Починаємо...');

        const manga = getMangaById(mangaId);
        const chapter = getChapterById(chapterId);

        if (!manga || !chapter || !chapter.pages || chapter.pages.length === 0) {
            throw new Error('Не знайдено даних про розділ або сторінок у розділі.');
        }

        const imageUrls = chapter.pages;
        const totalImages = imageUrls.length;
        const processedImages = [];
        
        onProgress(2, 'Завантаження зображень...');

        // Завантаження та обробка зображень
        for (let i = 0; i < totalImages; i++) {
            const url = imageUrls[i];
            try {
                let dataUrl = await loadImageAsDataURL(url);
                if (quality === 'compressed') {
                    dataUrl = await compressImage(dataUrl);
                }
                processedImages.push(dataUrl);
            } catch (error) {
                console.warn(`Пропуск пошкодженого або недоступного зображення: ${url}`);
            }
            // Оновлення прогресу в циклі
            const progress = 2 + ((i + 1) / totalImages) * 88; // Прогрес від 2% до 90%
            onProgress(progress, quality === 'compressed' ? 'Стиснення...' : 'Завантаження...');
        }
        
        if (processedImages.length === 0) {
            throw new Error("Не вдалося завантажити жодного зображення.");
        }
        
        onProgress(90, 'Створення PDF...');

        const { jsPDF } = window.jspdf;
        
        // Визначаємо розмір першої сторінки
        const firstImgProps = await new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = processedImages[0];
        });

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [firstImgProps.width, firstImgProps.height]
        });
        doc.deletePage(1);

        // Додавання сторінок до PDF
        for (let i = 0; i < processedImages.length; i++) {
            const dataUrl = processedImages[i];
             const imgProps = await new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.src = dataUrl;
            });

            doc.addPage([imgProps.width, imgProps.height]);
            doc.addImage(dataUrl, 'JPEG', 0, 0, imgProps.width, imgProps.height, undefined, 'FAST');
            
            const progress = 90 + ((i + 1) / processedImages.length) * 9; // Прогрес від 90% до 99%
            onProgress(progress, 'Компонування сторінок...');
        }

        const safeTitle = manga.title.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s-]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `${safeTitle}_Розділ_${chapter.chapter}_(${quality}).pdf`;
        
        onProgress(100, 'Збереження файлу...');
        doc.save(fileName);

    } catch (error) {
        console.error("[PDF Generator] Помилка при створенні PDF:", error);
        throw error; // Передаємо помилку для обробки в UI
    }
}