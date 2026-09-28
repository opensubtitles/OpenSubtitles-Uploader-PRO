#!/usr/bin/env bash
#
# Assert that every payload entry inside a built AppImage is usable by a user
# other than the one that built it.
#
# Why this check exists: Tauri's AppImage bundler caches the upstream AppRun
# binary and writes it with mode 0770 (tauri-bundler
# src/bundle/linux/appimage/mod.rs::write_and_make_executable), then copies that
# file into the AppDir with its mode intact. linuxdeploy-plugin-gtk renames it to
# AppRun.wrapped and puts a shell AppRun in front of it. 0770 leaves the "other"
# class with no read or execute bit, so as soon as the AppImage runs as anyone
# but its builder it dies with:
#
#   /run/firejail/appimage/AppRun: line 12: .../AppRun.wrapped: Permission denied
#
# which is exactly how the appimage.github.io catalog test (it runs candidates
# under firejail) reported OpenSubtitles Uploader PRO 1.8.24 as crashing on
# startup. The build fixes this by pre-seeding the cached AppRun with 0755; this
# script is the guard that keeps a regression from shipping.
#
# Usage: scripts/verify-appimage-permissions.sh <path-to-.AppImage>

set -euo pipefail

APPIMAGE="${1:-}"
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "usage: $0 <path-to-.AppImage>" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$APPIMAGE" "$WORK/candidate.AppImage"
chmod +x "$WORK/candidate.AppImage"

# --appimage-extract is handled by the embedded type-2 runtime and needs no FUSE.
( cd "$WORK" && ./candidate.AppImage --appimage-extract >/dev/null )

ROOT="$WORK/squashfs-root"
if [ ! -d "$ROOT" ]; then
  echo "::error::failed to extract $APPIMAGE" >&2
  exit 1
fi

# Three ways an entry can be unusable by another user:
#   - a regular file nobody else can read
#   - a regular file the owner can execute but others cannot
#   - a directory nobody else can traverse
BAD="$(
  {
    find "$ROOT" -type f ! -perm -004
    find "$ROOT" -type f -perm -100 ! -perm -001
    find "$ROOT" -type d ! -perm -005
  } | sort -u
)"

if [ -n "$BAD" ]; then
  echo "❌ AppImage contains entries that are not accessible to other users:"
  while IFS= read -r entry; do
    printf '   %s  %s\n' "$(stat -c '%A' "$entry")" "${entry#"$ROOT"/}"
    echo "::error::AppImage entry not accessible to other users: ${entry#"$ROOT"/} ($(stat -c '%A' "$entry"))"
  done <<< "$BAD"
  echo
  echo "This is the failure mode reported by the appimage.github.io catalog test."
  exit 1
fi

echo "✅ AppImage permissions OK — every entry is readable/traversable by other users"
stat -c '   %A  %n' "$ROOT/AppRun" "$ROOT/AppRun.wrapped" 2>/dev/null || true
