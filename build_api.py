import json
import os
import shutil

SOURCE_FILE = 'manga-data.json'
API_DIR = 'api'
MANGA_DIR = os.path.join(API_DIR, 'manga')

def main():
    if not os.path.exists(SOURCE_FILE):
        print(f"Error: {SOURCE_FILE} not found.")
        return

    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Create directories
    if os.path.exists(API_DIR):
        shutil.rmtree(API_DIR)
    os.makedirs(MANGA_DIR, exist_ok=True)

    manga_list = []

    for manga in data:
        # Save individual full manga file
        identifier = manga.get('slug') or str(manga.get('id'))
        file_path = os.path.join(MANGA_DIR, f"{identifier}.json")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(manga, f, ensure_ascii=False, indent=2)

        # Create lightweight version for manga-list
        lightweight_manga = {k: v for k, v in manga.items() if k != 'chapters'}
        
        # We need some chapter metadata for the list (latest volume/chapter, and date)
        if manga.get('chapters') and len(manga['chapters']) > 0:
            lightweight_chapters = []
            for ch in manga['chapters']:
                light_ch = {k: v for k, v in ch.items() if k in ['id', 'volume', 'chapter', 'title', 'date']}
                lightweight_chapters.append(light_ch)
            lightweight_manga['chapters'] = lightweight_chapters
        else:
            lightweight_manga['chapters'] = []

        manga_list.append(lightweight_manga)

    # Save lightweight list
    list_path = os.path.join(API_DIR, 'manga-list.json')
    with open(list_path, 'w', encoding='utf-8') as f:
        json.dump(manga_list, f, ensure_ascii=False, indent=2)

    print(f"API built successfully. {len(data)} titles processed.")
    print(f"Lightweight list saved to: {list_path}")
    print(f"Individual files saved to: {MANGA_DIR}")

if __name__ == '__main__':
    main()
