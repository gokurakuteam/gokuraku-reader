const keys = ['mangaBookmarks', 'mangaHistory', 'gokuClickerData', 'gokuActiveThemeId', 'gokuThemeMode', 'gokuSelectedCover', 'gokuReaderSettings', 'reader-settings', 'catalog_view_mode'];
const jsonKeys = new Set(['mangaBookmarks', 'mangaHistory', 'gokuClickerData', 'gokuSelectedCover', 'gokuReaderSettings', 'reader-settings']);

export function initBackup() {
    const input = document.querySelector('#backup-file');
    const message = document.querySelector('#backup-message');
    document.querySelector('#backup-export').addEventListener('click', () => {
        const data = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
        const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'gokuraku-backup', version: 1, data }, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `gokuraku-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.textContent = 'Резервну копію збережено.';
    });
    document.querySelector('#backup-import').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error();
            const backup = JSON.parse(await file.text());
            if (backup.format !== 'gokuraku-backup' || backup.version !== 1 || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) throw new Error();
            for (const key of keys) {
                const value = backup.data[key];
                if (value !== null && typeof value !== 'string') throw new Error();
                if (value !== null && jsonKeys.has(key)) {
                    const parsed = JSON.parse(value);
                    if (key === 'mangaHistory' ? !Array.isArray(parsed) : !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
                    if (key === 'mangaBookmarks' && (!Array.isArray(parsed.categories) || !parsed.categories.every(c => c && typeof c.name === 'string' && Array.isArray(c.mangaIds)))) throw new Error();
                }
            }
            if (!confirm('Відновлення замінить поточні закладки, історію та налаштування даними з копії. Продовжити?')) return;
            const previous = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
            try {
                for (const key of keys) backup.data[key] === null ? localStorage.removeItem(key) : localStorage.setItem(key, backup.data[key]);
            } catch (error) {
                for (const key of keys) previous[key] === null ? localStorage.removeItem(key) : localStorage.setItem(key, previous[key]);
                throw error;
            }
            location.reload();
        } catch (error) {
            message.textContent = 'Не вдалося відновити копію. Перевірте файл і доступне місце в браузері.';
        } finally {
            input.value = '';
        }
    });
}
