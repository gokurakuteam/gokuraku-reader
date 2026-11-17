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

Object.assign(CanvasStrip, {
  async renderPageWebp(page, items) {
    // WebP's dimension limit is 16383. Refuse oversized allocations before decoding.
    if(!Number.isInteger(page.width) || !Number.isInteger(page.height) ||
       page.width<1 || page.height<1 || page.width>16383 || page.height>16383 ||
       page.width*page.height>32*1024*1024) {
      throw new Error('Сторінка «'+page.name+'» завелика для безпечного WebP-експорту (максимум 32 Мп і 16383 px на сторону). Зменште її розмір.');
    }
    const canvas=document.createElement('canvas'), scan=new Image();
    canvas.width=page.width; canvas.height=page.height;
    try {
      const ctx=canvas.getContext('2d');
      if(!ctx) throw new Error('Недостатньо пам’яті для полотна');
      scan.src=page.cleanDataUrl; await scan.decode();
      ctx.drawImage(scan,0,0,page.width,page.height);
      scan.src='';
      for(const item of items) {
        ctx.save();
        try {
          ctx.translate(item.x+item.w/2,item.y+item.h/2);
          ctx.rotate((item.angle||0)*Math.PI/180);
          if(item.type==='png' && item.pngDataUrl) {
            const img=new Image();
            try { img.src=item.pngDataUrl; await img.decode(); ctx.drawImage(img,-item.w/2,-item.h/2,item.w,item.h); }
            finally { img.src=''; }
          }
          if(item.lines?.length) this.renderStyledText(ctx,item);
        } finally { ctx.restore(); }
      }
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(
        b=>b?resolve(b):reject(new Error('Не вдалося закодувати WebP')),'image/webp',0.95));
      if(blob.type!=='image/webp') throw new Error('Цей браузер не підтримує експорт WebP');
      return blob;
    } finally { scan.src=''; canvas.width=canvas.height=1; }
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
      if(CanvasStrip.editingItem) CanvasStrip.closeInlineEditor();
      // Freeze page order, coordinates, lines and styles across asynchronous encoding.
      const data=CanvasStrip.projectData();
      const pages=data.pages, items=JSON.parse(JSON.stringify(data.items));
      if(window.showSaveFilePicker) {
        const handle=await showSaveFilePicker({suggestedName:'pages.zip',types:[{description:'ZIP зі сторінками WebP',accept:{'application/zip':['.zip']}}]});
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
      for(let n=0;n<pages.length;n++) {
        button.textContent='WebP: '+(n+1)+' / '+pages.length;
        const blob=await CanvasStrip.renderPageWebp(pages[n],items.filter(i=>i.pageId===pages[n].id));
        await zip.add(String(n+1).padStart(5,'0')+'.webp',blob);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      await zip.close();
      if(sink) { await sink.close(); sink=null; }
      else CanvasStrip.downloadBlob(new Blob(parts,{type:'application/zip'}),'pages.zip');
    } catch(error) {
      if(sink) await sink.abort().catch(()=>{});
      if(error.name!=='AbortError') await AppDialogs.alert('Експорт не завершено: '+error.message);
    } finally {
      CanvasStrip.exporting=false; button.disabled=false;
      button.textContent='Сторінки WebP у ZIP';
      CanvasStrip.requestRender();
    }
  });
});
