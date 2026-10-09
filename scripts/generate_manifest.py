"""Scan assets/img/<category>/ and write assets/img/manifest.json.

Run this after adding/removing portfolio images so the website picks up
the changes without editing any HTML:

    python scripts/generate_manifest.py
"""
import json
import locale
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
CATEGORIES = ["banner-ads", "infographic", "logo", "packaging", "poster", "thumbnail", "other"]
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}

# Plain sorted() compares by raw Unicode code point, which puts every
# Latin-named file before every Thai-named one (Thai letters start around
# U+0E01, far above 'a'-'z') - two filenames that would sit right next to
# each other alphabetically end up in different halves of the list. Sorting
# with Thai collation interleaves them the way a person actually alphabetizes
# mixed Thai/English names. Not every machine has this locale installed, so
# fall back to plain sorted() rather than crashing the whole script over it.
try:
    locale.setlocale(locale.LC_COLLATE, "Thai_Thailand")
    sort_key = locale.strxfrm
except locale.Error:
    print("Warning: Thai locale unavailable, falling back to Unicode code point sort.")
    sort_key = None

manifest = {}
for slug in CATEGORIES:
    folder = os.path.join(IMG_DIR, slug)
    # Maps filename -> source mtime, so the site can append it as a "?v="
    # cache-buster - replacing a file's content under the same name (a
    # common edit) would otherwise keep serving whatever browsers already
    # cached for that URL.
    files = {}
    if os.path.isdir(folder):
        for name in sorted(os.listdir(folder), key=sort_key):
            if os.path.splitext(name)[1].lower() in VALID_EXT:
                files[name] = int(os.path.getmtime(os.path.join(folder, name)))
    manifest[slug] = files

out_path = os.path.join(IMG_DIR, "manifest.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

total = sum(len(v) for v in manifest.values())
print(f"Wrote {out_path}")
for slug, files in manifest.items():
    print(f"  {slug}: {len(files)} files")
print(f"Total: {total} files")
