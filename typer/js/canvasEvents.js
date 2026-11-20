Object.assign(window.CanvasStrip, {
  // --- ПЛАВАЮЧИЙ РЕДАКТОР ТЕКСТУ ЗА ПОДВІЙНИМ КЛІКОМ НА ПОЛОТНІ ---
  openInlineEditor(item) {
    if (!item || item.type === 'png') return;
    AppState.saveSnapshot();
    this.editingItem = item;
    this.inlineInitialValue = item.lines?.length ? item.lines.join('\n') : item.rawText || '';
    const g = this.getItemGlobalRect(item);
    const angle = (item.angle || 0) * Math.PI / 180;
    const offsetX = item.textOffsetX || 0;
    const offsetY = item.textOffsetY || 0;
    const scrCenter = this.worldToScreen(
      g.cx + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
      g.cy + offsetX * Math.sin(angle) + offsetY * Math.cos(angle)
    );
    const scale = AppState.camera.scale;
    const w = Math.max(40, item.w * scale);
    const h = Math.max(30, item.h * scale);
    const ed = this.inlineEditor;
    ed.hidden = false;
    ed.wrap = 'off';
    ed.style.width = `${w}px`;
    ed.style.height = `${h}px`;
    ed.style.left = `${scrCenter.x - w / 2}px`;
    ed.style.top = `${scrCenter.y - h / 2}px`;
    ed.style.transform = `rotate(${item.angle || 0}deg)`;
    ed.value = this.inlineInitialValue;
    ed.focus();
    ed.setSelectionRange(ed.value.length, ed.value.length);
    this.requestRender();
  },

  closeInlineEditor(cancel = false) {
    if (!this.editingItem) return;
    const changed = this.inlineEditor.value !== this.inlineInitialValue;
    if (changed && !cancel) Object.assign(this.editingItem, this.inlineTextChanges());
    this.inlineMouseAnchor = null;
    this.editingItem = null;
    this.inlineEditor.hidden = true;
    if (changed) this.markProjectChanged();
    this.syncUIFromSelection();
    this.requestRender();
  },

  setInlineSelection(offset) {
    const anchor = this.inlineMouseAnchor;
    this.inlineEditor.setSelectionRange(Math.min(anchor, offset), Math.max(anchor, offset),
      offset < anchor ? 'backward' : 'forward');
    this.requestRender();
  },

  inlinePointerOffset(e) {
    const item = this.editingItem;
    const rect = this.canvas.getBoundingClientRect();
    const point = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const local = this.worldToItemLocal(point.x, point.y, this.getItemGlobalRect(item), item.angle || 0);
    const x = local.x - (item.textOffsetX || 0);
    const y = local.y - (item.textOffsetY || 0);
    const lines = this.inlineEditor.value.split('\n');
    const ctx = this.ctx;
    const rows = TextEngine.placements(ctx, item, lines, item.style.fontSize || 42);
    const index = rows.reduce((best, row, i) => Math.abs(row.y - y) < Math.abs(rows[best].y - y) ? i : best, 0);
    const line = lines[index];
    const row = rows[index];
    const left = row.x - ctx.measureText(row.text).width / 2;
    const start = lines.slice(0, index).reduce((offset, text) => offset + text.length + 1, 0);
    let column = 0;
    let previousX = left;
    for (const character of line) {
      const next = column + character.length;
      const nextX = left + ctx.measureText(TextEngine.displayText(item, line.slice(0, next))).width;
      if (x < (previousX + nextX) / 2) break;
      column = next;
      previousX = nextX;
    }
    return start + column;
  },

  linkAdjacentBubbles(item) {
    const page = AppState.getPageById(item.pageId);
    const siblings = AppState.items.filter(other => {
      if (other === item || other.type !== 'bubble') return false;
      const otherPage = AppState.getPageById(other.pageId);
      const dx = item.x + (page?.xOffset || 0) + item.w / 2 - other.x - (otherPage?.xOffset || 0) - other.w / 2;
      const dy = item.y + (page?.yOffset || 0) + item.h / 2 - other.y - (otherPage?.yOffset || 0) - other.h / 2;
      if (item.detected && other.detected && item.pageId === other.pageId) {
        return Math.hypot(dx, dy) < (Math.max(item.w, item.h) + Math.max(other.w, other.h)) * .6;
      }
      return Math.hypot(2 * dx / (item.w + other.w), 2 * dy / (item.h + other.h)) <= 1;
    });
    AppState.linkBubbles(item, siblings);
  },

  detectBubbleAt(world) {
    const page = AppState.getPageAtPoint(world.x, world.y);
    if (!page) return;
    const index = AppState.pages.indexOf(page);
    const neighbors = AppState.pages.slice(Math.max(0, index - 1), index + 2).filter(scan => scan !== page);
    const found = BubbleDetector.detect(page, world.x - (page.xOffset || 0), world.y - page.yOffset, neighbors);
    if (found) {
      const existing = AppState.items.find(item => {
        if (!item.detected) return false;
        const anchor = AppState.getPageById(item.pageId);
        return Math.abs(item.x + (anchor.xOffset || 0) - found.x - (page.xOffset || 0)) <= 2 &&
          Math.abs(item.y + anchor.yOffset - found.y - page.yOffset) <= 2 &&
          Math.abs(item.w - found.w) <= 2 && Math.abs(item.h - found.h) <= 2;
      });
      if (existing) AppState.selectedId = existing.id;
      else {
        AppState.saveSnapshot();
        const item = Object.assign(this.createDefaultItem('bubble', page.id, found.x, found.y, found.w, found.h), found);
        AppState.items.push(item);
        AppState.selectedId = item.id;
        this.linkAdjacentBubbles(item);
        this.markProjectChanged?.();
      }
      this.setTool('pointer');
      this.syncUIFromSelection();
    }
    this.requestRender();
  },

  // --- ПОДІЇ ПОЛОТНА ---
  bindCanvasEvents() {
    this.canvas.addEventListener('dblclick', (e) => {
      if (AppState.showingOriginal || e.altKey) return;
      const rect = this.canvas.getBoundingClientRect();
      const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = this.hitTest(world.x, world.y, false);
      if (hit?.item) {
        AppState.selectedId = hit.item.id;
        this.syncUIFromSelection();
        this.openInlineEditor(hit.item);
      } else if (['pointer', 'bubble'].includes(AppState.activeTool)) {
        this.detectBubbleAt(world);
      }
    });

    this.inlineEditor.addEventListener('input', () => {
      if (!this.editingItem) return;
      this.requestRender();
      document.getElementById('prop-text').value = this.inlineEditor.value;
      this.markProjectChanged();
    });

    this.inlineEditor.addEventListener('mousedown', e => {
      if (!this.editingItem || e.button !== 0) return;
      e.preventDefault();
      const offset = this.inlinePointerOffset(e);
      const ed = this.inlineEditor;
      this.inlineMouseAnchor = e.shiftKey
        ? (ed.selectionDirection === 'backward' ? ed.selectionEnd : ed.selectionStart)
        : offset;
      ed.focus();
      this.setInlineSelection(offset);
    });

    for (const event of ['select', 'keyup', 'pointerup']) {
      this.inlineEditor.addEventListener(event, () => this.requestRender());
    }
    this.inlineEditor.addEventListener('keydown', (e) => {
      if (this.handleTextShortcut?.(e)) return;
      e.stopPropagation(); // Щоб хоткеї інструментів не спрацьовували під час набору
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeInlineEditor(true);
      }
    });

    this.inlineEditor.addEventListener('blur', () => {
      this.closeInlineEditor();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.editingItem) this.closeInlineEditor();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // Wheel deltas may be reported in pixels, lines, or pages.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;

      // Pixel-sized wheel events are typically emitted by a touchpad. Browsers
      // do not expose the originating device, so this is only a heuristic.
      const smooth = e.deltaMode === 0 && (e.ctrlKey || e.metaKey || (Math.abs(dx) < 50 && Math.abs(dy) < 50));
      if (smooth) {
        const motion = this.wheelMotion || (this.wheelMotion = { x: 0, y: 0, zoom: 0, frame: 0 });
        if (e.ctrlKey || e.metaKey) {
          motion.zoom += -dy * 0.002;
          motion.mx = mx;
          motion.my = my;
        } else {
          motion.x -= e.shiftKey && !dx ? dy : dx;
          motion.y -= e.shiftKey && !dx ? 0 : dy;
        }
        if (!motion.frame) {
          let lastTime = 0;
          const tick = (time) => {
            const fraction = 1 - Math.exp(-Math.min(lastTime ? time - lastTime : 16, 50) / 55);
            lastTime = time;
            const x = motion.x * fraction;
            const y = motion.y * fraction;
            const zoom = motion.zoom * fraction;
            motion.x -= x;
            motion.y -= y;
            motion.zoom -= zoom;
            const camera = AppState.camera;
            camera.x += x;
            camera.y += y;
            if (zoom) {
              const scale = Math.min(5, Math.max(0.1, camera.scale * Math.exp(zoom)));
              camera.x = motion.mx - (motion.mx - camera.x) * scale / camera.scale;
              camera.y = motion.my - (motion.my - camera.y) * scale / camera.scale;
              camera.scale = scale;
              document.getElementById('zoom-label').textContent = `${Math.round(scale * 100)}%`;
            }
            this.requestRender();
            if (Math.abs(motion.x) + Math.abs(motion.y) > 0.05 || Math.abs(motion.zoom) > 0.0001) {
              motion.frame = requestAnimationFrame(tick);
            } else {
              motion.x = motion.y = motion.zoom = motion.frame = 0;
            }
          };
          motion.frame = requestAnimationFrame(tick);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.exp(-dy * 0.004);
        const newScale = Math.min(5, Math.max(0.1, AppState.camera.scale * zoomFactor));
        AppState.camera.x = mx - ((mx - AppState.camera.x) / AppState.camera.scale) * newScale;
        AppState.camera.y = my - ((my - AppState.camera.y) / AppState.camera.scale) * newScale;
        AppState.camera.scale = newScale;
        document.getElementById('zoom-label').textContent = `${Math.round(newScale * 100)}%`;
      } else {
        AppState.camera.x -= e.shiftKey && !dx ? dy : dx;
        AppState.camera.y -= e.shiftKey && !dx ? 0 : dy;
      }
      this.requestRender();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.wheelMotion?.frame) {
        cancelAnimationFrame(this.wheelMotion.frame);
        this.wheelMotion = null;
      }
      this.hideContextMenu();
      if (this.editingItem) this.closeInlineEditor();
      if (e.button === 2) return;

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);

      if (e.button === 1 || this.spacePressed || AppState.showingOriginal) {
        this.dragState = { mode: 'pan', startSX: sx, startSY: sy, camX: AppState.camera.x, camY: AppState.camera.y };
        return;
      }

      const tool = AppState.activeTool;

      if (tool === 'eyedropper') {
        this.pickColorFromCanvas(sx, sy);
        return;
      }

      if (tool === 'eraser') {
        const hit = this.hitTest(world.x, world.y, false);
        if (hit?.item) {
          AppState.saveSnapshot();
          AppState.items = AppState.items.filter(i => i.id !== hit.item.id);
          AppState.selectedId = null;
          this.syncUIFromSelection();
          this.markProjectChanged?.();
          this.requestRender();
        }
        return;
      }

      if (e.altKey && (tool === 'pointer' || tool === 'bubble')) {
        this.dragState = { mode: 'detect', startSX: sx, startSY: sy, clickWorld: world };
        return;
      }

      if (tool === 'bubble') {
        const page = AppState.getPageAtPoint(world.x, world.y);
        if (!page) return;
        this.dragState = { mode: 'draw', page, startWX: world.x, startWY: world.y, startSX: sx, startSY: sy };
        return;
      }

      if (tool === 'text') {
        const hit = this.hitTest(world.x, world.y, true);
        if (hit?.item && hit.item.type === 'bubble') {
          AppState.selectedId = hit.item.id;
          this.setTool('pointer');
          this.syncUIFromSelection();
          this.openInlineEditor(hit.item);
          return;
        }
        const page = AppState.getPageAtPoint(world.x, world.y);
        if (!page) return;
        AppState.saveSnapshot();
        const newText = this.createDefaultItem('text', page.id, world.x - (page.xOffset || 0) - 90, world.y - page.yOffset - 35, 180, 70);
        newText.rawText = '';
        newText.lines = [];
        AppState.items.push(newText);
        AppState.selectedId = newText.id;
        this.setTool('pointer');
        this.syncUIFromSelection();
        this.markProjectChanged?.();
        this.openInlineEditor(newText);
        return;
      }

      // Режим 'pointer' (Вказівник)
      const hit = this.hitTest(world.x, world.y, false);
      if (hit) {
        AppState.selectedId = hit.item.id;
        this.syncUIFromSelection();
        AppState.saveSnapshot();
        const g = this.getItemGlobalRect(hit.item);

        if (hit.handle === 'rotate') {
          this.dragState = { mode: 'rotate', item: hit.item, cx: g.cx, cy: g.cy };
        } else if (hit.handle === 'body') {
          this.dragState = {
            mode: 'move',
            item: hit.item,
            startWX: world.x,
            startWY: world.y,
            origX: hit.item.x,
            origY: hit.item.y
          };
        } else {
          this.dragState = {
            mode: 'resize',
            handle: hit.handle,
            item: hit.item,
            startWX: world.x,
            startWY: world.y,
            origContour: hit.item.contour,
            origRect: { x: hit.item.x, y: hit.item.y, w: hit.item.w, h: hit.item.h }
          };
        }
      } else {
        AppState.selectedId = null;
        this.syncUIFromSelection();
        this.dragState = { mode: 'pan', startSX: sx, startSY: sy, camX: AppState.camera.x, camY: AppState.camera.y };
      }
      this.requestRender();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.editingItem && this.inlineMouseAnchor != null) {
        this.setInlineSelection(this.inlinePointerOffset(e));
        return;
      }
      if (!this.dragState) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      const st = this.dragState;

      if (st.mode === 'pan') {
        AppState.camera.x = st.camX + (sx - st.startSX);
        AppState.camera.y = st.camY + (sy - st.startSY);
      } else if (st.mode === 'draw') {
        if (!st.item) {
          if (Math.hypot(sx - st.startSX, sy - st.startSY) < 5) return;
          AppState.saveSnapshot();
          st.item = this.createDefaultItem('bubble', st.page.id, 0, 0, 24, 24);
          AppState.items.push(st.item);
          AppState.selectedId = st.item.id;
          this.syncUIFromSelection();
        }
        st.item.x = Math.min(st.startWX, world.x) - (st.page.xOffset || 0);
        st.item.y = Math.min(st.startWY, world.y) - st.page.yOffset;
        st.item.w = Math.max(24, Math.abs(world.x - st.startWX));
        st.item.h = Math.max(24, Math.abs(world.y - st.startWY));
      } else if (st.mode === 'move') {
        let nx = st.origX + (world.x - st.startWX);
        let ny = st.origY + (world.y - st.startWY);
        this.snapGuideX = null;

        if (AppState.centerSnap) {
          const itemCenterX = nx + st.item.w / 2;
          const page = AppState.getPageById(st.item.pageId);
          const snapTargets = [];
          if (page) snapTargets.push(page.width / 2);

          for (const other of AppState.items) {
            if (other.id !== st.item.id && other.pageId === st.item.pageId && other.type === 'bubble') {
              snapTargets.push(other.x + other.w / 2);
            }
          }

          for (const targetX of snapTargets) {
            if (Math.abs(itemCenterX - targetX) < 12) {
              nx = targetX - st.item.w / 2;
              this.snapGuideX = targetX + (page?.xOffset || 0);
              break;
            }
          }
        }
        st.item.x = nx;
        st.item.y = ny;
      } else if (st.mode === 'rotate') {
        const angleRad = Math.atan2(world.y - st.cy, world.x - st.cx);
        let deg = Math.round((angleRad * 180) / Math.PI + 90);
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        st.item.angle = deg;
        document.getElementById('prop-angle').value = deg;
      } else if (st.mode === 'resize') {
        const dx = world.x - st.startWX;
        const dy = world.y - st.startWY;
        const r = { ...st.origRect };
        if (st.handle.includes('e')) r.w = Math.max(20, r.w + dx);
        if (st.handle.includes('s')) r.h = Math.max(20, r.h + dy);
        if (st.handle.includes('w')) {
          const nw = Math.max(20, r.w - dx);
          r.x += r.w - nw;
          r.w = nw;
        }
        if (st.handle.includes('n')) {
          const nh = Math.max(20, r.h - dy);
          r.y += r.h - nh;
          r.h = nh;
        }
        if (e.shiftKey && st.handle.length === 2) {
          const { w, h, x, y } = st.origRect;
          const scaleX = r.w / w;
          const scaleY = r.h / h;
          const scale = Math.max(20 / w, 20 / h,
            Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY);
          r.w = w * scale;
          r.h = h * scale;
          if (st.handle.includes('w')) r.x = x + w - r.w;
          if (st.handle.includes('n')) r.y = y + h - r.h;
        }
        st.item.x = r.x;
        st.item.y = r.y;
        st.item.w = r.w;
        st.item.h = r.h;
        if (st.origContour) {
          const scaleX = r.w / st.origRect.w;
          st.item.contour = {
            step: st.origContour.step * r.h / st.origRect.h,
            rows: st.origContour.rows.map(([left, right]) => [left * scaleX, right * scaleX])
          };
        }
      }
      this.requestRender();
    });

    window.addEventListener('mouseup', (e) => {
      this.inlineMouseAnchor = null;
      const st = this.dragState;
      if (!st) return;
      if (st.mode === 'detect') {
        const rect = this.canvas.getBoundingClientRect();
        const moved = Math.hypot(e.clientX - rect.left - st.startSX, e.clientY - rect.top - st.startSY);
        const world = st.clickWorld;
        if (moved < 5) this.detectBubbleAt(world);
      }
      if (st.mode === 'draw' && st.item) {
        this.linkAdjacentBubbles(st.item);
        this.setTool('pointer');
        this.syncUIFromSelection();
      }
      if (st?.mode === 'resize' && (st.item.w !== st.origRect.w || st.item.h !== st.origRect.h)) {
        if (st.item.manualTextLayout && !st.item.fixedFontSize) {
          const scale = Math.min(st.item.w / st.origRect.w, st.item.h / st.origRect.h);
          st.item.style.fontSize = Math.max(0.25, (st.item.style.fontSize || 42) * scale);
        }
        AppState.autoFitItemText(st.item);
        this.syncUIFromSelection();
      }
      if (['move', 'rotate', 'resize'].includes(st.mode) || (st.mode === 'draw' && st.item)) {
        this.markProjectChanged?.();
      }

      this.dragState = null;
      this.snapGuideX = null;
      this.requestRender();
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = this.hitTest(world.x, world.y, false);
      if (hit?.item) {
        AppState.selectedId = hit.item.id;
        this.syncUIFromSelection();
        this.requestRender();
        this.showContextMenu(e.clientX, e.clientY);
      }
    });
  },


});
