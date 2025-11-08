import { getMangaById, getChapterById } from '../data-manager.js';

async function loadImage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Помилка мережі: статус ${response.status} для ${url}`);
        }
        const blob = await response.blob();

        const dataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    } catch (error) {
        console.error(`Не вдалося обробити зображення з ${url}:`, error);
        throw error;
    }
}

export async function downloadChapterAsPdf(mangaId, chapterId, buttonElement) {
    const originalIcon = buttonElement.innerHTML;
    const loadingIcon = '<svg viewBox="0 0 24 24" class="spinner"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

    try {
        buttonElement.innerHTML = loadingIcon;
        buttonElement.disabled = true;

        const manga = getMangaById(mangaId);
        const chapter = getChapterById(chapterId);
        
        console.log(`[PDF Generator] Розпочато завантаження розділу ${chapter.chapter} для '${manga.title}'.`);

        if (!manga || !chapter || !chapter.pages || chapter.pages.length === 0) {
            throw new Error('Не знайдено даних про розділ або сторінок у розділі.');
        }
        
        console.log(`[PDF Generator] Знайдено ${chapter.pages.length} сторінок. Починаю завантаження зображень...`);

        const imagePromises = chapter.pages.map((url, index) => 
            loadImage(url).then(img => {
                console.log(`[PDF Generator] Зображення ${index + 1}/${chapter.pages.length} завантажено успішно.`);
                return img;
            })
        );

        const results = await Promise.allSettled(imagePromises);
        
        const loadedImages = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
        
        const failedCount = results.length - loadedImages.length;

        console.log(`[PDF Generator] Успішно завантажено ${loadedImages.length} з ${chapter.pages.length} зображень.`);
        if (failedCount > 0) {
            console.warn(`[PDF Generator] Не вдалося завантажити ${failedCount} зображень.`);
        }

        if (loadedImages.length === 0) {
            throw new Error("Не вдалося завантажити жодного зображення.");
        }
        
        console.log("[PDF Generator] Розраховую максимальну ширину...");
        
        let maxWidth = 0;
        loadedImages.forEach(img => {
            if (img.width > maxWidth) {
                maxWidth = img.width;
            }
        });

        const MAX_PAGE_HEIGHT = 10000;
        console.log(`[PDF Generator] Максимальна ширина: ${maxWidth}px. Ліміт висоти сторінки: ${MAX_PAGE_HEIGHT}px.`);
        console.log("[PDF Generator] Створюю екземпляр jsPDF...");

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [maxWidth, MAX_PAGE_HEIGHT]
        });

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        console.log("[PDF Generator] Додаю зображення до документа з нарізкою...");

        let currentY = 0;
        let pageCount = 1;
        
        for (let i = 0; i < loadedImages.length; i++) {
            const img = loadedImages[i];
            let sourceY = 0;

            while (sourceY < img.height) {
                let remainingOnPage = MAX_PAGE_HEIGHT - currentY;

                if (remainingOnPage <= 1) {
                    doc.addPage();
                    pageCount++;
                    currentY = 0;
                    remainingOnPage = MAX_PAGE_HEIGHT;
                    console.log(`[PDF Generator] Створено нову сторінку ${pageCount}.`);
                }

                const sliceHeight = Math.min(img.height - sourceY, remainingOnPage);
                
                tempCanvas.width = img.width;
                tempCanvas.height = sliceHeight;
                tempCtx.drawImage(img, 0, sourceY, img.width, sliceHeight, 0, 0, img.width, sliceHeight);

                doc.addImage(tempCanvas, 'JPEG', 0, currentY, img.width, sliceHeight);
                
                currentY += sliceHeight;
                sourceY += sliceHeight;
            }
        }

        const safeTitle = manga.title.replace(/[^a-zA-Zа-яА-ЯіІїЇєЄґҐ0-9\s-]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `${safeTitle}_Розділ_${chapter.chapter}.pdf`;
        
        console.log(`[PDF Generator] Генерація завершена. Всього сторінок: ${pageCount}. Зберігаю файл: ${fileName}`);
        doc.save(fileName);
        
        console.log("[PDF Generator] PDF успішно збережено!");

    } catch (error) {
        console.error("[PDF Generator] Загальна помилка при створенні PDF:", error);
        alert("Не вдалося завантажити розділ. Деталі помилки дивіться в консолі розробника (F12).");
    } finally {
        buttonElement.innerHTML = originalIcon;
        buttonElement.disabled = false;
    }
}
