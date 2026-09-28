#!/usr/bin/env bash
# Show total play time per player, from the server's own per-player stats.
#
#   ./playtimes.sh          play time for everyone who has ever joined
#
# Runs from Git Bash on Windows, like deploy.sh. Needs: ssh (alias 'mac-mini').
# Reads the vanilla stat minecraft:play_time (ticks while connected, 20 per
# second) from data/<world>/stats/<uuid>.json and maps UUIDs to usernames via
# usercache.json, whitelist.json and ops.json. The server must be running.
set -euo pipefail

HOST=mac-mini
REMOTE_DIR=docker/minecraft-esa                   # relative to the Mac home dir

# Non-interactive ssh on the Mac gets PATH=/usr/bin:/bin:/usr/sbin:/sbin, which
# omits /usr/local/bin where Docker Desktop installs 'docker'. Keep $PATH
# single-quoted so it expands on the Mac, not here.
REMOTE_ENV='export PATH=/usr/local/bin:$PATH;'

die() { echo "playtimes: $*" >&2; exit 1; }

case "${1:-}" in
  "") ;;
  -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

cd "$(dirname "$0")"

command -v ssh >/dev/null || die "ssh not found on PATH"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true || die "cannot ssh to $HOST"

# The stats live on the mc container's /data volume and the itzg image ships
# jq, so the whole report runs in there and the Mac needs nothing installed.
ssh "$HOST" "$REMOTE_ENV cd '$REMOTE_DIR' && docker compose exec -T mc bash -s" <<'REMOTE' \
  || die "report failed (is the server running? start it with ./deploy.sh)"
set -euo pipefail
cd /data
world=$(sed -n 's/^level-name=//p' server.properties 2>/dev/null | tr -d '\r')
world=${world:-world}
[ -d "$world/stats" ] || { echo "no stats yet: $world/stats does not exist" >&2; exit 1; }

# UUID -> username. usercache.json entries expire after a month, so merge in
# whitelist.json and ops.json as longer-lived sources. A UUID none of them
# know is printed as-is.
names=$(cat usercache.json whitelist.json ops.json 2>/dev/null \
  | jq -s '[.[][]] | map(select(.uuid and .name)
                         | {key: (.uuid | ascii_downcase), value: .name})
                   | from_entries') || names='{}'

for f in "$world"/stats/*.json; do
  [ -e "$f" ] || { echo "no stats yet: nobody has joined this world" >&2; exit 1; }
  uuid=$(basename "$f" .json)
  ticks=$(jq '.stats["minecraft:custom"]["minecraft:play_time"] // 0' "$f")
  name=$(jq -r --arg u "${uuid,,}" '.[$u] // $u' <<<"$names")
  printf '%s\t%s\n' "$ticks" "$name"
done | sort -rn | awk -F'\t' '
  { s = $1 / 20                       # ticks -> seconds
    printf "  %4dh %02dm  %s\n", s / 3600, (s % 3600) / 60, $2
    total += s }
  END { printf "  ---------\n  %4dh %02dm  total\n", total / 3600, (total % 3600) / 60 }'
REMOTE
