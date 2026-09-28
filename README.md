# ESA Students' Minecraft Server

Fabric Minecraft **26.2** for students of Elstree Screen Arts, Java and Bedrock
in the same world, in Docker on the Mac Mini (`chriss-mac-mini`). **Parent-run,
not a school service.** Design and reasoning: [docs/specs](docs/specs/2026-09-28-esa-server-design.md).

| What | Where |
|---|---|
| Address (Java) | `esa.myminecraft.party` (no port needed) |
| Address (Bedrock) | `esa.myminecraft.party`, port `19132` |
| Repo on the Mac | `/Users/chris/docker/minecraft-esa` |
| World and server files | `/Users/chris/docker/minecraft-esa/data` (never in git) |
| Nightly backups | `/Volumes/X9/backups/minecraft-esa`, 03:15 UK time, kept 14 days |
| Secrets | 1Password, Personal vault, item "Minecraft ESA Server" |
| Mac ports | 25566/tcp (Java), 19132/udp (Bedrock) |

Containers: `mc` (server), `backup` (itzg/mc-backup), `log-prune` (deletes
chat logs older than 30 days).
Mods (all server-side): the family server's set (fabric-api, lithium,
ferrite-core, krypton, spark, universal-graves, essential-commands,
fabric-language-kotlin, ledger, chunky, tabtps, styled-chat, inventory-sorting,
clumps, fallingtree) plus geyser, floodgate and worldedit.

## How it sits next to the family server

The family server (repo `Chris-HT/minecraft-server`, `~/docker/minecraft`) and
this one are separate Docker Compose projects (`name: minecraft-esa`). Deploying,
restarting or rolling back one never touches the other. Container names and host
ports are all different.

Two things are shared and **owned by the family repo**:

- **The relay droplet.** It forwards 25566/tcp and 19132/udp to the Mac for this
  server. Its firewall starts with `flush ruleset`, so it must only ever be
  configured from `minecraft-server/relay/`. Never add a relay config here.
- **Docker Desktop's memory** on the Mac (both servers share it).

DNS for `esa.myminecraft.party` sits in the same Cloudflare zone as
`myminecraft.party`.

## First-time setup

1. **Check the mods.** On Modrinth, confirm `geyser`, `floodgate` and
   `worldedit` each have a **Fabric 26.2** build and that those are the right
   slugs. Without Geyser and Floodgate there is no Bedrock play.
2. **Docker Desktop memory** on the Mac: Settings > Resources > Memory to
   **18 GB** (up from 12 for the family server alone).
3. **1Password item.** In Git Bash on the PC:
   ```bash
   op item create --category Password --vault Personal --title "Minecraft ESA Server" \
     --generate-password='32,letters,digits' >/dev/null
   ```
   `deploy.sh` writes it into `.env` on the Mac as `RCON_PASSWORD`.
4. **PC tooling.** Same as the family server and already set up on the PC: the
   `mac-mini` ssh alias, the 1Password CLI, rsync in Git Bash, and the
   `~/bin/ssh` and `~/bin/rsync-ssh` shims. For a new PC, follow "First-time
   setup" steps 3 and 4 in the `minecraft-server` README.
   Check with `./deploy.sh --dry-run`.
