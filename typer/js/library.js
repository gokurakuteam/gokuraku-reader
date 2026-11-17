(() => {
  const key = 'typer_style_folders_v1';
  let state;
  try { state = JSON.parse(localStorage.getItem(key)); } catch (_) {}
  if (!state || !Array.isArray(state.folders) || !state.folders.length) {
    state = { active: 'default', folders: [{ id: 'default', name: 'Основна', presets: AppState.presets }] };
  }
  if (!state.folders.some(f => f.id === state.active)) state.active = state.folders[0].id;
  const current = () => state.folders.find(f => f.id === state.active);
  const save = () => { current().presets = AppState.presets; localStorage.setItem(key, JSON.stringify(state)); };
  const refresh = () => {
    const select = document.getElementById('style-folder-select');
    select.replaceChildren();
    state.folders.forEach(folder => { const option = document.createElement('option'); option.value = folder.id; option.textContent = folder.name; select.append(option); });
    select.value = state.active;
    window.CanvasStrip.renderPresets();
  };
  const selectFolder = id => { state.active = id; AppState.presets = current().presets; save(); refresh(); };
  AppState.presets = current().presets;
  window.StyleLibrary = { save, refresh, replacePresets(presets) { AppState.presets = presets; save(); refresh(); } };
  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    document.getElementById('style-folder-select').addEventListener('change', e => selectFolder(e.target.value));
    document.getElementById('folder-create').addEventListener('click', async () => {
      const name = await AppDialogs.text('Назва нової теки'); if (!name) return;
      const folder = { id: crypto.randomUUID(), name, presets: [] }; state.folders.push(folder); selectFolder(folder.id);
    });
    document.getElementById('folder-rename').addEventListener('click', async () => {
      const name = await AppDialogs.text('Назва теки', current().name); if (!name) return; current().name = name; save(); refresh();
    });
    document.getElementById('folder-delete').addEventListener('click', async () => {
      if (state.folders.length === 1) { await AppDialogs.alert('Потрібно залишити хоча б одну теку.'); return; }
      if (!await AppDialogs.confirm(`Видалити теку «${current().name}» та всі її стилі?`)) return;
      state.folders = state.folders.filter(f => f.id !== state.active); selectFolder(state.folders[0].id);
    });
    document.getElementById('folder-export').addEventListener('click', async () => {
      try {
        const folder = current();
        const used = new Set(folder.presets.map(p => p.font).filter(Boolean));
        const stored = await FontLibrary.list();
        const fonts = stored.filter(font => used.has(font.name)).map(font => ({ name: font.name, data: FontLibrary.encode(font.buffer) }));
        const blob = new Blob([JSON.stringify({format:'typer-style-folder', version:2, name:folder.name, presets:folder.presets, fonts}, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${folder.name.replace(/[\\/<>:"|?*]/g, '_')}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { await AppDialogs.alert(`Не вдалося експортувати теку: ${error.message}`); }
    });
    document.getElementById('folder-import').addEventListener('change', async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.format !== 'typer-style-folder' || ![1, 2].includes(data.version) || typeof data.name !== 'string' || !Array.isArray(data.presets) || !data.presets.every(p => p && typeof p === 'object' && typeof p.name === 'string')) throw new Error('Невірний формат теки стилів');
        if (data.version === 2) {
          if (!Array.isArray(data.fonts) || !data.fonts.every(font => font && typeof font.name === 'string' && font.name.trim() && typeof font.data === 'string')) throw new Error('Невірний список шрифтів');
          const mapping = await FontLibrary.importFonts(data.fonts);
          data.presets.forEach(preset => { if (mapping.has(preset.font)) preset.font = mapping.get(preset.font); });
        }
        const folder = { id: crypto.randomUUID(), name: data.name, presets: data.presets }; state.folders.push(folder); selectFolder(folder.id);
        window.CanvasStrip.renderFontPicker(); window.CanvasStrip.requestRender();
      } catch (error) { await AppDialogs.alert(`Не вдалося імпортувати теку: ${error.message}`); }
    });
  });
})();

window.FontLibrary = {
  db() { return new Promise((resolve, reject) => { const req = indexedDB.open('typer-fonts', 1); req.onupgradeneeded = () => req.result.createObjectStore('fonts', {keyPath:'name'}); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); },
  async install(name, buffer) { const face = new FontFace(name, buffer); await face.load(); document.fonts.add(face); if (!AppState.fonts.includes(name)) AppState.fonts.unshift(name); },
  encode(buffer) { const bytes = new Uint8Array(buffer); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); },
  decode(data) { const binary = atob(data); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes.buffer; },
  async list() { const db = await this.db(); try { return await new Promise((resolve, reject) => { const req = db.transaction('fonts').objectStore('fonts').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); } finally { db.close(); } },
  async importFonts(fonts) {
    const existing = await this.list(); const names = new Set([...AppState.fonts, ...existing.map(font => font.name)]); const mapping = new Map(); const prepared = [];
    for (const item of fonts) {
      if (mapping.has(item.name)) throw new Error('Повторна назва шрифту в теці');
      const buffer = this.decode(item.data);
      const match = existing.find(font => font.name === item.name && this.encode(font.buffer) === item.data);
      if (match) { if (!AppState.fonts.includes(item.name)) await this.install(item.name, match.buffer); mapping.set(item.name, item.name); continue; }
      let name = item.name, suffix = 2; while (names.has(name)) name = `${item.name} (імпорт ${suffix++})`;
      const face = new FontFace(name, buffer); await face.load();
      names.add(name); mapping.set(item.name, name); prepared.push({ name, buffer, face });
    }
    if (prepared.length) { const db = await this.db(); try { await new Promise((resolve, reject) => { const tx = db.transaction('fonts', 'readwrite'); prepared.forEach(font => tx.objectStore('fonts').put({ name: font.name, buffer: font.buffer })); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); } }
    prepared.forEach(font => { document.fonts.add(font.face); AppState.fonts.unshift(font.name); });
    return mapping;
  },
  async add(file) { const name = file.name.replace(/\.[^.]+$/, ''); const buffer = await file.arrayBuffer(); await this.install(name, buffer); const db = await this.db(); try { await new Promise((resolve, reject) => { const tx = db.transaction('fonts', 'readwrite'); tx.objectStore('fonts').put({name, buffer}); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); } finally { db.close(); } },
  async restore() { const db = await this.db(); let fonts; try { fonts = await new Promise((resolve, reject) => { const req = db.transaction('fonts').objectStore('fonts').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); } finally { db.close(); } for (const font of fonts) { try { await this.install(font.name, font.buffer); } catch (error) { console.error('Не вдалося відновити шрифт', font.name, error); } } window.CanvasStrip.renderFontPicker(); window.CanvasStrip.requestRender(); }
};
window.addEventListener('DOMContentLoaded', () => { FontLibrary.restore().catch(error => { console.error(error); AppDialogs.alert('Не вдалося відновити збережені шрифти.'); }); });
