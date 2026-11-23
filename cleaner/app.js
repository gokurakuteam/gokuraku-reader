'use strict';

const $ = (id) => document.getElementById(id);
const picture = $('picture');
const mask = $('mask');
const ink = $('ink');
const sheet = $('sheet');
const viewport = $('viewport');
const cursor = $('cursor');
const imageContext = picture.getContext('2d', { willReadFrequently: true });
const maskContext = mask.getContext('2d', { willReadFrequently: true });
const inkContext = ink.getContext('2d');
const tools = [...document.querySelectorAll('[data-tool]')];
const endpoint = 'https://sanster-iopaint-lama.hf.space/api/v1/inpaint';
const collator = new Intl.Collator('uk', { numeric: true });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pages = [];
const cleanQueue = [];
let runningJob = null;
let displayedQueuePage;
let queueRevision = 0;
let displayedQueueRevision = -1;
const historyLimit = 96 * 1024 * 1024;
let historyBytes = 0;
let historySequence = 0;
const thumbCanvas = canvas(72, 96);

let index = -1;
let selectedTool = 'paint';
let operation = '';
let importing = false;
let gesture = null;
let noticeTimer;
let transition;
let zoomMotion;
let lastMouse;
const loupe = $('loupe');
const loupeContext = loupe.querySelector('canvas').getContext('2d');
const processingRegion = $('processing-region');
const processingTint = $('processing-tint');
let processingRevision = 0;
let displayedJob;
let progressTimer;
const timingRatios = [];
const touchPoints = new Map();
let pinch = false;
const mobile = matchMedia('(max-width: 720px)');
const activePage = () => pages[index];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function notify(message, { error = false, persistent = false } = {}) {
  const notice = $('notice');
  clearTimeout(noticeTimer);
  notice.hidden = !message;
  notice.textContent = message;
  notice.classList.toggle('error', error);
  if (message && !persistent) noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}

function controls() {
  const page = activePage();
  const locked = Boolean(operation || gesture || pinch);
  $('position').textContent = `${index + 1} / ${pages.length}`;
  $('no-pages').hidden = Boolean(pages.length);
  $('prev').disabled = locked || index <= 0;
  $('next').disabled = locked || index < 0 || index >= pages.length - 1;
  $('undo').disabled = locked || !page?.undo.length;
  $('redo').disabled = locked || !page?.redo.length;
  $('clear').disabled = locked || !page?.maskBounds;
  $('clean').disabled = $('clear').disabled;
  $('clean').setAttribute('aria-busy', String(runningJob?.page === page && Boolean(page)));
  $('add').disabled = $('pick').disabled = Boolean(operation || importing);
  const pending = Boolean(runningJob || cleanQueue.length);
  $('queue-count').hidden = cleanQueue.length === 0;
  $('queue-count').textContent = cleanQueue.length;
  $('clean').setAttribute('aria-label', cleanQueue.length
    ? `Очистити маску. У черзі: ${cleanQueue.length}` : 'Очистити маску');
  $('export').disabled = locked || importing || pending || !page;
  $('export').title = pending ? 'Експорт ZIP доступний після обробки ШІ' : 'Експорт ZIP';
  for (const id of ['fit', 'smaller', 'larger']) $(id).disabled = locked || !page;
  $('stage').setAttribute('aria-busy', String(Boolean(operation)));
  syncProcessingRegion(runningJob?.page === page ? runningJob : undefined);
  syncQueuedRegions(page);
}

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

function png(element) {
  return new Promise((resolve, reject) => {
    element.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не вдалося зберегти зображення')), 'image/png');
  });
}

async function encodeCrop(element) {
  try {
    return await png(element);
  } finally {
    element.width = 0;
  }
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function preview(source) {
  const thumb = thumbCanvas;
  thumb.height = Math.min(96, Math.max(1, Math.round(source.height * 72 / source.width)));
  const height = Math.min(source.height, Math.round(thumb.height * source.width / thumb.width));
  thumb.getContext('2d').drawImage(source, 0, 0, source.width, height, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/webp', .82);
}

function addEntry(page, thumbnail) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  const thumb = document.createElement('img');
  const caption = document.createElement('span');
  const number = document.createElement('span');
  const name = document.createElement('span');

  button.className = 'page-entry';
  button.title = page.file.name;
  thumb.className = 'thumb';
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.decoding = 'async';
  thumb.src = thumbnail;
  caption.className = 'page-caption';
  number.className = 'page-number';
  number.textContent = String(page.order + 1).padStart(2, '0');
  name.className = 'page-name';
  name.textContent = page.file.name;
  caption.append(number, name);
  button.append(thumb, caption);
  button.addEventListener('click', () => openPage(page.order));
  li.append(button);
  $('pages').append(li);
  page.button = button;
  page.thumb = thumb;
}

const archiveImage = /\.(apng|avif|bmp|gif|hei[cf]|ico|jpe?g|jxl|png|svg|tiff?|webp)$/i;

async function readZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise((resolve, reject) => {
    fflate.unzip(bytes, {
      filter: ({ name }) => archiveImage.test(name) &&
        !name.split(/[\/\\]/).some((part) => part.startsWith('.') || part === '__MACOSX'),
    }, (error, content) => error ? reject(error) : resolve(content));
  });
  return Object.keys(entries).sort(collator.compare).map((path) => {
    const name = path.split(/[\/\\]/).pop();
    const extension = name.match(archiveImage)[1].toLowerCase();
    const format = { jpg: 'jpeg', ico: 'x-icon', svg: 'svg+xml' }[extension] || extension;
    return new File([entries[path]], name, { type: `image/${format}` });
  });
}

