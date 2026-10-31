import json

with open('/home/heorhii/Проєкти/gokuraku-reader-main/manga-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for manga in data:
    if manga.get('slug') == 'lykhodii-khoche-zhyty':
        for ch in manga.get('chapters', []):
            content = ch.get('content')
            if content and isinstance(content, str):
                # The content currently has a single <p> tag?
                # Let's just re-parse it from the raw string without <p> tags
                raw_text = content.replace('<p>', '').replace('</p>', '').replace('<p style="text-align: center;">', '')
                # The raw text might have literal '\n' as substrings if it was saved wrong, but python json.load converts escape sequences.
                # Actually, in JSON, it was saved as `\\n` (backslash-n), so json.load gives literal `\n`.
                
                paragraphs = raw_text.splitlines() if '\n' in raw_text else raw_text.split('\\n')
                
                formatted = ''
                for p in paragraphs:
                    p = p.strip()
                    if p:
                        if p in ['***', '* * *']:
                            formatted += f'<p style="text-align: center;">{p}</p>\n'
                        else:
                            formatted += f'<p>{p}</p>\n'
                ch['content'] = formatted

with open('/home/heorhii/Проєкти/gokuraku-reader-main/manga-data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Fixed JSON.")
