'use strict';

(() => {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('shortcut-dialog');
  const rows = byId('shortcut-rows');
  const status = byId('shortcut-status');
  const help = 'Обери поле й натисни клавішу або комбінацію.';
  const storageKey = 'klin.shortcuts.v1';
  const primary = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Ctrl';
  const actions = [
    ['add', 'Додати сторінки'],
    ['export', 'Експорт ZIP'],
    ['undo', 'Скасувати', primary + '+KeyZ'],
    ['redo', 'Повторити', primary + '+Shift+KeyZ', primary + '+KeyY'],
    ['pan', 'Рука', 'KeyV'],
    ['paint', 'Пензель', 'KeyB'],
    ['pick', 'Піпетка', 'KeyI'],
    ['mask', 'ШІ-маска', 'KeyX'],
    ['clean', 'Очистити маску', 'Enter'],
    ['clear', 'Скинути маску'],
    ['prev', 'Попередня сторінка', 'ArrowLeft'],
    ['next', 'Наступна сторінка', 'ArrowRight'],
    ['smaller', 'Зменшити масштаб'],
    ['larger', 'Збільшити масштаб'],
    ['fit', 'Умістити по ширині'],
    ['toggle-panel', 'Показати або сховати панель'],
    ['pages-tab', 'Вкладка «Сторінки»'],
    ['tools-tab', 'Вкладка «Інструменти»'],
    ['shortcuts', 'Налаштувати клавіші'],
  ].map(([id, name, first = '', second = '']) => ({
    id, name,
    defaults: [first, second],
    button: document.querySelector(`button[data-tool="${id}"]`) || byId(id),
  }));

  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {}
  for (const action of actions) {
    action.keys = Array.isArray(stored[action.id]) && stored[action.id].length === 2
      && stored[action.id].every((key) => typeof key === 'string')
      ? [...stored[action.id]] : [...action.defaults];
  }

  let capture;
  const displayCodes = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Пробіл',
    Equal: '=', Minus: '−', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`',
  };

  function human(key) {
    return key.split('+').map((part) => displayCodes[part] || part.replace(/^(Key|Digit)/, '')).join(' + ');
  }

  function updateLabels() {
    for (const action of actions) {
      const labels = action.keys.filter(Boolean).map(human);
      action.button.title = labels.length ? `${action.name} (${labels.join(' / ')})` : action.name;
      for (const [i, slot] of action.slots.entries()) {
        const key = action.keys[i];
        slot.button.textContent = capture?.slot === slot ? 'Натисни…' : key ? human(key) : '—';
        slot.button.setAttribute('aria-pressed', String(capture?.slot === slot));
        slot.remove.hidden = !key;
      }
    }
    for (const id of ['paint', 'mask']) {
      const key = actions.find((action) => action.id === id).keys.find(Boolean);
      byId(id + '-key').hidden = !key;
      byId(id + '-key').textContent = key ? human(key) : '';
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(actions.map(({ id, keys }) => [id, keys]))));
      status.textContent = help;
    } catch {
      status.textContent = 'Клавіші діятимуть до закриття вкладки.';
    }
    updateLabels();
  }

  function endCapture() {
    capture = null;
    status.textContent = help;
    updateLabels();
  }

  function makeRow(action) {
    const row = rows.insertRow();
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = action.name;
    row.append(name);
    return action.keys.map((_, i) => {
      const slot = document.createElement('div');
      slot.className = 'shortcut-slot';
      const button = document.createElement('button');
      button.className = 'shortcut-capture';
      button.setAttribute('aria-label', `${action.name} · комбінація ${i + 1}`);
      const remove = document.createElement('button');
      remove.className = 'shortcut-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Очистити комбінацію ${i + 1} · ${action.name}`);
      const item = { button, remove };
      button.onclick = () => {
        if (capture?.slot === item) return endCapture();
        capture = { action, index: i, slot: item };
        status.textContent = 'Натисни комбінацію. Esc виходить із запису.';
        updateLabels();
      };
      remove.onclick = () => {
        capture = null;
        action.keys[i] = '';
        save();
        button.focus();
      };
      slot.append(button, remove);
      row.insertCell().append(slot);
      return item;
    });
  }

  for (const action of actions) action.slots = makeRow(action);
  updateLabels();
  function signature(event) {
    const code = event.code === 'NumpadEnter' ? 'Enter' : event.code;
    if (!code || ['Tab', 'Escape'].includes(code) || /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(code)) return '';
    return [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.metaKey && 'Meta', event.shiftKey && 'Shift', code]
      .filter(Boolean).join('+');
  }

  dialog.addEventListener('keydown', (event) => {
    if (!capture) return;
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      endCapture();
      return;
    }
    const key = signature(event);
    if (!key) return;
    event.preventDefault();
    if (event.repeat) return;
    const { action, index } = capture;
    const conflict = actions.find((other) => other.keys.some((value, slot) =>
      value === key && (other !== action || slot !== index)));
    if (conflict) {
      status.textContent = `${human(key)} уже призначено для «${conflict.name}».`;
      return;
    }
    action.keys[index] = key;
    capture = null;
    save();
  });

  byId('shortcuts').onclick = () => {
    hideLoupe();
    dialog.showModal();
  };
  byId('shortcut-close').onclick = () => dialog.close();
  byId('shortcut-reset').onclick = () => {
    capture = null;
    for (const action of actions) action.keys = [...action.defaults];
    save();
  };
  dialog.addEventListener('close', endCapture);

  document.addEventListener('keydown', (event) => {
    if (dialog.open || gesture || pinch || event.defaultPrevented || event.isComposing
      || event.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const key = signature(event);
    if (!key || (['Enter', 'Space'].includes(key) && event.target.closest?.('button'))) return;
    const action = actions.find((item) => item.keys.includes(key));
    if (!action || action.button.disabled) return;
    event.preventDefault();
    if (event.repeat && ['add', 'export', 'clean', 'toggle-panel', 'shortcuts'].includes(action.id)) return;
    if (['pages-tab', 'tools-tab'].includes(action.id) && panel.inert) byId('toggle-panel').click();
    action.button.click();
  });
})();
