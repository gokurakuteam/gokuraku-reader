Object.assign(window.CanvasStrip, {
  async loadPageFiles(files, insertAtCurrentPosition = false, replaceChapter = false) {
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const results = [];
    for (const file of files) { try {
      const data = await this.readFileData(file);
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = data; });
      results.push({ status: 'fulfilled', value: { id: 'page_' + AppState.uid(), name: file.name, width: img.width, height: img.height,
        cleanImg: img, cleanDataUrl: data, origImg: null, origDataUrl: null, yOffset: 0 } });
      img.src = '';
      results[results.length - 1].value.cleanImg = null;
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (reason) { results.push({status:'rejected', reason}); } }
    const pages = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (replaceChapter && pages.length) {
      AppState.pages = []; AppState.items = []; AppState.selectedId = null;
      AppState.translations = []; AppState.activeTransIndex = -1;
      AppState.undoStack = []; AppState.redoStack = [];
      this.syncUIFromSelection(); this.renderTranslationList();
    }
    if (insertAtCurrentPosition && AppState.pages.length) {
      const current = AppState.getPageAtGlobalY(this.screenToWorld(0, this.canvas.clientHeight / 2).y);
      AppState.pages.splice(AppState.pages.indexOf(current) + 1, 0, ...pages);
    } else AppState.pages.push(...pages);
    AppState.recalcPageOffsets();
    if (AppState.pages.length) document.getElementById('floating-hint').style.display = 'none';
    this.requestRender();
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) AppDialogs.alert(`Не вдалося завантажити зображень: ${failed}.`);
  },

  async loadOrigFiles(files) {
    for (const file of files) {
      const base = file.name.replace(/\.[^.]+$/, '');
      const page = AppState.pages.find(p => p.name.replace(/\.[^.]+$/, '') === base);
      if (!page) continue;
      try {
        const data = await this.readFileData(file);
        const img = new Image();
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = data; });
        img.src = ''; page.origImg = null; page.origDataUrl = data;
        this.requestRender();
      } catch (error) { AppDialogs.alert(`Не вдалося завантажити ${file.name}`); }
    }
  },

  insertCurrentTranslationLine() {
    const item = AppState.getSelectedItem();
    if (!item) return AppDialogs.alert('Спочатку виберіть або намалюйте бабл на сторінці!');
    if (AppState.activeTransIndex < 0 || AppState.activeTransIndex >= AppState.translations.length) return;

    const entry = AppState.translations[AppState.activeTransIndex];
    if (!entry || entry.type === 'comment' || entry.type === 'page_header') return;

    AppState.saveSnapshot();

    const matchedPreset = AppState.presets.find(p => (p.autoTypes || (p.autoType && p.autoType !== 'none' ? [p.autoType] : [])).includes(entry.type));
    if (matchedPreset) {
      this.applyPresetObject(matchedPreset, true);
    }

    let text = entry.text;
    if (AppState.capsLockOnInsert) text = text.toUpperCase();

    item.rawText = text;
    item.manualTextLayout = false;
    AppState.autoFitItemText(item);

    AppState.activeTransIndex = AppState.findNextInsertableIndex(AppState.activeTransIndex);
    this.renderTranslationList();
    this.syncUIFromSelection();
    this.requestRender();
  },

  renderTranslationList() {
    const container = document.getElementById('translation-list');
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

      if (item.type !== 'comment' && !AppState.activeFilters[item.type]) return;

      const row = document.createElement('div');
      row.className = `trans-item type-${item.type} ${idx === AppState.activeTransIndex ? 'selected' : ''}`;
      row.innerHTML = `<i data-lucide="${iconMap[item.type] || 'circle'}" class="trans-badge"></i><span></span>`;
      row.querySelector('span').textContent = item.text;

      if (item.type !== 'comment') {
        row.addEventListener('click', () => {
          AppState.activeTransIndex = idx;
          this.renderTranslationList();
          this.requestRender();
        });
        row.addEventListener('dblclick', () => {
          AppState.activeTransIndex = idx;
          this.insertCurrentTranslationLine();
        });
      }
      container.appendChild(row);
    });

    this.refreshIcons();
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
      const meta = document.createElement('small');
      meta.textContent = `${p.font || 'Arial'} · ${(p.autoTypes || (p.autoType && p.autoType !== 'none' ? [p.autoType] : [])).map(type => ({bubble:'Бабл',panel:'Панель',bg:'Фон',thought:'Думки',sound:'Звук'})[type] || type).join(', ') || 'Вручну'}`;
      details.append(name, meta);
      const sample = document.createElement('span');
      sample.className = 'preset-sample';
      sample.textContent = 'Аа';
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

    document.getElementById('prop-fill-color').value = p.fill || '#000000';
    document.getElementById('prop-grad-color2').value = p.grad2 || '#ffffff';
    document.getElementById('prop-stroke-width').value = p.strokeWidth || 0;
    document.getElementById('prop-stroke-color').value = p.strokeColor || '#ffffff';
    document.getElementById('prop-glow-blur').value = p.glowBlur || 0;
    document.getElementById('prop-glow-color').value = p.glowColor || '#00e5ff';
    document.getElementById('toggle-bold').classList.toggle('active', !!p.bold);
    document.getElementById('toggle-italic').classList.toggle('active', !!p.italic);
    document.getElementById('toggle-underline').classList.toggle('active', !!p.underline);
    document.getElementById('toggle-strike').classList.toggle('active', !!p.strike);
    this.updateColorWells();
    if (updateSelected) this.applyUIStyleToSelected(false);
  },


});
