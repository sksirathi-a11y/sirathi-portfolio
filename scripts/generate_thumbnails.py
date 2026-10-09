"""Generate compressed grid-size thumbnails for every portfolio image.

The full-resolution originals in assets/img/<category>/ stay untouched (used
by the lightbox when a card is opened). This script creates a matching,
resized+compressed copy of each one under assets/img/thumbs/<category>/ for
the grid to actually download - the grid never needs more than a few hundred
pixels per card, so serving the multi-megabyte original there wastes most of
the download.

Run after adding/removing portfolio images (before or after
generate_manifest.py - order doesn't matter):

    python scripts/generate_thumbnails.py
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
THUMBS_DIR = os.path.join(IMG_DIR, "thumbs")
CATEGORIES = ["banner-ads", "infographic", "logo", "packaging", "poster", "thumbnail", "other"]
VALID_EXT = {".jpg", ".jpeg", ".png"}

MAX_DIM = 900       # longer side, in px - plenty for a grid card even on retina
JPEG_QUALITY = 78

total_before = 0
total_after = 0
written = 0
skipped = 0

removed = 0

for slug in CATEGORIES:
    src_folder = os.path.join(IMG_DIR, slug)
    if not os.path.isdir(src_folder):
        continue
    dst_folder = os.path.join(THUMBS_DIR, slug)
    os.makedirs(dst_folder, exist_ok=True)

    # Drop thumbnails whose source image was since deleted or renamed - a
    # stale thumbnail is still a valid file, so without this the grid would
    # keep showing an image that's supposedly gone.
    current_names = set(os.listdir(src_folder))
    for name in list(os.listdir(dst_folder)):
        if name not in current_names:
            os.remove(os.path.join(dst_folder, name))
            removed += 1

    for name in sorted(os.listdir(src_folder)):
        ext = os.path.splitext(name)[1].lower()
        if ext not in VALID_EXT:
            continue
        src_path = os.path.join(src_folder, name)
        dst_path = os.path.join(dst_folder, name)

        src_size = os.path.getsize(src_path)
        if os.path.exists(dst_path) and os.path.getmtime(dst_path) >= os.path.getmtime(src_path):
            skipped += 1
            total_before += src_size
            total_after += os.path.getsize(dst_path)
            continue

        with Image.open(src_path) as im:
            im = ImageOps.exif_transpose(im)  # bake in EXIF rotation before resizing
            w, h = im.size
            scale = min(1.0, MAX_DIM / max(w, h))
            if scale < 1.0:
                im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

            if ext in (".jpg", ".jpeg"):
                if im.mode != "RGB":
                    im = im.convert("RGB")
                im.save(dst_path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            else:  # .png
                im.save(dst_path, "PNG", optimize=True)

        dst_size = os.path.getsize(dst_path)
        total_before += src_size
        total_after += dst_size
        written += 1

def mb(n):
    return n / (1024 * 1024)

print(f"Thumbnails written: {written}, unchanged/skipped: {skipped}, removed (orphaned): {removed}")
print(f"Source size:  {mb(total_before):.1f} MB")
print(f"Thumbs size:  {mb(total_after):.1f} MB")
if total_before:
    print(f"Reduction:    {100 * (1 - total_after / total_before):.1f}%")
