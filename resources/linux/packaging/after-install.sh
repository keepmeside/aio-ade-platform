#!/bin/bash
# Why: register the bundled `aio-ade` CLI on PATH at package-install time so the
# command is reachable from a shell without any in-app install step. deb/rpm both
# run this after unpacking.
#
# The shim resolves the real app by walking up from its own location, so a
# symlink works. We discover the install dir instead of hardcoding /opt/AIO-ADE
# because electron-builder's directory name can vary by productName sanitization.
set -e

link="/usr/bin/aio-ade"

for dir in /opt/AIO-ADE /opt/aio-ade /opt/aio-ade; do
  sandbox="$dir/chrome-sandbox"
  if [ -f "$sandbox" ]; then
    # Why: packaged Linux installs must leave Chromium's sandbox helper usable
    # on hosts where unprivileged user namespaces are unavailable.
    chmod 4755 "$sandbox" || true
  fi

  shim="$dir/resources/bin/aio-ade"
  if [ -x "$shim" ]; then
    # Only manage our own symlink; never clobber an unrelated /usr/bin/aio-ade.
    if [ ! -e "$link" ] || [ -L "$link" ]; then
      ln -sf "$shim" "$link"
    fi
    break
  fi
done

exit 0
