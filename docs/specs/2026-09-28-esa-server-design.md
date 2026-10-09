# ESA Students' Minecraft Server — Design

Date: 2026-09-28
Status: planned, not built. Implementation will be done from the Windows PC.
Revised 2026-09-28: the server lives in its own repo (`Chris-HT/minecraft-esa`)
instead of inside the family repo. See "Decision: a separate repo".

## Goal

A second Minecraft server on the Mac Mini for students of Elstree Screen Arts
(ESA), alongside the existing family server, which stays exactly as it is.

- **20 players** to start, able to grow to 50 by changing two numbers.
- **Java and Bedrock** in the same world (Geyser + Floodgate).
- **Survival**, always on. Creative only for occasional events, on a separate
  server that runs only when started.
- Everyone spawns on a viewing platform facing a **huge ESA build** (for
  example, letters about 40 blocks tall and 100 wide, in school colours, lit
  for night).
- Reached at **`esa.myminecraft.party`**; the family server keeps
  `myminecraft.party`.

This is a **parent-run** server, not a school service. Chris runs it and
supervises; his child is an in-game moderator.

## Decision: a separate repo

The first draft added `mc-esa` and `backup-esa` to the family repo's
`docker-compose.yml`. The server now has its own repo and its own folder on the
Mac instead:

```
~/docker/minecraft       family repo, Compose project "minecraft" (unchanged)
~/docker/minecraft-esa   this repo, Compose project "minecraft-esa"
```

Why:
- **Isolation.** Each Compose project only manages its own containers, so an
  ESA deploy, rollback or `--remove-orphans` cannot stop or recreate the family
  server, and the reverse.
- **No world-deletion trap.** In one repo, the family `deploy.sh`'s
  `rsync --delete` would have deleted `data-esa/` unless an exclude was added
  in the same commit. With separate folders, neither deploy syncs over the other.
- **Plain names.** Services are `mc`, `backup`, `log-prune`; `.env` keys are
  `WHITELIST`, `OPS`, so `deploy.sh`, `rollback.sh` and `playtimes.sh` are
  copies with one line changed (`REMOTE_DIR`) rather than needing a
  `--server esa` option.
- **Own secret.** RCON uses its own 1Password item, "Minecraft ESA Server".

What stays shared, with one owner each:
- **Relay droplet:** owned by `minecraft-server/relay/`. Its `nftables.conf`
  begins with `flush ruleset`, so two repos each pushing their own copy would
  wipe each other's forwarding. This repo documents the ports it needs
  (25566/tcp, 19132/udp); the family repo forwards them.
- **Cloudflare zone:** two extra records for `esa`, added by hand.
- **Docker Desktop memory and the X9 drive** on the Mac.

## Constraints

- Everything from the family design still applies: no router ports, secrets
  only in 1Password, Minecraft pinned to 26.2.
- The family server (`~/docker/minecraft`, port 25565) must not change or
  restart because of this work. Separate Compose projects guarantee it.
- Whitelist mandatory, `ONLINE_MODE` true.
- The relay is only ever configured from the family repo.

## Host capacity (from the 2026-09-05 host facts)

| Item | Now | With ESA (20) | With ESA (50) |
|---|---|---|---|
| Docker Desktop memory | 12 GiB | **~18 GiB** | ~22 GiB |
| ESA `MEMORY` (heap) | — | 6G | 8–9G |
| Home upload | 1 Gb FTTP (≥110 Mbit/s up) | ~6 Mbit/s steady | ~15 Mbit/s steady, peaks 30–50 |

The Mac (M4, 32 GiB) has room for this. Upload is not a constraint on this
line. The one risk is tick lag if many players crowd one spot with farms or
redstone; watch `/spark tps` (keep MSPT under 50 ms).

## Addresses and ports

| Server | Java | Bedrock | Mac host port |
|---|---|---|---|
| Family (`mc`) | `myminecraft.party` | — | 25565/tcp |
| ESA (`mc`, project `minecraft-esa`) | `esa.myminecraft.party` (SRV, no port typed) | `esa.myminecraft.party`, port 19132 (the default) | 25566/tcp, 19132/udp |
| ESA events (optional, later) | `esa.myminecraft.party:25567` | port 19133 | 25567/tcp, 19133/udp |

Minecraft cannot route by hostname without a proxy, so each server gets its
own port. The SRV record means Java players still type only the hostname.
The family server has no Bedrock, so ESA takes the default Bedrock port.

### DNS (Cloudflare, DNS only / grey cloud)

```
A    esa                      <relay public IP>
SRV  _minecraft._tcp.esa      priority 0, weight 5, port 25566, target esa.myminecraft.party
```

## Compose services

See `docker-compose.yml`. Summary:

