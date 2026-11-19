// Decode visible scans sequentially. Source data remains available for saving.
Object.assign(CanvasStrip, {
  releasePageImages() {
    for (const p of AppState.pages) for (const key of ['cleanImg', 'origImg']) this.clearPageImage(p, key);
    this.invalidateScanLayer();
  },

  clearPageImage(page, key) {
    const img = page[key];
    if (!img) return;
    if (this.loadingScan === img) this.loadingScan = null;
    img.onload = img.onerror = null;
    URL.revokeObjectURL(img.src);
    img.src = '';
    page[key] = null;
    this.invalidateScanLayer();
  },

  updatePageImages(top, bottom) {
    if (this.exporting) return;
    const key = AppState.showingOriginal ? 'origImg' : 'cleanImg';
    const visible = AppState.pages.filter(p=>p.yOffset+p.height>=top && p.yOffset<=bottom);
    const visibleSet = new Set(visible);
    for (const p of AppState.pages) for (const k of ['cleanImg','origImg']) {
      const wanted = visibleSet.has(p) && (k === 'cleanImg' || (key === 'origImg' && p.origBlob));
      if (!wanted) this.clearPageImage(p, k);
    }
    // Decode one image at a time; do not start a chapter-wide Promise.all.
    if (this.loadingScan) return;
    for (const p of visible) {
      const k = key==='origImg' && p.origBlob ? key : 'cleanImg';
      if (p[k]) continue;
      const img = new Image();
      p[k] = this.loadingScan = img;
      const finish = () => {
        if (this.loadingScan === img) this.loadingScan = null;
        this.invalidateScanLayer();
        this.requestRender();
      };
      img.onload=finish;
      img.onerror=finish;
      img.src = URL.createObjectURL(k==='origImg' ? p.origBlob : p.cleanBlob);
      break;
    }
  },

  downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});
