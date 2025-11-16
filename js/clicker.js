import { getClickerData, saveClickerData, saveThemeId, getSavedThemeId, saveThemeMode, getThemeMode } from '../storage-manager.js';
import { loadGiscusForPage } from './giscus-loader.js';

// === КОНФІГУРАЦІЯ МАГАЗИНУ ===

export const SHOP_ITEMS = {
    themes: [
        { id: 'theme_gokuraku', type: 'theme', name: 'Gokuraku', price: 0, colors: { primary: '#2A5AFF', glow: 'rgba(143, 69, 161, 0.5)' } },
        { id: 'theme_love_is_an_illusion', type: 'theme', name: 'Кохання — це ілюзія', price: 500, colors: { primary: '#6E3E92', glow: 'rgba(240, 140, 85,  0.5)' } },
        { id: 'theme_shape_of_symphaty', type: 'theme', name: 'Форма симпатії', price: 1000, colors: { primary: '#7a4945ff', glow: 'rgba(179, 153, 134, 0.5)' } },
        { id: 'theme_merry_marbling', type: 'theme', name: 'Щасливий Мармур', price: 1500, colors: { primary: '#48776dff', glow: 'rgba(150, 230, 240, 0.5)' } },
        { id: 'theme_ichi_the_witch', type: 'theme', name: 'Відьма Ічі', price: 2000, colors: { primary: '#ecba30ff', glow: 'rgba(143, 69, 161, 0.5)' } },
        { id: 'theme_old_style', type: 'theme', name: 'Старий колір', price: 0, colors: { primary: '#00ff99', glow: 'rgba(0, 255, 153, 0.5)' } } 
    ],
    characters: [
        {
            id: 'yugun',
            type: 'character',
            name: 'Юґун',
            image: 'https://files.catbox.moe/u03qqs.webp', // Базове фото для списку персонажів
            skins: [
                { id: 'yugun_default', name: 'Зимовий', image: 'https://files.catbox.moe/u03qqs.webp', price: 0, phrases: ["Чого тобі? Клікай далі.", "Не лізь, холодно.", "Набридло! Відчепись!", "Це не усмішка. Капюшон заважає.", "Ще один клік і пошкодуєш.", "Швидше, бо мерзну!", "Слабко!", "Тихіше. Голова болить.", "Я не граюся!", "Сам напросився..."] },
                { id: 'yugun_dino', name: 'Динозаврик', image: 'https://files.catbox.moe/bw40gw.webp', price: 500, phrases: ["Я не милий! Я хижак!", "Р-р-р! (Невпевнено)", "Ян, це твоя витівка?!", "У ньому жарко, перестань!", "Якого динозавра я нагадую?", "Мої ручки не дістають до тебе.", "Навіщо так багато кліків?!", "Це для маскування.", "Не фотографуй!", "Відстань, рогатий! (Він сам рогатий)"] } 
            ]
        },
        {
            id: 'kyungbin',
            type: 'character',
            name: 'Кьонбін',
            image: 'https://files.catbox.moe/yo2ra0.webp',
            skins: [
                { id: 'kyungbin_default', name: 'Пінгвінчик', image: 'https://files.catbox.moe/yo2ra0.webp', price: 0, phrases: ["Пін-пін! Це я!", "Я вже сходив до тата!", "Ой, я впав!", "Ти бачив Юґуна?", "Морська рибка? Ні?", "Хочу спати...", "У цьому костюмі не поб'єш!", "Ого, ти так швидко клікаєш!", "Оце клац-клац!", "Ти мій друг!"] },
                { id: 'kyungbin_wrapped', name: 'Замотаний', image: 'https://files.catbox.moe/1ywz38.webp', price: 2000, phrases: ["Тепло... Як млинці.", "Сім'я - це важливо.", "Чи можу я ще поспати?", "Я не можу рухатися!", "Ой, здається, я заснув.", "Ти обіймаєш мене?", "Кінець гри? Чи початок?", "Клікай, щоб принести мені чаю!", "Я не зможу тренуватися...", "Баю-бай!"] }
            ]
        },
        {
            id: 'jang',
            type: 'character',
            name: 'Ян',
            image: 'https://files.catbox.moe/q1rsv6.webp',
            skins: [
                { id: 'jang_default', name: 'Зимовий', image: 'https://files.catbox.moe/q1rsv6.webp', price: 0, phrases: ["Дякую за увагу. Я це ціную.", "Будь ласка, клікайте обережно.", "Сподіваюся, я добре виглядаю.", "Ви мене не розкриєте, правда?", "Це для моєї репутації.", "Тільки мама не повинна знати...", "Посмішка – ключ до успіху.", "Ми всі... друзі?", "Можна трохи швидше?", "Усе під контролем, так?"] }
            ]
        },
        {
            id: 'mirye',
            type: 'character',
            name: 'Міре',
            image: 'https://files.catbox.moe/lv26wr.webp',
            skins: [
                { id: 'mirye_default', name: 'Звичайний', image: 'https://files.catbox.moe/lv26wr.webp', price: 0, phrases: ["Час – гроші. Не витрачай мій час.", "Який тут коефіцієнт прибутковості?", "Це інвестиція в моє майбутнє.", "Не забувай про субординацію.", "Я старший за тебе.", "Чому ти так зацікавлений?", "Твої кліки знецінюються!", "Ціна одного кліку?", "Мій одяг – це класика.", "Виглядає дивно... але я заплатив."] }
            ]
        }
    ]
};