async function importImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const page = { file, order: pages.length, undo: [], redo: [], zoom: null, jobs: [] };
    addEntry(page, preview(bitmap));
    pages.push(page);
    if (index < 0 && !operation) await openPage(0, bitmap);
  } finally {
    bitmap.close();
  }
}

async function importFiles(files) {
  if (importing || operation) return;
  importing = true;
  controls();
  let skipped = 0;
  const archiveErrors = [];
  try {
    const sorted = Array.from(files).sort((a, b) => collator.compare(a.name, b.name));
    for (const file of sorted) {
      let images = [file];
      if (/\.zip$/i.test(file.name) || /^(application\/zip|application\/x-zip-compressed)$/i.test(file.type)) {
        try {
          images = await readZip(file);
          if (!images.length) archiveErrors.push(`${file.name} — немає зображень`);
        } catch {
          archiveErrors.push(`${file.name} — не вдалося розпакувати`);
          continue;
        }
      }
      for (const image of images) {
        try {
          await importImage(image);
        } catch {
          skipped++;
        }
      }
    }
  } finally {
    importing = false;
    controls();
    const errors = archiveErrors.slice(0, 2);
    if (archiveErrors.length > 2) errors.push(`Інші проблемні архіви: ${archiveErrors.length - 2}`);
    if (skipped) errors.push(`Не вдалося відкрити зображень: ${skipped}`);
    if (errors.length) notify(errors.join(' · '), { error: true });
  }
}

async function savePage(page) {
  page.scroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
  if (page.pictureDirty) {
    page.edited = await png(picture);
    page.pictureDirty = false;
  }
  if (page.maskDirty) {
    const area = page.maskBounds;
    if (area) {
      const { x, y, w, h } = area;
      const croppedMask = canvas(w, h);
      try {
        croppedMask.getContext('2d').drawImage(mask, x, y, w, h, 0, 0, w, h);
        page.savedMask = await png(croppedMask);
      } finally {
        croppedMask.width = 0;
      }
    } else {
      page.savedMask = null;
    }
    page.maskDirty = false;
  }
}

function fitScale() {
  const padding = mobile.matches ? 24 : 56;
  return Math.min(1, Math.max(1, viewport.clientWidth - padding) / picture.width, 960 / picture.width);
}

function stopZoom() {
  if (zoomMotion) cancelAnimationFrame(zoomMotion.frame);
  zoomMotion = null;
}

function animateZoom(value, anchor) {
  const page = activePage();
  if (!page) return;
  transition?.finish();
  const fit = fitScale();
  const target = value === null ? fit : clamp(value, Math.min(.05, fit), 6);
  if (reducedMotion.matches) {
    stopZoom();
    zoomTo(value, anchor);
    return;
  }

  if (zoomMotion) {
    Object.assign(zoomMotion, { target, anchor, value });
    return;
  }

  const motion = { target, anchor, value, last: performance.now() };
  zoomMotion = motion;
  const tick = (now) => {
    const remaining = Math.log(motion.target / page.scale);
    if (Math.abs(remaining) < .0015) {
      zoomTo(motion.value, motion.anchor);
      zoomMotion = null;
      return;
    }
    const fraction = 1 - Math.exp(-Math.min(60, now - motion.last) / 48);
    zoomTo(page.scale * Math.exp(remaining * fraction), motion.anchor);
    motion.last = now;
    motion.frame = requestAnimationFrame(tick);
  };
  motion.frame = requestAnimationFrame(tick);
}

function zoomTo(value, anchor, destination = anchor) {
  const page = activePage();
  if (!page) return;
  const fit = fitScale();
  const scale = value === null ? fit : clamp(value, Math.min(.05, fit), 6);
  const oldRect = sheet.getBoundingClientRect();
  const width = picture.width * scale;
  const height = picture.height * scale;
  page.zoom = value === null ? null : scale;
  page.scale = scale;
  sheet.style.width = `${width}px`;
  sheet.style.height = `${height}px`;
  $('fit').textContent = `${Math.max(1, Math.round(scale * 100))}%`;
  if (anchor && oldRect.width && oldRect.height) {
    const x = (anchor.x - oldRect.left) / oldRect.width;
    const y = (anchor.y - oldRect.top) / oldRect.height;
    const rect = sheet.getBoundingClientRect();
    viewport.scrollLeft += rect.left + x * width - destination.x;
    viewport.scrollTop += rect.top + y * height - destination.y;
  }
}

