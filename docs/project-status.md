# Project status

Last updated: 2026-09-29. **Nothing is deployed yet.** Only code and docs exist.

## What this is

A Minecraft server for Elstree Screen Arts students: Java and Bedrock in one
survival world, 20 players (can grow to 50), at `esa.myminecraft.party`. It runs
on the Mac Mini next to the family server. Parent-run, not a school service.

- Full design: [specs/2026-09-28-esa-server-design.md](specs/2026-09-28-esa-server-design.md)
- How to set up and run it: [../README.md](../README.md)

## How it is split

| Piece | Lives in | State |
|---|---|---|
| ESA server (compose, deploy, rollback, docs) | this repo, `main` | written, not deployed |
| Relay forwarding for ESA (25566/tcp, 19132/udp) | `Chris-HT/minecraft-server`, branch `claude/tender-hopper-95tqbd` | written, **not merged**, not applied to the live relay |
| DNS (`A esa`, SRV `_minecraft._tcp.esa`) | Cloudflare, by hand | not done |
| Family server | `Chris-HT/minecraft-server`, `main` | unchanged |

Key decisions:
- **Separate repo and Compose project** (`~/docker/minecraft-esa`), so nothing
  here can stop or delete the family server.
- **The relay is configured only from the family repo.** Its firewall file
  starts with `flush ruleset`, so a second copy here would wipe the family
  rules.
- The old planning branch `claude/server-scaling-50-players-h3ddrt` in the
  family repo is superseded by this repo and does not need merging.

## What is in this repo

- `docker-compose.yml`, which runs three containers:
  - `mc`: Fabric 26.2, the family mods plus Geyser, Floodgate and WorldEdit
  - `backup`: nightly at 03:15, keeps chat logs
  - `log-prune`: deletes chat logs older than 30 days
- `.env.example`, with the chosen `SEED` (see "World seed"). Deploy refuses
  to run if `SEED` is empty.
- `deploy.sh`, `rollback.sh`, `playtimes.sh`, `prune-branches.sh`: copied from
  the family repo and pointed at `~/docker/minecraft-esa` and the 1Password
  item "Minecraft ESA Server".
- `assets/esa-logo.png`: the ESA logo. `assets/esa.schem`: the logo as a
  WorldEdit schematic (100 x 35 x 2, concrete), made by
  `tools/logo_to_schem.py`. Preview: `assets/esa-schem-preview.png`.

Checked: `docker compose config` passes with a dummy `.env` and fails with an
empty `SEED`. The relay's firewall file passes `nft -c`. The schematic reads
back correctly with an independent NBT library, but has not been pasted in game
yet. Not tested yet: any of it on the real Mac, relay or DigitalOcean.

## Mod check for 26.2 (2026-09-29)

From the Modrinth API, Fabric builds for 26.2:

| Mod | Fabric 26.2 build? |
|---|---|
| `worldedit` | **Yes.** 3 builds, newest 7.4.5 (release). |
| `floodgate` | **Yes.** 2 builds, newest 2.2.6-b67 (release). |
| `geyser` | **Yes, beta only.** 61 builds, newest 2.11.3-b1247, all marked beta. The image picks release builds unless told otherwise, so `docker-compose.yml` lists it as `geyser:beta`. |

**Risk: Geyser moves on.** Geyser-Fabric follows only the newest Java version.
Once it moves to 26.3 there will be no new builds for 26.2, and when the Bedrock
app updates, an old Geyser may stop letting Bedrock players in. Plan to upgrade
to 26.3 (README "Upgrading Minecraft") soon after Geyser, Floodgate and the
other mods support it.

## World seed

`SEED=-5228782230889826103`, chosen 2026-09-28 by searching 4 million seeds
with [cubiomes](https://github.com/Cubitect/cubiomes) for a flat plains build
site at 0,0, a village in view, no pillager outpost near spawn, and lots of
biomes within walking distance. Of 44 that passed, this had the most variety
close in.

![Biome map, 3200 x 3200 blocks around 0,0; the white square is spawn protection](seed-map.png)

What should be there (block coordinates, distance from 0,0):

| What | Where |
|---|---|
| Build site | 0,0: plains plateau at about Y 92, flat to a block or two over ~250 x 250. Drops to a valley in the south-west, so the letters show from below |
| Natural first spawn | about -112,0, a short walk west of the site |
| Nearest village | -176,0 (176), plains, in view of the site; 11 villages within 2000 |
| Cherry grove | 200 (north-east and west of the site) |
| Savanna, snowy biomes, mountain peaks | 149, 251, 324 |
| Ocean (north) | 401, with an ocean monument at -240,-752 and 21 shipwrecks within 2000 |
| Birch forest, jungle, dark forest | 764, 826, 944 |
| Mushroom island (in the northern sea), taiga | 1105, 1069 |
| Woodland mansion | -976,688 (1194) |
| Desert, badlands (south-east) | 1294, 1360 |
| Pillager outposts | nearest -1312,224 (1331), well away from spawn |

**Checked on Chunkbase for 26.2 on 2026-09-29: it matches.** This was needed
because cubiomes models Minecraft only up to 1.21.4. To check again, open
[Chunkbase's seed map](https://www.chunkbase.com/apps/seed-map), choose Java
26.2, enter the seed and look for plains at 0,0 with a village near -176,0
and cherry groves nearby.

## Next steps

1. On the Mac, raise Docker Desktop memory from 12 GB to 18 GB (Settings >
   Resources > Memory, Apply & restart). `alpine:3` is done: on 2026-09-29 the
   Mac's existing `alpine:latest` (3.24.1) was tagged as `alpine:3`, no pull needed.
2. Create the 1Password item "Minecraft ESA Server".
3. Run `./deploy.sh --dry-run`, then `./deploy.sh`. Check
   `auth-type: floodgate` and the `ops.json` levels (README steps 9–10).
4. Build the world: pre-generate, paste `assets/esa.schem` (inside spawn
   protection, README "Building the world" step 3), spawn platform, rules
   signs, then a template backup.
5. Merge the relay branch in the family repo, then run
   `op run --env-file relay/.env.op -- relay/update-relay.sh` when nobody is
   playing. Players on the relay drop for a few seconds.
6. Add the DNS records, then test Java and Bedrock from a phone on mobile data.
7. Pilot with about 5 students for a week, then open to 20.

## Open items

- ~~ESA logo file~~ Done: `assets/esa-logo.png`, turned into `assets/esa.schem`
- The school's OK on using the ESA name and logo
- ~~Your child's Minecraft username~~ Done: `Wheafus`, in `WHITELIST` and `OPS`
- The parent note (not drafted)
