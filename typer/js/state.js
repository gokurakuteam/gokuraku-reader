window.AppState = {
  pages: [],
  items: [],
  selectedId: null,
  activeTool: 'pointer',
  peekOriginal: false,
  holdOriginal: false,
  get showingOriginal() { return this.peekOriginal || this.holdOriginal; },
  centerSnap: true,
  capsLockOnInsert: true,

  // Доступні шрифти для візуального селектора
  fonts: ['Arial', 'Impact', 'Comic Sans MS', 'Georgia', 'Verdana', 'Trebuchet MS'],
  currentFont: 'Arial',
  useGradient: false,

  // Камера (відступ зліва 140px, щоб було видно плашки сторінок зліва за межами скану)
  camera: {
    x: 150,
    y: 28,
    scale: 0.75
  },

  undoStack: [],
  redoStack: [],

  recents: JSON.parse(localStorage.getItem('typer_recents') || 'null') || [
    { type: 'solid', fill: '#000000', stroke: '#ffffff', strokeWidth: 0 },
    { type: 'solid', fill: '#ffffff', stroke: '#000000', strokeWidth: 6 },
    { type: 'gradient', fill: '#ff0055', useGradient: true, grad2: '#ffcc00', stroke: '#000000', strokeWidth: 6 },
    { type: 'glow', fill: '#ffffff', stroke: '#000000', strokeWidth: 2, glowColor: '#00e5ff', glowBlur: 15 }
  ],

  presets: JSON.parse(localStorage.getItem('typer_presets') || 'null') || [
    { name: '1. Основний бабл', autoType: 'bubble', font: 'Arial', size: 42, fill: '#000000', useGrad: false, grad2: '#ffffff', strokeWidth: 0, strokeColor: '#ffffff', glowBlur: 0, glowColor: '#00e5ff', bold: false, italic: false },
    { name: '2. Панелька / Рамка', autoType: 'panel', font: 'Arial', size: 38, fill: '#ffffff', useGrad: false, grad2: '#ffffff', strokeWidth: 6, strokeColor: '#000000', glowBlur: 0, glowColor: '#00e5ff', bold: true, italic: false },
    { name: '3. Фоновий текст', autoType: 'bg', font: 'Arial', size: 32, fill: '#000000', useGrad: false, grad2: '#ffffff', strokeWidth: 5, strokeColor: '#ffffff', glowBlur: 0, glowColor: '#00e5ff', bold: false, italic: false },
    { name: '4. Думки', autoType: 'thought', font: 'Arial', size: 40, fill: '#333333', useGrad: false, grad2: '#ffffff', strokeWidth: 0, strokeColor: '#ffffff', glowBlur: 0, glowColor: '#00e5ff', bold: false, italic: true }
  ],

  hotkeys: JSON.parse(localStorage.getItem('typer_hotkeys') || 'null') || {
    insertNext: { code: 'KeyK', shift: true, ctrl: false, label: 'Shift+K', title: 'Вставити фразу у бабл і перейти далі' },
    toolPointer: { code: 'KeyV', shift: false, ctrl: false, label: 'V', title: 'Інструмент Вказівник' },
    toolBubble: { code: 'KeyD', shift: false, ctrl: false, label: 'D', title: 'Інструмент Малювання бабла' },
    toolText: { code: 'KeyT', shift: false, ctrl: false, label: 'T', title: 'Інструмент Текст без бабла' },
    toolEyedropper: { code: 'KeyI', shift: false, ctrl: false, label: 'I', title: 'Інструмент Піпетка' },
    toolEraser: { code: 'KeyE', shift: false, ctrl: false, label: 'E', title: 'Інструмент Ластик' },
    peekOrig: { code: 'KeyQ', shift: false, ctrl: false, label: 'Q', title: 'Показати оригінал (затиснути або клік)' }
  },

  translations: [],
  activeTransIndex: -1,
  activeFilters: { bubble: true, panel: true, bg: true, thought: true, sound: true, comment: true },

  uid() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  },

  recalcPageOffsets() {
    let y = 0;
    const width = this.pages.reduce((max, page) => Math.max(max, page.width), 0);
    this.pagesById = new Map();
    for (const p of this.pages) {
      this.pagesById.set(p.id, p);
      p.yOffset = y;
      p.xOffset = (width - p.width) / 2;
      y += p.height;
    }
    window.CanvasStrip?.invalidateScanLayer?.();
  },

  getPageById(pageId) {
    return (this.pagesById ? this.pagesById.get(pageId) : this.pages.find(page => page.id === pageId)) ||
      this.pages[0] || null;
  },

  getPageAtGlobalY(globalY) {
    for (const p of this.pages) {
      if (globalY >= p.yOffset && globalY < p.yOffset + p.height) {
        return p;
      }
    }
    return this.pages[this.pages.length - 1] || null;
  },

  getPageAtPoint(x, y) {
    const page = this.getPageAtGlobalY(y);
    if (!page) return null;
    const left = page.xOffset || 0;
    return x >= left && x < left + page.width && y >= page.yOffset && y < page.yOffset + page.height
      ? page : null;
  },

  linkBubbles(item, siblings) {
    if (!siblings.length) return;
    const groups = new Set([item, ...siblings].map(bubble => bubble.clusterId).filter(Boolean));
    const clusterId = groups.values().next().value || this.uid();
    for (const bubble of this.items) {
      if (bubble === item || siblings.includes(bubble) || groups.has(bubble.clusterId)) bubble.clusterId = clusterId;
    }
    this.autoFitItemText(item);
  },

  getSelectedItem() {
    return this.items.find(i => i.id === this.selectedId) || null;
  },

  snapshot(includeTranslation = false) {
    return JSON.stringify({
      items: this.items.map(({ pngImg, ...item }) => item),
      activeTransIndex: includeTranslation ? this.activeTransIndex : undefined,
      translationRevision: includeTranslation ? this.translationRevision || 0 : undefined
    });
  },

  saveSnapshot(includeTranslation = false) {
    const snap = this.snapshot(includeTranslation);
    if (this.undoStack.at(-1) === snap) return;
    this.undoStack.push(snap);
    while (this.undoStack.length > 1 && (this.undoStack.length > 40 ||
      this.undoStack.reduce((bytes, entry) => bytes + entry.length * 2, 0) > 16 * 1024 * 1024)) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  },

  undo() {
    this.restoreHistory(this.undoStack, this.redoStack);
  },

  redo() {
    this.restoreHistory(this.redoStack, this.undoStack);
  },

  restoreHistory(source, destination) {
    if (!source.length) return;
    const snapshot = JSON.parse(source.pop());
    const includesTranslation = snapshot.activeTransIndex !== undefined &&
      snapshot.translationRevision === (this.translationRevision || 0);
    destination.push(this.snapshot(includesTranslation));
    if (includesTranslation) {
      this.activeTransIndex = snapshot.activeTransIndex;
      window.CanvasStrip?.updateTranslationSelection?.();
    }
    this.restoreItemsFromSnapshot(snapshot.items);
    window.CanvasStrip?.markProjectChanged?.();
  },

  restoreItemsFromSnapshot(arr) {
    this.items = arr.map(it => {
      if (it.type === 'png' && it.pngDataUrl) {
        const img = new Image();
        img.onload = () => window.CanvasStrip?.requestRender();
        img.src = it.pngDataUrl;
        it.pngImg = img;
      }
      return it;
    });
    if (!this.items.some(i => i.id === this.selectedId)) {
      this.selectedId = null;
    }
    window.CanvasStrip?.syncUIFromSelection();
    window.CanvasStrip?.requestRender();
  },

  addRecentStyle(style) {
    const entry = {
      type: style.useGradient ? 'gradient' : (style.glowBlur > 0 ? 'glow' : 'solid'),
      fill: style.fillColor,
      useGradient: !!style.useGradient,
      grad2: style.gradColor2 || '#ffffff',
      stroke: style.strokeColor || '#ffffff',
      strokeWidth: style.strokeWidth || 0,
      glowColor: style.glowColor || '#00e5ff',
      glowBlur: style.glowBlur || 0
    };
    const key = JSON.stringify(entry);
    this.recents = this.recents.filter(r => JSON.stringify(r) !== key);
    this.recents.unshift(entry);
    if (this.recents.length > 10) this.recents.pop();
    localStorage.setItem('typer_recents', JSON.stringify(this.recents));
    window.CanvasStrip?.renderRecentSwatches();
  },

  autoFitItemText(item) {
    if (!item || item.type === 'png') return;
    if (!item.manualTextLayout) TextEngine.autoFitText(item);
    if (item.clusterId) {
      const group = this.items.filter(i => i.clusterId === item.clusterId);
      const automatic = group.filter(i => i.rawText && !i.manualTextLayout && !i.fixedFontSize);
      const locked = group.filter(i => i.fixedFontSize);
      const anchor = locked.reduce((latest, current) =>
        !latest || (current.fixedFontOrder || 0) > (latest.fixedFontOrder || 0) ? current : latest, null);
      if (anchor) {
        automatic.forEach(i => TextEngine.autoFitText(i, {fixedSize: anchor.fixedFontSize}));
      } else if (automatic.length) {
        automatic.forEach(i => { if (i !== item) TextEngine.autoFitText(i); });
        if (automatic.length > 1) {
          const size = Math.min(...automatic.map(i => i.style.fontSize));
          automatic.forEach(i => TextEngine.autoFitText(i, {fixedSize: size}));
        }
      }
    }
    window.CanvasStrip?.syncFontLimits?.(this.getSelectedItem());
  },

  resetItemTextLayout(item) {
    delete item.fixedFontSize;
    delete item.fixedFontOrder;
    item.manualTextLayout = false;
    item.textOffsetX = 0;
    item.textOffsetY = 0;
    this.autoFitItemText(item);
  },

  isInsertableTranslation(item) {
    return item.type !== 'page_header' && item.type !== 'comment' && !!this.activeFilters[item.type];
  },

  // --- УНІВЕРСАЛЬНИЙ ПАРСЕР СТОРІНОК ("34 сторінка", "сторінка 34", "Сторінка 34", "Стор. 34") ---
  parseTranslationText(rawContent) {
    const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
    const parsed = [];
    let currentPage = 1;

    // Ловить: "34 сторінка", "сторінка 34", "Сторінка: 34", "стор. 34", "# Сторінка 34" тощо
    const pageRegex = /^#*\s*[-—=~*]*\s*(?:(\d+)\s*(?:сторінка|стор\.?|page)|(?:сторінка|стор\.?|page)\s*[:№#-]*\s*(\d+))\s*[-—=~*:]*$/i;

    const unescape = text => text.replace(/\\([!-/:-@\[\\\]\^_`{|}~])/g, '$1');
    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      const pageMatch = line.match(pageRegex);
      if (pageMatch) {
        currentPage = parseInt(pageMatch[1] || pageMatch[2], 10);
        parsed.push({ type: 'page_header', page: currentPage, text: `Сторінка ${currentPage}` });
        continue;
      }

      if (line.startsWith('#')) {
        parsed.push({
          type: 'comment',
          page: currentPage,
          text: unescape(line.replace(/^#+\s*/, ''))
        });
        continue;
      }

      let tType = 'bubble';
      if (line.startsWith('/')) {
        tType = 'bg';
        line = line.slice(1).trim();
      } else if (/(?<!\\)(?:\\\\)*\*\*/.test(line)) {
        tType = 'sound';
        line = line.replace(/(?<!\\)((?:\\\\)*)\*\*/g, '$1').trim();
      } else if (/(?<!\\)(?:\\\\)*__/.test(line)) {
        tType = 'panel';
        line = line.replace(/(?<!\\)((?:\\\\)*)__/g, '$1').trim();
      } else if (/^\*.*(?<!\\)(?:\\\\)*\*$/.test(line)) {
        tType = 'thought';
        line = line.replace(/(?<!\\)((?:\\\\)*)\*/g, '$1').trim();
      }

      if (line) {
        parsed.push({ type: tType, page: currentPage, text: unescape(line) });
      }
    }

    this.translationRevision = (this.translationRevision || 0) + 1;
    this.translations = parsed;
    this.activeTransIndex = this.findNextInsertableIndex(-1);
  },

  findNextInsertableIndex(fromIndex) {
    for (let i = fromIndex + 1; i < this.translations.length; i++) {
      const item = this.translations[i];
      if (this.isInsertableTranslation(item)) return i;
    }
    return -1;
  }
};