async function openPage(target, importedBitmap) {
  if (operation || gesture || pinch || target === index || !pages[target]) return;
  stopZoom();
  hideLoupe();
  const previous = activePage();
  const page = pages[target];
  let bitmap;
  let savedMask;
  operation = 'page';
  controls();
  try {
    if (previous) await savePage(previous);
    bitmap = importedBitmap || await createImageBitmap(page.edited || page.file);
    if (page.savedMask) savedMask = await createImageBitmap(page.savedMask);
    transition?.cancel();
    for (const layer of [picture, mask, ink]) {
      if (layer.width !== bitmap.width) layer.width = bitmap.width;
      if (layer.height !== bitmap.height) layer.height = bitmap.height;
      layer.getContext('2d').clearRect(0, 0, bitmap.width, bitmap.height);
    }
    imageContext.drawImage(bitmap, 0, 0);
    if (savedMask) maskContext.drawImage(savedMask, page.maskBounds.x, page.maskBounds.y);
    previous?.button.removeAttribute('aria-current');
    index = target;
    page.button.setAttribute('aria-current', 'page');
    page.button.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'nearest' });
    $('empty').hidden = true;
    viewport.hidden = false;
    zoomTo(page.zoom);
    viewport.scrollTo(page.scroll || { top: 0, left: (viewport.scrollWidth - viewport.clientWidth) / 2 });
    cursor.hidden = true;
    if (!reducedMotion.matches) {
      transition = sheet.animate([
        { opacity: .55, translate: `${target > (previous?.order ?? -1) ? 12 : -12}px 0`, scale: '.985' },
        { opacity: 1, translate: '0 0', scale: '1' },
      ], { duration: 340, easing: 'cubic-bezier(.22, 1.3, .42, 1)' });
    }
  } catch {
    notify('Не вдалося відкрити сторінку', { error: true });
  } finally {
    if (!importedBitmap) bitmap?.close();
    savedMask?.close();
    operation = '';
    applyActiveJob();
    controls();
  }
}

function chooseTool(tool) {
  selectedTool = tool;
  sheet.dataset.tool = tool;
  cursor.hidden = true;
  for (const button of tools) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
}

function point(event) {
  const box = sheet.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * picture.width / box.width,
    y: (event.clientY - box.top) * picture.height / box.height,
  };
}

function hideLoupe() {
  loupe.hidden = true;
  sheet.classList.remove('temporary-picker');
}

