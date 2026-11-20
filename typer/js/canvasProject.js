Object.assign(window.CanvasStrip, {
  projectData() {
    return {
      version: 1,
      projectName: document.getElementById('project-name').value,
      pages: AppState.pages.map(({ id, name, width, height, cleanBlob, origBlob }) =>
        ({ id, name, width, height, cleanBlob, origBlob })),
      items: AppState.items.map(item => ({ ...item, pngImg: undefined })),
      translations: AppState.translations,
      activeTransIndex: AppState.activeTransIndex,
      presets: AppState.presets
    };
  },

  async compactProjectImage(blob) {
    if (!blob) return blob;
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      if (bitmap.width > 16383 || bitmap.height > 16383 || bitmap.width * bitmap.height > 32000000) return blob;
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return blob;
      ctx.drawImage(bitmap, 0, 0);
      const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
      return compressed && compressed.type === 'image/webp' && compressed.size < blob.size ? compressed : blob;
    } catch (_) {
      return blob;
    } finally {
      bitmap?.close();
    }
  },

  async exportProjectData() {
    const data = this.draftData();
    // Freeze styles and contours while the scans are being encoded.
    data.items = structuredClone(data.items);
    data.translations = structuredClone(data.translations);
    data.presets = structuredClone(data.presets);
    for (let i = 0; i < data.pages.length; i++) {
      const { cleanBlob, origBlob, ...page } = data.pages[i];
      page.cleanDataUrl = await this.readFileData(cleanBlob);
      page.origDataUrl = origBlob ? await this.readFileData(origBlob) : null;
      data.pages[i] = page;
    }
    return data;
  },

  inlineTextChanges() {
    const rawText = this.inlineEditor.value;
    if (rawText === this.inlineInitialValue) return {};
    return {
      rawText, lines: rawText ? rawText.split('\n') : [], manualTextLayout: true, layoutError: null
    };
  },

  draftData() {
    const data = this.projectData();
    if (this.editingItem && this.inlineEditor.value !== this.inlineInitialValue) {
      const item = data.items.find(entry => entry.id === this.editingItem.id);
      if (item) Object.assign(item, this.inlineTextChanges());
    }
    return data;
  },

  draftDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('typer-draft', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('draft');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async readDraft(key) {
    const db = await this.draftDB();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('draft');
        const store = tx.objectStore('draft');
        const request = store.get(key);
        tx.onabort = () => reject(tx.error);
        request.onsuccess = () => {
          const data = request.result;
          if (data?.version !== 2) {
            resolve(data);
            return;
          }
          const scans = new Map(savedScanIds(data).map(id => [id, store.get([key, id])]));
          tx.oncomplete = () => {
            try {
              const blob = id => {
                const value = scans.get(id)?.result;
                if (!(value instanceof Blob)) throw new Error('У чернетці бракує скану.');
                (this.draftScanIds ||= new WeakMap()).set(value, id);
                return value;
              };
              resolve({
                ...data, version: 1,
                pages: data.pages.map(({ cleanScanId, origScanId, ...page }) => ({
                  ...page, cleanBlob: blob(cleanScanId), origBlob: origScanId ? blob(origScanId) : null
                }))
              });
            } catch (error) {
              reject(error);
            }
          };
        };
      });
    } finally { db.close(); }
  },

  async writeDraft(key, data) {
    const scans = new Map();
    const ids = this.draftScanIds ||= new WeakMap();
    const scanId = blob => {
      if (!blob) return null;
      let id = ids.get(blob);
      if (!id) {
        id = crypto.getRandomValues(new Uint32Array(4)).join('-');
        ids.set(blob, id);
      }
      scans.set(id, blob);
      return id;
    };
    const manifest = structuredClone({
      ...data, version: 2,
      pages: data.pages.map(({ cleanBlob, origBlob, ...page }) => ({
        ...page, cleanScanId: scanId(cleanBlob), origScanId: scanId(origBlob)
      }))
    });
    const db = await this.draftDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('draft', 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        const store = tx.objectStore('draft');
        const previous = store.get(key);
        previous.onsuccess = () => {
          const saved = new Set(savedScanIds(previous.result));
          for (const [id, blob] of scans) {
            if (!saved.has(id)) store.put(blob, [key, id]);
          }
          for (const id of saved) {
            if (!scans.has(id)) store.delete([key, id]);
          }
          store.put(manifest, key);
        };
      });
    } finally { db.close(); }
  },

  setDraftStatus(text) {
    const status = document.getElementById('draft-status');
    if (status.textContent !== text) status.textContent = text;
  },

  markProjectChanged() {
    this.projectRevision = (this.projectRevision || 0) + 1;
    this.scheduleDraft();
  },

  scheduleDraft() {
    if (!this.draftReady) return;
    this.setDraftStatus('Є незбережені зміни');
    clearTimeout(this.draftTimer);
    const now = performance.now();
    this.dirtySince ??= now;
    this.draftTimer = setTimeout(() => this.saveDraft(), Math.max(0, Math.min(650, 3000 - (now - this.dirtySince))));
  },

  async saveDraft() {
    if (!this.draftReady || this.savedRevision === this.projectRevision || this.savingDraft) return;
    clearTimeout(this.draftTimer);
    const revision = this.projectRevision;
    this.dirtySince = undefined;
    this.savingDraft = true;
    try {
      await this.writeDraft('current', this.draftData());
      this.savedRevision = revision;
      if (this.projectRevision === revision) this.setDraftStatus('Чернетку збережено');
    } catch (error) {
      this.setDraftStatus('Не вдалося зберегти чернетку');
      console.error(error);
    } finally {
      this.savingDraft = false;
      if (revision !== this.projectRevision) this.scheduleDraft();
    }
  },

  async restoreDraft() {
    try {
      const data = await this.readDraft('current');
      if (data && !this.projectRevision) {
        const project = await this.prepareProjectScans(this.validateProject(data, true));
        if (!this.projectRevision) {
          this.applyProject(project, true);
          this.setDraftStatus('Чернетку відновлено');
        }
      }
    } catch (error) {
      this.setDraftStatus('Не вдалося відновити чернетку');
      console.error(error);
    } finally {
      this.draftReady = true;
      if (this.projectRevision) this.scheduleDraft();
    }
  },

  validateProject(data, allowBlobs = false) {
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    const id = value => typeof value === 'string' && value.length > 0;
    const positive = value => Number.isFinite(value) && value > 0;
    const image = value => typeof value === 'string' && /^data:image\/[\w.+-]+;base64,/i.test(value);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const optionalNumbers = (entry, keys) => keys.every(key => entry[key] == null || Number.isFinite(entry[key]));
    const optionalStrings = (entry, keys) => keys.every(key => entry[key] == null || typeof entry[key] === 'string');
    const validStyle = style => record(style) &&
      optionalNumbers(style, ['fontSize', 'lineHeight', 'strokeWidth', 'glowBlur']) &&
      optionalStrings(style, ['fontFamily', 'textAlign', 'fillColor', 'gradColor2', 'strokeColor', 'glowColor']) &&
      (!style.useGradient || [style.fillColor, style.gradColor2].every(color =>
        !color || CSS.supports('color', color)));

    check(record(data) && (data.version === undefined || data.version === 1), 'Непідтримуваний формат проєкту.');
    const { pages, items, translations = [], presets = AppState.presets, activeTransIndex } = data;
    check(Array.isArray(pages) && Array.isArray(items) && Array.isArray(translations) && Array.isArray(presets),
      'Файл має містити списки сторінок, об’єктів, перекладу та стилів.');
    const pageIds = new Set();
    for (const page of pages) {
      check(record(page) && id(page.id) && !pageIds.has(page.id) && typeof page.name === 'string' &&
        positive(page.width) && positive(page.height) &&
        (allowBlobs && page.cleanBlob instanceof Blob || image(page.cleanDataUrl)) &&
        (page.origBlob == null || allowBlobs && page.origBlob instanceof Blob) &&
        (page.origDataUrl == null || image(page.origDataUrl)), 'Некоректна сторінка у файлі проєкту.');
      pageIds.add(page.id);
    }
    const itemIds = new Set();
    for (const item of items) {
      check(record(item) && id(item.id) && !itemIds.has(item.id) && pageIds.has(item.pageId) &&
        ['bubble', 'text', 'png'].includes(item.type) && Number.isFinite(item.x) && Number.isFinite(item.y) &&
        positive(item.w) && positive(item.h) && validStyle(item.style) &&
        optionalNumbers(item, ['angle', 'padding', 'effectivePadding', 'textOffsetX', 'textOffsetY',
          'manualMinFont', 'manualMaxFont', 'fixedFontSize', 'fixedFontOrder']) &&
        (item.rawText === undefined || typeof item.rawText === 'string') &&
        (item.lines === undefined || (Array.isArray(item.lines) && item.lines.every(line => typeof line === 'string'))) &&
        (item.type !== 'png' || image(item.pngDataUrl)), 'Некоректний об’єкт або посилання на сторінку.');
      if (item.contour) {
        check(positive(item.contour.step) && Array.isArray(item.contour.rows) && item.contour.rows.length &&
          item.contour.rows.every(row => Array.isArray(row) && row.length === 2 &&
            row.every(Number.isFinite) && row[1] >= row[0]), 'Некоректний контур бабла.');
      }
      itemIds.add(item.id);
    }
    check(translations.every(entry => record(entry) && typeof entry.text === 'string' &&
      ['page_header', 'bubble', 'panel', 'bg', 'thought', 'sound', 'comment'].includes(entry.type)),
    'Некоректний рядок перекладу.');
    check(presets.every(preset => record(preset) && typeof preset.name === 'string' &&
      optionalStrings(preset, ['font', 'autoType', 'fill', 'grad2', 'strokeColor', 'glowColor']) &&
      optionalNumbers(preset, ['strokeWidth', 'glowBlur', 'size', 'padding']) &&
      (preset.autoTypes === undefined || (Array.isArray(preset.autoTypes) && preset.autoTypes.every(id)))),
    'Некоректний стиль.');
    check(activeTransIndex === undefined || (Number.isInteger(activeTransIndex) &&
      activeTransIndex >= -1 && activeTransIndex < translations.length), 'Некоректна позиція в перекладі.');
    return { pages, items, translations, presets, activeTransIndex, projectName: typeof data.projectName === 'string' ? data.projectName.slice(0, 100) : '' };
  },

  hasProjectContent() {
    return Boolean(AppState.pages.length || AppState.items.length || AppState.translations.length);
  },

  async backupProject() {
    if (this.hasProjectContent()) await this.writeDraft('previous', this.draftData());
  },

  async prepareProjectScans(project) {
    const fromDataUrl = async source => {
      if (!source) return null;
      const response = await fetch(source);
      return response.blob();
    };
    const pages = [];
    for (const { cleanDataUrl, origDataUrl, cleanBlob, origBlob, ...page } of project.pages) {
      pages.push({
        ...page,
        cleanBlob: cleanBlob ?? await fromDataUrl(cleanDataUrl),
        origBlob: origBlob ?? await fromDataUrl(origDataUrl)
      });
    }
    return { ...project, pages };
  },

  async validateProjectImages(project) {
    const decode = async (source, name) => {
      if (!source) return;
      const image = new Image();
      const url = source instanceof Blob ? URL.createObjectURL(source) : source;
      try {
        image.src = url;
        await image.decode();
      } catch {
        throw new Error('Не вдалося відкрити зображення «' + name + '».');
      } finally {
        image.src = '';
        if (source instanceof Blob) URL.revokeObjectURL(url);
      }
    };
    for (const page of project.pages) {
      await decode(page.cleanBlob, page.name);
      await decode(page.origBlob, page.name + ' (оригінал)');
    }
    for (const item of project.items) {
      if (item.type === 'png') await decode(item.pngDataUrl, item.id);
    }
  },

  async loadProject(data, restoringBackup = false, allowBlobs = false) {
    const project = await this.prepareProjectScans(this.validateProject(data, restoringBackup || allowBlobs));
    if (!restoringBackup) await this.validateProjectImages(project);
    if (this.hasProjectContent()) {
      const message = restoringBackup ? 'Відновити попередній розділ? Поточний стане резервною копією.' :
        'Відкрити інший проєкт? Поточний розділ буде збережено як резервну копію.';
      if (!await AppDialogs.confirm(message)) return;
    }
    const revision = this.projectRevision;
    await this.backupProject();
    if (revision !== this.projectRevision || this.dragState) throw new Error('Розділ змінився під час резервного копіювання. Спробуйте ще раз.');
    this.applyProject(project);
    this.markProjectChanged();
  },

  applyProject(data, restoringDraft = false) {
    document.getElementById('project-name').value = data.projectName || '';
    if (!restoringDraft) StyleLibrary.replacePresets(data.presets);
    if (this.editingItem) this.closeInlineEditor(true);
    if (this.wheelMotion?.frame) cancelAnimationFrame(this.wheelMotion.frame);
    this.wheelMotion = null;
    this.dragState = null;
    this.snapGuideX = null;
    this.releasePageImages?.();
    AppState.pages = data.pages.map(page => ({
      id: page.id, name: page.name, width: page.width, height: page.height,
      cleanBlob: page.cleanBlob, origBlob: page.origBlob, cleanImg: null, origImg: null
    }));
    AppState.recalcPageOffsets();
    AppState.selectedId = null;
    document.getElementById('floating-hint').style.display = AppState.pages.length ? 'none' : '';
    AppState.translations = data.translations;
    AppState.activeTransIndex = data.activeTransIndex ?? AppState.findNextInsertableIndex(-1);
    AppState.undoStack = [];
    AppState.redoStack = [];
    AppState.restoreItemsFromSnapshot(data.items);
    this.renderTranslationList();
    this.renderPresets();
    this.requestRender();
  },

  readFileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
});

function savedScanIds(data) {
  if (data?.version !== 2) return [];
  return [...new Set(data.pages.flatMap(page => [page.cleanScanId, page.origScanId]).filter(Boolean))];
}
