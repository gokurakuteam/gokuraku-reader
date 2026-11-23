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
    this.scanCanvas = document.getElementById('scan-canvas');
    this.scanCtx = this.scanCanvas.getContext('2d');
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
    this.scanImport = this.restoreDraft();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveDraft();
    });
    this.requestRender();
    document.fonts.ready.then(() => {
      this.invalidateScanLayer();
      this.requestRender();
    });
  },

  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  resizeCanvas() {
    this.canvasSizeDirty = true;
    this.requestRender();
  },

  syncCanvasSize() {
    this.canvasSizeDirty = false;
    const rect = this.viewport.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (this.canvas.width === width && this.canvas.height === height && this.canvasDpr === dpr) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.scanCanvas.width !== width) this.scanCanvas.width = width;
    if (this.scanCanvas.height !== height) this.scanCanvas.height = height;
    this.canvasDpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scanCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.invalidateScanLayer();
  },

  requestRender() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.canvasSizeDirty) this.syncCanvasSize();
      this.updateBrushCursor?.();
      this.render();
    });
  },

};
