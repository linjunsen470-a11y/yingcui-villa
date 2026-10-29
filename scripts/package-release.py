#!/usr/bin/env python3
"""Create a portable source + compiled offline app + GLB delivery ZIP."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil

root = Path(__file__).resolve().parents[1]
downloads = root / "public" / "downloads"
downloads.mkdir(parents=True, exist_ok=True)
shutil.copy2(root / "models" / "yingcui-villa.glb", downloads / "yingcui-villa.glb")
target = downloads / "yingcui-villa-project.zip"
files = []
for folder in ("src", "public", "docs", "models", "offline", "dist", "scripts"):
    for item in (root / folder).rglob("*"):
        if not item.is_file():
            continue
        relative = item.relative_to(root)
        if folder in ("dist", "public") and "downloads" in relative.parts:
            continue
        if "__pycache__" in relative.parts:
            continue
        files.append(item)
for filename in ("package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", "README.md", "THIRD_PARTY_NOTICES.md", ".gitignore"):
    item = root / filename
    if item.is_file():
        files.append(item)
with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for item in sorted(set(files)):
        archive.write(item, "yingcui-villa/" + item.relative_to(root).as_posix())
with ZipFile(target) as archive:
    problem = archive.testzip()
    if problem:
        raise RuntimeError(f"Invalid ZIP member: {problem}")
    names = set(archive.namelist())
    for required in ("offline/index.html", "offline/app.js", "src/viewer.ts", "models/yingcui-villa.glb", "README.md", "dist/index.html"):
        if "yingcui-villa/" + required not in names:
            raise RuntimeError(f"Missing delivery file: {required}")
print(f"Verified delivery: {target}\n{target.stat().st_size:,} bytes; {len(files)} files")
