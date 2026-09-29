# ESA Students' Minecraft Server

Fabric Minecraft **26.2** for students of Elstree Screen Arts, Java and Bedrock
in the same world, in Docker on the Mac Mini (`chriss-mac-mini`). **Parent-run,
not a school service.** Design and reasoning: [docs/specs](docs/specs/2026-09-28-esa-server-design.md).
Where things stand: [docs/project-status.md](docs/project-status.md).

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
clumps, fallingtree) plus geyser, floodgate, worldedit and disable-end.

**The End is closed.** `disable-end` stops End portals teleporting anyone
while the game rule is on. It is saved in the world, so it survives restarts
and deploys. The template backup was taken before it was added, so after
restoring that, run `/gamerule disable_end true` again. To open the End (for example, for a dragon-fight event), a moderator
runs `/gamerule disable_end false`, and `/gamerule disable_end true` to close
it again. Portals still light up either way.

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
5. **Check the seed.** `SEED` in `.env.example` is already chosen (see
   "Building the world"). Confirm it on Chunkbase before the first deploy:
   the world is generated from it on the first start and cannot change after.
6. **Usernames.** Your Java username in `WHITELIST` in `.env.example`, you and
   your child in `ops.json`. Commit.
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
10. **Ops levels.** Check `data/ops.json` matches `ops.json`: moderators at
    `"level": 3`. You keep full (level 4) control through `rcon-cli`.
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

1. **Seed.** `-5228782230889826103`: a flat plains plateau at 0,0 (about
   Y 92), a village at -176,0, cherry groves 200 blocks away. Details, a map
   and how to check it: [docs/project-status.md](docs/project-status.md),
   "World seed". Build the letters and platform at 0,0; the first join lands
   at about -112,0, so `/tp 0 94 0` (or walk east). The grass at 0,0 is at
   Y 93; `/tp 0 ~ 0` keeps your current height and can bury you in the hill.
   Build in `/gamemode creative` so you cannot suffocate or fall.
2. **Pre-generate** before anyone joins:
   ```bash
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky spawn'
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky radius 2000'
   ssh mac-mini 'export PATH=/usr/local/bin:$PATH; cd docker/minecraft-esa && docker compose exec -T mc rcon-cli chunky start'
   ```
3. **The ESA letters.** `assets/esa.schem` is ready: the logo
   (`assets/esa-logo.png`) as upright letters 100 wide, 35 tall and 2 deep, in
   concrete following the logo's purple-to-orange gradient. See
   `assets/esa-schem-preview.png`. `deploy.sh` copies it to the Mac. Put it
   where WorldEdit looks:
   ```bash
   ssh mac-mini 'cd docker/minecraft-esa && mkdir -p data/config/worldedit/schematics && cp assets/esa.schem data/config/worldedit/schematics/'
   ```
   In game, stand where the **bottom centre of the front face** should be and
   run `//schem load esa`, then `//paste -a` (`-a` leaves the existing ground
   alone instead of filling the gaps with air). The letters read correctly
   from the **south** (looking north), so put the platform south of them. To
   face another way, run `//rotate 90` (or 180, 270) between load and paste.
   `//undo` takes it back. Light it with sea lanterns or froglights so it
   shows at night.
   To change the size or depth, run
   `python3 tools/logo_to_schem.py --width 120 --depth 3` (needs
   `pip install pillow`) and commit the new files.
   **Keep all of it inside spawn protection.** `SPAWN_PROTECTION: 64` covers a
   square 64 blocks each way from spawn. For example, letters 100 wide centred
   25 blocks in front of the platform span 50 blocks each side and fit. Letters
   90 blocks away would be mostly unprotected. If the build needs more room,
   raise `SPAWN_PROTECTION` (e.g. 96) and redeploy.
   **Picture walls.** `assets/creative.schem` (chameleon),
   `assets/craftship.schem` (bee) and `assets/committed.schem` (donkey) are
   64 x 64 x 1 pixel-art walls, pasted the
   same way (`//schem load creative`, `//paste -a -s`); previews beside them.
   Copy them to the schematics folder as for `esa.schem`. To make one from
   another picture, see `tools/image_to_schem.py`.
4. **Spawn.** Build a viewing platform facing the letters, stand on it, run
   `/setworldspawn ~ ~ ~ <facing angle>`, and set the spawn radius game rule
   to 0 so everyone lands on the same spot. The rule was `spawnRadius`, and newer
   versions renamed game rules, so tab-complete `/gamerule` to find its name.
5. **Rules signs** by the platform: welcome ("Not run by ESA"), rules,
   moderators, and who to tell about problems. In creative, paste the four
   `/give` commands from `assets/rules-signs.txt` into chat; each gives a
   ready-written, waxed sign. If the moderators change, edit that file.
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
- **Moderators:** only `ops.json` in the repo counts. Add an entry with their
  UUID (it is in `data/usercache.json` once they have joined, or look it up on
  a site such as mcuuid.net) and `"level": 3`, then redeploy. Anyone opped in
  game (a level 3 moderator can run `/op`) is removed at the next restart or
  deploy. Level 3 can kick, ban, whitelist, teleport and change game mode, but
  not stop the server. (`ops.json` is used rather than an `OPS` list because
  the image gives everyone in a list level 4.)

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
   Geyser publishes only beta builds on Modrinth, hence `geyser:beta` in
   `MODRINTH_PROJECTS`.
3. Change `VERSION` in `docker-compose.yml`, commit, `./deploy.sh`.
4. If it fails, revert `VERSION` and redeploy; restore the backup if in doubt.

## Later

- An events server for creative contests (a second service under
  `profiles: [events]` on ports 25567/19133). The relay would need those
  ports added in `minecraft-server/relay/`.
- An optional curfew on school nights.
