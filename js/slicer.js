/* ==========================================================================
   GOKURAKU TOOLS - SMART SLICER (СКЛЕЮВАЧ ТА НАРІЗУВАЧ) (slicer.js)
   ========================================================================== */

import { formatBytes, yieldToMain, loadImage, canvasToBlob, extractZipEntries, openDownloadModal } from './tools-common.js';

let selectedFiles = [];
let generatedResults = []; // [{ name: string, url: blobUrl, blob: Blob }]
let originalArchiveName = "sliced_manga";

export function initSlicer() {
    const dropzone = document.getElementById('slicer-dropzone');
    const fileInput = document.getElementById('slicer-file-input');
    const btnStart = document.getElementById('slicer-btn-start');
    const btnReset = document.getElementById('slicer-btn-reset');
    const btnDownloadAll = document.getElementById('slicer-btn-download-all');
    const btnClear = document.getElementById('slicer-btn-clear');
    const optSmartMode = document.getElementById('slicer-opt-smart-mode');

    if (!dropzone) return;

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

    if (btnStart) btnStart.addEventListener('click', startSlicing);
    if (btnReset) btnReset.addEventListener('click', resetApp);
    if (btnClear) btnClear.addEventListener('click', clearFiles);
    if (btnDownloadAll) {
        btnDownloadAll.addEventListener('click', () => {
            openDownloadModal(originalArchiveName, downloadSlicesZip);
        });
    }

    if (optSmartMode) {
        optSmartMode.addEventListener('change', toggleSmartMethod);
    }
}

function toggleSmartMethod() {
    const isSmart = document.getElementById('slicer-opt-smart-mode').value === 'true';
    const container = document.getElementById('slicer-smart-method-container');
    if (container) container.style.display = isSmart ? 'block' : 'none';
}

async function handleFiles(files) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    let newFiles = [];

    const overlay = document.getElementById('slicer-processing-overlay');
    const progressTitle = document.getElementById('slicer-progress-title');
    const progressText = document.getElementById('slicer-progress-text');
    const progressBar = document.getElementById('slicer-progress-bar');

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
            if (originalArchiveName === "sliced_manga") {
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

    // Natural sort
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    selectedFiles = [...selectedFiles, ...newFiles].sort((a, b) => collator.compare(a.name, b.name));

    updateFileListUI();
}

function updateFileListUI() {
    const container = document.getElementById('slicer-file-list-container');
    const fileCount = document.getElementById('slicer-file-count');
    const totalSizeEl = document.getElementById('slicer-file-total-size');
    const fileList = document.getElementById('slicer-file-list');
    const btnStart = document.getElementById('slicer-btn-start');

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
    document.getElementById('slicer-file-input').value = '';
    updateFileListUI();
}

// --- Smart Cut Math & Search ---
function normalizeArray(arr) {
    let min = Infinity, max = -Infinity;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
    }
    const res = new Float32Array(len);
    if (max === min) return res;
    for (let i = 0; i < len; i++) {
        res[i] = (arr[i] - min) / (max - min);
    }
    return res;
}

function findOptimalCut(ctx, width, startY, endY, method) {
    const h = endY - startY;
    if (h <= 0) return startY;

    const imgData = ctx.getImageData(0, startY, width, h);
    const data = imgData.data;

    let bestY = 0;
    let minScore = Infinity;

    const variances = new Float32Array(h);
    const edgeDensities = new Float32Array(h);

    for (let y = 0; y < h; y++) {
        let rowSum = 0;
        const rowLuma = new Float32Array(width);

        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            rowLuma[x] = luma;
            rowSum += luma;
        }

        const mean = rowSum / width;
        let varSum = 0;
        let edgeSum = 0;

        for (let x = 0; x < width; x++) {
            varSum += Math.pow(rowLuma[x] - mean, 2);
            if (x > 0) {
                edgeSum += Math.abs(rowLuma[x] - rowLuma[x - 1]);
            }
        }

        variances[y] = varSum / width;
        edgeDensities[y] = edgeSum;
    }

    if (method === '1') {
        for (let y = 0; y < h; y++) {
            if (variances[y] < minScore) {
                minScore = variances[y];
                bestY = y;
                if (variances[y] === 0) break;
            }
        }
    } else {
        const normVars = normalizeArray(variances);
        const normEdges = normalizeArray(edgeDensities);
        for (let y = 0; y < h; y++) {
            const score = normVars[y] + normEdges[y];
            if (score < minScore) {
                minScore = score;
                bestY = y;
            }
        }
    }

    return startY + bestY;
}

