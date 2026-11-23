Object.assign(window.CanvasStrip, {
  async expandScanFiles(files) {
    const images = [];
    const errors = [];
    const imageType = /\.(avif|bmp|gif|ico|jpe?g|jxl|png|svg|webp)$/i;
    for (const file of files) {
      if (!/\.zip$/i.test(file.name)) {
        images.push(file);
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const content = await new Promise((resolve, reject) => {
          fflate.unzip(bytes, {
            filter: ({name}) => {
              const parts = name.split('/');
              return imageType.test(name) && !parts.some(part => part.startsWith('.') || part === '__MACOSX');
            }
          }, (error, entries) => error ? reject(error) : resolve(entries));
        });
        const entries = Object.entries(content);
        if (!entries.length) throw new Error('в архіві немає зображень');
        for (const [path, bytes] of entries) {
          const name = path.split('/').pop();
          const ext = name.match(imageType)[1].toLowerCase();
          const type = {jpg:'jpeg', svg:'svg+xml', ico:'x-icon'}[ext] || ext;
          images.push(new File([bytes], name, {type: 'image/' + type}));
        }
      } catch (error) {
        errors.push(`${file.name} — ${error.message}`);
      }
    }
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    return {images, errors};
  },

  async loadPageFiles(files, insertAtCurrentPosition = false, replaceChapter = false) {
    const {images, errors} = await this.expandScanFiles(files);
    const pages = [];
    let failed = 0;
    for (const file of images) {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);
        try {
          img.src = url;
          await img.decode();
          pages.push({
            id: 'page_' + AppState.uid(), name: file.name, width: img.naturalWidth, height: img.naturalHeight,
            cleanImg: null, cleanBlob: file, origImg: null, origBlob: null, yOffset: 0
          });
        } finally {
          img.src = '';
          URL.revokeObjectURL(url);
        }
      } catch {
        failed++;
      }
    }
    if (replaceChapter && pages.length) {
      const revision = this.projectRevision;
      await this.backupProject();
      if (revision !== this.projectRevision || this.dragState) throw new Error('Розділ змінився під час резервного копіювання. Спробуйте ще раз.');
      if (this.editingItem) this.closeInlineEditor();
      this.releasePageImages();
      AppState.pages = []; AppState.items = []; AppState.selectedId = null;
      if (this.wheelMotion?.frame) cancelAnimationFrame(this.wheelMotion.frame);
      this.wheelMotion = null;
      this.cancelBrushStroke?.();
      this.dragState = null;
      this.snapGuideX = null;
      AppState.camera.x = 150;
      AppState.camera.y = 28;
      AppState.peekOriginal = false;
      AppState.holdOriginal = false;
      this.updateOriginalView();
      AppState.translations = []; AppState.activeTransIndex = -1;
      AppState.undoStack = []; AppState.redoStack = [];
      this.syncUIFromSelection(); this.renderTranslationList();
    }
    if (insertAtCurrentPosition && AppState.pages.length) {
      const current = AppState.getPageAtGlobalY(this.screenToWorld(0, this.canvas.clientHeight / 2).y);
      AppState.pages.splice(AppState.pages.indexOf(current) + 1, 0, ...pages);
    } else AppState.pages.push(...pages);
    AppState.recalcPageOffsets();
    if (pages.length) {
      document.getElementById('floating-hint').style.display = 'none';
      this.markProjectChanged();
    }
    this.requestRender();
    if (failed) errors.push(`Не вдалося завантажити зображень: ${failed}.`);
    if (errors.length) await AppDialogs.alert(errors.join('\n'));
  },

  async loadOrigFiles(files) {
    const pages = [...AppState.pages];
    const {images, errors} = await this.expandScanFiles(files);
    const stem = name => name.replace(/\.[^.]+$/, '').normalize('NFC').toLowerCase();
    const available = new Set(pages);
    const pairs = [];
    const unmatched = [];
    for (const file of images) {
      const page = [...available].find(p => stem(p.name) === stem(file.name));
      if (page) {
        pairs.push([page, file]);
        available.delete(page);
      } else unmatched.push(file);
    }
    if (images.length === pages.length) {
      [...available].forEach((page, i) => pairs.push([page, unmatched[i]]));
      unmatched.length = 0;
    }
    if (unmatched.length) errors.push(`Без відповідного кліну: ${unmatched.map(file => file.name).join(', ')}.`);

    for (const [page, file] of pairs) {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);
        try {
          img.src = url;
          await img.decode();
        } finally {
          img.src = '';
          URL.revokeObjectURL(url);
        }
        if (!AppState.pages.includes(page)) break;
        this.clearPageImage(page, 'origImg');
        page.origBlob = file;
        this.invalidateScanLayer();
        this.markProjectChanged();
        this.requestRender();
      } catch {
        errors.push(`Не вдалося завантажити ${file.name}.`);
      }
    }
    if (errors.length) await AppDialogs.alert(errors.join('\n'));
  },

  updateOriginalView() {
    if (AppState.showingOriginal) this.cancelBrushStroke?.();
    const button = document.getElementById('btn-peek-orig');
    button.classList.toggle('active', AppState.showingOriginal);
    button.setAttribute('aria-pressed', AppState.showingOriginal);
    this.requestRender();
  },

  insertCurrentTranslationLine(index = AppState.activeTransIndex) {
    if (AppState.showingOriginal) return;
    const item = AppState.getSelectedItem();
    if (!item || item.type === 'png') return AppDialogs.alert('Спочатку виберіть або намалюйте бабл на сторінці!');
    if (index < 0 || index >= AppState.translations.length) return;

    const entry = AppState.translations[index];
    if (!entry || !AppState.isInsertableTranslation(entry)) return;

    AppState.saveSnapshot(true);

    const matchedPreset = AppState.presets.find(p => (p.autoTypes || (p.autoType && p.autoType !== 'none' ? [p.autoType] : [])).includes(entry.type));
    item.rawText = entry.text;
    delete item.textFormats;
    item.manualTextLayout = false;
    if (matchedPreset) this.applyPresetObject(matchedPreset, true);
    if (!matchedPreset || (item.type !== 'bubble' && !item.fixedFontSize)) AppState.autoFitItemText(item);

    AppState.activeTransIndex = item.lines?.some(line => line.trim()) ? AppState.findNextInsertableIndex(index) : index;
    this.markProjectChanged();
    this.updateTranslationSelection();
    this.syncUIFromSelection();
    this.requestRender();
  },

  renderTranslationList() {
    const container = document.getElementById('translation-list');
    const previousScroll = container.scrollTop;
    this.translationRows = new Map();
    this.selectedTranslationRow = null;
    container.innerHTML = '';
    const iconMap = {
      bubble: 'message-circle',
      panel: 'square',
      bg: 'cloud',
      thought: 'sparkles',
      sound: 'zap',
      comment: 'hash'
    };

    AppState.translations.forEach((item, idx) => {
      if (item.type === 'page_header') {
        const div = document.createElement('div');
        div.className = 'trans-page-divider';
        div.innerHTML = `<i data-lucide="book-open"></i> <span></span>`;
        div.querySelector('span').textContent = item.text;
        container.appendChild(div);
        return;
      }

      if (!AppState.activeFilters[item.type]) return;

      const row = document.createElement('div');
      row.className = `trans-item type-${item.type}`;
      this.translationRows.set(idx, row);
      row.innerHTML = `<i data-lucide="${iconMap[item.type] || 'circle'}" class="trans-badge"></i><span></span>`;
      row.querySelector('span').textContent = item.text;

      if (item.type === 'comment') row.title = 'Коментар перекладача';
      else {
        row.addEventListener('click', () => {
          AppState.activeTransIndex = idx;
          this.updateTranslationSelection(false);
          this.markProjectChanged();
          this.requestRender();
        });
        row.addEventListener('dblclick', () => {
          this.insertCurrentTranslationLine(idx);
        });
      }
      container.appendChild(row);
    });

    this.refreshIcons();
    container.scrollTop = AppState.translations.length ? previousScroll : 0;
    this.updateTranslationSelection();
  },

  updateTranslationSelection(scroll = true) {
    const container = document.getElementById('translation-list');
    const selected = this.translationRows?.get(AppState.activeTransIndex);
    if (this.selectedTranslationRow !== selected) {
      this.selectedTranslationRow?.classList.remove('selected');
      selected?.classList.add('selected');
      this.selectedTranslationRow = selected;
    }
    if (scroll && selected) {
      const list = container.getBoundingClientRect();
      const row = selected.getBoundingClientRect();
      if (row.top < list.top || row.bottom > list.bottom) {
        container.scrollTop += row.top - list.top - (list.height - row.height) / 2;
      }
    }
    this.updateTranslationProgress();
  },

  updateTranslationProgress() {
    let total = 0, remaining = 0;
    AppState.translations.forEach((item, index) => {
      if (!AppState.isInsertableTranslation(item)) return;
      total++;
      if (AppState.activeTransIndex >= 0 && index >= AppState.activeTransIndex) remaining++;
    });
    const percent = total ? Math.floor(100 * (total - remaining) / total) : 0;
    document.getElementById('translation-progress').value = percent;
    document.getElementById('translation-progress-label').textContent = `${percent}% · Попереду ${remaining}`;
  },

  renderRecentSwatches() {
    const box = document.getElementById('recent-swatches');
    box.innerHTML = '';
    AppState.recents.forEach(r => {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = r.useGradient ? `linear-gradient(180deg, ${r.fill}, ${r.grad2})` : r.fill;
      if (r.strokeWidth > 0) sw.style.border = `2px solid ${r.stroke}`;
      if (r.glowBlur > 0) sw.style.boxShadow = `0 0 6px ${r.glowColor}`;
      sw.title = 'Клік — застосувати збережений колір/градієнт';
      sw.addEventListener('click', () => {
        document.getElementById('prop-fill-color').value = r.fill;
        AppState.useGradient = !!r.useGradient;
        if (r.grad2) document.getElementById('prop-grad-color2').value = r.grad2;
        document.getElementById('prop-stroke-width').value = r.strokeWidth || 0;
        document.getElementById('prop-stroke-color').value = r.stroke || '#ffffff';
        document.getElementById('prop-glow-blur').value = r.glowBlur || 0;
        document.getElementById('prop-glow-color').value = r.glowColor || '#00e5ff';
        this.applyUIStyleToSelected(false);
      });
      box.appendChild(sw);
    });
  },

  renderPresets() {
    const box = document.getElementById('preset-list');
    box.innerHTML = '';
    const shortcuts = document.getElementById('style-shortcuts');
    shortcuts.replaceChildren();
    AppState.presets.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'preset-item';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'preset-apply';
      const badge = document.createElement('span');
      badge.className = 'preset-key';
      badge.textContent = idx < 9 ? idx + 1 : '•';
      const details = document.createElement('span');
      details.className = 'preset-details';
      const name = document.createElement('strong');
      name.textContent = p.name.replace(/^\d+\.\s*/, '');
      const entry = document.createElement('li');
      const shortcut = document.createElement('button');
      shortcut.type = 'button';
      if (idx < 9) {
        const key = document.createElement('kbd');
        key.textContent = idx + 1;
        shortcut.append(key);
      }
      shortcut.append(name.textContent);
      shortcut.addEventListener('click', () => this.applyPresetObject(p, true));
      entry.append(shortcut);
      shortcuts.append(entry);
      const meta = document.createElement('small');
      meta.textContent = `${p.font || 'Arial'} · ${(p.autoTypes || (p.autoType && p.autoType !== 'none' ? [p.autoType] : [])).map(type => ({bubble:'Бабл',panel:'Панель',bg:'Фон',thought:'Думки',sound:'Звук'})[type] || type).join(', ') || 'Вручну'}`;
      details.append(name, meta);
      const sample = document.createElement('span');
      sample.className = 'preset-sample';
      sample.textContent = p.uppercase ? 'АА' : 'Аа';
      sample.style.fontFamily = p.font || 'Arial';
      sample.style.color = p.fill || '#000000';
      sample.style.fontWeight = p.bold ? 'bold' : 'normal';
      sample.style.fontStyle = p.italic ? 'italic' : 'normal';
      apply.append(badge, details, sample);
      apply.addEventListener('click', () => this.applyPresetObject(p, true));
      const actions = document.createElement('div');
      actions.className = 'preset-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Редагувати';
      edit.title = 'Редагувати налаштування стилю';
      edit.addEventListener('click', async () => {
        const changes = await AppDialogs.editStyle(p);
        if (!changes) return;
        Object.assign(p, changes);
        AppState.presets.forEach(other => {
          if (other === p) return;
          other.autoTypes = (other.autoTypes || (other.autoType && other.autoType !== 'none' ? [other.autoType] : [])).filter(type => !p.autoTypes.includes(type));
          delete other.autoType;
        });
        delete p.autoType;
        StyleLibrary.save();
        this.renderPresets();
        this.requestRender();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Видалити';
      remove.className = 'preset-delete';
      remove.addEventListener('click', async () => {
        if (!await AppDialogs.confirm(`Видалити стиль «${p.name}»?`)) return;
        AppState.presets.splice(idx, 1);
        StyleLibrary.save();
        this.renderPresets();
      });
      actions.append(edit, remove);
      row.append(apply, actions);
      box.appendChild(row);
    });
  },

  applyPresetObject(p, updateSelected = true) {
    AppState.currentFont = p.font || 'Arial';
    AppState.useGradient = !!p.useGrad;
    this.renderFontPicker();

    const padding = document.getElementById('prop-padding');
    if (p.padding !== undefined || p.autoPadding !== undefined) {
      const auto = p.autoPadding !== false || !Number.isFinite(p.padding);
      document.getElementById('prop-auto-padding').checked = auto;
      padding.disabled = auto;
      padding.value = Number.isFinite(p.padding) ? Math.max(0, p.padding) : 14;
    }
    document.getElementById('prop-fill-color').value = p.fill || '#000000';
    document.getElementById('prop-grad-color2').value = p.grad2 || '#ffffff';
    document.getElementById('prop-stroke-width').value = p.strokeWidth || 0;
    document.getElementById('prop-stroke-relative').checked = !!p.strokeRelative;
    document.getElementById('prop-stroke-color').value = p.strokeColor || '#ffffff';
    document.getElementById('prop-glow-blur').value = p.glowBlur || 0;
    document.getElementById('prop-glow-color').value = p.glowColor || '#00e5ff';
    document.getElementById('toggle-bold').classList.toggle('active', !!p.bold);
    document.getElementById('toggle-italic').classList.toggle('active', !!p.italic);
    document.getElementById('toggle-underline').classList.toggle('active', !!p.underline);
    document.getElementById('toggle-strike').classList.toggle('active', !!p.strike);
    if (p.uppercase != null) this.setCapsButton(p.uppercase);
    this.updateColorWells();
    if (updateSelected) this.applyUIStyleToSelected(false);
  },


});
