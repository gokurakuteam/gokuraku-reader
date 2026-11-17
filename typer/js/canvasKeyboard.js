Object.assign(window.CanvasStrip, {
  bindScrubbableNumbers() {
    document.querySelectorAll('[data-scrub]').forEach(lbl => {
      lbl.addEventListener('mousedown', (e) => {
        const target = document.getElementById(lbl.dataset.scrub);
        if (!target) return;
        const step = Number(lbl.dataset.step) || 1;
        const startX = e.clientX;
        const startVal = Number(target.value) || 0;

        const onMove = (me) => {
          const delta = Math.round((me.clientX - startX) / 3) * step;
          const val = Number((startVal + delta).toFixed(2));
          target.value = Math.min(Number(target.max || 999), Math.max(Number(target.min || -999), val));
          target.dispatchEvent(new Event('input'));
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  },

  showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
  },

  hideContextMenu() {
    document.getElementById('context-menu').hidden = true;
  },

  handleContextAction(action) {
    const item = AppState.getSelectedItem();
    if (!item) return;
    AppState.saveSnapshot();

    if (action === 'autofit') {
      AppState.autoFitItemText(item);
    } else if (action === 'center') {
      item.textOffsetX = 0;
      item.textOffsetY = 0;
    } else if (action === 'split-h') {
      const h = item.h / 2;
      item.h = h;
      const clone = JSON.parse(JSON.stringify(item));
      clone.id = AppState.uid();
      clone.y = item.y + h;
      AppState.items.push(clone);
    } else if (action === 'split-v') {
      const w = item.w / 2;
      item.w = w;
      const clone = JSON.parse(JSON.stringify(item));
      clone.id = AppState.uid();
      clone.x = item.x + w;
      AppState.items.push(clone);
    } else if (action === 'link-cluster') {
      const idx = AppState.items.indexOf(item);
      if (idx > 0) {
        const prev = AppState.items[idx - 1];
        const cid = prev.clusterId || AppState.uid();
        prev.clusterId = cid;
        item.clusterId = cid;
        AppState.autoFitItemText(item);
      }
    } else if (action === 'unlink-cluster') {
      item.clusterId = null;
    } else if (action === 'duplicate') {
      const clone = JSON.parse(JSON.stringify({ ...item, pngImg: undefined }));
      clone.id = AppState.uid();
      clone.x += 25;
      clone.y += 25;
      if (item.pngImg) clone.pngImg = item.pngImg;
      AppState.items.push(clone);
      AppState.selectedId = clone.id;
    } else if (action === 'delete') {
      AppState.items = AppState.items.filter(i => i.id !== item.id);
      AppState.selectedId = null;
    }
    this.syncUIFromSelection();
    this.requestRender();
  },

  bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.recordingHotkeyKey) {
        e.preventDefault();
        if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
        const hk = AppState.hotkeys[this.recordingHotkeyKey];
        hk.code = e.code;
        hk.shift = e.shiftKey;
        hk.ctrl = e.ctrlKey || e.metaKey;
        hk.label = `${hk.ctrl ? 'Ctrl+' : ''}${hk.shift ? 'Shift+' : ''}${e.code.replace('Key', '')}`;
        localStorage.setItem('typer_hotkeys', JSON.stringify(AppState.hotkeys));
        this.recordingHotkeyKey = null;
        this.openHotkeyModal();
        this.updateHotkeyLabels();
        return;
      }

      const inInput = ['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName);
      const matchHk = (hk) => e.code === hk.code && !!e.shiftKey === !!hk.shift && !!(e.ctrlKey || e.metaKey) === !!hk.ctrl;

      if (matchHk(AppState.hotkeys.insertNext)) {
        e.preventDefault();
        this.insertCurrentTranslationLine();
        return;
      }

      if (inInput) return;

      if (e.code === 'Space') this.spacePressed = true;

      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (AppState.presets[num]) {
          e.preventDefault();
          this.applyPresetObject(AppState.presets[num], true);
        }
        return;
      }

      if (matchHk(AppState.hotkeys.toolPointer)) this.setTool('pointer');
      else if (matchHk(AppState.hotkeys.toolBubble)) this.setTool('bubble');
      else if (matchHk(AppState.hotkeys.toolText)) this.setTool('text');
      else if (matchHk(AppState.hotkeys.toolEyedropper)) this.setTool('eyedropper');
      else if (matchHk(AppState.hotkeys.toolEraser)) this.setTool('eraser');
      else if (matchHk(AppState.hotkeys.peekOrig)) {
        AppState.peekOriginal = true;
        document.getElementById('btn-peek-orig').classList.add('active');
        this.requestRender();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        AppState.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        AppState.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        this.handleContextAction('duplicate');
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        this.handleContextAction('delete');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spacePressed = false;
      if (e.code === AppState.hotkeys.peekOrig.code) {
        AppState.peekOriginal = false;
        document.getElementById('btn-peek-orig').classList.remove('active');
        this.requestRender();
      }
    });
  },

  openHotkeyModal() {
    const modal = document.getElementById('hotkey-modal');
    const list = document.getElementById('hotkey-list');
    list.innerHTML = '';
    Object.entries(AppState.hotkeys).forEach(([key, hk]) => {
      const row = document.createElement('div');
      row.className = 'hotkey-row';
      const isRec = this.recordingHotkeyKey === key;
      row.innerHTML = `
        <span>${hk.title}</span>
        <button class="m3-btn m3-btn-sm ${isRec ? 'active' : ''}">${isRec ? 'Натисніть клавішу...' : hk.label}</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        this.recordingHotkeyKey = key;
        this.openHotkeyModal();
      });
      list.appendChild(row);
    });
    modal.hidden = false;
  },

  updateHotkeyLabels() {
    document.getElementById('lbl-insert-hotkey').textContent = AppState.hotkeys.insertNext.label;
  }
});
