/* ==========================================================================
   GOKURAKU TOOLS - SCAN COMPRESSOR (СТИСПАЧ СКАНІВ) (compressor.js)
   ========================================================================== */

import { formatBytes, yieldToMain, loadImage, canvasToBlob, extractZipEntries, openDownloadModal } from './tools-common.js';

let selectedFiles = [];
let compressedResults = []; // [{ name, url, blob, originalSize, compressedSize, savingsPercent }]
let originalArchiveName = "compressed_scans";

export function checkAvifSupport() {
    try {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        return c.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    } catch (e) {
        return false;
    }
}

export function initCompressor() {
    const dropzone = document.getElementById('comp-dropzone');
    const fileInput = document.getElementById('comp-file-input');
    const btnStart = document.getElementById('comp-btn-start');
    const btnReset = document.getElementById('comp-btn-reset');
    const btnDownloadAll = document.getElementById('comp-btn-download-all');
    const btnClear = document.getElementById('comp-btn-clear');
    const qualityInput = document.getElementById('comp-opt-quality');
    const qualityVal = document.getElementById('comp-quality-val');
    const formatSelect = document.getElementById('comp-opt-format');

    if (!dropzone) return;

    // Check AVIF support and update format dropdown label
    const avifOption = formatSelect ? formatSelect.querySelector('option[value="avif"]') : null;
    const hasAvif = checkAvifSupport();
    if (avifOption) {
        if (!hasAvif) {
            avifOption.disabled = true;
            avifOption.textContent = "AVIF (не підтримується браузером)";
        } else {
            avifOption.textContent = "AVIF (максимальне стиснення)";
        }
    }

    // Quality slider sync
    if (qualityInput && qualityVal) {
        qualityInput.addEventListener('input', () => {
            qualityVal.textContent = `${qualityInput.value}%`;
        });
    }

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dropzone-active');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dropzone-active');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dropzone-active');
        handleFiles(e.dataTransfer.files);
    });

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    if (btnStart) btnStart.addEventListener('click', startCompression);
    if (btnReset) btnReset.addEventListener('click', resetCompressor);
    if (btnClear) btnClear.addEventListener('click', clearFiles);
    if (btnDownloadAll) {
        btnDownloadAll.addEventListener('click', () => {
            openDownloadModal(originalArchiveName, downloadCompressedZip);
        });
    }
}

async function handleFiles(files) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/avif'];
    let newFiles = [];

    const overlay = document.getElementById('comp-processing-overlay');
    const progressTitle = document.getElementById('comp-progress-title');
    const progressText = document.getElementById('comp-progress-text');
    const progressBar = document.getElementById('comp-progress-bar');

    const hasZip = Array.from(files).some(f => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip');
    if (hasZip) {
        overlay.classList.remove('hide');
        overlay.style.opacity = '1';
        progressTitle.textContent = "Обробка...";
        progressText.textContent = "Розпакування архіву...";
        progressBar.style.width = '50%';
    }

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
            if (originalArchiveName === "compressed_scans") {
                originalArchiveName = file.name.replace(/\.[^/.]+$/, "");
            }
            try {
                const extracted = await extractZipEntries(file);
                newFiles.push(...extracted);
            } catch (e) {
                console.error("Error reading ZIP:", e);
                alert("Помилка читання архіву: " + file.name);
            }
        } else if (validImageTypes.includes(file.type)) {
            newFiles.push(file);
        }
    }

    if (hasZip) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hide'), 300);
        setTimeout(() => {
            progressTitle.textContent = "Обробка...";
            progressText.textContent = "Підготовка файлів";
            progressBar.style.width = '0%';
        }, 300);
    }

    if (newFiles.length === 0) return;

    // Natural sorting
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    selectedFiles = [...selectedFiles, ...newFiles].sort((a, b) => collator.compare(a.name, b.name));

    updateFileListUI();
}

function updateFileListUI() {
    const container = document.getElementById('comp-file-list-container');
    const fileCount = document.getElementById('comp-file-count');
    const totalSizeEl = document.getElementById('comp-file-total-size');
    const fileList = document.getElementById('comp-file-list');
    const btnStart = document.getElementById('comp-btn-start');

    if (selectedFiles.length > 0) {
        container.classList.remove('hide');
        fileCount.innerHTML = `<i data-lucide="layers" style="width: 16px; height: 16px;"></i> ${selectedFiles.length} файлів обрано`;

        const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        totalSizeEl.textContent = formatBytes(totalBytes);

        fileList.innerHTML = '';
        selectedFiles.forEach((file) => {
            const el = document.createElement('div');
            el.className = 'file-list-item';
            el.innerHTML = `
                <div class="file-item-left">
                    <i data-lucide="file-image"></i>
                    <span class="file-name" title="${file.name}">${file.name}</span>
                </div>
                <span class="file-size-badge">${formatBytes(file.size)}</span>
            `;
            fileList.appendChild(el);
        });

        if (window.lucide) lucide.createIcons({ root: container });
        btnStart.disabled = false;
    } else {
        container.classList.add('hide');
        btnStart.disabled = true;
    }
}

function clearFiles() {
    selectedFiles = [];
    document.getElementById('comp-file-input').value = '';
    updateFileListUI();
}

