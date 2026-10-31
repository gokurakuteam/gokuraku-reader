import json
import os
import shutil

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

    # Create directories
    if os.path.exists(API_DIR):
        shutil.rmtree(API_DIR)
    os.makedirs(MANGA_DIR, exist_ok=True)

    manga_list = []

    for manga in data:
        # Save individual full manga file with all chapters and details
        identifier = manga.get('slug') or str(manga.get('id'))
        file_path = os.path.join(MANGA_DIR, f"{identifier}.json")
        
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
            latest_ch = chapters[-1]
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
    list_path = os.path.join(API_DIR, 'manga-list.json')
    with open(list_path, 'w', encoding='utf-8') as f:
        json.dump(manga_list, f, ensure_ascii=False)

    print(f"API built successfully. {len(data)} titles processed.")
    print(f"Lightweight list saved to: {list_path}")
    print(f"Individual files saved to: {MANGA_DIR}")

if __name__ == '__main__':
    main()