function sampledColor(x, y) {
  const { data } = imageContext.getImageData(x, y, 1, 1);
  return '#' + [...data.slice(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function showCursor(event) {
  if (event.pointerType === 'mouse') lastMouse = event;
  const pos = point(event);
  const within = pos.x >= 0 && pos.y >= 0 && pos.x < picture.width && pos.y < picture.height;
  const draw = gesture?.brush?.tool || selectedTool;
  const usable = activePage() && within && event.pointerType === 'mouse' && !operation && !pinch && !gesture?.pan;
  const picking = usable && !gesture && (event.ctrlKey || draw === 'pick');
  if (picking) {
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const stage = $('stage').getBoundingClientRect();
    loupeContext.clearRect(0, 0, 15, 15);
    loupeContext.drawImage(picture, x - 7, y - 7, 15, 15, 0, 0, 15, 15);
    const color = sampledColor(x, y);
    loupe.querySelector('span').textContent = color.toUpperCase();
    loupe.style.setProperty('--sample', color);
    const left = event.clientX - stage.left;
    const top = event.clientY - stage.top;
    loupe.style.left = `${left + (left + 120 < stage.width ? 14 : -119)}px`;
    loupe.style.top = `${clamp(top - 113, 4, Math.max(4, stage.height - 134))}px`;
    loupe.hidden = false;
    sheet.classList.toggle('temporary-picker', event.ctrlKey);
  } else {
    hideLoupe();
  }
  cursor.hidden = !usable || picking || (draw !== 'paint' && draw !== 'mask');
  if (cursor.hidden) return;
  const size = (gesture?.brush?.size || Number($('size').value)) * activePage().scale;
  cursor.style.cssText = `left:${pos.x / picture.width * 100}%;top:${pos.y / picture.height * 100}%;width:${size}px;height:${size}px`;
}

function refreshPicker(ctrlKey) {
  if (!lastMouse || viewport.hidden || !viewport.matches(':hover')) {
    hideLoupe();
    return;
  }
  showCursor({ clientX: lastMouse.clientX, clientY: lastMouse.clientY, pointerType: 'mouse', ctrlKey });
}
window.addEventListener('keydown', (event) => { if (event.key === 'Control' && !$('shortcut-dialog').open) refreshPicker(true); });
window.addEventListener('keyup', (event) => { if (event.key === 'Control') refreshPicker(false); });
window.addEventListener('blur', () => { lastMouse = null; hideLoupe(); });
viewport.addEventListener('scroll', () => { if (lastMouse) refreshPicker(lastMouse.ctrlKey); }, { passive: true });

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function bounds(x1, y1, x2, y2) {
  const x = clamp(Math.floor(x1), 0, picture.width);
  const y = clamp(Math.floor(y1), 0, picture.height);
  const w = clamp(Math.ceil(x2), 0, picture.width) - x;
  const h = clamp(Math.ceil(y2), 0, picture.height) - y;
  return w && h ? { x, y, w, h } : null;
}

function dab(brush, pos) {
  const from = brush.last || pos;
  const radius = brush.size / 2;
  const rect = bounds(Math.min(from.x, pos.x) - radius - 1, Math.min(from.y, pos.y) - radius - 1,
    Math.max(from.x, pos.x) + radius + 1, Math.max(from.y, pos.y) + radius + 1);
  brush.bounds = union(brush.bounds, rect);
  inkContext.fillStyle = inkContext.strokeStyle = brush.color;
  inkContext.lineWidth = brush.size;
  inkContext.lineCap = 'round';
  inkContext.beginPath();
  if (from.x === pos.x && from.y === pos.y) {
    inkContext.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
    inkContext.fill();
  } else {
    inkContext.moveTo(from.x, from.y);
    inkContext.lineTo(pos.x, pos.y);
    inkContext.stroke();
  }
  brush.last = pos;
}

function snapshot(context, rect) {
  const { x, y, w, h } = rect;
  return { context, rect, pixels: context.getImageData(x, y, w, h) };
}

function changed(layers) {
  const page = activePage();
  if (layers.some(({ context }) => context === imageContext)) {
    page.pictureDirty = true;
    page.thumb.src = preview(picture);
  }
  if (layers.some(({ context }) => context === maskContext)) page.maskDirty = true;
}

function discardHistory(stack, count = stack.length) {
  for (const entry of stack.splice(0, count)) historyBytes -= entry.bytes;
}

function trimHistory() {
  while (historyBytes > historyLimit) {
    let oldest;
    for (const page of pages) {
      for (const stack of [page.undo, page.redo]) {
        if (stack.length && (!oldest || stack[0].sequence < oldest[0].sequence)) oldest = stack;
      }
    }
    discardHistory(oldest, 1);
  }
}

function remember(layers, page = activePage()) {
  const bytes = layers.reduce((sum, { pixels }) => sum + pixels.data.byteLength, 0);
  discardHistory(page.redo);
  if (bytes > historyLimit) {
    discardHistory(page.undo);
  } else {
    page.undo.push({ layers, maskBounds: page.maskBounds, bytes, sequence: historySequence++ });
    historyBytes += bytes;
    if (page.undo.length > 30) discardHistory(page.undo, 1);
    trimHistory();
  }
  if (page === activePage()) changed(layers);
}

function restore(from, to) {
  const page = activePage();
  if (operation || gesture || pinch || !page?.[from].length) return;
  const entry = page[from].pop();
  const previousLayers = entry.layers;
  const previousBounds = entry.maskBounds;
  entry.layers = previousLayers.map(({ context, rect }) => snapshot(context, rect));
  entry.maskBounds = page.maskBounds;
  page[to].push(entry);
  for (const { context, rect, pixels } of previousLayers) context.putImageData(pixels, rect.x, rect.y);
  page.maskBounds = previousBounds;
  changed(previousLayers);
  controls();
}

function finishStroke(event, commit) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const { brush } = gesture;
  gesture = null;
  viewport.classList.remove('grabbing');
  if (brush?.bounds) {
    const rect = brush.bounds;
    const { x, y, w, h } = rect;
    if (commit) {
      const context = brush.tool === 'paint' ? imageContext : maskContext;
      const before = snapshot(context, rect);
      context.drawImage(ink, x, y, w, h, x, y, w, h);
      remember([before]);
      if (brush.tool === 'mask') activePage().maskBounds = union(activePage().maskBounds, rect);
    }
    inkContext.clearRect(x, y, w, h);
  }
  chooseTool(selectedTool);
  applyActiveJob();
  controls();
}

viewport.addEventListener('pointerdown', (event) => {
  if (!activePage() || operation || gesture || pinch || ![0, 1].includes(event.button)) return;
  const temporary = event.button === 0 && event.ctrlKey;
  const tool = event.button === 1 ? 'pan' : temporary ? 'pick' : selectedTool;
  if (tool !== 'pan' && !sheet.contains(event.target)) return;
  event.preventDefault();
  viewport.focus({ preventScroll: true });
  stopZoom();
  transition?.finish();
  const pos = point(event);
  if (tool === 'pick') {
    $('color').value = sampledColor(clamp(Math.floor(pos.x), 0, picture.width - 1), clamp(Math.floor(pos.y), 0, picture.height - 1));
    syncColor();
    if (!temporary) chooseTool('paint');
    showCursor(event);
    return;
  }
  gesture = { id: event.pointerId };
  viewport.setPointerCapture(event.pointerId);
  if (tool === 'pan') {
    gesture.pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.classList.add('grabbing');
  } else {
    gesture.brush = { tool, size: Number($('size').value), color: tool === 'paint' ? $('color').value : '#54dca1' };
    dab(gesture.brush, pos);
  }
  showCursor(event);
  controls();
});

viewport.addEventListener('pointermove', (event) => {
  showCursor(event);
  if (gesture?.id !== event.pointerId) return;
  if (gesture.pan) {
    const { x, y, left, top } = gesture.pan;
    viewport.scrollTo(left + x - event.clientX, top + y - event.clientY);
  } else {
    const events = event.getCoalescedEvents?.();
    for (const sample of events?.length ? events : [event]) dab(gesture.brush, point(sample));
  }
});

viewport.addEventListener('contextmenu', (event) => {
  if (event.ctrlKey && sheet.contains(event.target)) event.preventDefault();
});
viewport.addEventListener('pointerleave', () => { cursor.hidden = true; lastMouse = null; hideLoupe(); });
viewport.addEventListener('pointerup', (event) => {
  finishStroke(event, true);
  showCursor(event);
});
viewport.addEventListener('pointercancel', (event) => finishStroke(event, false));
viewport.addEventListener('lostpointercapture', (event) => finishStroke(event, false));

function syncColor() {
  $('hex').textContent = $('color').value.toUpperCase();
}

function clearMask(selection) {
  const rect = activePage()?.maskBounds;
  if (!rect || operation || gesture || pinch) return;
  remember([selection ? { context: maskContext, rect, pixels: selection } : snapshot(maskContext, rect)]);
  maskContext.clearRect(rect.x, rect.y, rect.w, rect.h);
  activePage().maskBounds = null;
  controls();
}

function updateJobStatus(page) {
  const pending = runningJob?.page === page;
  const waiting = page.jobs.filter((job) => job.pending && job !== runningJob).length;
  if (page.jobs.length) {
    page.button.dataset.job = pending ? 'pending' : waiting ? 'queued' : 'ready';
    page.button.title = waiting ? `${page.file.name} · У черзі: ${waiting}` : pending
      ? `${page.file.name} · ШІ обробляє` : `${page.file.name} · ШІ завершив обробку`;
  } else {
    delete page.button.dataset.job;
    page.button.title = page.file.name;
  }
}

function finishJob(job) {
  job.bitmap?.close();
  if (job.overlayUrl) URL.revokeObjectURL(job.overlayUrl);
  const { page } = job;
  page.jobs.splice(page.jobs.indexOf(job), 1);
  updateJobStatus(page);
}

function mergeResult(job, context) {
  const { area, source, selection, bitmap, offsetX, offsetY } = job;
  const { x, y, w, h } = area;
  const patch = canvas(w, h).getContext('2d');
  patch.drawImage(bitmap, -offsetX, -offsetY);
  const merged = patch.getImageData(0, 0, w, h);
  patch.canvas.width = 0;
  const before = snapshot(context, area);
  before.context = imageContext;
  const data = before.pixels.data;
  const result = merged.data;
  let didChange = false;
  for (let i = 0; i < data.length; i += 4) {
    // Preserve pixels touched by the user between submission and completion.
    const unchanged = data[i] === source.data[i] && data[i + 1] === source.data[i + 1]
      && data[i + 2] === source.data[i + 2] && data[i + 3] === source.data[i + 3];
    if (selection.data[i + 3] && result[i + 3] && unchanged) {
      didChange = true;
    } else {
      result[i] = data[i];
      result[i + 1] = data[i + 1];
      result[i + 2] = data[i + 2];
      result[i + 3] = data[i + 3];
    }
  }
  if (!didChange) return null;
  context.putImageData(merged, x, y);
  return before;
}

function applyActiveJob() {
  const page = activePage();
  if (!page || gesture || pinch) return;
  let message;
  let failure;
  for (const job of [...page.jobs]) {
    if (job.pending) break;
    if (job.error) {
      const { area, selection } = job;
      const restored = canvas(area.w, area.h);
      restored.getContext('2d').putImageData(selection, 0, 0);
      remember([snapshot(maskContext, area)]);
      maskContext.drawImage(restored, area.x, area.y);
      restored.width = 0;
      page.maskBounds = union(page.maskBounds, area);
      failure = job.error;
    } else {
      const before = mergeResult(job, imageContext);
      if (before) remember([before]);
      message = before ? 'Ділянку очищено' : 'Пізніші правки збережено';
    }
    finishJob(job);
  }
  if (failure || message) notify(failure || message, { error: Boolean(failure) });
}

async function applyExportJob(page) {
  const ready = page.jobs.filter((job) => job.bitmap);
  if (!ready.length) return;
  const original = await createImageBitmap(page.edited || page.file);
  const output = canvas(original.width, original.height);
  try {
    const context = output.getContext('2d');
    context.drawImage(original, 0, 0);
    const history = [];
    for (const job of ready) {
      const before = mergeResult(job, context);
      if (before) history.push(before);
    }
    if (history.length) {
      page.edited = await png(output);
      page.thumb.src = preview(output);
      for (const before of history) remember([before], page);
    }
    for (const job of ready) finishJob(job);
  } finally {
    original.close();
    output.width = 0;
  }
}

// CPU request medians with 128 px of context on each side.
// The largest test exceeded 35 s. Use an extrapolated estimate for that anchor.
function baselineSeconds(width, height) {
  const pixels = width * height;
  const samples = [[0, 2], [304 ** 2, 4.8], [512 ** 2, 10], [896 ** 2, 19], [1256 ** 2, 40]];
  const upper = samples.findIndex(([area]) => area >= pixels);
  const i = upper < 0 ? samples.length - 1 : Math.max(1, upper);
  const [a, first] = samples[i - 1];
  const [b, last] = samples[i];
  return Math.min(175, first + (last - first) * (pixels - a) / (b - a));
}

function updateProcessingTime() {
  const job = displayedJob;
  if (!job?.pending) return;
  const elapsed = (performance.now() - job.started) / 1000;
  const remaining = Math.ceil(job.estimate - elapsed);
  const fraction = clamp(elapsed / job.estimate, 0, 1);
  processingRegion.style.setProperty('--eta-color', `hsl(${52 + 94 * fraction} 69% 64%)`);
  $('processing-time').textContent = remaining > 0 ? `ШІ · ≈ ${remaining} с` : 'ШІ · ще обробляється';
}

function showMaskTint(job, element, stillVisible) {
  if (!job.overlay) {
    const { w, h } = job.area;
    const alpha = canvas(w, h);
    alpha.getContext('2d').putImageData(job.selection, 0, 0);
    job.overlay = encodeCrop(alpha).then((blob) => {
      if (job.pending) job.overlayUrl = URL.createObjectURL(blob);
      return job.overlayUrl;
    }, () => undefined);
  }
  element.hidden = true;
  job.overlay.then((url) => {
    if (!url || !job.pending || !stillVisible()) return;
    element.style.maskImage = `url(${url})`;
    element.hidden = false;
  });
}

function syncProcessingRegion(job) {
  if (!job?.pending) job = undefined;
  if (job === displayedJob) return;
  displayedJob = job;
  const revision = ++processingRevision;
  clearInterval(progressTimer);
  processingTint.hidden = true;
  processingTint.style.maskImage = '';
  processingRegion.hidden = !job;
  if (!job) return;
  const { x, y, w, h } = job.area;
  Object.assign(processingRegion.style, {
    left: `${100 * x / picture.width}%`, top: `${100 * y / picture.height}%`,
    width: `${100 * w / picture.width}%`, height: `${100 * h / picture.height}%`,
  });
  showMaskTint(job, processingTint, () => revision === processingRevision);
  updateProcessingTime();
  progressTimer = setInterval(updateProcessingTime, 200);
}

function syncQueuedRegions(page) {
  if (page === displayedQueuePage && queueRevision === displayedQueueRevision) return;
  displayedQueuePage = page;
  displayedQueueRevision = queueRevision;
  const regions = $('queued-regions');
  regions.replaceChildren();
  cleanQueue.forEach((job, i) => {
    if (job.page !== page) return;
    const { x, y, w, h } = job.area;
    const region = document.createElement('div');
    region.className = 'queued-region';
    Object.assign(region.style, {
      left: `${100 * x / picture.width}%`, top: `${100 * y / picture.height}%`,
      width: `${100 * w / picture.width}%`, height: `${100 * h / picture.height}%`,
    });
    const tint = document.createElement('div');
    tint.className = 'queued-tint';
    showMaskTint(job, tint, () => tint.isConnected);
    const caption = document.createElement('span');
    caption.textContent = `Черга · ${i + 1}`;
    region.append(tint, caption);
    regions.append(region);
  });
}

function clean() {
  const page = activePage();
  if (!page?.maskBounds || operation || gesture || pinch) return;
  const area = page.maskBounds;
  const { x, y, w, h } = bounds(area.x - 128, area.y - 128, area.x + area.w + 128, area.y + area.h + 128);
  if (w * h > 4096 ** 2) {
    notify('Виділення завелике. Очисти ділянку частинами.', { error: true });
    return;
  }
  const source = imageContext.getImageData(area.x, area.y, area.w, area.h);
  const selection = maskContext.getImageData(area.x, area.y, area.w, area.h);
  const crop = canvas(w, h);
  crop.getContext('2d').drawImage(picture, x, y, w, h, 0, 0, w, h);
  // Freeze the submitted image while keeping the next selection independent.
  const image = encodeCrop(crop).then((blob) => ({ blob }), (error) => ({ error }));
  const job = { page, area, source, selection, image, w, h, offsetX: area.x - x, offsetY: area.y - y, pending: true };
  page.jobs.push(job);
  cleanQueue.push(job);
  queueRevision++;
  updateJobStatus(page);
  clearMask(selection);
  runNextJob();
}

async function runNextJob() {
  if (runningJob || !cleanQueue.length) return;
  const job = cleanQueue.shift();
  runningJob = job;
  queueRevision++;
  const { page, w, h } = job;
  const baseline = baselineSeconds(w, h);
  const sorted = [...timingRatios].sort((a, b) => a - b);
  const factor = sorted[Math.floor(sorted.length / 2)] || 1;
  job.started = performance.now();
  job.estimate = clamp(baseline * factor, 1, 175);
  updateJobStatus(page);
  controls();
  try {
    const { blob, error } = await job.image;
    job.image = null;
    if (error) throw error;
    const stencil = canvas(w, h);
    const context = stencil.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, w, h);
    const shape = context.createImageData(job.area.w, job.area.h);
    for (let i = 0; i < shape.data.length; i += 4) {
      const value = job.selection.data[i + 3] ? 255 : 0;
      shape.data[i] = shape.data[i + 1] = shape.data[i + 2] = value;
      shape.data[i + 3] = 255;
    }
    context.putImageData(shape, job.offsetX, job.offsetY);
    const [image, maskImage] = await Promise.all([blobDataUrl(blob), encodeCrop(stencil).then(blobDataUrl)]);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mask: maskImage }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`Помилка ШІ (HTTP ${response.status}). Спробуй ще раз.`);
    const bitmap = await createImageBitmap(await response.blob());
    if (bitmap.width !== w || bitmap.height !== h) {
      bitmap.close();
      throw new Error('ШІ повернув зображення іншого розміру');
    }
    job.bitmap = bitmap;
    timingRatios.push(clamp((performance.now() - job.started) / 1000 / baseline, .35, 4));
    if (timingRatios.length > 5) timingRatios.shift();
  } catch (error) {
    job.error = error.name === 'TimeoutError' ? 'ШІ довго не відповідає. Спробуй ще раз.'
      : error.name === 'TypeError' ? 'Немає зв’язку з ШІ. Спробуй ще раз.'
      : error.message || 'Не вдалося очистити ділянку';
  } finally {
    job.pending = false;
    runningJob = null;
    updateJobStatus(page);
    try {
      if (page === activePage() && !operation) applyActiveJob();
    } finally {
      runNextJob();
      controls();
    }
  }
}

