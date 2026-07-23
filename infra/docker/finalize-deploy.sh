#!/bin/sh
# Finalize a `pnpm deploy` tree for a portable runtime image.
#
# With inject-workspace-packages, deploy often hardlinks workspace files to
# /app/packages/* (same inode). Blind `cp` then fails with "are the same file".
# We only copy when source/dest differ, and we rewrite top-level links so they
# resolve inside the deploy root (relative → .pnpm), never to /app/packages.
#
# Also copies the generated Prisma client next to @prisma/client because
# deploy --ignore-scripts skips prisma generate.
#
# Usage: finalize-deploy.sh <deploy-root> <pkg> [<pkg>...]
set -eu

DEPLOY_ROOT="${1:?deploy root required}"
shift

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <deploy-root> <workspace-pkg-name>..." >&2
  exit 1
fi

if [ ! -d "$DEPLOY_ROOT/node_modules" ]; then
  echo "ERROR: missing $DEPLOY_ROOT/node_modules (pnpm deploy failed?)" >&2
  exit 1
fi

relpath() {
  node -e "process.stdout.write(require('path').relative(process.argv[1], process.argv[2]))" "$1" "$2"
}

# Copy only when not already the same inode (pnpm inject hardlinks).
sync_path() {
  src="$1"
  dest="$2"
  if [ -e "$dest" ] && [ "$src" -ef "$dest" ]; then
    return 0
  fi
  rm -rf "$dest"
  cp -a "$src" "$dest"
}

for name in "$@"; do
  link="$DEPLOY_ROOT/node_modules/@openconferences/$name"
  built="/app/packages/$name"

  if [ ! -d "$built/dist" ]; then
    echo "ERROR: missing built package at $built/dist" >&2
    exit 1
  fi

  pnpm_dir="$(
    find "$DEPLOY_ROOT/node_modules/.pnpm" -type d \
      -path "*/node_modules/@openconferences/$name" 2>/dev/null | head -n1 || true
  )"

  if [ -n "$pnpm_dir" ]; then
    sync_path "$built/dist" "$pnpm_dir/dist"
    sync_path "$built/package.json" "$pnpm_dir/package.json"

    mkdir -p "$(dirname "$link")"
    rm -rf "$link"
    ln -s "$(relpath "$(dirname "$link")" "$pnpm_dir")" "$link"
  elif [ -e "$link" ]; then
    real="$(readlink -f "$link")"
    case "$real" in
      "$DEPLOY_ROOT"/*)
        sync_path "$built/dist" "$real/dist"
        sync_path "$built/package.json" "$real/package.json"
        ;;
      *)
        echo "ERROR: @openconferences/$name points outside deploy root: $real" >&2
        echo "pnpm deploy did not materialize this workspace package under $DEPLOY_ROOT" >&2
        exit 1
        ;;
    esac
  else
    echo "ERROR: @openconferences/$name missing from $DEPLOY_ROOT/node_modules" >&2
    exit 1
  fi

  real="$(readlink -f "$link")"
  case "$real" in
    "$DEPLOY_ROOT"/*) ;;
    *)
      echo "ERROR: @openconferences/$name still outside deploy root: $real" >&2
      exit 1
      ;;
  esac

  if [ ! -f "$real/dist/index.js" ] && [ ! -f "$real/dist/env/index.js" ]; then
    echo "ERROR: @openconferences/$name has no usable dist after finalize" >&2
    exit 1
  fi
done

prisma_src="$(
  find /app/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' 2>/dev/null | head -n1 || true
)"
if [ -z "$prisma_src" ] || [ ! -f "$prisma_src/index.js" ]; then
  echo "ERROR: generated Prisma client not found under /app/node_modules/.pnpm" >&2
  exit 1
fi

prisma_pkg="$(
  find "$DEPLOY_ROOT/node_modules/.pnpm" -type d \
    -path '*/@prisma+client@*/node_modules/@prisma/client' 2>/dev/null | head -n1 || true
)"
if [ -n "$prisma_pkg" ]; then
  parent="$(dirname "$prisma_pkg")"
  if [ ! -d "$parent/.prisma/client" ] || [ ! "$prisma_src" -ef "$parent/.prisma/client" ]; then
    rm -rf "$parent/.prisma"
    mkdir -p "$parent/.prisma"
    cp -a "$prisma_src" "$parent/.prisma/client"
  fi
fi

if [ -e "$DEPLOY_ROOT/node_modules/@prisma/client" ]; then
  if [ ! -d "$DEPLOY_ROOT/node_modules/.prisma/client" ] || \
     [ ! "$prisma_src" -ef "$DEPLOY_ROOT/node_modules/.prisma/client" ]; then
    mkdir -p "$DEPLOY_ROOT/node_modules/.prisma"
    rm -rf "$DEPLOY_ROOT/node_modules/.prisma/client"
    cp -a "$prisma_src" "$DEPLOY_ROOT/node_modules/.prisma/client"
  fi
fi

echo "finalize-deploy: ok ($DEPLOY_ROOT)"