let state = {
    coins: 0,
    clickCount: 0,
    unlockedSkins: ['yugun_default', 'mirye_default', 'jang_default', 'kyungbin_default'],
    activeSkinId: 'yugun_default',
    activeCharacterId: 'yugun',
    unlockedThemes: ['theme_gokuraku', 'theme_old_style'],
    activeThemeId: 'theme_gokuraku'
};

export async function initClicker() {
    const clickerTab = document.getElementById('clicker');
    if (!clickerTab) return;

    state = { ...state, ...getClickerData() };

    initThemeSwitcher();
    renderShop(); // Рендеримо весь магазин (теми + персонажі + скіни)
    updateClickerArea();
    setupClickerListeners();
}

function initThemeSwitcher() {
    const currentMode = getThemeMode();
    const radio = document.querySelector(`input[name="theme-mode"][value="${currentMode}"]`);
    if (radio) radio.checked = true;
    applyThemeMode(currentMode);

    const radios = document.querySelectorAll('input[name="theme-mode"]');
    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            const newMode = e.target.value;
            applyThemeMode(newMode);
            saveThemeMode(newMode);
            
            // Перезавантажуємо Giscus, якщо він є на сторінці (хоча в кабінеті його зазвичай нема, але для універсальності)
            const giscusContainer = document.getElementById('giscus-container');
            if (giscusContainer && giscusContainer.innerHTML !== "") {
                // Тут ми не знаємо ID манги, тому просто не чіпаємо, 
                // але в 'reader' і 'title' сторінках giscus сам оновить тему при перезавантаженні сторінки
            }
        });
    });
}

export function applyThemeMode(mode) {
    const html = document.documentElement;
    if (mode === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', systemDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', mode);
    }
}

function updateClickerArea() {
    const char = SHOP_ITEMS.characters.find(c => c.id === state.activeCharacterId);
    let currentSkin = char?.skins.find(s => s.id === state.activeSkinId);
    // Якщо активний скін не належить поточному персонажу (при перемиканні), беремо дефолтний
    if (!currentSkin && char) currentSkin = char.skins[0];
    
    const img = document.getElementById('active-chibik');
    const name = document.getElementById('active-char-name');
    const score = document.getElementById('clicker-score');

    if(img && currentSkin) img.src = currentSkin.image;
    if(name && char) name.textContent = char.name;
    if(score) score.textContent = state.coins;
}

