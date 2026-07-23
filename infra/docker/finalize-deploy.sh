#!/bin/sh
# Finalize a `pnpm deploy` tree for a portable runtime image.
#
# pnpm may leave workspace packages as symlinks into the monorepo (e.g.
# /app/packages/config). Those break once only the deploy directory is copied
# into the runner. This script:
#   1. Points @openconferences/* at the package copy inside the deploy tree
#   2. Refreshes dist/ from the just-built workspace packages
#   3. Copies the generated Prisma client next to @prisma/client
#      (--ignore-scripts skips prisma generate during deploy)
#
# Usage: finalize-deploy.sh <deploy-root> <pkg> [<pkg>...]
# Example: finalize-deploy.sh /app/out/api config contracts db schemas
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
    rm -rf "$pnpm_dir/dist"
    cp -a "$built/dist" "$pnpm_dir/dist"
    cp -a "$built/package.json" "$pnpm_dir/package.json"

    mkdir -p "$(dirname "$link")"
    rm -rf "$link"
    ln -s "$(relpath "$(dirname "$link")" "$pnpm_dir")" "$link"
  elif [ -e "$link" ]; then
    real="$(readlink -f "$link")"
    case "$real" in
      "$DEPLOY_ROOT"/*)
        rm -rf "$real/dist"
        cp -a "$built/dist" "$real/dist"
        cp -a "$built/package.json" "$real/package.json"
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

# Generated Prisma client (not in the npm pack; written by `prisma generate` in the builder)
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
  rm -rf "$parent/.prisma"
  mkdir -p "$parent/.prisma"
  cp -a "$prisma_src" "$parent/.prisma/client"
fi

if [ -e "$DEPLOY_ROOT/node_modules/@prisma/client" ]; then
  mkdir -p "$DEPLOY_ROOT/node_modules/.prisma"
  rm -rf "$DEPLOY_ROOT/node_modules/.prisma/client"
  cp -a "$prisma_src" "$DEPLOY_ROOT/node_modules/.prisma/client"
fi

echo "finalize-deploy: ok ($DEPLOY_ROOT)"
