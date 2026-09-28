# Project status

Last updated: 2026-09-28. **Nothing is deployed yet.** Only code and docs exist.

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
- `.env.example`. `SEED` is empty on purpose, and deploy refuses to run until
  it is set.
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

## Mod check for 26.2 (2026-09-28)

Modrinth itself could not be reached from the cloud session, so this is from
web search results, not the Modrinth API:

| Mod | Fabric 26.2 build? |
|---|---|
| `worldedit` | **Yes.** WorldEdit 7.4.5 (NeoForge/Fabric for MC 26.2), 9 Aug 2026. |
| `geyser` | **Probably.** Geyser-Fabric supports only the newest Java version, which is 26.2 for now. A report from 23 Sep said there was no 26.3 build yet. |
| `floodgate` | **Not confirmed.** Modrinth lists 26.2 for Fabric, but the newest build that came up in search (2.2.6-b63, April) was for 26.1 to 26.1.2. |

To settle it, open these on the PC:
modrinth.com/plugin/geyser/versions?l=fabric&g=26.2 and
modrinth.com/mod/floodgate/versions?l=fabric&g=26.2. The first start will show
it too: the image stops with an error if it cannot find a matching build.

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

**Check it before the first deploy.** cubiomes models Minecraft up to 1.21.4,
not 26.2. Overworld generation has been stable since 1.18, but open
[Chunkbase's seed map](https://www.chunkbase.com/apps/seed-map), choose Java
26.2 (or the newest it offers), enter the seed and confirm plains at 0,0 with a
village near -176,0 and cherry groves nearby. If it looks different, ask for
another pick: there are 43 other candidates.

## Next steps

1. Confirm `geyser` and `floodgate` have Fabric 26.2 builds (links above).
   WorldEdit is fine. Without Geyser and Floodgate, Bedrock players cannot join.
2. Check the seed on Chunkbase (see "World seed"). Add your child to `OPS`
   and `WHITELIST` in `.env.example` (`Senior_Huevo` is already in both).
3. On the Mac, raise Docker Desktop memory to 18 GB and run `docker pull alpine:3`.
4. Create the 1Password item "Minecraft ESA Server".
5. Run `./deploy.sh --dry-run`, then `./deploy.sh`. Check
   `auth-type: floodgate` and the `ops.json` levels (README steps 9–10).
6. Build the world: pre-generate, paste `assets/esa.schem` (inside spawn
   protection, README "Building the world" step 3), spawn platform, rules
   signs, then a template backup.
7. Merge the relay branch in the family repo, then run
   `op run --env-file relay/.env.op -- relay/update-relay.sh` when nobody is
   playing. Players on the relay drop for a few seconds.
8. Add the DNS records, then test Java and Bedrock from a phone on mobile data.
9. Pilot with about 5 students for a week, then open to 20.

## Open items

- ~~ESA logo file~~ Done: `assets/esa-logo.png`, turned into `assets/esa.schem`
- The school's OK on using the ESA name and logo
- Your child's Minecraft username for `OPS`
- The parent note (not drafted)