async function exportPages() {
  if (operation || gesture || pinch || importing || !activePage() || (runningJob || cleanQueue.length)) return;
  operation = 'export';
  controls();
  try {
    applyActiveJob();
    await savePage(activePage());
    const chunks = [];
    const archive = new fflate.Zip((error, bytes) => {
      if (error) throw error;
      chunks.push(bytes);
    });
    const digits = Math.max(2, String(pages.length).length);
    for (const page of pages) {
      notify(`Експорт ${page.order + 1} / ${pages.length}`, { persistent: true });
      await applyExportJob(page);
      let file = page.edited || page.file;
      let name = page.file.name.replace(/[/\\\u0000-\u001f]/g, '_');
      const base = name.replace(/\.[^.]+$/, '') || 'сторінка';
      if (page.edited) name = base + '.png';
      if (!page.edited && !/\.[a-z0-9]+$/i.test(name)) {
        const bitmap = await createImageBitmap(file);
        try {
          const output = canvas(bitmap.width, bitmap.height);
          output.getContext('2d').drawImage(bitmap, 0, 0);
          file = await png(output);
          name = base + '.png';
        } finally {
          bitmap.close();
        }
      }
      const entry = new fflate.ZipPassThrough(`${String(page.order + 1).padStart(digits, '0')}-${name}`);
      archive.add(entry);
      const reader = file.stream().getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          entry.push(value);
        }
        entry.push(new Uint8Array(), true);
      } finally {
        reader.releaseLock();
      }
    }
    archive.end();
    const url = URL.createObjectURL(new Blob(chunks, { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'klin.zip';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    notify(pages.some((page) => page.maskBounds || page.jobs.some((job) => job.error)) ? 'ZIP готовий. Необроблені маски пропущено.' : 'ZIP готовий');
  } catch (error) {
    console.error(error);
    notify('Не вдалося створити ZIP', { error: true });
  } finally {
    operation = '';
    controls();
  }
}

$('add').onclick = $('pick').onclick = () => $('files').click();
$('files').addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  event.target.value = '';
  if (files.length) importFiles(files);
});
$('size').oninput = () => { $('size-value').textContent = `${$('size').value} px`; };
$('color').oninput = syncColor;
$('prev').onclick = () => openPage(index - 1);
$('next').onclick = () => openPage(index + 1);
$('undo').onclick = () => restore('undo', 'redo');
$('redo').onclick = () => restore('redo', 'undo');
function viewportCenter() {
  const rect = viewport.getBoundingClientRect();
  return { x: rect.left + viewport.clientWidth / 2, y: rect.top + viewport.clientHeight / 2 };
}

