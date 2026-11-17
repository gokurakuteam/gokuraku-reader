window.CanvasStrip = {
  canvas: null,
  ctx: null,
  viewport: null,
  inlineEditor: null,
  editingItem: null,
  rafId: null,

  dragState: null,
  snapGuideX: null,
  recordingHotkeyKey: null,

  init() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.viewport = document.getElementById('canvas-viewport');
    this.inlineEditor = document.getElementById('canvas-inline-editor');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindTabsAndCustomPickers();
    this.bindCanvasEvents();
    this.bindUIEvents();
    this.bindKeyboardEvents();
    this.bindScrubbableNumbers();

    this.renderFontPicker();
    this.updateColorWells();
    this.renderRecentSwatches();
    this.renderPresets();
    this.updateHotkeyLabels();
    this.refreshIcons();
    this.restoreDraft();
    this.requestRender();
  },

  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  resizeCanvas() {
    const rect = this.viewport.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.requestRender();
  },

  requestRender() {
    if (this.draftReady) {
      clearTimeout(this.draftTimer);
      this.draftTimer = setTimeout(() => this.saveDraft(), 700);
    }
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  },

};
