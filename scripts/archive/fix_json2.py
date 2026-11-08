import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(BASE_DIR, 'manga-data.json')

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

for manga in data:
    for ch in manga.get('chapters', []):
        content = ch.get('content')
        if content and isinstance(content, str):
            # Remove any literal '\\n'
            ch['content'] = content.replace('\\n', '')

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Fixed JSON again.")
