/* ==========================================================================
   GOKURAKU TOOLS - COMMON UTILITIES & TAB NAVIGATION (tools-common.js)
   ========================================================================== */

// --- 1. Theme Synchronization with Gokuraku ---
export function initToolsTheme() {
    const THEMES = [
        { id: 'theme_gokuraku', colors: { primary: '#2A5AFF', primaryLight: '#1d4ed8', glow: 'rgba(143, 69, 161, 0.5)', glowLight: 'rgba(29, 78, 216, 0.3)' } },
        { id: 'theme_old_style', colors: { primary: '#00ff99', primaryLight: '#00824e', glow: 'rgba(0, 255, 153, 0.5)', glowLight: 'rgba(0, 130, 78, 0.3)' } },
        { id: 'theme_love_is_an_illusion', colors: { primary: '#a875cc', primaryLight: '#6E3E92', glow: 'rgba(240, 140, 85, 0.5)', glowLight: 'rgba(110, 62, 146, 0.3)' } },
        { id: 'theme_shape_of_symphaty', colors: { primary: '#b67f7a', primaryLight: '#7a4945', glow: 'rgba(179, 153, 134, 0.5)', glowLight: 'rgba(122, 73, 69, 0.3)' } },
        { id: 'theme_merry_marbling', colors: { primary: '#5c9589', primaryLight: '#3a6159', glow: 'rgba(150, 230, 240, 0.5)', glowLight: 'rgba(58, 97, 89, 0.3)' } },
        { id: 'theme_ichi_the_witch', colors: { primary: '#ecba30', primaryLight: '#b38810', glow: 'rgba(143, 69, 161, 0.5)', glowLight: 'rgba(179, 136, 16, 0.3)' } }
    ];

    const savedMode = localStorage.getItem('gokuThemeMode') || 'dark';
    const html = document.documentElement;
    if (savedMode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', savedMode);
    }

    const savedThemeId = localStorage.getItem('gokuActiveThemeId') || 'theme_gokuraku';
    const theme = THEMES.find(t => t.id === savedThemeId) || THEMES[0];
    if (theme) {
        html.style.setProperty('--theme-accent-dark', theme.colors.primary);
        html.style.setProperty('--theme-glow-dark', theme.colors.glow);
        html.style.setProperty('--theme-accent-light', theme.colors.primaryLight || theme.colors.primary);
        html.style.setProperty('--theme-glow-light', theme.colors.glowLight || theme.colors.glow);
    }
}

// --- 2. Tab Navigation ("Склеювач" <-> "Стискач") ---
export function initTabSwitcher() {
    const tabs = document.querySelectorAll('.tool-tab');
    const titleBadge = document.getElementById('tool-active-title');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tool = tab.dataset.tab;
            switchTool(tool);
        });
    });

    // Check URL hash (e.g. #compressor or #slicer)
    const hash = window.location.hash.replace('#', '');
    if (hash === 'compressor' || hash === 'slicer') {
        switchTool(hash);
    } else {
        switchTool('slicer');
    }
}

export function switchTool(toolName) {
    const tabs = document.querySelectorAll('.tool-tab');
    const views = document.querySelectorAll('.tools-view');
    const titleBadge = document.getElementById('tool-active-title');

    tabs.forEach(t => {
        if (t.dataset.tab === toolName) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    views.forEach(v => {
        if (v.id === `view-${toolName}`) {
            v.classList.add('active');
        } else {
            v.classList.remove('active');
        }
    });

    // Toggle info cards by active tool tab
    const infoCards = document.querySelectorAll('.info-card');
    infoCards.forEach(c => {
        if (c.id === `info-card-${toolName}`) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });

    if (titleBadge) {
        titleBadge.textContent = toolName === 'compressor' ? 'Стискач' : 'Склеювач';
    }

    window.location.hash = toolName;
    if (window.lucide) {
        lucide.createIcons();
    }
}

// --- 3. Format & File Utilities ---
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

export function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });
}

