(() => {
  function openDialog(title, build) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const dialog = document.createElement('div');
      dialog.className = 'modal app-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const heading = document.createElement('h2');
      heading.textContent = title;
      dialog.append(heading);
      const previous = document.activeElement;
      const close = value => { document.removeEventListener('keydown', onKey); backdrop.remove(); previous?.focus(); resolve(value); };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
      document.addEventListener('keydown', onKey);
      backdrop.append(dialog); document.body.append(backdrop);
      build(dialog, close);
      dialog.querySelector('input, select, button')?.focus();
    });
  }
  function buttons(dialog, close, confirmText, getValue) {
    const row = document.createElement('div'); row.className = 'dialog-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'm3-btn'; cancel.textContent = 'Скасувати'; cancel.onclick = () => close(null);
    const ok = document.createElement('button'); ok.type = 'submit'; ok.className = 'm3-btn m3-btn-primary'; ok.textContent = confirmText;
    row.append(cancel, ok); dialog.append(row);
    if (dialog.tagName !== 'FORM') ok.onclick = () => close(getValue());
  }
  window.AppDialogs = {
    confirm(message) { return openDialog('Підтвердження', (dialog, close) => { const p = document.createElement('p'); p.textContent = message; dialog.append(p); buttons(dialog, close, 'Підтвердити', () => true); }); },
    alert(message) { return openDialog('Повідомлення', (dialog, close) => { const p = document.createElement('p'); p.textContent = message; const ok = document.createElement('button'); ok.className = 'm3-btn m3-btn-primary'; ok.textContent = 'Зрозуміло'; ok.onclick = () => close(true); dialog.append(p, ok); }); },
    text(title, value = '') { return openDialog(title, (dialog, close) => { const form = document.createElement('form'); const input = document.createElement('input'); input.className = 'dialog-text-input'; input.required = true; input.maxLength = 100; input.value = value; form.append(input); buttons(form, close, 'Зберегти'); form.onsubmit = e => { e.preventDefault(); if (input.value.trim()) close(input.value.trim()); }; dialog.append(form); }); },
    editStyle(preset) {
      return openDialog('Редагування стилю', (dialog, close) => {
        const form = document.createElement('form'); form.className = 'style-editor';
        const fields = {};
        const add = (label, key, type, value, attrs = {}) => {
          const wrapper = document.createElement('label'); wrapper.className = 'style-field';
          const caption = document.createElement('span'); caption.textContent = label;
          const input = document.createElement('input'); input.type = type; input.name = key;
          if (type === 'checkbox') input.checked = !!value; else input.value = value;
          Object.assign(input, attrs); wrapper.append(caption, input); form.append(wrapper); fields[key] = input;
        };
        add('Назва', 'name', 'text', preset.name || '', {required:true, maxLength:100});
        const fontLabel = document.createElement('label'); fontLabel.className = 'style-field'; fontLabel.textContent = 'Шрифт';
        const font = document.createElement('select'); fields.font = font;
        [...new Set([preset.font || 'Arial', ...AppState.fonts])].forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name + " — АбвгҐґ"; opt.style.fontFamily = name; font.append(opt); }); font.value = preset.font || 'Arial'; fontLabel.append(font); form.append(fontLabel);
        add('Колір тексту', 'fill', 'color', preset.fill || '#000000');
        add('Градієнт', 'useGrad', 'checkbox', preset.useGrad);
        add('Другий колір', 'grad2', 'color', preset.grad2 || '#ffffff');
        add('Обводка, px', 'strokeWidth', 'number', preset.strokeWidth ?? 0, {min:0,max:150,step:1});
        add('Колір обводки', 'strokeColor', 'color', preset.strokeColor || '#ffffff');
        add('Світіння, px', 'glowBlur', 'number', preset.glowBlur ?? 0, {min:0,max:150,step:1});
        add('Колір світіння', 'glowColor', 'color', preset.glowColor || '#00e5ff');
        add('Жирний', 'bold', 'checkbox', preset.bold);
        add('Курсив', 'italic', 'checkbox', preset.italic);
        add('Підкреслення', 'underline', 'checkbox', preset.underline);
        add('Закреслення', 'strike', 'checkbox', preset.strike);
        const typeGroup = document.createElement('fieldset'); typeGroup.className = 'style-types';
        const legend = document.createElement('legend'); legend.textContent = 'Автоматично для'; typeGroup.append(legend);
        const selectedTypes = Array.isArray(preset.autoTypes) ? preset.autoTypes : (preset.autoType && preset.autoType !== 'none' ? [preset.autoType] : []);
        [['bubble','Бабл'],['panel','Панель'],['bg','Фон'],['thought','Думки'],['sound','Звук']].forEach(([value, text]) => { const label = document.createElement('label'); const box = document.createElement('input'); box.type='checkbox'; box.value=value; box.checked=selectedTypes.includes(value); label.append(box, document.createTextNode(text)); typeGroup.append(label); });
        form.append(typeGroup);
        dialog.append(form); buttons(form, close, 'Зберегти');
        form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity() || !fields.name.value.trim()) { fields.name.focus(); return; } const result = {}; Object.entries(fields).forEach(([key, input]) => { result[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value.trim(); }); result.autoTypes = [...typeGroup.querySelectorAll('input:checked')].map(input => input.value); close(result); });
      });
    }
  };
})();
