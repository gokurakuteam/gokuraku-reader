Object.assign(window.CanvasStrip, {
  // --- ПЛАВАЮЧИЙ РЕДАКТОР ТЕКСТУ ЗА ПОДВІЙНИМ КЛІКОМ НА ПОЛОТНІ ---
  openInlineEditor(item) {
    if (!item || item.type === 'png') return;
    AppState.saveSnapshot();
    this.editingItem = item;
    this.inlineOriginalText = item.rawText || '';
    this.inlineOriginalLines = [...(item.lines || [])];
    this.inlineInitialValue = this.inlineOriginalLines.length ? this.inlineOriginalLines.join('\n') : this.inlineOriginalText;

    const g = this.getItemGlobalRect(item);
    const scrCenter = this.worldToScreen(g.cx, g.cy);
    const scale = AppState.camera.scale;
    const w = Math.max(40, item.w * scale);
    const h = Math.max(30, item.h * scale);
    const ed = this.inlineEditor;
    const st = item.style || {};
    const fontSize = (st.fontSize || 42) * scale;
    const lineHeight = Math.max(1.1, st.lineHeight || 1.2);
    ed.hidden = false;
    ed.wrap = 'off';
    ed.style.width = `${w}px`;
    ed.style.height = `${h}px`;
    ed.style.left = `${scrCenter.x - w / 2 + (item.textOffsetX || 0) * scale}px`;
    ed.style.top = `${scrCenter.y - h / 2 + (item.textOffsetY || 0) * scale}px`;
    ed.style.transform = `rotate(${item.angle || 0}deg)`;
    ed.style.fontFamily = `"${st.fontFamily || 'Arial'}"`;
    ed.style.fontSize = `${fontSize}px`;
    ed.style.lineHeight = lineHeight;
    ed.style.fontWeight = st.bold ? 'bold' : 'normal';
    ed.style.fontStyle = st.italic ? 'italic' : 'normal';
    ed.style.color = st.fillColor || '#000000';
    ed.style.caretColor = st.fillColor || '#000000';
    ed.style.padding = `${Math.max(0, (h - Math.max(1, this.inlineInitialValue.split('\n').length) * fontSize * lineHeight) / 2)}px 0`;
    ed.value = this.inlineInitialValue;
    ed.focus();
    ed.setSelectionRange(ed.value.length, ed.value.length);
    this.requestRender();
  },

  closeInlineEditor(cancel = false) {
    if (!this.editingItem) return;
    const item = this.editingItem;
    const changed = !cancel && this.inlineEditor.value !== this.inlineInitialValue;
    item.rawText = changed ? this.inlineEditor.value : this.inlineOriginalText;
    item.lines = changed ? (item.rawText ? item.rawText.split('\n') : []) : this.inlineOriginalLines;
    if (changed) item.manualTextLayout = true;
    this.editingItem = null;
    this.inlineEditor.hidden = true;
    this.syncUIFromSelection();
    this.requestRender();
  },

  // --- ПОДІЇ ПОЛОТНА ---
  bindCanvasEvents() {
    // Подвійний клік на полотні відкриває пряме редагування тексту в баблі
    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = this.hitTest(world.x, world.y, false);
      if (hit?.item) {
        AppState.selectedId = hit.item.id;
        this.syncUIFromSelection();
        this.openInlineEditor(hit.item);
      }
    });

    this.inlineEditor.addEventListener('input', () => {
      if (!this.editingItem) return;
      const ed = this.inlineEditor;
      ed.style.paddingTop = `${Math.max(0, (ed.clientHeight - ed.value.split('\n').length * parseFloat(ed.style.fontSize) * parseFloat(ed.style.lineHeight)) / 2)}px`;
      this.requestRender();
      document.getElementById('prop-text').value = this.inlineEditor.value;
    });

    this.inlineEditor.addEventListener('keydown', (e) => {
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

      if (e.button === 1 || this.spacePressed) {
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
          this.requestRender();
        }
        return;
      }

      if (tool === 'bubble') {
        const page = AppState.getPageAtGlobalY(world.y);
        if (!page) return;
        AppState.saveSnapshot();
        const newBubble = this.createDefaultItem('bubble', page.id, world.x, world.y - page.yOffset, 10, 10);
        AppState.items.push(newBubble);
        AppState.selectedId = newBubble.id;
        this.dragState = { mode: 'draw', item: newBubble, startWX: world.x, startWY: world.y, pageOffset: page.yOffset };
        this.syncUIFromSelection();
        this.requestRender();
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
        const page = AppState.getPageAtGlobalY(world.y);
        if (!page) return;
        AppState.saveSnapshot();
        const newText = this.createDefaultItem('text', page.id, world.x - 90, world.y - page.yOffset - 35, 180, 70);
        newText.rawText = '';
        newText.lines = [];
        AppState.items.push(newText);
        AppState.selectedId = newText.id;
        this.setTool('pointer');
        this.syncUIFromSelection();
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
            origRect: { x: hit.item.x, y: hit.item.y, w: hit.item.w, h: hit.item.h }
          };
        }
      } else {
        AppState.selectedId = null;
        this.syncUIFromSelection();
        this.dragState = { mode: 'pan', startSX: sx, startSY: sy, camX: AppState.camera.x, camY: AppState.camera.y, clickWorld: world };
      }
      this.requestRender();
    });

    window.addEventListener('mousemove', (e) => {
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
        const x1 = Math.min(st.startWX, world.x);
        const y1 = Math.min(st.startWY, world.y) - st.pageOffset;
        st.item.x = x1;
        st.item.y = y1;
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
              this.snapGuideX = targetX;
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
        st.item.x = r.x;
        st.item.y = r.y;
        st.item.w = r.w;
        st.item.h = r.h;
      }
      this.requestRender();
    });

    window.addEventListener('mouseup', (e) => {
      const st = this.dragState;
      const rect = this.canvas.getBoundingClientRect();
      const world = st?.clickWorld || (st?.mode === 'draw' ? {x:st.startWX,y:st.startWY} : null);
      const moved = st?.mode === 'draw'
        ? Math.hypot((this.screenToWorld(e.clientX-rect.left,e.clientY-rect.top).x-st.startWX)*AppState.camera.scale,
                     (this.screenToWorld(e.clientX-rect.left,e.clientY-rect.top).y-st.startWY)*AppState.camera.scale)
        : Math.hypot(e.clientX-rect.left-(st?.startSX||0),e.clientY-rect.top-(st?.startSY||0));
      if (world && moved < 5) {
        const page = AppState.getPageAtGlobalY(world.y);
        const found = BubbleDetector.detect(page, world.x, world.y-(page?.yOffset||0));
        if (st.mode === 'draw') AppState.items = AppState.items.filter(i=>i!==st.item);
        if (found) {
          if (st.mode !== 'draw') AppState.saveSnapshot();
          const item = this.createDefaultItem('bubble',page.id,found.x,found.y,found.w,found.h);
          Object.assign(item,found);
          // Adjacent lobes share typography; each retains its own contour and text.
          const sibling = AppState.items.find(i=>i.detected && i.pageId===item.pageId &&
            Math.hypot(i.x+i.w/2-item.x-item.w/2,i.y+i.h/2-item.y-item.h/2)<(Math.max(i.w,i.h)+Math.max(item.w,item.h))*.6);
          if(sibling){sibling.clusterId ||= AppState.uid();item.clusterId=sibling.clusterId;}
          AppState.items.push(item);AppState.selectedId=item.id;
        } else if(st.mode==='draw') AppState.selectedId=null;
        this.syncUIFromSelection();
      }
      if (st?.mode === 'resize') {delete st.item.contour; st.item.detected=false; AppState.autoFitItemText(st.item);}

      if (this.dragState?.mode === 'draw') {
        // АВТОМАТИЧНО ПЕРЕМИКАЄМО З "D" (БАБЛ) НА "V" (ВКАЗІВНИК) ПІСЛЯ СТВОРЕННЯ БАБЛА!
        this.setTool('pointer');
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
