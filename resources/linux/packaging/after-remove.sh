#!/bin/bash
# Why: remove the PATH symlink that after-install.sh created, but only if it
# still points into an AIO-ADE install dir — never delete an unrelated
# /usr/bin/aio-ade a user or other package may own.
set -e

link="/usr/bin/aio-ade"

if [ -L "$link" ]; then
  target="$(readlink "$link" || true)"
  case "$target" in
    /opt/AIO-ADE/*|/opt/aio-ade/*|/opt/aio-ade/*)
      rm -f "$link"
      ;;
  esac
fi

exit 0
