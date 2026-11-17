window.AppState = {
  pages: [],
  items: [],
  selectedId: null,
  activeTool: 'pointer',
  peekOriginal: false,
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
  activeFilters: { bubble: true, panel: true, bg: true, thought: true, sound: true },

  uid() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  },

  recalcPageOffsets() {
    let y = 0;
    for (const p of this.pages) {
      p.yOffset = y;
      y += p.height;
    }
  },

  getPageById(pageId) {
    return this.pages.find(p => p.id === pageId) || this.pages[0] || null;
  },

  getPageAtGlobalY(globalY) {
    for (const p of this.pages) {
      if (globalY >= p.yOffset && globalY <= p.yOffset + p.height) {
        return p;
      }
    }
    return this.pages[this.pages.length - 1] || null;
  },

  getSelectedItem() {
    return this.items.find(i => i.id === this.selectedId) || null;
  },

  saveSnapshot() {
    const snap = JSON.stringify(this.items.map(it => {
      const copy = { ...it, style: { ...it.style }, lines: [...(it.lines || [])] };
      delete copy.pngImg;
      return copy;
    }));
    if (this.undoStack.length && this.undoStack[this.undoStack.length - 1] === snap) return;
    this.undoStack.push(snap);
    while (this.undoStack.length > 1 && (this.undoStack.length > 40 || this.undoStack.reduce((n,s)=>n+s.length*2,0) > 16*1024*1024)) this.undoStack.shift();
    this.redoStack = [];
  },

  undo() {
    if (!this.undoStack.length) return;
    const current = JSON.stringify(this.items.map(it => ({ ...it, pngImg: undefined })));
    this.redoStack.push(current);
    const prev = JSON.parse(this.undoStack.pop());
    this.restoreItemsFromSnapshot(prev);
  },

  redo() {
    if (!this.redoStack.length) return;
    const current = JSON.stringify(this.items.map(it => ({ ...it, pngImg: undefined })));
    this.undoStack.push(current);
    const next = JSON.parse(this.redoStack.pop());
    this.restoreItemsFromSnapshot(next);
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
    if (item?.manualTextLayout) return;
    TextEngine.autoFitText(item);
    window.CanvasStrip?.syncFontLimits?.(item);
    if (item?.clusterId) {
      const group = this.items.filter(i => i.clusterId === item.clusterId && i.rawText && !i.manualTextLayout);
      group.forEach(i => TextEngine.autoFitText(i));
      const size = Math.min(...group.map(i => i.style.fontSize));
      group.forEach(i => TextEngine.autoFitText(i, {minFont:size, maxFont:size}));
    }
  },

  // --- УНІВЕРСАЛЬНИЙ ПАРСЕР СТОРІНОК ("34 сторінка", "сторінка 34", "Сторінка 34", "Стор. 34") ---
  parseTranslationText(rawContent) {
    const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
    const parsed = [];
    let currentPage = 1;

    // Ловить: "34 сторінка", "сторінка 34", "Сторінка: 34", "стор. 34", "# Сторінка 34" тощо
    const pageRegex = /^#*\s*[-—=~*]*\s*(?:(\d+)\s*(?:сторінка|стор\.?|page)|(?:сторінка|стор\.?|page)\s*[:№#-]*\s*(\d+))\s*[-—=~*:]*$/i;

    for (let rawLine of lines) {
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
          text: line.slice(1).trim()
        });
        continue;
      }

      let tType = 'bubble';
      if (line.startsWith('/')) {
        tType = 'bg';
        line = line.slice(1).trim();
      } else if (line.includes('**')) {
        tType = 'sound';
        line = line.replace(/\*\*/g, '').trim();
      } else if (line.includes('__')) {
        tType = 'panel';
        line = line.replace(/__/g, '').trim();
      } else if (line.startsWith('*') && line.endsWith('*')) {
        tType = 'thought';
        line = line.replace(/\*/g, '').trim();
      }

      if (line) {
        parsed.push({ type: tType, page: currentPage, text: line });
      }
    }

    this.translations = parsed;
    this.activeTransIndex = this.findNextInsertableIndex(-1);
  },

  findNextInsertableIndex(fromIndex) {
    for (let i = fromIndex + 1; i < this.translations.length; i++) {
      const item = this.translations[i];
      if (item.type === 'page_header' || item.type === 'comment') continue;
      if (!this.activeFilters[item.type]) continue;
      return i;
    }
    return -1;
  }
};