- **`mc`**: itzg/minecraft-server, Fabric 26.2, `MEMORY 6G`, ports
  `25566:25565` and `19132:19132/udp`. The family mod list plus `geyser`,
  `floodgate` and `worldedit`. `EXISTING_OPS_FILE: SYNCHRONIZE`,
  `OP_PERMISSION_LEVEL: 3`, `SPAWN_PROTECTION: 64`, `MAX_PLAYERS: 20`.
  `SEED` comes from `.env` and is required, so the world cannot be generated
  from a random seed by accident.
- **`backup`**: itzg/mc-backup at 03:15 (15 minutes after the family backup),
  14 days, `EXCLUDES: "*.jar,cache,*.tmp"`, so unlike the family backup it
  **keeps `logs`**.
- **`log-prune`**: a small alpine container that deletes
  `data/logs/*.log.gz` older than 30 days, daily. Keeping it in Compose means
  nothing has to be set up on the Mac by hand (the first draft used launchd).

Checks that still apply:
- Check each mod on Modrinth has a **26.2 Fabric** build before the first
  deploy, especially `geyser`, `floodgate` and `worldedit` (unchecked; Modrinth
  was blocked from the planning session). Check the slugs at the same time.
- Geyser's config (`data/config/Geyser-Fabric/config.yml`) must use
  `auth-type: floodgate`.
- After first start, check `data/ops.json`: moderators should be level 3.
- Bedrock players are whitelisted with Floodgate's `fwhitelist add`, never
  through `WHITELIST`: the image resolves those names with Mojang, and a
  Bedrock gamertag would fail the lookup.

### Events server (later)

Creative server for events such as a "build a film set" contest: a second
service under `profiles: [events]`, `MODE: creative`, `MEMORY: 3G`,
`./data-events:/data` (already excluded by `deploy.sh` and `.gitignore`), ports
`25567` and `19133:19132/udp`. The relay would need 25567/19133 added in the
family repo. Before relying on it, check that `up -d --remove-orphans` leaves a
running profile service alone.

## Repo layout and deploy

```
docker-compose.yml   mc, backup, log-prune
.env.example         BACKUP_DIR, SEED, WHITELIST, OPS, RCON_PASSWORD placeholder
deploy.sh            copy of the family deploy.sh: REMOTE_DIR=docker/minecraft-esa,
                     own 1Password item, also excludes data-*/, refuses an empty SEED
rollback.sh          copy, REMOTE_DIR changed
playtimes.sh         copy, REMOTE_DIR changed
prune-branches.sh    copy, unchanged
```

## Relay changes

Done in the family repo (`relay/` in `Chris-HT/minecraft-server`), not here:

1. `relay/cloud-init.yaml`: forward and DNAT `25566/tcp` and `19132/udp` to
   `100.81.31.15`.
2. `relay/create-relay.sh`: opens both on a newly created cloud firewall and
   checks the DNAT rules.
3. `relay/update-relay.sh` (new): applies `cloud-init.yaml`'s
   `nftables.conf` to the **live** droplet (a rebuild would change the public
   IP), and opens missing ports on the existing `mc-relay-fw` cloud firewall.
   Because `flush ruleset` also removes Tailscale's own rules, it restarts
   `tailscaled` afterwards, the same order as a reboot. Players on the relay
   drop for a few seconds.
4. If the tailnet has ACLs, the relay must be allowed to reach the Mac on 25566
   and 19132.

Relay plan and cost unchanged. 20 players is roughly 180 GB a month through
the relay, inside the 500 GB allowance. If it ever nears the limit, the 1 GB
plan (1 TB) costs about £1 a month more.

## The world and the ESA build

A seed decides only the terrain; the build is added to the world afterwards.

1. **Seed:** use a seed map (e.g. Chunkbase) to find one with wide flat
   plains or meadow near 0,0, ideally with a village in view. Set `SEED`.
2. **Pre-generate:** `chunky radius 2000` then `chunky start` (via rcon) before
   anyone joins.
3. **Build the ESA letters** (route A, logo supplied by Chris):
   - Convert the logo into a `.schem` with a free tool such as ObjToSchematic,
     from a 3D model or an extruded image.
   - Optionally build or test it first in a local creative world on the PC
     with the same seed, then save it with WorldEdit (`//copy`,
     `//schem save esa`).
   - Put the `.schem` in `data/config/worldedit/schematics/` and, in game,
     stand at the spot and run `//schem load esa`, then `//paste`.
   - Keep **all of it inside spawn protection**: 64 blocks each way from
     spawn. For example, letters 100 wide centred about 25 blocks in front of
     the platform fit; letters 90 blocks away would be mostly unprotected
     (the first draft said "within about 150 blocks", which left most of it
     open). If it needs more room, raise `SPAWN_PROTECTION`. Light it (sea
     lanterns, froglights) so it shows at night.
4. **Spawn:** build a viewing platform facing the letters, stand on it,
   `/setworldspawn` (with the facing angle), and set the spawn radius game rule
   to 0 so everyone lands on the same spot (the rule's name changed in recent
   versions; tab-complete `/gamerule`).
5. **Rules signs** next to the platform: "Be kind · No griefing · Mods: ___ ·
   Report problems to ___".