function setupClickerListeners() {
    const clickArea = document.querySelector('.clicker-area');
    if (clickArea) {
        const newArea = clickArea.cloneNode(true);
        clickArea.parentNode.replaceChild(newArea, clickArea);
        newArea.addEventListener('click', (e) => {
            const img = newArea.querySelector('img');
            img.classList.remove('bounce');
            void img.offsetWidth;
            img.classList.add('bounce');

            state.coins += 1;
            state.clickCount += 1;
            document.getElementById('clicker-score').textContent = state.coins;
            saveClickerData(state);

            spawnCoin(e.clientX, e.clientY);

            if (Math.random() < 0.1) showPhrase(newArea);
        });
    }
}

// === SHOP RENDERING ===
function renderShop() {
    // 1. ТЕМИ
    const themesContainer = document.getElementById('themes-list');
    if (themesContainer) {
        let html = '';
        SHOP_ITEMS.themes.forEach(theme => {
            const unlocked = state.unlockedThemes.includes(theme.id);
            const active = state.activeThemeId === theme.id;
            html += createThemeCard(theme, unlocked, active);
        });
        themesContainer.innerHTML = html;
    }

    // 2. ПЕРСОНАЖІ (Список для вибору)
    const charsContainer = document.getElementById('characters-list');
    if (charsContainer) {
        let html = '';
        SHOP_ITEMS.characters.forEach(char => {
            const active = state.activeCharacterId === char.id;
            // Персонаж доступний завжди, але скіни треба купувати.
            html += createCharacterCard(char, active); 
        });
        charsContainer.innerHTML = html;
    }

    // 3. СКІНИ (Для активного персонажа)
    const skinsContainer = document.getElementById('skins-list');
    const currentChar = SHOP_ITEMS.characters.find(c => c.id === state.activeCharacterId);
    
    if (skinsContainer && currentChar) {
        let html = '';
        currentChar.skins.forEach(skin => {
            const unlocked = state.unlockedSkins.includes(skin.id);
            const active = state.activeSkinId === skin.id;
            html += createSkinCard(skin, unlocked, active);
        });
        skinsContainer.innerHTML = html;
    }

    // Attach listeners globally for shop items
    document.querySelectorAll('.shop-btn, .character-card').forEach(btn => {
        // Remove old listeners to be safe (though rewriting innerHTML usually clears them)
        btn.removeEventListener('click', handleShopClick);
        btn.addEventListener('click', handleShopClick);
    });
}

function createThemeCard(theme, unlocked, active) {
    let btnText = active ? 'Вибрано' : (unlocked ? 'Вибрати' : `${theme.price} 🪙`);
    let btnClass = active ? 'shop-btn active' : (unlocked ? 'shop-btn unlocked' : 'shop-btn');
    let action = active ? 'none' : (unlocked ? 'select_theme' : 'buy_theme');

    return `
        <div class="shop-item ${unlocked ? 'unlocked-item' : ''}">
            <div class="theme-preview" style="transform: rotate(45deg); box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                <div style="flex:1; background:${theme.colors.primary}"></div>
                <div style="flex:1; background:${theme.colors.glow}"></div>
            </div>
            <div class="shop-item-name">${theme.name}</div>
            <button class="${btnClass}" data-action="${action}" data-id="${theme.id}" data-price="${theme.price}">${btnText}</button>
        </div>
    `;
}

function createCharacterCard(char, active) {
    // Картка для вибору персонажа (просто клік по картці)
    return `
        <div class="shop-item character-card ${active ? 'active-character-card' : ''}" 
             data-action="select_char" 
             data-id="${char.id}">
            <img src="${char.image}" class="chibik-preview" alt="${char.name}">
            <div class="shop-item-name">${char.name}</div>
        </div>
    `;
}

