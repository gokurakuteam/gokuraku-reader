import json
import os
import shutil
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_FILE = os.path.join(BASE_DIR, 'manga-data.json')
API_DIR = os.path.join(BASE_DIR, 'api')
MANGA_DIR = os.path.join(API_DIR, 'manga')

def main():
    if not os.path.exists(SOURCE_FILE):
        print(f"Error: {SOURCE_FILE} not found.")
        return

    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build into temporary directory, then atomically replace
    TMP_API_DIR = API_DIR + '_tmp'
    TMP_MANGA_DIR = os.path.join(TMP_API_DIR, 'manga')
    
    if os.path.exists(TMP_API_DIR):
        shutil.rmtree(TMP_API_DIR)
    os.makedirs(TMP_MANGA_DIR, exist_ok=True)

    manga_list = []

    for manga in data:
        # Save individual full manga file with all chapters and details
        identifier = manga.get('slug') or str(manga.get('id'))
        # Validate identifier to prevent path traversal
        if not re.match(r'^[a-zA-Z0-9_-]+$', str(identifier)):
            print(f"Warning: Skipping invalid identifier '{identifier}' for title '{manga.get('title', 'Unknown')}'")
            continue
        file_path = os.path.join(TMP_MANGA_DIR, f"{identifier}.json")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(manga, f, ensure_ascii=False, indent=2)

        # Create lightweight version for manga-list (Home & Catalog)
        # Excludes heavy descriptions and redundant arrays
        lightweight_manga = {
            'id': manga.get('id'),
            'slug': manga.get('slug', str(manga.get('id'))),
            'title': manga.get('title', ''),
            'coverImage': manga.get('coverImage', ''),
            'volumeCovers': manga.get('volumeCovers', {}),
            'extraCovers': manga.get('extraCovers', []),
            'teams': manga.get('teams', []),
            'backgroundImage': manga.get('backgroundImage', ''),
            'pageUrl': manga.get('pageUrl', f"#title?id={manga.get('slug', manga.get('id'))}"),
            'genres': manga.get('genres', []),
            'type': manga.get('type', ''),
            'status': manga.get('status', ''),
            'latestUpdate': manga.get('latestUpdate', '')
        }
        
        # We need latest chapter metadata for Home updates and Catalog last-chapter badge
        chapters = manga.get('chapters', [])
        lightweight_manga['totalChapters'] = len(chapters)
        if chapters:
            # Sort chapters by chapter number to correctly identify the latest
            sorted_chs = sorted(chapters, key=lambda c: (float(c.get('chapter', 0)),))
            latest_ch = sorted_chs[-1]
            lightweight_manga['chapters'] = [{
                'id': latest_ch.get('id'),
                'volume': latest_ch.get('volume', 1),
                'chapter': latest_ch.get('chapter', 1),
                'date': latest_ch.get('date', ''),
                'teams': latest_ch.get('teams', [])
            }]
            lightweight_manga['lastChapter'] = latest_ch.get('chapter')
        else:
            lightweight_manga['chapters'] = []
            lightweight_manga['lastChapter'] = None

        manga_list.append(lightweight_manga)

    # Save lightweight list
    list_path = os.path.join(TMP_API_DIR, 'manga-list.json')
    with open(list_path, 'w', encoding='utf-8') as f:
        json.dump(manga_list, f, ensure_ascii=False)

    # Atomic swap: replace old API directory with new one
    old_api = API_DIR + '_old'
    if os.path.exists(old_api):
        shutil.rmtree(old_api)
    if os.path.exists(API_DIR):
        os.rename(API_DIR, old_api)
    os.rename(TMP_API_DIR, API_DIR)
    if os.path.exists(old_api):
        shutil.rmtree(old_api)

    final_list_path = os.path.join(API_DIR, 'manga-list.json')
    print(f"API built successfully. {len(data)} titles processed.")
    print(f"Lightweight list saved to: {final_list_path}")
    print(f"Individual files saved to: {MANGA_DIR}")

if __name__ == '__main__':
    main()
