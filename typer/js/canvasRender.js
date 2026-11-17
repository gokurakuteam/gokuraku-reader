Object.assign(window.CanvasStrip, {
  screenToWorld(sx, sy) {
    const cam = AppState.camera;
    return {
      x: (sx - cam.x) / cam.scale,
      y: (sy - cam.y) / cam.scale
    };
  },

  worldToScreen(wx, wy) {
    const cam = AppState.camera;
    return {
      x: wx * cam.scale + cam.x,
      y: wy * cam.scale + cam.y
    };
  },

  getItemGlobalRect(item) {
    const page = AppState.getPageById(item.pageId);
    const yOff = page ? page.yOffset : 0;
    return {
      x: item.x,
      y: item.y + yOff,
      w: item.w,
      h: item.h,
      cx: item.x + item.w / 2,
      cy: item.y + yOff + item.h / 2
    };
  },

  // --- РЕНДЕР СТРІЧКИ З НАЗВАМИ СТОРІНОК ЗЛІВА ЗА МЕЖАМИ СТОРІНКИ ---
  render() {
    const ctx = this.ctx;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const cam = AppState.camera;

    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.scale, cam.scale);

    const viewTop = -cam.y / cam.scale - 600;
    const viewBottom = (vh - cam.y) / cam.scale + 600;

    this.updatePageImages(viewTop, viewBottom);

    // 1. Малюємо сторінки та бічні плашки ЗА МЕЖАМИ сторінки біля її початку
    for (let i = 0; i < AppState.pages.length; i++) {
      const p = AppState.pages[i];
      if (p.yOffset + p.height < viewTop || p.yOffset > viewBottom) continue;

      const imgToDraw = (AppState.peekOriginal && p.origImg) ? p.origImg : p.cleanImg;
      if (imgToDraw?.complete && imgToDraw.naturalWidth) {
        ctx.drawImage(imgToDraw, 0, p.yOffset, p.width, p.height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, p.yOffset, p.width, p.height);
      }

      // Межа між сторінками
      ctx.strokeStyle = 'rgba(180, 197, 255, 0.35)';
      ctx.lineWidth = 1.2 / cam.scale;
      ctx.beginPath();
      ctx.moveTo(0, p.yOffset);
      ctx.lineTo(p.width, p.yOffset);
      ctx.stroke();

      // ПЛАШКА НАЗВИ СТОРІНКИ ЗЛІВА ЗА МЕЖАМИ СКАНУ (біля самого початку сторінки)
      ctx.save();
      const badgeFont = Math.round(12 / cam.scale);
      ctx.font = `600 ${badgeFont}px "Plus Jakarta Sans", sans-serif`;
      const labelText = `#${i + 1} · ${p.name}`;
      const textW = ctx.measureText(labelText).width;
      const padX = 10 / cam.scale;
      const badgeH = 26 / cam.scale;
      const badgeX = -14 / cam.scale - textW - padX * 2;
      const badgeY = p.yOffset + 6 / cam.scale;

      ctx.fillStyle = '#1e222d';
      ctx.strokeStyle = '#3d4457';
      ctx.lineWidth = 1 / cam.scale;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, textW + padX * 2, badgeH, 8 / cam.scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#b7d8c8';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, badgeX + padX, badgeY + badgeH / 2);
      ctx.restore();
    }

    // 2. Малюємо об'єкти
    for (const item of AppState.items) {
      const g = this.getItemGlobalRect(item);
      if (g.y + g.h < viewTop || g.y > viewBottom) continue;

      ctx.save();
      ctx.translate(g.cx, g.cy);
      ctx.rotate(((item.angle || 0) * Math.PI) / 180);

      const isSelected = item.id === AppState.selectedId;

      if (item.type === 'png' && item.pngImg) {
        ctx.drawImage(item.pngImg, -item.w / 2, -item.h / 2, item.w, item.h);
      }

      if (item.type === 'bubble' && (!item.lines?.length || isSelected)) {
        ctx.strokeStyle = isSelected ? '#b4c5ff' : 'rgba(52, 211, 153, 0.75)';
        ctx.fillStyle = isSelected ? 'rgba(180, 197, 255, 0.1)' : 'rgba(52, 211, 153, 0.1)';
        ctx.lineWidth = 2 / cam.scale;
        ctx.beginPath();
        if (item.contour) {
          const {rows,step}=item.contour;
          rows.forEach((r,i)=>{const x=r[0]-item.w/2,y=i*step-item.h/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
          for(let i=rows.length-1;i>=0;i--)ctx.lineTo(rows[i][1]-item.w/2,i*step-item.h/2);
          ctx.closePath();
        } else ctx.ellipse(0, 0, Math.max(5, item.w / 2), Math.max(5, item.h / 2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Показуємо актуальний результат і під час редагування
      if (item.lines && item.lines.length > 0 && this.editingItem?.id !== item.id) {
        this.renderStyledText(ctx, item);
      }

      if (isSelected && this.editingItem?.id !== item.id) {
        this.renderSelectionHandles(ctx, item.w, item.h, cam.scale);
      }

      ctx.restore();
    }

    // 3. Лінія магнітного снапу по центру
    if (this.snapGuideX !== null) {
      ctx.strokeStyle = '#b4c5ff';
      ctx.lineWidth = 1.5 / cam.scale;
      ctx.setLineDash([6 / cam.scale, 4 / cam.scale]);
      ctx.beginPath();
      ctx.moveTo(this.snapGuideX, viewTop);
      ctx.lineTo(this.snapGuideX, viewBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  },

  renderStyledText(ctx, item) {
    const st = item.style || {};
    const fontSize = st.fontSize || 42;
    const lh = fontSize * Math.max(1.1, st.lineHeight || 1.2);
    const fontStr = `${st.italic ? 'italic ' : ''}${st.bold ? 'bold ' : ''}${fontSize}px "${st.fontFamily || 'Arial'}"`;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const lines = item.lines;
    const placements = TextEngine.placements(ctx,item);
    const totalH = lines.length * lh;
    const offsetX = item.textOffsetX || 0;

    if (st.glowBlur > 0) {
      ctx.shadowColor = st.glowColor || '#00e5ff';
      ctx.shadowBlur = st.glowBlur;
    } else {
      ctx.shadowBlur = 0;
    }

    if (st.useGradient) {
      const grad = ctx.createLinearGradient(0, -totalH / 2, 0, totalH / 2);
      grad.addColorStop(0, st.fillColor || '#000000');
      grad.addColorStop(1, st.gradColor2 || '#ff0055');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = st.fillColor || '#000000';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = placements[i].y + (item.textOffsetY || 0);
      const lineX = offsetX + placements[i].x;

      if (st.strokeWidth > 0) {
        ctx.strokeStyle = st.strokeColor || '#ffffff';
        ctx.lineWidth = st.strokeWidth;
        ctx.strokeText(line, lineX, y);
      }

      ctx.fillText(line, lineX, y);

      if (st.underline || st.strike) {
        const w = ctx.measureText(line).width;
        ctx.save();
        ctx.strokeStyle = st.fillColor || '#000000';
        ctx.lineWidth = Math.max(2, fontSize * 0.07);
        if (st.underline) {
          ctx.beginPath();
          ctx.moveTo(lineX - w / 2, y + fontSize * 0.42);
          ctx.lineTo(lineX + w / 2, y + fontSize * 0.42);
          ctx.stroke();
        }
        if (st.strike) {
          ctx.beginPath();
          ctx.moveTo(lineX - w / 2, y);
          ctx.lineTo(lineX + w / 2, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.shadowBlur = 0;
  },

  renderSelectionHandles(ctx, w, h, scale) {
    const hw = w / 2;
    const hh = h / 2;
    ctx.strokeStyle = '#b4c5ff';
    ctx.lineWidth = 1.6 / scale;
    ctx.strokeRect(-hw, -hh, w, h);

    const rotDist = 26 / scale;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, -hh - rotDist);
    ctx.stroke();

    ctx.fillStyle = '#e2b7ff';
    ctx.beginPath();
    ctx.arc(0, -hh - rotDist, 6.5 / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const s = 8 / scale;
    const pts = [
      [-hw, -hh], [0, -hh], [hw, -hh],
      [-hw, 0],             [hw, 0],
      [-hw, hh],  [0, hh],  [hw, hh]
    ];
    ctx.fillStyle = '#151821';
    for (const [px, py] of pts) {
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
      ctx.strokeRect(px - s / 2, py - s / 2, s, s);
    }
  },

  hitTest(wx, wy, ignoreExistingText = false) {
    const scale = AppState.camera.scale;
    const sel = AppState.getSelectedItem();

    if (sel && !ignoreExistingText) {
      const g = this.getItemGlobalRect(sel);
      const local = this.worldToItemLocal(wx, wy, g, sel.angle || 0);
      const hw = sel.w / 2;
      const hh = sel.h / 2;
      const rotDist = 26 / scale;
      const tol = 10 / scale;

      if (Math.hypot(local.x, local.y - (-hh - rotDist)) <= tol) {
        return { item: sel, handle: 'rotate' };
      }

      const handles = [
        ['nw', -hw, -hh], ['n', 0, -hh], ['ne', hw, -hh],
        ['w', -hw, 0],                   ['e', hw, 0],
        ['sw', -hw, hh],  ['s', 0, hh],  ['se', hw, hh]
      ];
      for (const [name, hx, hy] of handles) {
        if (Math.abs(local.x - hx) <= tol && Math.abs(local.y - hy) <= tol) {
          return { item: sel, handle: name };
        }
      }
    }

    for (let i = AppState.items.length - 1; i >= 0; i--) {
      const it = AppState.items[i];
      if (ignoreExistingText && it.type === 'text') continue;

      const g = this.getItemGlobalRect(it);
      const local = this.worldToItemLocal(wx, wy, g, it.angle || 0);
      if (Math.abs(local.x) <= it.w / 2 && Math.abs(local.y) <= it.h / 2) {
        return { item: it, handle: 'body' };
      }
    }
    return null;
  },

  worldToItemLocal(wx, wy, gRect, angleDeg) {
    const dx = wx - gRect.cx;
    const dy = wy - gRect.cy;
    const rad = (-angleDeg * Math.PI) / 180;
    return {
      x: dx * Math.cos(rad) - dy * Math.sin(rad),
      y: dx * Math.sin(rad) + dy * Math.cos(rad)
    };
  },


});