$('smaller').onclick = () => animateZoom((zoomMotion?.target || activePage().scale) / 1.25, viewportCenter());
$('larger').onclick = () => animateZoom((zoomMotion?.target || activePage().scale) * 1.25, viewportCenter());
$('fit').onclick = () => animateZoom(null, viewportCenter());
$('clean').onclick = clean;
$('clear').onclick = () => clearMask();
$('export').onclick = exportPages;
for (const button of tools) button.onclick = () => { if (!gesture) chooseTool(button.dataset.tool); };

let dragDepth = 0;
document.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  dragDepth++;
  $('drop').hidden = importing || Boolean(operation);
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('drop').hidden = true;
});
document.addEventListener('dragover', (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = importing || operation ? 'none' : 'copy';
});
document.addEventListener('drop', (event) => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  dragDepth = 0;
  $('drop').hidden = true;
  if (event.dataTransfer.files.length) importFiles(event.dataTransfer.files);
});
new ResizeObserver(() => {
  const page = activePage();
  if (page?.zoom === null && page.scale !== fitScale()) zoomTo(null, viewportCenter());
}).observe(viewport);

lucide.createIcons();
chooseTool(selectedTool);
controls();

viewport.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  if (!activePage() || operation || gesture || pinch) return;
  transition?.finish();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  const factor = Math.exp(clamp(-event.deltaY * unit * .003, -.6, .6));
  animateZoom((zoomMotion?.target || activePage().scale) * factor, { x: event.clientX, y: event.clientY });
  cursor.hidden = true;
}, { passive: false });

