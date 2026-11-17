(() => {
  const workspace = document.querySelector('.workspace');
  const widths = { left: 300, right: 310 };
  try { Object.assign(widths, JSON.parse(localStorage.getItem('panel-widths') || '{}')); } catch (_) {}
  function setWidth(side, value) {
    const other = side === 'left' ? 'right' : 'left';
    const max = Math.max(210, Math.min(520, workspace.clientWidth - widths[other] - 132));
    widths[side] = Math.max(210, Math.min(max, Number(value) || 300));
    workspace.style.setProperty(`--${side}-width`, `${widths[side]}px`);
    if (window.CanvasStrip?.viewport && window.CanvasStrip?.ctx) window.CanvasStrip.resizeCanvas();
  }
  ['left', 'right'].forEach(side => setWidth(side, widths[side]));
  document.querySelectorAll('.panel-resizer').forEach(handle => {
    const side = handle.dataset.side;
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const start = event.clientX, initial = widths[side];
      const move = e => setWidth(side, initial + (e.clientX - start) * (side === 'left' ? 1 : -1));
      const end = () => {
        handle.removeEventListener('pointermove', move);
        localStorage.setItem('panel-widths', JSON.stringify(widths));
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end, { once: true });
      handle.addEventListener('pointercancel', end, { once: true });
    });
    handle.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      setWidth(side, widths[side] + (event.key === 'ArrowRight' ? 10 : -10) * (side === 'left' ? 1 : -1));
      localStorage.setItem('panel-widths', JSON.stringify(widths));
    });
  });
  document.addEventListener('click', event => {
    document.querySelectorAll('.toolbar-menu[open]').forEach(menu => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
})();
