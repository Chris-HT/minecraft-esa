#!/usr/bin/env bash
# Deploy this repo to the Mac Mini and (re)start the ESA students' server.
# Touches only ~/docker/minecraft-esa; the family server is a separate project.
#
#   ./deploy.sh            sync, write .env from 1Password, pull images, up -d
#   ./deploy.sh --dry-run  show what rsync would change; touch nothing remote
#   ./deploy.sh --no-pull  skip 'docker compose pull'
#
# Runs from Git Bash on Windows. Needs: rsync, ssh (alias 'mac-mini'), op.
set -euo pipefail

HOST=mac-mini
REMOTE_DIR=docker/minecraft-esa                   # relative to the Mac home dir
OP_RCON='op://Personal/Minecraft ESA Server/password'
RSYNC_EXCLUDES=(--exclude .git --exclude data/ --exclude 'data.broken-*/' --exclude 'data-*/' --exclude backups/ --exclude .env --exclude docs/ --exclude .claude/ --exclude .superpowers/ --exclude signup/)

# Git Bash's MSYS rsync hands its remote shell a socketpair that Windows
# OpenSSH (the only ssh that reaches the 1Password agent) cannot read, so the
# transfer dies with "connection unexpectedly closed". ~/bin/rsync-ssh
# re-plumbs it through plain pipes (see README: First-time setup, step 4).
[ -x "$HOME/bin/rsync-ssh" ] && export RSYNC_RSH="$HOME/bin/rsync-ssh"

# Non-interactive ssh on the Mac gets PATH=/usr/bin:/bin:/usr/sbin:/sbin, which
# omits /usr/local/bin where Docker Desktop installs 'docker'. Keep $PATH
# single-quoted so it expands on the Mac, not here.
REMOTE_ENV='export PATH=/usr/local/bin:$PATH;'

DRY_RUN=0
PULL=1
PULL_LOG=""                                     # set later; named here for the EXIT trap
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-pull) PULL=0 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")"

die() { echo "deploy: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

step "Checking prerequisites"
for tool in rsync ssh op; do
  command -v "$tool" >/dev/null || die "$tool not found on PATH (see README: First-time setup)"
done
[ -f .env.example ] || die ".env.example missing"
[ -f docker-compose.yml ] || die "docker-compose.yml missing"
# A CRLF .env.example would be copied verbatim into .env on the Mac and every
# value would end in \r. Guarded with if so a clean file does not trip set -e.
if grep -qU $'\r' .env.example; then die ".env.example has CRLF line endings; convert to LF"; fi
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true || die "cannot ssh to $HOST"

# Non-secret values are read from .env.example so the script and the
# template can never disagree about BACKUP_DIR.
BACKUP_DIR=$(grep -E '^BACKUP_DIR=' .env.example | cut -d= -f2- || true)
[ -n "$BACKUP_DIR" ] || die "BACKUP_DIR not set in .env.example"
# The first start generates the world from SEED, and it cannot be changed after.
SEED=$(grep -E '^SEED=' .env.example | cut -d= -f2- || true)
[ -n "$SEED" ] || die "SEED is empty in .env.example; pick one first (README: Building the world)"

if [ "$DRY_RUN" -eq 1 ]; then
  step "Dry run: files rsync would transfer"
  rsync -azn --delete --itemize-changes "${RSYNC_EXCLUDES[@]}" ./ "$HOST:$REMOTE_DIR/"
  echo
  echo "Dry run complete. No secrets read, nothing changed on $HOST."
  exit 0
fi

step "Reading secrets from 1Password"
RCON=$(op read "$OP_RCON") || die "op read failed for $OP_RCON"
RCON=${RCON//$'\r'/}
for v in RCON; do
  val=${!v}
  [ -n "$val" ] || die "$v is empty in 1Password"
  [[ "$val" =~ ^[A-Za-z0-9_-]+$ ]] || die "$v contains characters other than letters, digits, - or _"
  printf '  %-6s %d chars, starts %s\n' "$v" "${#val}" "${val:0:3}"
done

step "Preparing remote directories"
# An unmounted external drive would otherwise make mkdir -p silently create the
# backup path on the boot disk, and backups would fill it up unnoticed.
case "$BACKUP_DIR" in
  /Volumes/*)
    BACKUP_VOL=$(printf '%s\n' "$BACKUP_DIR" | cut -d/ -f1-3)
    ssh "$HOST" "test -d '$BACKUP_VOL' && /sbin/mount | grep -q ' on $BACKUP_VOL ('" \
      || die "backup volume $BACKUP_VOL is not mounted on $HOST"
    ;;
esac
ssh "$HOST" "mkdir -p '$REMOTE_DIR' '$BACKUP_DIR'"

step "Syncing repo to $HOST:$REMOTE_DIR"
rsync -az --delete --itemize-changes "${RSYNC_EXCLUDES[@]}" ./ "$HOST:$REMOTE_DIR/"

step "Writing .env on $HOST"
TMP=$(mktemp)
trap 'rm -f "$TMP" "$PULL_LOG"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    RCON_PASSWORD=*) printf 'RCON_PASSWORD=%s\n' "$RCON" ;;
    *)               printf '%s\n' "$line" ;;
  esac
done < .env.example > "$TMP"
grep -q '__OP_' "$TMP" && die "a placeholder was not substituted"
ssh "$HOST" "umask 077 && cat > '$REMOTE_DIR/.env' && chmod 600 '$REMOTE_DIR/.env'" < "$TMP"
unset RCON val

step "Starting containers"
if [ "$PULL" -eq 1 ]; then
  # Docker Desktop resolves registry credentials through the macOS login
  # keychain, which a non-interactive ssh session cannot unlock, so 'pull'
  # fails even for anonymous images. That is not fatal: 'up -d' starts from the
  # images already on the Mac. Any other pull failure still aborts the deploy.
  PULL_LOG=$(mktemp)
  if ! ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose pull --quiet" >"$PULL_LOG" 2>&1; then
    cat "$PULL_LOG" >&2
    grep -q 'error getting credentials' "$PULL_LOG" || die "docker compose pull failed"
    echo "deploy: WARNING: image pull failed; the macOS keychain is unreachable over ssh." >&2
    echo "deploy: Continuing with the images already on $HOST." >&2
    echo "deploy: To refresh them, run in a Terminal on the Mac itself:" >&2
    echo "deploy:   cd ~/$REMOTE_DIR && docker compose pull" >&2
    echo "deploy: If an image is not yet on the Mac at all, the next step will fail — run the command above first." >&2
  fi
  rm -f "$PULL_LOG"
  PULL_LOG=""
fi
if ! ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose up -d --remove-orphans"; then
  die "docker compose up -d failed (if an image was never pulled on the Mac, pull it there first — see the warning above)"
fi

step "Status"
ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose ps && echo && docker compose logs --tail 20 mc"
echo
echo "Done. Follow logs with: ssh $HOST '$REMOTE_ENV cd $REMOTE_DIR && docker compose logs -f mc'"