// --- Core Compression Engine ---
async function startCompression() {
    if (selectedFiles.length === 0) return;

    const format = document.getElementById('comp-opt-format').value;
    const quality = parseInt(document.getElementById('comp-opt-quality').value) || 80;
    const maxWidth = parseInt(document.getElementById('comp-opt-max-width').value) || 0;

    const overlay = document.getElementById('comp-processing-overlay');
    const progressBar = document.getElementById('comp-progress-bar');
    const progressText = document.getElementById('comp-progress-text');
    const resultGrid = document.getElementById('comp-result-grid');

    overlay.classList.remove('hide');
    setTimeout(() => overlay.style.opacity = '1', 10);
    progressBar.style.width = '0%';

    compressedResults.forEach(r => URL.revokeObjectURL(r.url));
    compressedResults = [];
    resultGrid.innerHTML = '';

    const totalFiles = selectedFiles.length;
    const ext = format === 'jpeg' ? 'jpg' : format;

    try {
        for (let i = 0; i < totalFiles; i++) {
            const file = selectedFiles[i];
            progressText.textContent = `Стиснення ${i + 1} з ${totalFiles}: ${file.name}`;
            progressBar.style.width = `${Math.round(((i + 1) / totalFiles) * 100)}%`;
            await yieldToMain();

            const img = await loadImage(file);

            // Compute target dimensions
            let targetW = img.width;
            let targetH = img.height;

            if (maxWidth > 0 && img.width > maxWidth) {
                targetW = maxWidth;
                targetH = Math.round(img.height * (maxWidth / img.width));
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');

            // High-quality bicubic resampling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);

            const blob = await canvasToBlob(canvas, format, quality);
            const url = URL.createObjectURL(blob);

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const finalName = `${baseName}.${ext}`;

            const originalSize = file.size;
            const compressedSize = blob.size;
            const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            const resultItem = {
                name: finalName,
                url: url,
                blob: blob,
                originalSize: originalSize,
                compressedSize: compressedSize,
                savingsPercent: savingsPercent
            };

            compressedResults.push(resultItem);
            renderResultItem(resultItem);
        }

        progressText.textContent = 'Усі файли стиснено!';
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.classList.add('hide');
                showResults();
            }, 300);
        }, 400);

    } catch (e) {
        console.error("Compression error:", e);
        alert("Сталася помилка при стисненні: " + e.message);
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hide'), 300);
    }
}

function renderResultItem(item) {
    const grid = document.getElementById('comp-result-grid');
    const div = document.createElement('div');
    div.className = "slicer-result-card";

    const badgeClass = item.savingsPercent > 0 ? "savings-badge" : "savings-badge" ;
    const badgeText = item.savingsPercent > 0 ? `-${item.savingsPercent}%` : `0%`;

    div.innerHTML = `
        <div class="savings-badge" style="background: ${item.savingsPercent > 0 ? '#28a745' : '#6c757d'};">
            ${badgeText}
        </div>
        <div class="result-thumb-box">
            <img src="${item.url}" class="result-thumb-img" alt="${item.name}" loading="lazy">
            <div class="result-thumb-overlay">
                <a href="${item.url}" target="_blank" class="result-action-circle" title="Відкрити оригінал">
                    <i data-lucide="maximize-2"></i>
                </a>
            </div>
        </div>
        <div class="result-info-bar" style="flex-direction: column; align-items: stretch; gap: 0.35rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="result-name" title="${item.name}">${item.name}</span>
                <a href="${item.url}" download="${item.name}" class="result-download-btn" title="Завантажити цей файл">
                    <i data-lucide="download"></i>
                </a>
            </div>
            <div class="size-comparison-line">
                <span class="size-old">${formatBytes(item.originalSize)}</span>
                <span>→</span>
                <span class="size-new">${formatBytes(item.compressedSize)}</span>
            </div>
        </div>
    `;
    grid.appendChild(div);
    if (window.lucide) {
        lucide.createIcons({ root: div });
    }
}

function showResults() {
    document.getElementById('comp-view-input').classList.add('hide');
    const viewResults = document.getElementById('comp-view-results');
    viewResults.classList.remove('hide');

    const totalOriginal = compressedResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = compressedResults.reduce((sum, r) => sum + r.compressedSize, 0);
    const overallSavings = totalOriginal > 0 ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) : 0;

    document.getElementById('comp-result-stats').innerHTML = `
        Стиснуто ${compressedResults.length} файлів: 
        <strong>${formatBytes(totalOriginal)}</strong> → <strong style="color: var(--accent-color);">${formatBytes(totalCompressed)}</strong> 
        <span style="color: #28a745; font-weight: 700; margin-left: 0.5rem;">(-${overallSavings}%)</span>
    `;

    if (window.lucide) lucide.createIcons({ root: viewResults });
}

function resetCompressor() {
    document.getElementById('comp-view-results').classList.add('hide');
    document.getElementById('comp-view-input').classList.remove('hide');
    clearFiles();
    originalArchiveName = "compressed_scans";
}

async function downloadCompressedZip(finalZipName) {
    if (compressedResults.length === 0) return;
    const zip = new JSZip();
    for (const res of compressedResults) {
        zip.file(res.name, res.blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = finalZipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCompressor);