5. **Pick the seed** and put it in `SEED` in `.env.example` (see "Building the
   world"). `deploy.sh` and Compose both refuse to start without one, because
   the world is generated from it on the first start.
6. **Usernames.** Your Java username in `WHITELIST`, you and your child in
   `OPS`, in `.env.example`. Commit.
7. **Pull the one new image.** `itzg/minecraft-server` and `itzg/mc-backup` are
   already on the Mac, but `alpine` (for `log-prune`) is not, and pulls do not
   work over ssh (see the family README, "Image pulls need a Terminal on the
   Mac"). In a Terminal on the Mac:
   ```bash
   docker pull alpine:3
   ```
8. **Deploy:** `./deploy.sh`, then wait for "Done" in the log (below). If the
   first `up` fails with "container minecraft-esa is unhealthy", wait for "Done",
   then `./deploy.sh --no-pull`.
9. **Geyser auth.** Open `data/config/Geyser-Fabric/config.yml` on the Mac and
   check `auth-type: floodgate` (Geyser usually sets it when Floodgate is
   present). Change it if not, then restart `mc`.
10. **Ops levels.** Check `data/ops.json`: moderators should be `"level": 3`.
    You keep full (level 4) control through `rcon-cli`.
11. **Relay.** In the `minecraft-server` repo:
    `op run --env-file relay/.env.op -- relay/update-relay.sh`. It opens the
    cloud firewall ports and pushes the forwarding rules to the live relay.
12. **DNS** in Cloudflare, both **DNS only (grey cloud)**:
    ```
    A    esa                     <relay public IP>
    SRV  _minecraft._tcp.esa     priority 0, weight 5, port 25566, target esa.myminecraft.party
    ```
    The SRV record is why Java players do not type `:25566`. Bedrock ignores SRV
    and uses 19132, which is its default.
13. **Test from outside the tailnet**, e.g. a phone on mobile data: Java on
    `esa.myminecraft.party`, Bedrock on `esa.myminecraft.party` port 19132.
    Both should be refused until whitelisted.

## Deploy and update

```bash
./deploy.sh            # sync, secrets, pull, up -d
./deploy.sh --dry-run  # see what would change
./deploy.sh --no-pull  # skip image pull (the usual choice; pulls fail over ssh)
ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose logs -f mc'
```

To refresh images, in a Terminal on the Mac: `cd ~/docker/minecraft-esa && docker compose pull`.
`deploy.sh` refuses to run if the X9 drive is not mounted.

## Building the world

1. **Seed.** Use a seed map (e.g. Chunkbase) to find wide flat plains or meadow
   near 0,0, ideally with a village in view. Set `SEED` before the first deploy.
2. **Pre-generate** before anyone joins:
   ```bash
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky spawn'
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky radius 2000'
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky start'
   ```
3. **The ESA letters.** Convert the logo into a `.schem` (e.g. ObjToSchematic),
   copy it into `data/config/worldedit/schematics/`, then in game stand at the
   spot and run `//schem load esa` and `//paste`. Light it with sea lanterns or
   froglights so it shows at night.
   **Keep all of it inside spawn protection.** `SPAWN_PROTECTION: 64` covers a
   square 64 blocks each way from spawn. For example, letters 100 wide centred
   25 blocks in front of the platform span 50 blocks each side and fit. Letters
   90 blocks away would be mostly unprotected. If the build needs more room,
   raise `SPAWN_PROTECTION` (e.g. 96) and redeploy.
4. **Spawn.** Build a viewing platform facing the letters, stand on it, run
   `/setworldspawn ~ ~ ~ <facing angle>`, and set the spawn radius game rule
   to 0 so everyone lands on the same spot. The rule was `spawnRadius`, and newer
   versions renamed game rules, so tab-complete `/gamerule` to find its name.
5. **Rules signs** by the platform: "Be kind · No griefing · Mods: ___ ·
   Report problems to ___ · Not run by ESA".
6. **Template backup** once it is finished and **before students join**, so it
   holds no student data:
   ```bash
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T backup backup now'
   ssh mac-mini 'mkdir -p /Volumes/X9/backups/minecraft-esa-template && cp "$(ls -1 /Volumes/X9/backups/minecraft-esa/world-*.tar.gz | tail -n 1)" /Volumes/X9/backups/minecraft-esa-template/'
   ```
   It lives outside the pruned folder, so it is never deleted. To reset for a
   new term, restore it by hand as in "Backups and restore", using the template
   file.

## Adding players and moderators

Collect usernames and consent **through parents**.

- **Java:** add to `WHITELIST` in `.env.example` and redeploy, or straight away:
  ```bash
  ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli whitelist add SomeStudent'
  ```
- **Bedrock:** use Floodgate's whitelist, with the gamertag and no dot:
  ```bash
  ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli fwhitelist add TheirGamertag'
  ```
  In game they appear as `.TheirGamertag`. Do not put Bedrock names in
  `WHITELIST`: the image looks names up with Mojang, which does not know them.
  If `fwhitelist` does not answer from rcon, run it in game as an op.
- **Moderators:** only `OPS` in `.env.example` counts. Anyone opped in game (a
  level 3 moderator can run `/op`) is removed at the next restart or deploy.
  Level 3 can kick, ban, whitelist, teleport and change game mode, but not stop
  the server.

## Console commands

```bash
ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli list'
ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli say Server restarting in 5 minutes'
ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli spark tps'
ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli ban SomePlayer'
```

Watch `spark tps` during the pilot: MSPT should stay under 50 ms. Ledger records
every block change, so griefing can be inspected and rolled back in game
(`/ledger inspect`, `/ledger rollback`).

## Connecting

- **Java** (PC, Mac, Linux): Multiplayer > Add Server > `esa.myminecraft.party`.
  Version 26.2.
- **Bedrock** (phone, tablet, Windows Bedrock, Chromebook): Servers > Add
  Server > `esa.myminecraft.party`, port `19132`.
- **Consoles** (Xbox, PlayStation, Switch) cannot add custom servers without
  workarounds. Not supported at launch.
- Child Microsoft accounts may need a parent to allow "join multiplayer games"
  in Xbox family settings.
- Players come through the relay, so the server sees the relay's address, not
  theirs. Whitelisting is by username, so that does not matter.

## Play times

```bash
./playtimes.sh
```

Same as the family server's: total play time per player from the world's
stats. Bedrock players may show as a raw UUID if the server does not know their
name.

## Backups and restore

Full `.tar.gz` backups named `world-YYYYMMDD-HHMMSS.tar.gz` in
`/Volumes/X9/backups/minecraft-esa`. Unlike the family server, they **include
`logs/`**, so chat history is kept with each backup.

```bash
./rollback.sh --list                          # see what's on the X9 drive
./rollback.sh                                 # restore the newest backup
./rollback.sh world-20261001-031500.tar.gz    # restore a specific one
```

It confirms first, keeps the current world as `data.broken-<timestamp>` (which
`deploy.sh` never deletes), and puts it back if the extract fails. Delete
`data.broken-*` by hand once you are happy.

By hand, e.g. for the template reset:
```bash
ssh mac-mini
cd ~/docker/minecraft-esa
docker compose down
mv data data.broken-$(date +%Y%m%d-%H%M%S)
mkdir data
tar -xzf /Volumes/X9/backups/minecraft-esa-template/world-YYYYMMDD-HHMMSS.tar.gz -C data
docker compose up -d
docker compose logs -f mc     # wait for "Done"
```

## Chat logs

`log-prune` deletes `data/logs/*.log.gz` older than 30 days, once at start and
then daily. Backups hold logs for up to 14 days longer, until they are pruned.
Tell parents "about 6 weeks at most". The template backup holds none, since it
is taken before students join.

## Scaling to 50

1. Docker Desktop memory to **22 GB**.
2. `MAX_PLAYERS: 50` and `MEMORY: 8G` (up to 9G) in `docker-compose.yml`.
3. `./deploy.sh --no-pull`.
4. Watch `spark tps` and relay traffic (`doctl` or the DigitalOcean dashboard).
   50 players is well inside the relay's 500 GB a month, but check it.

## Upgrading Minecraft

1. Take a manual backup (`backup now`, as above).
2. Check every mod, **especially Geyser and Floodgate**, has a build for the
   new version. Geyser also has to support the current Bedrock app version.
3. Change `VERSION` in `docker-compose.yml`, commit, `./deploy.sh`.
4. If it fails, revert `VERSION` and redeploy; restore the backup if in doubt.

## Later

- An events server for creative contests (a second service under
  `profiles: [events]` on ports 25567/19133). The relay would need those
  ports added in `minecraft-server/relay/`.
- An optional curfew on school nights.
