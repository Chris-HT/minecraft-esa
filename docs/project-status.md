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

## Next steps

1. Confirm `geyser` and `floodgate` have Fabric 26.2 builds (links above).
   WorldEdit is fine. Without Geyser and Floodgate, Bedrock players cannot join.
2. Choose a seed. Set `SEED`, `WHITELIST` and `OPS` (add your child) in
   `.env.example`.
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