function extractNumbers(str) {
    const matches = str.match(/\d+/g);
    return matches ? matches.join('') : str;
}

function getFileName(index, activeFiles, nameMode, ext) {
    if (nameMode === '1' || activeFiles.length === 0) {
        return `${index.toString().padStart(2, '0')}.${ext}`;
    } else {
        const baseStart = extractNumbers(activeFiles[0].name.split('.')[0]);
        const baseEnd = extractNumbers(activeFiles[activeFiles.length - 1].name.split('.')[0]);
        if (baseStart !== baseEnd && baseEnd) {
            return `${baseStart}-${baseEnd}.${ext}`;
        }
        return `${baseStart || index.toString().padStart(2, '0')}.${ext}`;
    }
}

// --- Main Slicing Execution ---
async function startSlicing() {
    if (selectedFiles.length === 0) return;

    const settings = {
        targetHeight: parseInt(document.getElementById('slicer-opt-height').value) || 6000,
        nameMode: document.getElementById('slicer-opt-name-mode').value,
        smartMode: document.getElementById('slicer-opt-smart-mode').value === 'true',
        smartMethod: document.getElementById('slicer-opt-smart-method').value,
        tolMin: parseInt(document.getElementById('slicer-opt-tol-min').value) || 3000,
        tolMax: parseInt(document.getElementById('slicer-opt-tol-max').value) || 100,
        format: document.getElementById('slicer-opt-format').value,
        quality: parseInt(document.getElementById('slicer-opt-quality').value) || 100
    };

    const overlay = document.getElementById('slicer-processing-overlay');
    const progressBar = document.getElementById('slicer-progress-bar');
    const progressText = document.getElementById('slicer-progress-text');
    const resultGrid = document.getElementById('slicer-result-grid');

    overlay.classList.remove('hide');
    setTimeout(() => overlay.style.opacity = '1', 10);
    progressBar.style.width = '0%';

    generatedResults.forEach(r => URL.revokeObjectURL(r.url));
    generatedResults = [];
    resultGrid.innerHTML = '';

    try {
        let bufferCanvas = null;
        let fileCursor = 0;
        let sliceIndex = 1;
        let activeFilesMap = [];
        const ext = settings.format === 'webp' ? 'webp' : 'jpg';

        const totalFiles = selectedFiles.length;

        while (true) {
            const neededHeight = settings.targetHeight + settings.tolMax;

            while ((!bufferCanvas || bufferCanvas.height < neededHeight) && fileCursor < totalFiles) {
                progressText.textContent = `Завантаження джерела ${fileCursor + 1} з ${totalFiles}...`;
                progressBar.style.width = `${(fileCursor / totalFiles) * 50}%`;
                await yieldToMain();

                const file = selectedFiles[fileCursor];
                const img = await loadImage(file);

                if (!bufferCanvas) {
                    bufferCanvas = document.createElement('canvas');
                    bufferCanvas.width = img.width;
                    bufferCanvas.height = img.height;
                    const ctx = bufferCanvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);

                    activeFilesMap.push({ name: file.name, startY: 0, endY: img.height });
                } else {
                    const scale = bufferCanvas.width / img.width;
                    const h = Math.round(img.height * scale);

                    const newBuf = document.createElement('canvas');
                    newBuf.width = bufferCanvas.width;
                    newBuf.height = bufferCanvas.height + h;
                    const ctx = newBuf.getContext('2d', { willReadFrequently: true });

                    ctx.drawImage(bufferCanvas, 0, 0);
                    ctx.drawImage(img, 0, bufferCanvas.height, bufferCanvas.width, h);

                    activeFilesMap.push({ name: file.name, startY: bufferCanvas.height, endY: bufferCanvas.height + h });
                    bufferCanvas = newBuf;
                }
                fileCursor++;
            }

            if (!bufferCanvas) break;

            progressText.textContent = `Обчислення розрізу ${sliceIndex}...`;
            progressBar.style.width = `${50 + (sliceIndex / (totalFiles * 2)) * 50}%`;
            await yieldToMain();

            let cutY = settings.targetHeight;

            if (bufferCanvas.height <= settings.targetHeight && fileCursor >= totalFiles) {
                cutY = bufferCanvas.height;
            } else if (settings.smartMode) {
                const searchStart = Math.max(0, settings.targetHeight - settings.tolMin);
                const searchEnd = Math.min(bufferCanvas.height, settings.targetHeight + settings.tolMax);

                const ctx = bufferCanvas.getContext('2d', { willReadFrequently: true });
                cutY = findOptimalCut(ctx, bufferCanvas.width, searchStart, searchEnd, settings.smartMethod);
            }

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = bufferCanvas.width;
            sliceCanvas.height = cutY;
            const sliceCtx = sliceCanvas.getContext('2d');
            sliceCtx.drawImage(bufferCanvas, 0, 0, bufferCanvas.width, cutY, 0, 0, bufferCanvas.width, cutY);

            const contributingFiles = activeFilesMap.filter(f => f.startY < cutY && f.endY > 0);
            const fileName = getFileName(sliceIndex, contributingFiles, settings.nameMode, ext);

            // Export Blob
            const blob = await canvasToBlob(sliceCanvas, settings.format, settings.quality);
            const url = URL.createObjectURL(blob);
            generatedResults.push({ name: fileName, url: url, blob: blob });

            renderResultItem(fileName, url);

            const remainingHeight = bufferCanvas.height - cutY;
            if (remainingHeight > 0) {
                const newBuf = document.createElement('canvas');
                newBuf.width = bufferCanvas.width;
                newBuf.height = remainingHeight;
                const ctx = newBuf.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(bufferCanvas, 0, -cutY);
                bufferCanvas = newBuf;
            } else {
                bufferCanvas = null;
            }

            for (let f of activeFilesMap) {
                f.startY -= cutY;
                f.endY -= cutY;
            }
            activeFilesMap = activeFilesMap.filter(f => f.endY > 0);

            sliceIndex++;

            if (fileCursor >= totalFiles && !bufferCanvas) {
                break;
            }
        }

        progressBar.style.width = '100%';
        progressText.textContent = 'Завершено!';

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.classList.add('hide');
                showResults();
            }, 300);
        }, 500);

    } catch (error) {
        console.error(error);
        alert("Сталася помилка при нарізці: " + error.message);
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hide'), 300);
    }
}

