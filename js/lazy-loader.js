/**
 * Модуль для лінивого динамічного завантаження важких зовнішніх бібліотек.
 * Дозволяє не завантажувати jsPDF та JSZip при кожному відвідуванні сайту,
 * а завантажувати їх лише за вимогою (наприклад, при експорті розділу).
 */

const loadedScripts = new Map();

export function loadScript(src) {
    if (loadedScripts.has(src)) {
        return loadedScripts.get(src);
    }

    // Якщо скрипт уже присутній у DOM
    if (document.querySelector(`script[src="${src}"]`)) {
        loadedScripts.set(src, Promise.resolve());
        return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            loadedScripts.delete(src);
            reject(new Error(`Не вдалося завантажити бібліотеку: ${src}`));
        };
        document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
}

export async function ensureJsPdf() {
    if (window.jspdf) return window.jspdf;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    return window.jspdf;
}

export async function ensureJsZip() {
    if (window.JSZip) return window.JSZip;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    return window.JSZip;
}
