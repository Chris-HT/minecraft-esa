#!/usr/bin/env bash
# Delete remote branches that have already been merged into origin/main.
#
#   ./prune-branches.sh feat/foo claude/bar   delete these branches on origin
#   ./prune-branches.sh --dry-run feat/foo    check only, delete nothing
#
# Refuses main/master/HEAD and any branch not fully merged into origin/main.
# Every branch is checked before anything is deleted, so a single bad name
# aborts the whole run.
set -euo pipefail

PROTECTED='^(main|master|HEAD)$'
DRY_RUN=0
BRANCHES=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) BRANCHES+=("${arg#origin/}") ;;
  esac
done
[ "${#BRANCHES[@]}" -gt 0 ] || { echo "usage: $0 [--dry-run] <branch>..." >&2; exit 2; }

cd "$(dirname "$0")"
git fetch --prune --quiet origin

for b in "${BRANCHES[@]}"; do
  if [[ "$b" =~ $PROTECTED ]]; then
    echo "prune: refusing to delete protected branch '$b'" >&2; exit 1
  fi
  if ! git show-ref --verify --quiet "refs/remotes/origin/$b"; then
    echo "prune: no such branch on origin: '$b'" >&2; exit 1
  fi
  if ! git merge-base --is-ancestor "origin/$b" origin/main; then
    echo "prune: '$b' is not fully merged into origin/main; refusing" >&2; exit 1
  fi
  echo "ok: $b is merged into origin/main"
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run. Nothing deleted."
  exit 0
fi

git push origin --delete "${BRANCHES[@]}"
