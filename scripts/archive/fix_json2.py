import json

with open('/home/heorhii/Проєкти/gokuraku-reader-main/manga-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for manga in data:
    for ch in manga.get('chapters', []):
        content = ch.get('content')
        if content and isinstance(content, str):
            # Remove any literal '\\n'
            ch['content'] = content.replace('\\n', '')

with open('/home/heorhii/Проєкти/gokuraku-reader-main/manga-data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Fixed JSON again.")
