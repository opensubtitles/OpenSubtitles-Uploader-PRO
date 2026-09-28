#!/usr/bin/env bash
#
# Assert that the AppStream metainfo file actually made it into the AppImage.
#
# Why this check exists: the file is placed by `bundle.linux.appimage.files` in
# tauri.conf.json, whose source paths are resolved against the bundler's working
# directory. Tauri's schema does not document what that directory is, and
# copy_custom_files() in tauri-bundler falls through to copy_dir() when the
# source does not resolve as a file — so a wrong path does not necessarily fail
# the build, it just silently produces an AppImage with no metadata. Without
# metainfo the appimage.github.io catalog page falls back to an auto-generated
# name and its own screenshot of the app.
#
# Usage: scripts/verify-appimage-metainfo.sh <path-to-.AppImage>

set -euo pipefail

APPIMAGE="${1:-}"
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "usage: $0 <path-to-.AppImage>" >&2
  exit 2
fi

EXPECTED="usr/share/metainfo/com.opensubtitles.uploader.pro.v2.metainfo.xml"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$APPIMAGE" "$WORK/candidate.AppImage"
chmod +x "$WORK/candidate.AppImage"
( cd "$WORK" && ./candidate.AppImage --appimage-extract >/dev/null )

FOUND="$WORK/squashfs-root/$EXPECTED"
if [ ! -f "$FOUND" ]; then
  echo "::error::AppImage is missing $EXPECTED"
  echo "Contents of usr/share/metainfo (if any):"
  ls -la "$WORK/squashfs-root/usr/share/metainfo" 2>/dev/null || echo "   (no metainfo directory at all)"
  echo
  echo "Check the source path in bundle.linux.appimage.files in src-tauri/tauri.conf.json;"
  echo "it is resolved against the bundler's working directory, not the repo root."
  exit 1
fi

# Present but malformed would still break the catalog page, so parse it and
# confirm the fields the catalog actually reads.
if command -v appstreamcli >/dev/null 2>&1; then
  appstreamcli validate --no-net "$FOUND"
else
  python3 - "$FOUND" <<'PY'
import sys, xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
missing = [f for f in ("id", "name", "summary", "metadata_license", "project_license")
           if not (root.findtext(f) or "").strip()]
if missing:
    sys.exit(f"::error::metainfo is missing required fields: {', '.join(missing)}")
if root.find(".//screenshots/screenshot/image") is None:
    sys.exit("::error::metainfo declares no screenshot, so the catalog will use its own")
print(f"   id:   {root.findtext('id')}")
print(f"   name: {root.findtext('name')}")
PY
fi

echo "✅ AppImage ships $EXPECTED"
