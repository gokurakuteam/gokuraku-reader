Object.assign(window.CanvasStrip, {
  projectData() {
    return {
      pages: AppState.pages.map(({ id, name, width, height, cleanDataUrl, origDataUrl }) =>
        ({ id, name, width, height, cleanDataUrl, origDataUrl })),
      items: AppState.items.map(i => ({ ...i, pngImg: undefined })),
      translations: AppState.translations,
      activeTransIndex: AppState.activeTransIndex,
      presets: AppState.presets
    };
  },

  draftDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('typer-draft', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('draft');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveDraft() {
    if (this.savingDraft) { this.draftAgain = true; return; }
    const signature = JSON.stringify({items: AppState.items.map(i=>({...i,pngImg:undefined})),
      translations:AppState.translations,activeTransIndex:AppState.activeTransIndex,presets:AppState.presets});
    const sources = AppState.pages.map(p=>[p.id,p.name,p.width,p.height,p.cleanDataUrl,p.origDataUrl]);
    if (signature === this.draftSignature && sources.length === this.draftSources?.length &&
        sources.every((p,i)=>p.every((v,j)=>v===this.draftSources[i][j]))) return;
    this.savingDraft = true;
    try {
      const db = await this.draftDB();
      const tx = db.transaction('draft', 'readwrite');
      tx.objectStore('draft').put(this.projectData(), 'current');
      await new Promise((resolve,reject) => {
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      }).finally(()=>db.close());
      this.draftSignature = signature; this.draftSources = sources;
    } catch (error) { console.error('Не вдалося зберегти чернетку', error); }
    finally {
      this.savingDraft = false;
      if (this.draftAgain) { this.draftAgain=false; this.saveDraft(); }
    }
  },

  async restoreDraft() {
    try {
      const db = await this.draftDB();
      const data = await new Promise((resolve, reject) => {
        const request = db.transaction('draft').objectStore('draft').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (data) await this.loadProject(data, true);
    } catch (error) { console.error('Не вдалося відновити чернетку', error); }
    this.draftReady = true;
  },

  async loadProject(data, restoringDraft = false) {
    const image = src => new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не вдалося відкрити зображення сторінки'));
      img.src = src;
    });
    if (Array.isArray(data.pages)) {
      const pages = data.pages.map(p => ({...p, cleanImg:null, origImg:null}));
      this.releasePageImages?.();
      AppState.pages = pages;
      AppState.recalcPageOffsets();
      document.getElementById('floating-hint').style.display = pages.length ? 'none' : '';
    }
    AppState.translations = data.translations || [];
    AppState.activeTransIndex = Number.isInteger(data.activeTransIndex) ? data.activeTransIndex : AppState.findNextInsertableIndex(-1);
    if (!restoringDraft && Array.isArray(data.presets)) StyleLibrary.replacePresets(data.presets);
    AppState.undoStack = []; AppState.redoStack = [];
    AppState.restoreItemsFromSnapshot(data.items || []);
    this.renderTranslationList(); this.renderPresets(); this.requestRender();
  },

  readFileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },


});