function touchGeometry() {
  const [a, b] = touchPoints.values();
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
  };
}

viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || operation) return;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (touchPoints.size > 1) {
    pinch = true;
    stopZoom();
    hideLoupe();
    if (gesture) finishStroke({ pointerId: gesture.id }, false);
    for (const id of touchPoints.keys()) viewport.setPointerCapture(id);
    viewport.focus({ preventScroll: true });
    transition?.finish();
    cursor.hidden = true;
    controls();
  } else if (!sheet.contains(event.target)) {
    viewport.setPointerCapture(event.pointerId);
  }
}, true);

viewport.addEventListener('pointermove', (event) => {
  if (!touchPoints.has(event.pointerId)) return;
  const before = touchPoints.size > 1 ? touchGeometry() : null;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (!before || operation) return;
  const after = touchGeometry();
  zoomTo(activePage().scale * after.distance / before.distance, before, after);
}, true);

function releaseTouch(event) {
  if (!touchPoints.delete(event.pointerId) || touchPoints.size || !pinch) return;
  pinch = false;
  if (!operation) applyActiveJob();
  controls();
}
viewport.addEventListener('pointerup', releaseTouch, true);
viewport.addEventListener('pointercancel', releaseTouch, true);

let trackpadScale = null;
viewport.addEventListener('gesturestart', (event) => {
  event.preventDefault();
  if (!operation && !gesture && !pinch && activePage()) {
    stopZoom();
    trackpadScale = activePage().scale;
    transition?.finish();
  }
});
viewport.addEventListener('gesturechange', (event) => {
  event.preventDefault();
  if (trackpadScale !== null && !operation && !gesture && !pinch) {
    zoomTo(trackpadScale * event.scale, { x: event.clientX, y: event.clientY });
  }
});
viewport.addEventListener('gestureend', (event) => {
  event.preventDefault();
  trackpadScale = null;
});

