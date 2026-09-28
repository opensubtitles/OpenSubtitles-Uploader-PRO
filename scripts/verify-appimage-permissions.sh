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
# The modes are read out of the squashfs with unsquashfs rather than by
# extracting and stat'ing the result. Extraction does not faithfully reproduce
# stored directory modes - the embedded runtime creates directories using the
# caller's umask, so an earlier version of this script reported every directory
# in the image as 0700 purely because of how it had extracted them. Only the
# stored modes say anything about what other users will see.
#
# Usage: scripts/verify-appimage-permissions.sh <path-to-.AppImage>

set -euo pipefail

APPIMAGE="${1:-}"
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "usage: $0 <path-to-.AppImage>" >&2
  exit 2
fi

if ! command -v unsquashfs >/dev/null 2>&1; then
  echo "::error::unsquashfs not found; install squashfs-tools" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$APPIMAGE" "$WORK/candidate.AppImage"
chmod +x "$WORK/candidate.AppImage"

OFFSET="$("$WORK/candidate.AppImage" --appimage-offset)"
unsquashfs -lln -o "$OFFSET" "$WORK/candidate.AppImage" > "$WORK/listing"

# unsquashfs -lln lines look like:
#   drwxr-xr-x 0/0   53 2026-09-20 10:35 squashfs-root/usr
#   -rwxr-xr-x 0/0  274 2026-09-20 10:36 squashfs-root/AppRun
# Mode is field 1, path is field 6 onwards (names may contain spaces).
# Mode string indexes: 1 type, 2-4 user, 5-7 group, 8-10 other.
BAD="$(
  awk '
    NF >= 6 {
      m = $1
      path = $6
      for (i = 7; i <= NF; i++) path = path " " $i
      type = substr(m, 1, 1)

      # Symlinks are always lrwxrwxrwx and carry no permissions of their own.
      if (type == "l") next

      other_r = (substr(m, 8, 1)  == "r")
      other_x = (substr(m, 10, 1) == "x")
      owner_x = (substr(m, 4, 1)  == "x")

      if (type == "d") {
        if (!other_r || !other_x) print m "  " path
      } else if (type == "-") {
        if (!other_r || (owner_x && !other_x)) print m "  " path
      }
    }
  ' "$WORK/listing"
)"

if [ -n "$BAD" ]; then
  echo "❌ AppImage contains entries that are not accessible to other users:"
  while IFS= read -r line; do
    printf '   %s\n' "$line"
    echo "::error::AppImage entry not accessible to other users: $line"
  done <<< "$BAD"
  echo
  echo "This is the failure mode reported by the appimage.github.io catalog test."
  exit 1
fi

echo "✅ AppImage permissions OK — every entry is readable/traversable by other users"
grep -E "squashfs-root/AppRun(\.wrapped)?$" "$WORK/listing" | awk '{print "   " $1 "  " $6}'
