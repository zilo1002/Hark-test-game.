#!/usr/bin/env python3
"""Fail Android packaging if shared doll artwork is missing, stale, or corrupted."""
from pathlib import Path
import re
import sys
import zipfile

apk = Path(sys.argv[1])
source = Path(__file__).resolve().parents[1] / "harvest"
source_js = (source / "js" / "doll-art.js").read_text(encoding="utf-8")
activity_java = (Path(__file__).resolve().parent / "app/src/main/java/com/zilo/banmuharvest/MainActivity.java").read_text(encoding="utf-8")
files_block = re.search(r"const FILES = \{(.*?)\n\};", source_js, re.S)
if not files_block:
    raise SystemExit("Could not read doll artwork map from harvest/js/doll-art.js")
referenced = set(re.findall(r":\s*'([^']+)'", files_block.group(1)))
if not referenced:
    raise SystemExit("Doll artwork map contains no files")
expected = {f"assets/harvest/assets/dolls/{name}" for name in referenced}
extensions = {Path(name).suffix.lstrip(".").lower() for name in referenced}
mime_map = dict(re.findall(r'MIME\.put\("([^"]+)",\s*"([^"]+)"\)', activity_java))
missing_mime = sorted(ext for ext in extensions if not mime_map.get(ext, "").startswith("image/"))
if missing_mime:
    raise SystemExit("Android WebView MIME map is missing image types for: " + ", ".join(missing_mime))
all_source_assets = {
    f"assets/harvest/assets/dolls/{p.relative_to(source / 'assets' / 'dolls').as_posix()}"
    for p in (source / "assets" / "dolls").rglob("*") if p.is_file()
}
with zipfile.ZipFile(apk) as archive:
    damaged = archive.testzip()
    if damaged:
        raise SystemExit(f"APK contains a corrupt ZIP entry: {damaged}")
    actual = set(archive.namelist())
    missing = sorted(expected - actual)
    if missing:
        raise SystemExit("APK is missing referenced doll assets:\n  " + "\n  ".join(missing))
    missing_all = sorted(all_source_assets - actual)
    if missing_all:
        raise SystemExit("APK is missing artwork files from the source tree:\n  " + "\n  ".join(missing_all))
    stale_or_changed = sorted(name for name in all_source_assets if archive.read(name) != (source / "assets" / "dolls" / name.removeprefix("assets/harvest/assets/dolls/")).read_bytes())
    if stale_or_changed:
        raise SystemExit("APK artwork differs from the current source files:\n  " + "\n  ".join(stale_or_changed))
    bad_images = []
    for name in all_source_assets:
        data = archive.read(name)
        suffix = Path(name).suffix.lower()
        if suffix == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
            bad_images.append(name)
        elif suffix == ".webp" and (len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP"):
            bad_images.append(name)
    if bad_images:
        raise SystemExit("APK contains artwork with invalid image headers:\n  " + "\n  ".join(sorted(bad_images)))
print(f"APK doll-art check passed: {len(expected)} referenced images; {len(all_source_assets)} current, valid artwork files bundled")
