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

Checked: `docker compose config` passes with a dummy `.env` and fails with an
empty `SEED`. The relay's firewall file passes `nft -c`. Not tested yet: any of
it on the real Mac, relay or DigitalOcean.

## Next steps

1. Check that `geyser`, `floodgate` and `worldedit` have Fabric 26.2 builds on
   Modrinth. Without Geyser and Floodgate, Bedrock players cannot join.
2. Choose a seed. Set `SEED`, `WHITELIST` and `OPS` (add your child) in
   `.env.example`.
3. On the Mac, raise Docker Desktop memory to 18 GB and run `docker pull alpine:3`.
4. Create the 1Password item "Minecraft ESA Server".
5. Run `./deploy.sh --dry-run`, then `./deploy.sh`. Check
   `auth-type: floodgate` and the `ops.json` levels (README steps 9–10).
6. Build the world: pre-generate, the ESA letters (inside spawn protection),
   spawn platform, rules signs, then a template backup.
7. Merge the relay branch in the family repo, then run
   `op run --env-file relay/.env.op -- relay/update-relay.sh` when nobody is
   playing. Players on the relay drop for a few seconds.
8. Add the DNS records, then test Java and Bedrock from a phone on mobile data.
9. Pilot with about 5 students for a week, then open to 20.

## Open items

- ESA logo file (image or 3D model)
- The school's OK on using the ESA name and logo
- Your child's Minecraft username for `OPS`
- The parent note (not drafted)
