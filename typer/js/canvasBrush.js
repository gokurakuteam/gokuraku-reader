Object.assign(window.CanvasStrip, {
  getBrushSize() {
    return Math.min(200, Math.max(2, Number(document.getElementById('brush-size').value) || 30));
  },

  bindBrushEvents() {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || this.dragState || this.spacePressed ||
          AppState.showingOriginal || AppState.activeTool !== 'brush') return;
      const rect = canvas.getBoundingClientRect();
      const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const page = AppState.getPageAtPoint(world.x, world.y);
      if (!page?.cleanImg?.naturalWidth) return;

      e.preventDefault();
      if (this.wheelMotion?.frame) {
        cancelAnimationFrame(this.wheelMotion.frame);
        this.wheelMotion = null;
      }
      this.hideContextMenu();
      if (this.editingItem) this.closeInlineEditor();
      canvas.setPointerCapture(e.pointerId);
      this.dragState = { mode: 'brush', pointerId: e.pointerId, page, size: this.getBrushSize(), points: [] };
      this.addBrushSamples(e);
    });

    canvas.addEventListener('pointermove', e => {
      if (this.dragState?.mode === 'brush' && this.dragState.pointerId === e.pointerId) this.addBrushSamples(e);
    });
    canvas.addEventListener('pointerup', e => {
      if (this.dragState?.mode !== 'brush' || this.dragState.pointerId !== e.pointerId) return;
      this.addBrushSamples(e);
      const { page } = this.dragState;
      const patch = this.renderBrushPatch(this.dragState);
      this.cancelBrushStroke();
      if (!patch || AppState.getPageById(page.id) !== page) return;

      const { canvas: image, x, y } = patch;
      const item = this.createDefaultItem('png', page.id, x, y, image.width, image.height);
      item.pngDataUrl = image.toDataURL();
      item.pngImg = image;
      item.brushStroke = true;
      AppState.saveSnapshot();
      const index = AppState.items.findIndex(entry => !entry.brushStroke);
      AppState.items.splice(index < 0 ? AppState.items.length : index, 0, item);
      this.markProjectChanged();
    });

    for (const event of ['pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, e => {
        if (this.dragState?.pointerId === e.pointerId) this.cancelBrushStroke();
      });
    }
    window.addEventListener('blur', () => this.cancelBrushStroke());
  },

  cancelBrushStroke() {
    if (this.dragState?.mode !== 'brush') return;
    const { pointerId } = this.dragState;
    this.dragState = null;
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    this.requestRender();
  },

  addBrushSamples(event) {
    const stroke = this.dragState;
    const rect = this.canvas.getBoundingClientRect();
    const samples = event.getCoalescedEvents?.();
    for (const sample of [...(samples || []), event]) {
      const world = this.screenToWorld(sample.clientX - rect.left, sample.clientY - rect.top);
      const x = world.x - (stroke.page.xOffset || 0);
      const y = world.y - stroke.page.yOffset;
      const last = stroke.points.at(-1);
      if (last?.x === x && last.y === y) continue;
      stroke.points.push({ x, y });
      stroke.patch = undefined;
    }
    this.requestRender();
  },

  renderBrushPatch(stroke) {
    if (stroke.patch !== undefined) return stroke.patch;
    const { page, points, size } = stroke;
    if (!page.cleanImg?.naturalWidth) return null;

    const first = points[0];
    let minX = first.x, maxX = first.x, minY = first.y, maxY = first.y;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    const radius = size / 2;
    const x = Math.max(0, Math.floor(minX - radius));
    const y = Math.max(0, Math.floor(minY - radius));
    const right = Math.min(page.width, Math.ceil(maxX + radius));
    const bottom = Math.min(page.height, Math.ceil(maxY + radius));
    if (right <= x || bottom <= y) return null;

    const canvas = stroke.patchCanvas || (stroke.patchCanvas = document.createElement('canvas'));
    if (canvas.width !== right - x) canvas.width = right - x;
    if (canvas.height !== bottom - y) canvas.height = bottom - y;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(-x, -y);
    ctx.beginPath();
    if (points.length === 1) {
      ctx.arc(first.x, first.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.lineWidth = size;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      const last = points.at(-1);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    ctx.restore();

    const mask = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.fillBrushMask(stroke, mask, x, y);
    ctx.putImageData(mask, 0, 0);
    stroke.patch = { canvas, x, y };
    return stroke.patch;
  },

  fillBrushMask(stroke, mask, x, y) {
    const { page } = stroke;
    const { width, height, data } = mask;
    const left = Math.max(0, x - 1);
    const top = Math.max(0, y - 1);
    const right = Math.min(page.width, x + width + 1);
    const bottom = Math.min(page.height, y + height + 1);
    const source = stroke.sampleCanvas || (stroke.sampleCanvas = document.createElement('canvas'));
    if (source.width !== right - left) source.width = right - left;
    if (source.height !== bottom - top) source.height = bottom - top;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, source.width, source.height);
    ctx.drawImage(page.cleanImg, -left, -top, page.width, page.height);
    const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
    const start = (y - top) * source.width + x - left;
    const scores = new Uint16Array(width * height);

    // Interpolate across each masked run using the scan on either side.
    // Prefer shorter runs and endpoints with similar colors to preserve nearby lines.
    for (const across of [true, false]) {
      const lines = across ? height : width;
      const length = across ? width : height;
      const maskStep = across ? 1 : width;
      const scanStep = across ? 1 : source.width;
      const before = across ? x - left : y - top;
      const after = across ? right - x - width : bottom - y - height;
      for (let line = 0; line < lines; line++) {
        const maskBase = across ? line * width : line;
        const scanBase = start + (across ? line * source.width : line);
        let pos = 0;
        while (pos < length) {
          const first = pos;
          while (pos < length && data[(maskBase + pos * maskStep) * 4 + 3]) pos++;
          if (pos === first) {
            pos++;
            continue;
          }
          const a = Math.max(-before, first - 1);
          const b = Math.min(length + after - 1, pos);
          const hasBefore = a < first;
          const hasAfter = b >= pos;
          if (!hasBefore && !hasAfter) continue;
          const from = (scanBase + (hasBefore ? a : b) * scanStep) * 4;
          const to = (scanBase + (hasAfter ? b : a) * scanStep) * 4;
          const difference = Math.max(
            Math.abs(pixels[from] - pixels[to]),
            Math.abs(pixels[from + 1] - pixels[to + 1]),
            Math.abs(pixels[from + 2] - pixels[to + 2])
          );
          const score = Math.min(65535, pos - first + difference + (from === to ? 8 : 1));
          for (let i = first; i < pos; i++) {
            const pixel = maskBase + i * maskStep;
            if (scores[pixel] && scores[pixel] <= score) continue;
            scores[pixel] = score;
            const mix = from === to ? 0 : (i - a) / (b - a);
            const offset = pixel * 4;
            for (let channel = 0; channel < 3; channel++) {
              data[offset + channel] = pixels[from + channel] * (1 - mix) + pixels[to + channel] * mix;
            }
          }
        }
      }
    }

    // With no surrounding samples, leave the underlying scan visible.
    for (let i = 0; i < scores.length; i++) {
      if (!scores[i]) data[i * 4 + 3] = 0;
    }
  },

  drawBrushPreview(ctx, stroke) {
    const patch = this.renderBrushPatch(stroke);
    if (patch) ctx.drawImage(patch.canvas, patch.x + (stroke.page.xOffset || 0), patch.y + stroke.page.yOffset);
  }
});
