#!/usr/bin/env bash
# Roll the world back to a backup from /Volumes/X9/backups/minecraft-esa.
#
#   ./rollback.sh                 restore the most recent backup (asks first)
#   ./rollback.sh --list          list available backups, change nothing
#   ./rollback.sh world-20260907-030000.tar.gz   restore a specific backup
#
# Runs from Git Bash on Windows, like deploy.sh. Needs: ssh (alias 'mac-mini').
# The current world is kept as data.broken-<timestamp>, which deploy.sh's rsync
# excludes, so nothing is lost until you delete it by hand.
set -euo pipefail

HOST=mac-mini
REMOTE_DIR=docker/minecraft-esa                   # relative to the Mac home dir

# Non-interactive ssh on the Mac gets PATH=/usr/bin:/bin:/usr/sbin:/sbin, which
# omits /usr/local/bin where Docker Desktop installs 'docker'. Keep $PATH
# single-quoted so it expands on the Mac, not here.
REMOTE_ENV='export PATH=/usr/local/bin:$PATH;'

die() { echo "rollback: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

LIST_ONLY=0
BACKUP_FILE=""
for arg in "$@"; do
  case "$arg" in
    --list) LIST_ONLY=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) BACKUP_FILE=$arg ;;
  esac
done

cd "$(dirname "$0")"

step "Checking prerequisites"
command -v ssh >/dev/null || die "ssh not found on PATH"
[ -f .env.example ] || die ".env.example missing"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true || die "cannot ssh to $HOST"

# Same source of truth as deploy.sh, so the two can never disagree.
BACKUP_DIR=$(grep -E '^BACKUP_DIR=' .env.example | cut -d= -f2- || true)
[ -n "$BACKUP_DIR" ] || die "BACKUP_DIR not set in .env.example"

step "Backups in $BACKUP_DIR on $HOST (newest last)"
BACKUPS=$(ssh "$HOST" "ls -1 '$BACKUP_DIR'/world-*.tar.gz 2>/dev/null | sort") \
  || die "could not list $BACKUP_DIR (is the X9 drive mounted?)"
[ -n "$BACKUPS" ] || die "no world-*.tar.gz backups found in $BACKUP_DIR"
ssh "$HOST" "ls -lh '$BACKUP_DIR'/world-*.tar.gz | sort -k9"

if [ "$LIST_ONLY" -eq 1 ]; then
  echo
  echo "List only. Nothing changed on $HOST."
  exit 0
fi

if [ -n "$BACKUP_FILE" ]; then
  BACKUP_PATH=$BACKUP_DIR/${BACKUP_FILE##*/}
  ssh "$HOST" "test -f '$BACKUP_PATH'" || die "$BACKUP_PATH does not exist on $HOST"
else
  BACKUP_PATH=$(printf '%s\n' "$BACKUPS" | tail -n 1)
fi

STAMP=$(date +%Y%m%d-%H%M%S)
echo
echo "About to restore: $BACKUP_PATH"
echo "Everything played since that backup will be gone from the live world."
echo "The current world will be kept as data.broken-$STAMP."
printf 'Type yes to continue: '
read -r REPLY
[ "$REPLY" = yes ] || die "aborted, nothing changed"

# 'down', not 'stop mc': the backup sidecar keeps the old data directory
# mounted, so both containers must be recreated against the restored world.
step "Stopping containers"
ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose down"

step "Setting aside current world as data.broken-$STAMP"
ssh "$HOST" "cd '$REMOTE_DIR' && mv data data.broken-$STAMP && mkdir data"

step "Extracting $BACKUP_PATH"
if ! ssh "$HOST" "cd '$REMOTE_DIR' && tar -xzf '$BACKUP_PATH' -C data"; then
  echo "rollback: extract failed; putting the old world back" >&2
  ssh "$HOST" "cd '$REMOTE_DIR' && rm -rf data && mv data.broken-$STAMP data"
  die "restore failed, previous world restored"
fi

step "Starting containers"
ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose up -d"

step "Status"
ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose ps && echo && docker compose logs --tail 20 mc"
echo
echo "Done. Wait for \"Done\" in the log: ssh $HOST '$REMOTE_ENV cd $REMOTE_DIR && docker compose logs -f mc'"
echo "Once happy, remove the old world: ssh $HOST 'cd $REMOTE_DIR && rm -rf data.broken-$STAMP'"
