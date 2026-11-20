// ZIP STORE with data descriptors: encoded WebP bytes are streamed without recompression.
window.TyperZip = class {
  constructor(write) { this.write=write; this.offset=0; this.entries=[]; }
  async emit(bytes) {
    if (this.offset+bytes.byteLength>0xffffffff) throw new Error('ZIP перевищує ліміт 4 ГБ');
    await this.write(bytes); this.offset+=bytes.byteLength;
  }
  async add(name, blob) {
    if(this.entries.length>=65535 || blob.size>0xffffffff) throw new Error('Перевищено ліміт ZIP');
    const filename=new TextEncoder().encode(name), offset=this.offset;
    const header=new Uint8Array(30+filename.length), h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true);
    h.setUint16(6,0x808,true); h.setUint16(12,33,true);
    h.setUint16(26,filename.length,true); header.set(filename,30);
    await this.emit(header);
    let crc=0xffffffff;
    const reader=blob.stream().getReader();
    try {
      while(true) {
        const {value,done}=await reader.read(); if(done) break;
        for(const byte of value) crc=TyperZip.table[(crc^byte)&255]^(crc>>>8);
        await this.emit(value);
      }
    } finally { reader.releaseLock(); }
    crc=(crc^0xffffffff)>>>0;
    const descriptor=new Uint8Array(16), d=new DataView(descriptor.buffer);
    d.setUint32(0,0x08074b50,true); d.setUint32(4,crc,true);
    d.setUint32(8,blob.size,true); d.setUint32(12,blob.size,true);
    await this.emit(descriptor);
    this.entries.push({filename,offset,crc,size:blob.size});
  }
  async close() {
    const start=this.offset;
    for(const e of this.entries) {
      const bytes=new Uint8Array(46+e.filename.length), d=new DataView(bytes.buffer);
      d.setUint32(0,0x02014b50,true); d.setUint16(4,20,true); d.setUint16(6,20,true);
      d.setUint16(8,0x808,true); d.setUint16(14,33,true);
      d.setUint32(16,e.crc,true); d.setUint32(20,e.size,true); d.setUint32(24,e.size,true);
      d.setUint16(28,e.filename.length,true); d.setUint32(42,e.offset,true);
      bytes.set(e.filename,46); await this.emit(bytes);
    }
    const end=new Uint8Array(22), d=new DataView(end.buffer);
    d.setUint32(0,0x06054b50,true); d.setUint16(8,this.entries.length,true);
    d.setUint16(10,this.entries.length,true); d.setUint32(12,this.offset-start,true);
    d.setUint32(16,start,true); await this.emit(end);
  }
};
TyperZip.table=Uint32Array.from({length:256},(_,i)=>{
  for(let n=0;n<8;n++) i=(i&1)?0xedb88320^(i>>>1):i>>>1;
  return i>>>0;
});

async function drawExportImage(ctx, source, rect, label) {
  const image = new Image();
  const blobUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
  try {
    if (!source) throw new Error('Файл зображення відсутній');
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Браузер не зміг відкрити зображення'));
      image.src = blobUrl ?? source;
    });
    ctx.drawImage(image, ...rect);
  } catch (error) {
    throw new Error(`${label}. ${error.message}`, { cause: error });
  } finally {
    image.onload = image.onerror = null;
    image.removeAttribute('src');
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}

