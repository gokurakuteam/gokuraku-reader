Object.assign(window.CanvasStrip, {
  // --- ВКЛАДКИ ЛІВОЇ ПАНЕЛІ ТА НАОЧНИЙ ВИБІР ШРИФТІВ ---
  bindTabsAndCustomPickers() {
    document.querySelectorAll('.m3-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.m3-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    // Відкриття/закриття візуального списку шрифтів
    const trigger = document.getElementById('font-picker-trigger');
    const menu = document.getElementById('font-picker-menu');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    window.addEventListener('click', () => {
      menu.hidden = true;
    });
  },

  renderFontPicker() {
    const menu = document.getElementById('font-picker-menu');
    const currSpan = document.getElementById('font-picker-current');
    const font = AppState.currentFont;
    currSpan.style.fontFamily = `"${font}"`;
    currSpan.textContent = `${font} — АбвгҐґ`;

    const fontsKey = JSON.stringify(AppState.fonts);
    if (this.fontPickerFonts === fontsKey) {
      this.selectedFontOption?.classList.remove('active');
      this.selectedFontOption = this.fontPickerOptions.get(font);
      this.selectedFontOption?.classList.add('active');
      return;
    }
    this.fontPickerFonts = fontsKey;
    this.fontPickerOptions = new Map();
    this.selectedFontOption = null;
    menu.replaceChildren();
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'font-search';
    search.placeholder = 'Пошук шрифту';
    search.setAttribute('aria-label', 'Пошук шрифту');
    search.addEventListener('click', e => e.stopPropagation());
    search.addEventListener('input', () => {
      const query = search.value.toLocaleLowerCase().trim();
      for (const [fontName, option] of this.fontPickerOptions) {
        option.hidden = !fontName.toLocaleLowerCase().includes(query);
      }
    });
    menu.appendChild(search);
    AppState.fonts.forEach(fontName => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.dataset.font = fontName;
      this.fontPickerOptions.set(fontName, opt);
      opt.className = 'font-option';
      if (fontName === font) {
        this.selectedFontOption = opt;
        opt.classList.add('active');
      }
      opt.style.fontFamily = `"${fontName}"`;
      opt.textContent = `${fontName} — АбвгҐґ`;
      opt.addEventListener('click', () => {
        AppState.currentFont = fontName;
        this.renderFontPicker();
        this.applyUIStyleToSelected(false);
      });
      menu.appendChild(opt);
    });
  },

  updateColorWells() {
    document.getElementById('well-fill').style.background = document.getElementById('prop-fill-color').value;
    document.getElementById('quick-text-color').value = document.getElementById('prop-fill-color').value;
    document.getElementById('well-grad2').style.background = document.getElementById('prop-grad-color2').value;
    document.getElementById('well-stroke').style.background = document.getElementById('prop-stroke-color').value;
    document.getElementById('well-glow').style.background = document.getElementById('prop-glow-color').value;
    document.getElementById('chip-use-gradient').classList.toggle('active', AppState.useGradient);
  },

  createDefaultItem(type, pageId, x, y, w, h) {
    return {
      id: AppState.uid(),
      pageId,
      type,
      x,
      y,
      w,
      h,
      angle: 0,
      padding: Number(document.getElementById('prop-padding').value) || 14,
      autoFontLimits: document.getElementById('prop-auto-font-limits').checked,
      manualMinFont: Number(document.getElementById('prop-minfont').value)||24,
      manualMaxFont: Number(document.getElementById('prop-maxfont').value)||68,
      rawText: '',
      lines: [],
      clusterId: null,
      style: this.getStyleFromInputs()
    };
  },

  getStyleFromInputs() {
    return {
      fontFamily: AppState.currentFont || 'Arial',
      fontSize: Number(document.getElementById('prop-fontsize').value) || 42,
      uppercase: document.getElementById('toggle-caps').classList.contains('active'),
      textAlign: document.getElementById('prop-text-align').value,
      lineHeight: Number(document.getElementById('prop-lineheight').value) || 1.2,
      fillColor: document.getElementById('prop-fill-color').value || '#000000',
      useGradient: AppState.useGradient,
      gradColor2: document.getElementById('prop-grad-color2').value || '#ff0055',
      strokeWidth: Number(document.getElementById('prop-stroke-width').value) || 0,
      strokeRelative: document.getElementById('prop-stroke-relative').checked,
      strokeColor: document.getElementById('prop-stroke-color').value || '#ffffff',
      glowBlur: Number(document.getElementById('prop-glow-blur').value) || 0,
      glowColor: document.getElementById('prop-glow-color').value || '#00e5ff',
      bold: document.getElementById('toggle-bold').classList.contains('active'),
      italic: document.getElementById('toggle-italic').classList.contains('active'),
      underline: document.getElementById('toggle-underline').classList.contains('active'),
      strike: document.getElementById('toggle-strike').classList.contains('active')
    };
  },

  showLayoutStatus(item) {
    const textInput = document.getElementById('prop-text');
    const status = document.getElementById('text-layout-status');
    const message = item?.layoutError || '';
    textInput.title = message;
    textInput.setCustomValidity(message);
    if (status.textContent !== message) status.textContent = message;
    status.hidden = !message;
  },

  syncUIFromSelection() {
    const item = AppState.getSelectedItem();
    const txtArea = document.getElementById('prop-text');
    if (!item) {
      txtArea.value = '';
      this.showLayoutStatus();
      this.setCapsButton(AppState.capsLockOnInsert);
      return;
    }
    this.syncFontLimits(item);
    txtArea.value = item.rawText || '';
    this.showLayoutStatus(item);
    document.getElementById('prop-padding').value = item.padding ?? 14;
    document.getElementById('prop-angle').value = item.angle ?? 0;

    if (item.style) {
      const s = item.style;
      AppState.currentFont = s.fontFamily || 'Arial';
      AppState.useGradient = !!s.useGradient;
      this.renderFontPicker();

      document.getElementById('prop-fontsize').value = s.fontSize || 42;
      document.getElementById('prop-fontsize').title = item.fixedFontSize ? 'Ручний кегль. «Вписати» відновлює автопідбір.' : '';
      this.setCapsButton(!!s.uppercase);
      document.getElementById('prop-text-align').value = s.textAlign || 'center';
      this.syncAlignButtons?.();
      document.getElementById('prop-lineheight').value = s.lineHeight || 1.2;
      document.getElementById('prop-fill-color').value = s.fillColor || '#000000';
      document.getElementById('prop-grad-color2').value = s.gradColor2 || '#ff0055';
      document.getElementById('prop-stroke-width').value = s.strokeWidth || 0;
      document.getElementById('prop-stroke-relative').checked = !!s.strokeRelative;
      document.getElementById('prop-stroke-color').value = s.strokeColor || '#ffffff';
      document.getElementById('prop-glow-blur').value = s.glowBlur || 0;
      document.getElementById('prop-glow-color').value = s.glowColor || '#00e5ff';

      document.getElementById('toggle-bold').classList.toggle('active', !!s.bold);
      document.getElementById('toggle-italic').classList.toggle('active', !!s.italic);
      document.getElementById('toggle-underline').classList.toggle('active', !!s.underline);
      document.getElementById('toggle-strike').classList.toggle('active', !!s.strike);
      this.updateColorWells();
    }
  },

  setCapsButton(active) {
    const button = document.getElementById('toggle-caps');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  },

  syncFontLimits(item) {
    if(!item)return;
    const limits=TextEngine.fontLimits(item),auto=item.autoFontLimits!==false;
    document.getElementById('prop-auto-font-limits').checked=auto;
    for(const [id,key] of [['prop-minfont','minFont'],['prop-maxfont','maxFont']]) {
      const el=document.getElementById(id);el.disabled=auto;el.value=limits[key];
    }
  },

  applyUIStyleToSelected(saveToRecents = false, requestedSize = null) {
    this.updateColorWells();
    const item = AppState.getSelectedItem();
    const st = this.getStyleFromInputs();
    if (saveToRecents) AppState.addRecentStyle(st);
    if (!item) return;

    if (requestedSize !== null && (!Number.isFinite(requestedSize) || requestedSize < 0.25)) return;
    if (requestedSize !== null) {
      if (item.fixedFontSize !== requestedSize) {
        item.fixedFontSize = requestedSize;
        item.fixedFontOrder = Date.now();
      }
      document.getElementById('prop-fontsize').title = 'Ручний кегль. «Вписати» відновлює автопідбір.';
    }
    item.style = {...item.style, ...st, fontSize: requestedSize ?? item.style.fontSize ?? st.fontSize};
    item.padding = Number(document.getElementById('prop-padding').value) || 0;
    item.angle = Number(document.getElementById('prop-angle').value) || 0;
    if (item.type === 'bubble' || item.fixedFontSize) AppState.autoFitItemText(item);
    const fontInput = document.getElementById('prop-fontsize');
    if (requestedSize === null || Number(fontInput.value) !== item.style.fontSize) fontInput.value = item.style.fontSize;
    this.showLayoutStatus(item);
    this.markProjectChanged();
    this.requestRender();
  },

  pickColorFromCanvas(sx, sy) {
    const dpr = this.canvasDpr || 1;
    const x = Math.floor(sx * dpr), y = Math.floor(sy * dpr);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    if (!this.colorSampleCtx) {
      const sample = document.createElement('canvas');
      sample.width = sample.height = 1;
      this.colorSampleCtx = sample.getContext('2d', { willReadFrequently: true });
    }
    const sample = this.colorSampleCtx;
    sample.clearRect(0, 0, 1, 1);
    sample.drawImage(this.scanCanvas, x, y, 1, 1, 0, 0, 1, 1);
    sample.drawImage(this.canvas, x, y, 1, 1, 0, 0, 1, 1);
    const pixel = sample.getImageData(0, 0, 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('');
    document.getElementById('prop-fill-color').value = hex;
    this.applyUIStyleToSelected(true);
    this.setTool('pointer');
  },

  setTool(toolName) {
    AppState.activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
  },

  bindUIEvents() {
    document.getElementById('prop-auto-font-limits').addEventListener('change', e=>{
      const item=AppState.getSelectedItem();
      if(!item){for(const id of ['prop-minfont','prop-maxfont'])document.getElementById(id).disabled=e.target.checked;return;}
      AppState.saveSnapshot();
      if(!e.target.checked && item.manualMinFont==null) {
        const limits=TextEngine.fontLimits(item);item.manualMinFont=limits.minFont;item.manualMaxFont=limits.maxFont;
      }
      item.autoFontLimits=e.target.checked;
      AppState.autoFitItemText(item);this.syncUIFromSelection();this.markProjectChanged();this.requestRender();
    });
    for(const [id,key] of [['prop-minfont','manualMinFont'],['prop-maxfont','manualMaxFont']]) {
      document.getElementById(id).addEventListener('change',e=>{
        const item=AppState.getSelectedItem();if(!item || item.autoFontLimits!==false)return;
        AppState.saveSnapshot();item[key]=Math.max(1,Number(e.target.value)||1);
        AppState.autoFitItemText(item);this.syncUIFromSelection();this.markProjectChanged();this.requestRender();
      });
    }

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    const bindScanInput = (id, load) => {
      document.getElementById(id).addEventListener('change', e => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        if (!files.length) return;

        this.scanImport = (this.scanImport || Promise.resolve()).then(() => load(files)).catch(error =>
          AppDialogs.alert('Імпорт сканів не завершено: ' + error.message));
      });
    };
    bindScanInput('input-clean-files', files => this.loadPageFiles(files));
    bindScanInput('input-new-chapter', async files => {
      if ((AppState.pages.length || AppState.items.length) && !await AppDialogs.confirm('Почати новий розділ? Поточні сторінки, об’єкти та переклад буде замінено. Збережіть проєкт, якщо хочете повернутися до нього.')) return;
      await this.loadPageFiles(files, false, true);
    });
    bindScanInput('input-orig-files', files => this.loadOrigFiles(files));
    bindScanInput('input-insert-page', files => this.loadPageFiles(files, true));

    document.getElementById('input-png-layer').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const centerWorld = this.screenToWorld(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
          const page = AppState.getPageAtGlobalY(centerWorld.y) || AppState.pages[0];
          if (!page) return AppDialogs.alert('Спочатку завантажте хоча б одну сторінку скану!');
          AppState.saveSnapshot();
          const w = Math.min(page.width * 0.8, img.width);
          const h = (img.height / img.width) * w;
          const pngItem = {
            id: AppState.uid(),
            pageId: page.id,
            type: 'png',
            x: (page.width - w) / 2,
            y: Math.max(0, centerWorld.y - page.yOffset - h / 2),
            w,
            h,
            angle: 0,
            pngImg: img,
            pngDataUrl: reader.result,
            style: {}
          };
          AppState.items.push(pngItem);
          AppState.selectedId = pngItem.id;
          this.setTool('pointer');
          this.markProjectChanged();
          this.requestRender();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    // Завантаження локальних шрифтів з миттєвим візуальним прев'ю
    document.getElementById('input-fonts').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        try { await FontLibrary.add(file); AppState.currentFont = file.name.replace(/\.[^.]+$/, ''); }
        catch (error) { await AppDialogs.alert(`Не вдалося зберегти шрифт ${file.name}: ${error.message}`); }
      }
      e.target.value = '';
      this.renderFontPicker();
      this.applyUIStyleToSelected();
    });

    document.getElementById('prop-text').addEventListener('input', (e) => {
      const item = AppState.getSelectedItem();
      if (!item) return;
      item.rawText = e.target.value;
      item.lines = e.target.value.split('\n');
      if (item.type === 'bubble' || item.fixedFontSize) AppState.autoFitItemText(item);
      document.getElementById('prop-fontsize').value = item.style.fontSize;
      this.showLayoutStatus(item);
      this.markProjectChanged();
      this.requestRender();
    });

    document.getElementById('btn-autofit').addEventListener('click', () => {
      const item = AppState.getSelectedItem();
      if (!item) return;
      AppState.saveSnapshot();
      AppState.resetItemTextLayout(item);
      this.markProjectChanged();
      this.syncUIFromSelection();
      this.requestRender();
    });

    ['toggle-bold', 'toggle-italic', 'toggle-underline', 'toggle-strike'].forEach(id => {
      document.getElementById(id).addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
        this.applyUIStyleToSelected();
      });
    });

    document.getElementById('toggle-caps').addEventListener('click', (e) => {
      const active = !e.currentTarget.classList.contains('active');
      this.setCapsButton(active);
      if (AppState.getSelectedItem()) {
        AppState.saveSnapshot();
        this.applyUIStyleToSelected();
      } else AppState.capsLockOnInsert = active;
    });

    const alignSelect = document.getElementById('prop-text-align');
    const syncAlign = () => document.querySelectorAll('[data-align]').forEach(b => { const active = b.dataset.align === alignSelect.value; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => { alignSelect.value = b.dataset.align; alignSelect.dispatchEvent(new Event('change')); }));
    new MutationObserver(syncAlign).observe(alignSelect, { attributes: true });
    this.syncAlignButtons = syncAlign; syncAlign();
    document.getElementById('prop-stroke-relative').addEventListener('change', () => { if (AppState.getSelectedItem()) AppState.saveSnapshot(); this.applyUIStyleToSelected(); });
    document.getElementById('prop-text-align').addEventListener('change', () => {
      syncAlign();
      if (AppState.getSelectedItem()) AppState.saveSnapshot();
      this.applyUIStyleToSelected();
    });

    document.getElementById('toggle-center-snap').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active');
      AppState.centerSnap = e.currentTarget.classList.contains('active');
    });

    document.getElementById('chip-use-gradient').addEventListener('click', () => {
      AppState.useGradient = !AppState.useGradient;
      this.applyUIStyleToSelected(true);
    });

    const fontSize = document.getElementById('prop-fontsize');
    fontSize.addEventListener('focus', () => {
      if (AppState.getSelectedItem()) AppState.saveSnapshot();
    });
    fontSize.addEventListener('blur', () => {
      const item = AppState.getSelectedItem();
      if (item) fontSize.value = item.style.fontSize;
    });

    ['prop-fontsize', 'prop-padding', 'prop-lineheight', 'prop-angle'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        const item=AppState.getSelectedItem();
        if(item && id==='prop-padding') item.autoPadding=false;
        this.applyUIStyleToSelected(false,id==='prop-fontsize'?Number(document.getElementById(id).value):null);
      });
    });

    ['prop-fill-color', 'prop-grad-color2', 'prop-stroke-width', 'prop-stroke-color', 'prop-glow-blur', 'prop-glow-color'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.applyUIStyleToSelected(false));
      document.getElementById(id).addEventListener('change', () => this.applyUIStyleToSelected(true));
    });

    const peekBtn = document.getElementById('btn-peek-orig');
    peekBtn.addEventListener('click', () => {
      AppState.peekOriginal = !AppState.peekOriginal;
      this.updateOriginalView();
    });

    document.getElementById('btn-undo').addEventListener('click', () => AppState.undo());
    document.getElementById('btn-redo').addEventListener('click', () => AppState.redo());
    document.getElementById('zoom-label').addEventListener('click', () => {
      AppState.camera.scale = 1;
      document.getElementById('zoom-label').textContent = '100%';
      this.requestRender();
    });

    document.getElementById('btn-save-preset').addEventListener('click', async () => {
      const s = this.getStyleFromInputs();
      const preset = await AppDialogs.editStyle({
        name: `Мій стиль ${AppState.presets.length + 1}`, autoTypes: [],
        font: s.fontFamily,
        fill: s.fillColor, useGrad: s.useGradient, grad2: s.gradColor2,
        strokeWidth: s.strokeWidth, strokeRelative: s.strokeRelative, strokeColor: s.strokeColor,
        glowBlur: s.glowBlur, glowColor: s.glowColor, bold: s.bold,
        italic: s.italic, underline: s.underline, strike: s.strike, uppercase: s.uppercase
      });
      if (!preset) return;
      AppState.presets.forEach(other => {
        other.autoTypes = (other.autoTypes || (other.autoType && other.autoType !== 'none' ? [other.autoType] : [])).filter(type => !preset.autoTypes.includes(type));
        delete other.autoType;
      });
      AppState.presets.push(preset);
      StyleLibrary.save();
      this.renderPresets();
      this.requestRender();
    });

    document.getElementById('btn-parse-manual').addEventListener('click', () => {
      const raw = document.getElementById('manual-trans-input').value;
      if (!raw.trim()) return;
      AppState.parseTranslationText(raw);
      this.markProjectChanged();
      this.renderTranslationList();
      this.requestRender();
    });

    document.getElementById('input-trans-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      const text = await file.text();
      AppState.parseTranslationText(text);
      this.markProjectChanged();
      this.renderTranslationList();
      this.requestRender();
    });

    // Фільтри типів баблів через M3 Chips
    document.querySelectorAll('#filter-chips .m3-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const type = chip.dataset.filter;
        const hadInsertable = AppState.translations.some(item => AppState.isInsertableTranslation(item));
        AppState.activeFilters[type] = chip.classList.contains('active');
        const active = AppState.translations[AppState.activeTransIndex];
        if (active && !AppState.isInsertableTranslation(active)) {
          const next = AppState.findNextInsertableIndex(AppState.activeTransIndex);
          if (next >= 0) AppState.activeTransIndex = next;
        }
        if (!hadInsertable && AppState.activeTransIndex < 0) AppState.activeTransIndex = AppState.findNextInsertableIndex(-1);
        this.markProjectChanged();
        this.renderTranslationList();
        this.requestRender();
      });
    });

    document.getElementById('btn-insert-line').addEventListener('click', () => this.insertCurrentTranslationLine());

    document.getElementById('context-menu').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-action]');
      if (li) this.handleContextAction(li.dataset.action);
      this.hideContextMenu();
    });

    document.getElementById('btn-hotkeys').addEventListener('click', () => this.openHotkeyModal());
    document.getElementById('btn-close-hotkeys').addEventListener('click', () => {
      document.getElementById('hotkey-modal').hidden = true;
      this.recordingHotkeyKey = null;
    });

    document.getElementById('btn-save-project').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const data = JSON.stringify(await this.exportProjectData());
        this.downloadBlob(new Blob([data], { type: 'application/json' }), 'project.typer.json');
      } catch (error) {
        await AppDialogs.alert('Не вдалося зберегти проєкт: ' + error.message);
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('input-load-project').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      this.scanImport = (this.scanImport || Promise.resolve())
        .then(async () => this.loadProject(JSON.parse(await file.text())))
        .catch(error => AppDialogs.alert('Не вдалося відкрити проєкт: ' + error.message));
    });

    document.getElementById('btn-restore-project').addEventListener('click', () => {
      this.scanImport = (this.scanImport || Promise.resolve()).then(async () => {
        const previous = await this.readDraft('previous');
        if (!previous) return AppDialogs.alert('Резервної копії ще немає.');
        await this.loadProject(previous, true);
      }).catch(error => AppDialogs.alert('Не вдалося відновити проєкт: ' + error.message));
    });
  },


});

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('project-name').addEventListener('input', () => CanvasStrip.markProjectChanged());
  document.getElementById('quick-text-color').addEventListener('input', e => { const input = document.getElementById('prop-fill-color'); input.value = e.target.value; input.dispatchEvent(new Event('input', { bubbles: true })); });
});