const panel = $('side-panel');
const workspace = panel.parentElement;
const resizeHandle = $('resize-panel');
const tabs = [$('pages-tab'), $('tools-tab')];

function selectTab(selected) {
  for (const tab of tabs) {
    const active = selected === tab;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !active;
  }
  if (selected === tabs[0]) activePage()?.button.scrollIntoView({ block: 'nearest' });
}

for (const tab of tabs) {
  tab.onclick = () => selectTab(tab);
  tab.onkeydown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs.find((item) => item !== tab);
    selectTab(next);
    next.focus();
  };
}

$('toggle-panel').onclick = () => {
  const closed = !panel.inert;
  if (closed && panel.contains(document.activeElement)) $('toggle-panel').focus();
  panel.inert = closed;
  workspace.classList.add('panel-motion');
  workspace.classList.toggle('panel-closed', closed);
  $('toggle-panel').setAttribute('aria-expanded', String(!closed));
};

function setPanelSize(value = mobile.matches ? panel.offsetHeight : panel.offsetWidth) {
  workspace.classList.remove('panel-motion');
  const narrow = mobile.matches;
  const max = Math.floor(narrow ? Math.min(420, innerHeight * .55) : Math.min(500, innerWidth * .54));
  const min = Math.min(max, narrow ? 120 : 204);
  const size = clamp(value, min, max);
  workspace.style.setProperty(narrow ? '--panel-height' : '--panel-width', `${size}px`);
  resizeHandle.setAttribute('aria-orientation', narrow ? 'horizontal' : 'vertical');
  resizeHandle.setAttribute('aria-valuemin', String(min));
  resizeHandle.setAttribute('aria-valuemax', String(max));
  resizeHandle.setAttribute('aria-valuenow', String(size));
}

let panelDrag;
resizeHandle.onpointerdown = (event) => {
  if (event.button !== 0 || panelDrag) return;
  const narrow = mobile.matches;
  panelDrag = {
    id: event.pointerId,
    narrow,
    start: narrow ? event.clientY : event.clientX,
    size: narrow ? panel.offsetHeight : panel.offsetWidth,
  };
  resizeHandle.setPointerCapture(event.pointerId);
  resizeHandle.focus({ preventScroll: true });
  event.preventDefault();
};
window.addEventListener('pointermove', (event) => {
  if (panelDrag?.id !== event.pointerId) return;
  const position = panelDrag.narrow ? event.clientY : event.clientX;
  setPanelSize(panelDrag.size + panelDrag.start - position);
});
function stopPanelDrag(event) {
  if (panelDrag?.id === event.pointerId) panelDrag = null;
}
window.addEventListener('pointerup', stopPanelDrag);
window.addEventListener('pointercancel', stopPanelDrag);
window.addEventListener('blur', () => { panelDrag = null; });
resizeHandle.onkeydown = (event) => {
  const grow = mobile.matches ? 'ArrowUp' : 'ArrowLeft';
  const shrink = mobile.matches ? 'ArrowDown' : 'ArrowRight';
  if (![grow, shrink, 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const size = mobile.matches ? panel.offsetHeight : panel.offsetWidth;
  const limits = { Home: 0, End: Infinity, [grow]: size + 16, [shrink]: size - 16 };
  setPanelSize(limits[event.key]);
};
window.addEventListener('resize', () => setPanelSize());
setPanelSize();