Object.assign(CanvasStrip, {
  exportPageLayers(pages, items) {
    const stripWidth = pages.reduce((max, page) => Math.max(max, page.width), 0);
    let y = 0;
    const positioned = pages.map(page => {
      const result = { ...page, xOffset: (stripWidth - page.width) / 2, yOffset: y };
      y += page.height;
      return result;
    });
    const byId = new Map(positioned.map(page => [page.id, page]));
    const layers = new Map(positioned.map(page => [page.id, []]));
    const ctx = document.createElement('canvas').getContext('2d');
    for (const item of items) {
      const anchor = byId.get(item.pageId);
      if (!anchor || (!item.lines?.length && item.type !== 'png')) continue;
      const cx = anchor.xOffset + item.x + item.w / 2;
      const cy = anchor.yOffset + item.y + item.h / 2;
      const angle = (item.angle || 0) * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const radius = item.type === 'png'
        ? (Math.abs(sin) * item.w + Math.abs(cos) * item.h) / 2
        : Math.max(...TextEngine.placements(ctx, item).map(row => {
          const size = item.style.fontSize || 42;
          const x = row.x + (item.textOffsetX || 0);
          const y = row.y + (item.textOffsetY || 0);
          return Math.abs(x * sin + y * cos) + Math.abs(sin) * (ctx.measureText(row.text).width + row.width) +
            Math.abs(cos) * Math.max(row.ascent, row.descent, size * .5 + 2) +
            TextEngine.inkMargin(item, size) + 2;
        }));
      for (const page of positioned) {
        if (cy + radius <= page.yOffset || cy - radius >= page.yOffset + page.height) continue;
        layers.get(page.id).push({ ...item, x: cx - item.w / 2 - page.xOffset, y: cy - item.h / 2 - page.yOffset });
      }
    }
    return layers;
  },

  async renderPageWebp(page, items) {
    // WebP's dimension limit is 16383. Refuse oversized allocations before decoding.
    if(!Number.isInteger(page.width) || !Number.isInteger(page.height) ||
       page.width<1 || page.height<1 || page.width>16383 || page.height>16383 ||
       page.width*page.height>32*1024*1024) {
      throw new Error('Сторінка «'+page.name+'» завелика для безпечного WebP-експорту (максимум 32 Мп і 16383 px на сторону). Зменште її розмір.');
    }
    const canvas=document.createElement('canvas');
    canvas.width=page.width; canvas.height=page.height;
    try {
      const ctx=canvas.getContext('2d');
      if(!ctx) throw new Error('Недостатньо пам’яті для полотна');
      await drawExportImage(ctx, page.cleanBlob ?? page.cleanDataUrl,
        [0, 0, page.width, page.height], `Клін сторінки «${page.name}»`);
      for(const item of items) {
        ctx.save();
        try {
          ctx.translate(item.x+item.w/2,item.y+item.h/2);
          ctx.rotate((item.angle||0)*Math.PI/180);
          if(item.type==='png' && item.pngDataUrl) {
            await drawExportImage(ctx, item.pngDataUrl, [-item.w / 2, -item.h / 2, item.w, item.h],
              `Шар зображення на сторінці «${page.name}» (x: ${Math.round(item.x)}, y: ${Math.round(item.y)})`);
          }
          if(item.lines?.length) this.renderStyledText(ctx,item);
        } finally { ctx.restore(); }
      }
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(
        b=>b?resolve(b):reject(new Error('Не вдалося закодувати WebP')),'image/webp',0.95));
      if(blob.type!=='image/webp') throw new Error('Цей браузер не підтримує експорт WebP');
      return blob;
    } finally {
      canvas.width=canvas.height=1;
    }
  }
});
window.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('btn-export-archive');
  button.addEventListener('click',async()=>{
    if(CanvasStrip.exporting) return;
    CanvasStrip.exporting=true; button.disabled=true;
    let sink;
    try {
      if(!AppState.pages.length) throw new Error('Спочатку додайте сторінки');
      const projectName = document.getElementById('project-name').value.trim();
      if (!projectName && !await AppDialogs.confirm('Проєкт не має назви. Завантажити архів як pages.zip?')) return;
      const archiveName = (projectName.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\.+$/, '') || 'pages') + '.zip';
      if(CanvasStrip.editingItem) CanvasStrip.closeInlineEditor();
      // Freeze page order, coordinates, lines and styles across asynchronous encoding.
      const data=CanvasStrip.projectData();
      const pages=data.pages, items=JSON.parse(JSON.stringify(data.items));
      if(window.showSaveFilePicker) {
        const handle=await showSaveFilePicker({suggestedName:archiveName,types:[{description:'ZIP зі сторінками WebP',accept:{'application/zip':['.zip']}}]});
        sink=await handle.createWritable();
      }
      await document.fonts.ready;
      CanvasStrip.releasePageImages();
      const parts=[]; let total=0;
      const zip=new TyperZip(async bytes=>{
        if(sink) return sink.write(bytes);
        total+=bytes.byteLength;
        if(total>128*1024*1024) throw new Error('Архів перевищує 128 МБ. Для запису великого ZIP одразу на диск використайте Chrome або Edge через localhost/HTTPS.');
        parts.push(bytes);
      });
      const layers = CanvasStrip.exportPageLayers(pages, items);
      for(let n=0;n<pages.length;n++) {
        button.textContent='WebP: '+(n+1)+' / '+pages.length;
        const blob=await CanvasStrip.renderPageWebp(pages[n],layers.get(pages[n].id));
        await zip.add(String(n+1).padStart(5,'0')+'.webp',blob);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      await zip.close();
      if(sink) { await sink.close(); sink=null; }
      else CanvasStrip.downloadBlob(new Blob(parts,{type:'application/zip'}),archiveName);
    } catch(error) {
      if(sink) await sink.abort().catch(()=>{});
      if(error.name!=='AbortError') await AppDialogs.alert('Експорт не завершено: '+error.message);
    } finally {
      CanvasStrip.exporting=false; button.disabled=false;
      CanvasStrip.invalidateScanLayer();
      button.innerHTML='<i data-lucide="package-export"></i> Експортувати';
      if (window.lucide) lucide.createIcons();
      CanvasStrip.requestRender();
    }
  });
});
