// Decode visible scans sequentially. Source data remains available for saving.
Object.assign(CanvasStrip, {
  releasePageImages() {
    this.loadingScan=false;
    for (const p of AppState.pages) for (const key of ['cleanImg','origImg']) {
      if (p[key]) { p[key].onload = p[key].onerror = null; p[key].src = ''; }
      p[key] = null;
    }
  },
  updatePageImages(top, bottom) {
    if (this.exporting) return;
    const key = AppState.peekOriginal ? 'origImg' : 'cleanImg';
    const visible = AppState.pages.filter(p=>p.yOffset+p.height>=top && p.yOffset<=bottom);
    for (const p of AppState.pages) for (const k of ['cleanImg','origImg']) {
      const wanted = visible.includes(p) && k === (key==='origImg' && p.origDataUrl ? key : 'cleanImg');
      if (!wanted && p[k]) { if (!p[k].complete) this.loadingScan=false; p[k].onload=p[k].onerror=null; p[k].src=''; p[k]=null; }
    }
    // Decode one image at a time; do not start a chapter-wide Promise.all.
    if (this.loadingScan) return;
    for (const p of visible) {
      const k = key==='origImg' && p.origDataUrl ? key : 'cleanImg';
      if (p[k]) continue;
      this.loadingScan = true;
      const img = new Image(); p[k]=img;
      const finish = () => { this.loadingScan=false; this.requestRender(); };
      img.onload=finish;
      img.onerror=finish;
      img.src = k==='origImg' ? p.origDataUrl : p.cleanDataUrl;
      break;
    }
  },

  downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});