export function canvasToBlob(canvas, format, quality) {
    return new Promise(resolve => {
        let mimeType = 'image/jpeg';
        if (format === 'webp') mimeType = 'image/webp';
        else if (format === 'avif') mimeType = 'image/avif';
        
        const q = quality / 100;
        canvas.toBlob(blob => {
            if (!blob && format === 'avif') {
                // Fallback to webp if browser canvas fails avif encoding
                canvas.toBlob(resolve, 'image/webp', q);
            } else {
                resolve(blob);
            }
        }, mimeType, q);
    });
}

export async function extractZipEntries(file) {
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'avif'];
    const extractedFiles = [];

    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    for (const filename of Object.keys(contents.files)) {
        const zipEntry = contents.files[filename];
        if (!zipEntry.dir) {
            if (filename.includes('__MACOSX/') || filename.split('/').pop().startsWith('.')) continue;

            const ext = filename.split('.').pop().toLowerCase();
            if (validExts.includes(ext)) {
                const blob = await zipEntry.async("blob");
                const cleanName = filename.split('/').pop();
                const mime = ext === 'jpg' ? 'jpeg' : ext;
                const extractedFile = new File([blob], cleanName, { type: `image/${mime}` });
                extractedFiles.push(extractedFile);
            }
        }
    }
    return extractedFiles;
}

// --- 4. Shared Download Modal Controller ---
let currentDownloadHandler = null;
let currentArchiveBaseName = "archive";

export function setupDownloadModal({ onConfirm }) {
    currentDownloadHandler = onConfirm;
}

export function openDownloadModal(defaultBaseName, onConfirm) {
    currentDownloadHandler = onConfirm;
    currentArchiveBaseName = defaultBaseName || "archive";

    const modal = document.getElementById('download-modal');
    const baseInput = document.getElementById('modal-basename');
    const chapterInput = document.getElementById('modal-chapter');

    baseInput.value = currentArchiveBaseName;
    chapterInput.value = "";
    updateModalPreview();

    modal.classList.add('modal-open');
    if (window.lucide) {
        lucide.createIcons({ root: modal });
    }
}

export function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.remove('modal-open');
}

export function changeChapter(delta) {
    const chInput = document.getElementById('modal-chapter');
    let current = parseFloat(chInput.value) || 0;
    let next = current + delta;
    if (next < 0) next = 0;
    chInput.value = next;
    handleChapterInput();
}

export function handleChapterInput() {
    const baseInput = document.getElementById('modal-basename');
    if (baseInput.value === currentArchiveBaseName) {
        baseInput.value = "";
    }
    updateModalPreview();
}

export function updateModalPreview() {
    const base = document.getElementById('modal-basename').value.trim();
    const ch = document.getElementById('modal-chapter').value.trim();
    const preview = document.getElementById('modal-preview');

    let finalName = "archive";
    if (base && ch) {
        finalName = `${base} Розділ ${ch}`;
    } else if (base) {
        finalName = base;
    } else if (ch) {
        finalName = `Розділ ${ch}`;
    }

    if (preview) preview.textContent = finalName + ".zip";
}

export async function executeModalDownload() {
    if (!currentDownloadHandler) return;
    const finalName = document.getElementById('modal-preview').textContent;
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const originalHTML = confirmBtn.innerHTML;

    confirmBtn.innerHTML = `
        <div class="spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; margin-right: 6px; display: inline-block;"></div>
        Архівування...
    `;
    confirmBtn.disabled = true;

    try {
        await currentDownloadHandler(finalName);
        closeDownloadModal();
    } catch (e) {
        console.error("Archive generation error:", e);
        alert("Помилка при створенні архіву: " + e.message);
    } finally {
        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
        if (window.lucide) lucide.createIcons({ root: confirmBtn });
    }
}

// Global modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    initToolsTheme();
    initTabSwitcher();

    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDownloadModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('modal-open')) {
            closeDownloadModal();
        }
    });

    const basenameInput = document.getElementById('modal-basename');
    if (basenameInput) {
        basenameInput.addEventListener('input', updateModalPreview);
    }

    const chapterInput = document.getElementById('modal-chapter');
    if (chapterInput) {
        chapterInput.addEventListener('input', handleChapterInput);
    }

    const btnConfirm = document.getElementById('modal-btn-confirm');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', executeModalDownload);
    }
});

// Expose stepper helper to window for inline HTML onclick
window.changeChapter = changeChapter;
window.closeDownloadModal = closeDownloadModal;
