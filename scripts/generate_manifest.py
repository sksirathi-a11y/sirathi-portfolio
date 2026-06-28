"""Scan assets/img/<category>/ and write assets/img/manifest.json.

Run this after adding/removing portfolio images so the website picks up
the changes without editing any HTML:

    python scripts/generate_manifest.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
CATEGORIES = ["banner-ads", "infographic", "logo", "packaging", "poster", "thumbnail", "other"]
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}

manifest = {}
for slug in CATEGORIES:
    folder = os.path.join(IMG_DIR, slug)
    files = []
    if os.path.isdir(folder):
        for name in sorted(os.listdir(folder)):
            if os.path.splitext(name)[1].lower() in VALID_EXT:
                files.append(name)
    manifest[slug] = files

out_path = os.path.join(IMG_DIR, "manifest.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

total = sum(len(v) for v in manifest.values())
print(f"Wrote {out_path}")
for slug, files in manifest.items():
    print(f"  {slug}: {len(files)} files")
print(f"Total: {total} files")
