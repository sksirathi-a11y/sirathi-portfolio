"""Apply replacement/new images dropped into assets/img/_incoming/<category>/.

Drop files into the matching category subfolder under _incoming (same
category names used under assets/img/: banner-ads, infographic, logo,
packaging, poster, thumbnail, other), then run this script - or just
double-click update_images.bat in the project root, which does the same
thing without needing a terminal.

Why this exists: dragging a replacement file directly onto an existing one
of the same name in File Explorer sometimes gets silently skipped when
Explorer decides the two "look the same" (same name/size/date), even
though the content is actually different. Dropping into an empty _incoming
folder instead never collides with anything, so the copy always happens -
and this script does the actual move+overwrite itself (not Explorer's
copy dialog), so there's no "same file, skip" heuristic to trip over.

This will, for every file found under _incoming/<category>/:
  - move it into assets/img/<category>/, overwriting any existing file of
    the same name
  - stamp a fresh modified time on it, so the site's cache-busting
    ("?v=...") always sees a change even if the new file happens to match
    the old one's size/date
  - regenerate manifest.json and the thumbnails to match

    python scripts/apply_incoming.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
INCOMING_DIR = os.path.join(IMG_DIR, "_incoming")
CATEGORIES = ["banner-ads", "infographic", "logo", "packaging", "poster", "thumbnail", "other"]
VALID_EXT = {".jpg", ".jpeg", ".png"}

applied = []
for slug in CATEGORIES:
    src_folder = os.path.join(INCOMING_DIR, slug)
    if not os.path.isdir(src_folder):
        continue
    dst_folder = os.path.join(IMG_DIR, slug)
    os.makedirs(dst_folder, exist_ok=True)
    for name in sorted(os.listdir(src_folder)):
        if os.path.splitext(name)[1].lower() not in VALID_EXT:
            continue
        src_path = os.path.join(src_folder, name)
        dst_path = os.path.join(dst_folder, name)
        replaced = os.path.exists(dst_path)
        if replaced:
            os.remove(dst_path)
        shutil.move(src_path, dst_path)
        os.utime(dst_path, None)
        applied.append((slug, name, "replaced" if replaced else "added"))

if not applied:
    print("Nothing found in assets/img/_incoming/<category>/ - drop files there first.")
    sys.exit(0)

print(f"Applied {len(applied)} file(s):")
for slug, name, action in applied:
    print(f"  [{action}] {slug}/{name}")

print()
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "generate_manifest.py")], check=True)
print()
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "generate_thumbnails.py")], check=True)