6. **Protection:** `SPAWN_PROTECTION 64` (non-ops cannot change blocks within
   64 of spawn). Ledger can roll back anything outside it.
7. **Template backup:** once the build is done and before students join, take
   a manual backup and copy it somewhere it will not be pruned, e.g.
   `/Volumes/X9/backups/minecraft-esa-template/`. It is the reset point for a
   new term.

## Moderation and safeguarding

| Role | Who | Power |
|---|---|---|
| Owner | Chris | Full, via `rcon-cli` from the PC (console = level 4) |
| Moderator | Chris's child (and Chris in game) | Op level 3: kick, ban, whitelist, teleport, game mode |

- `EXISTING_OPS_FILE: SYNCHRONIZE`: anyone opped in game is removed at the
  next restart or deploy. Only `OPS` in `.env.example` counts. Level 3
  includes `/op`, so a moderator can op someone until the next restart; tell
  moderators this.
- **School name and logo:** ask ESA whether using "ESA" and the logo is OK.
  Either way, say in the MOTD and on the spawn signs that the server is **not
  run by the school**.
- **Parents:** send a one-page note (who runs it, the rules, what is logged,
  how to reach Chris) and collect usernames and consent **through parents**.
  Include a line on Xbox family settings: child Microsoft accounts may need a
  parent to allow "join multiplayer games".
  Superseded 2026-09-29 by the sign-up page: students sign up themselves and
  tick a consent box. See [2026-09-29-signup-page-design.md](2026-09-29-signup-page-design.md).
- **Chat logs:** kept 30 days on the server (`log-prune`), and in backups for
  up to 14 days after that. Tell parents "about 6 weeks at most". The template
  backup is taken before students join, so it holds none.
- **Adult contact:** Chris keeps to public chat with students, not private
  messages.
- **Always on:** Ledger records every block change, so overnight damage can be
  undone. An optional curfew (e.g. stop 22:00, start 07:00 on school nights) is
  an easy later addition, not part of the first build.
- **Bedrock names** appear with a `.` prefix (e.g. `.TheirGamertag`).
  Whitelist them with Floodgate's `fwhitelist add TheirGamertag`, not through
  `WHITELIST`.
- **Consoles:** Xbox, PlayStation and Switch cannot add custom servers without
  workarounds (BedrockConnect, MCXboxBroadcast). Launch as "PC, phone, tablet
  or Chromebook".

## Cost

| Item | Monthly |
|---|---|
| Mac electricity (extra load) | ~£2–4 |
| Relay | £0 extra (same droplet and allowance) |
| DNS | £0 (subdomain of the existing domain) |
| **Total** | **~£2–4** |

## Implementation order

1. [ ] Check 26.2 Fabric builds and slugs for `geyser`, `floodgate`, `worldedit`.
2. [ ] Pick the seed; set `SEED`, `WHITELIST`, `OPS` in `.env.example`.
3. [ ] Raise Docker Desktop memory to 18 GiB on the Mac.
4. [ ] Create the 1Password item "Minecraft ESA Server".
5. [ ] On the Mac: `docker pull alpine:3`.
6. [ ] `./deploy.sh --dry-run`, then `./deploy.sh`; wait for "Done"; check
       `auth-type: floodgate` and `ops.json` levels.
7. [ ] Pre-generate with Chunky; build and light the ESA letters inside spawn
       protection; spawn platform, `/setworldspawn`, rules signs; template backup.
8. [ ] Family repo: merge the relay change, run `relay/update-relay.sh`.
9. [ ] DNS: `A esa` and the SRV record; test Java and Bedrock from outside the
       tailnet (e.g. a phone on mobile data).
10. [ ] Pilot: Chris, his child and about 5 students for a week, watching
        `/spark tps`. Then open to 20.
11. [ ] Later: events server, optional curfew, scale to 50 (`MAX_PLAYERS 50`,
        `MEMORY 8–9G`, Docker memory 22 GiB).

## Verification

- `docker compose config` passes with a dummy `.env`, and fails with an empty
  `SEED`.
- `deploy.sh --dry-run` lists nothing under `data/`.
- The family `mc` keeps running (uptime unchanged) through the ESA deploy.
- `rcon-cli list` answers on this project's `mc`; `data/mods/` contains geyser
  and floodgate.
- A Java client joins `esa.myminecraft.party` with no port; a Bedrock client
  joins `esa.myminecraft.party` on 19132; both are refused before being
  whitelisted.
- A non-op cannot break a block of the ESA build.
- A manual `backup now` produces a tarball that contains `logs/`.
- `docker compose logs log-prune` shows no errors.

## Open items

- ESA logo file from Chris (image or 3D model).
- School's answer on using the ESA name and logo.
- Child's Minecraft username for `OPS`.
- Parent note (not yet drafted).

## Out of scope

A Velocity proxy, consoles without workarounds, a separate relay for ESA,
Minecraft Education, web dashboards.
