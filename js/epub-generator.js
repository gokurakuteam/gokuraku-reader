import { getMangaById, getChapterById } from '../data-manager.js';

export async function downloadChapterAsEpub(mangaId, chapterId, { onProgress = () => {} }) {
    try {
        onProgress(10, 'Підготовка до створення EPUB...');

        const manga = getMangaById(mangaId);
        const chapter = getChapterById(chapterId);

        if (!manga || !chapter || !chapter.content) {
            throw new Error('Не знайдено текстового контенту для створення EPUB.');
        }

        onProgress(30, 'Створення структури архіву...');
        const zip = new JSZip();

        // 1. mimetype (повинен бути без стиснення, але JSZip дозволяє просто додати його)
        zip.file("mimetype", "application/epub+zip");

        // 2. META-INF/container.xml
        const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`;
        zip.folder("META-INF").file("container.xml", containerXml);

        // 3. OEBPS/content.opf
        const safeTitle = (manga.title || 'Unknown').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeAuthor = 'Gokuraku Reader';
        const chapterTitle = `Том ${chapter.volume || 1}, Розділ ${chapter.chapter || 1}`;
        
        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${safeTitle} - ${chapterTitle}</dc:title>
        <dc:creator opf:role="aut">${safeAuthor}</dc:creator>
        <dc:language>uk</dc:language>
        <dc:identifier id="BookId">urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : '12345-67890'}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="style" href="style.css" media-type="text/css"/>
        <item id="chapter1" href="chapter.html" media-type="application/xhtml+xml"/>
    </manifest>
    <spine toc="ncx">
        <itemref idref="chapter1"/>
    </spine>
</package>`;

        // 4. OEBPS/toc.ncx
        const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:12345-67890"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${safeTitle}</text>
    </docTitle>
    <navMap>
        <navPoint id="navPoint-1" playOrder="1">
            <navLabel>
                <text>${chapterTitle}</text>
            </navLabel>
            <content src="chapter.html"/>
        </navPoint>
    </navMap>
</ncx>`;

        // 5. CSS
        const styleCss = `
            body { font-family: sans-serif; line-height: 1.6; margin: 5%; }
            h2 { text-align: center; margin-bottom: 2em; }
            p { text-indent: 1.5em; margin-bottom: 0.5em; }
        `;

        // 6. Content HTML
        // Очищаємо контент, щоб він був валідним XHTML (дуже базово)
        let htmlContent = chapter.content.replace(/<br>/gi, '<br/>').replace(/<hr>/gi, '<hr/>');
        const chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="uk">
<head>
    <title>${chapterTitle}</title>
    <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
    <h2>${chapterTitle}</h2>
    ${htmlContent}
</body>
</html>`;

        const oebps = zip.folder("OEBPS");
        oebps.file("content.opf", contentOpf);
        oebps.file("toc.ncx", tocNcx);
        oebps.file("style.css", styleCss);
        oebps.file("chapter.html", chapterHtml);

        onProgress(70, 'Пакування EPUB...');
        
        const content = await zip.generateAsync({ type: "blob" });
        
        onProgress(100, 'Збереження файлу...');
        
        const fileName = `${safeTitle.replace(/\s+/g, '_')}_${chapter.chapter}.epub`;
        
        // Створення посилання для завантаження
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("[EPUB Generator] Помилка:", error);
        throw error;
    }
}

export async function downloadMultipleChaptersAsEpub(mangaId, chapters, { onProgress = () => {} }) {
    try {
        onProgress(10, 'Підготовка до створення єдиного EPUB...');
        const manga = getMangaById(mangaId);

        if (!manga || chapters.length === 0) {
            throw new Error('Немає даних для створення EPUB.');
        }

        onProgress(20, 'Створення структури архіву...');
        const zip = new JSZip();

        zip.file("mimetype", "application/epub+zip");

        const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`;
        zip.folder("META-INF").file("container.xml", containerXml);

        const safeTitle = (manga.title || 'Unknown').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeAuthor = 'Gokuraku Reader';
        
        let manifestItems = '';
        let spineItems = '';
        let navPoints = '';
        
        const oebps = zip.folder("OEBPS");

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            if (!chapter.content) continue;

            const chapterId = `chapter${i+1}`;
            const chapterFileName = `chapter${i+1}.html`;
            const chapterTitle = `Том ${chapter.volume || 1}, Розділ ${chapter.chapter || 1}${chapter.title ? ': ' + chapter.title : ''}`;
            const safeChapterTitle = chapterTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            manifestItems += `\n        <item id="${chapterId}" href="${chapterFileName}" media-type="application/xhtml+xml"/>`;
            spineItems += `\n        <itemref idref="${chapterId}"/>`;
            
            navPoints += `
        <navPoint id="navPoint-${i+1}" playOrder="${i+1}">
            <navLabel>
                <text>${safeChapterTitle}</text>
            </navLabel>
            <content src="${chapterFileName}"/>
        </navPoint>`;

            let htmlContent = chapter.content.replace(/<br>/gi, '<br/>').replace(/<hr>/gi, '<hr/>');
            const chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="uk">
<head>
    <title>${safeChapterTitle}</title>
    <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
    <h2>${safeChapterTitle}</h2>
    ${htmlContent}
</body>
</html>`;
            oebps.file(chapterFileName, chapterHtml);
        }

        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${safeTitle}</dc:title>
        <dc:creator opf:role="aut">${safeAuthor}</dc:creator>
        <dc:language>uk</dc:language>
        <dc:identifier id="BookId">urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : '12345-67890'}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="style" href="style.css" media-type="text/css"/>${manifestItems}
    </manifest>
    <spine toc="ncx">${spineItems}
    </spine>
</package>`;

        const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:12345-67890"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${safeTitle}</text>
    </docTitle>
    <navMap>${navPoints}
    </navMap>
</ncx>`;

        const styleCss = `
            body { font-family: sans-serif; line-height: 1.6; margin: 5%; }
            h2 { text-align: center; margin-bottom: 2em; }
            p { text-indent: 1.5em; margin-bottom: 0.5em; }
        `;

        oebps.file("content.opf", contentOpf);
        oebps.file("toc.ncx", tocNcx);
        oebps.file("style.css", styleCss);

        onProgress(70, 'Пакування єдиного EPUB...');
        
        const content = await zip.generateAsync({ type: "blob" });
        
        onProgress(100, 'Збереження файлу...');
        
        const fileName = `${safeTitle.replace(/\s+/g, '_')}_batch.epub`;
        
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("[EPUB Generator] Помилка:", error);
        throw error;
    }
}