function createSkinCard(skin, unlocked, active) {
    let btnText = active ? 'Вибрано' : (unlocked ? 'Вибрати' : `${skin.price} 🪙`);
    let btnClass = active ? 'shop-btn active' : (unlocked ? 'shop-btn unlocked' : 'shop-btn');
    let action = active ? 'none' : (unlocked ? 'select_skin' : 'buy_skin');

    return `
        <div class="shop-item skin-item ${unlocked ? 'unlocked-item' : ''}">
            <img src="${skin.image}" class="chibik-preview" alt="${skin.name}">
            <div class="shop-item-name">${skin.name}</div>
            <button class="${btnClass}" data-action="${action}" data-id="${skin.id}" data-price="${skin.price}">${btnText}</button>
        </div>
    `;
}

function handleShopClick(e) {
    // Handle clicks on buttons OR character cards
    let target = e.currentTarget;
    
    const action = target.dataset.action;
    const id = target.dataset.id;
    const price = parseInt(target.dataset.price) || 0;

    if (!action || action === 'none') return;

    if (action === 'select_char') {
        state.activeCharacterId = id;
        // Reset skin to default if active skin doesn't belong to new char
        const char = SHOP_ITEMS.characters.find(c => c.id === id);
        const hasActiveSkin = char.skins.some(s => s.id === state.activeSkinId);
        
        if (!hasActiveSkin) {
             // Try to find unlocked skin, else default
             const unlockedSkin = char.skins.find(s => state.unlockedSkins.includes(s.id));
             state.activeSkinId = unlockedSkin ? unlockedSkin.id : char.skins[0].id;
        }
    }
    else if (action === 'buy_theme') {
        if (state.coins >= price) {
            state.coins -= price;
            state.unlockedThemes.push(id);
            state.activeThemeId = id;
            applyTheme(SHOP_ITEMS.themes.find(t => t.id === id));
        } else { alert("Мало грошей!"); return; }
    }
    else if (action === 'select_theme') {
        state.activeThemeId = id;
        applyTheme(SHOP_ITEMS.themes.find(t => t.id === id));
    }
    else if (action === 'buy_skin') {
        if (state.coins >= price) {
            state.coins -= price;
            state.unlockedSkins.push(id);
            state.activeSkinId = id;
        } else { alert("Мало грошей!"); return; }
    }
    else if (action === 'select_skin') {
        state.activeSkinId = id;
    }

    saveClickerData(state);
    saveThemeId(state.activeThemeId);
    
    renderShop();
    updateClickerArea();
    document.getElementById('clicker-score').textContent = state.coins;
}

function spawnCoin(x, y) {
    const coin = document.createElement('div');
    coin.className = 'clicker-coin';
    coin.textContent = '+1';
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    document.body.appendChild(coin);
    setTimeout(() => coin.remove(), 1000);
}

function showPhrase(container) {
    const char = SHOP_ITEMS.characters.find(c => c.id === state.activeCharacterId);
    let currentSkin = char?.skins.find(s => s.id === state.activeSkinId);
    if (!currentSkin) currentSkin = char?.skins[0];

    const phrases = currentSkin?.phrases || ["..."];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    
    const bubble = document.createElement('div');
    bubble.className = 'chibik-bubble';
    bubble.textContent = text;
    
    // Центруємо бульбашку над клікером
    container.appendChild(bubble);
    
    // Анімація
    setTimeout(() => {
        bubble.style.opacity = '1';
        bubble.style.transform = 'translate(-50%, -50px)';
    }, 10);

    setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translate(-50%, -80px)';
        setTimeout(() => bubble.remove(), 300);
    }, 1500);
}

export function applyTheme(themeObj) {
    if (!themeObj) return;
    document.documentElement.style.setProperty('--accent-color', themeObj.colors.primary);
    document.documentElement.style.setProperty('--glow-color', themeObj.colors.glow);
    saveThemeId(themeObj.id);
}