function renderResultItem(name, url) {
    const grid = document.getElementById('slicer-result-grid');
    const div = document.createElement('div');
    div.className = "slicer-result-card";

    div.innerHTML = `
        <div class="result-thumb-box">
            <img src="${url}" class="result-thumb-img" alt="${name}" loading="lazy">
            <div class="result-thumb-overlay">
                <a href="${url}" target="_blank" class="result-action-circle" title="Відкрити оригінал">
                    <i data-lucide="maximize-2"></i>
                </a>
            </div>
        </div>
        <div class="result-info-bar">
            <span class="result-name" title="${name}">${name}</span>
            <a href="${url}" download="${name}" class="result-download-btn" title="Завантажити цей файл">
                <i data-lucide="download"></i>
            </a>
        </div>
    `;
    grid.appendChild(div);
    if (window.lucide) {
        lucide.createIcons({ root: div });
    }
}

function showResults() {
    document.getElementById('slicer-view-input').classList.add('hide');
    const viewResults = document.getElementById('slicer-view-results');
    viewResults.classList.remove('hide');
    document.getElementById('slicer-result-stats').textContent = `Згенеровано ${generatedResults.length} файлів`;
    if (window.lucide) lucide.createIcons({ root: viewResults });
}

function resetApp() {
    document.getElementById('slicer-view-results').classList.add('hide');
    document.getElementById('slicer-view-input').classList.remove('hide');
    clearFiles();
    originalArchiveName = "sliced_manga";
}

async function downloadSlicesZip(finalZipName) {
    if (generatedResults.length === 0) return;
    const zip = new JSZip();
    for (const res of generatedResults) {
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
document.addEventListener('DOMContentLoaded', initSlicer);
