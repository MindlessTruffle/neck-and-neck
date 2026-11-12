# Put your club online

The game client, authoritative server, private parties, and 1v1/2v2 queues are implemented. This guide leaves account creation, billing verification, and VM creation to you. No Oracle resources have been created.

## Try multiplayer locally first

Requires Node.js 24 LTS. From this repository:

```sh
npm ci
npm run dev:online
```

Or double-click `Start Online.cmd` on Windows. Open http://127.0.0.1:5173 in two separate tabs. Choose **Party Post**, give each tab a different court name, and connect to `ws://127.0.0.1:8787`. One player creates a 1v1 party; the other joins with its invite code. The host starts when both teams are occupied. Use four tabs for a private 2v2 match. A two-person 2v2 party can queue together; solo queues work without a party.

If ports 5173 or 8787 already have this game running, use the existing preview or stop that process before starting another copy. Local development binds only to localhost.

## 1. Create your Oracle VM

1. Create/sign in to your Oracle Cloud account yourself and complete its verification/terms steps.
2. In your home region, create an **Ubuntu 24.04 LTS Arm64** instance using **VM.Standard.A1.Flex**, ideally **2 OCPUs / 6 GB RAM**, and a roughly **50 GB boot volume**. Save its SSH private key somewhere private.
3. Confirm the console marks your allocation **Always Free eligible** before creating it. Avoid paid shapes or resources merely covered by trial credit.
4. Use a public subnet with a public IPv4 address. Add network ingress TCP **80 and 443** from the internet and TCP **22 only from your own public IP /32**. Keep raw game port **8787 closed**.

Oracle's current documented A1 allowance is 1,500 OCPU-hours and 9,000 GB-hours monthly, equivalent to **2 OCPUs / 12 GB** continuously. Capacity can be unavailable; idle free instances can be reclaimed. Check the current console and [Oracle's official limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) when provisioning. The application does not require a paid account upgrade.

## 2. Give the server a hostname

Point a DNS **A record** such as `club.your-domain.com` to the VM's public IPv4 address. Use a hostname you control. A hostname and publicly reachable ports 80/443 let Caddy obtain and renew a trusted TLS certificate. The Pages client uses **wss://**, not an unencrypted public WebSocket.

If you do not have a domain yet, finish the local test first. DNS/hostname configuration remains necessary for this supplied public TLS setup; do not bypass certificate warnings.

## 3. Install Docker on the VM

From Windows PowerShell, connect using your actual key path and VM address:

```powershell
ssh -i "C:\path\to\your-private-key" ubuntu@YOUR_VM_PUBLIC_IP
```

Install Docker Engine and its Compose plugin using [Docker's official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/), choosing the apt repository method. Then verify:

```sh
sudo docker version
sudo docker compose version
```

The supplied images support Arm64. Docker-published ports can bypass UFW rules, so retain the Oracle network ingress restrictions above. The Compose configuration exposes only Caddy's 80/443; the game port stays on its private container network.

## 4. Start the club

On the VM:

```sh
sudo apt update
sudo apt install -y git
git clone https://github.com/MindlessTruffle/neck-and-neck.git
cd neck-and-neck
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Set these values, using your real hostname:

```dotenv
CLUB_HOST=club.your-domain.com
ALLOWED_ORIGINS=https://mindlesstruffle.github.io
MAX_ROOMS=8
MAX_CONNECTIONS=64
```

An origin is scheme + hostname + optional port, with **no path or trailing slash**. To admit another client site, explicitly add its origin, separated by a comma. Never use a wildcard. This file contains deployment settings, not an ElevenLabs key. Audio is already bundled; the server needs no audio credentials.

```sh
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml ps
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=60 game caddy
curl --fail https://club.your-domain.com/health
```

The health response should report `ok: true`. Caddy handles TLS and WebSocket forwarding using its [documented Compose/reverse-proxy deployment](https://caddyserver.com/docs/running#docker-compose). Its certificate data persists in Docker volumes. Containers restart after a VM reboot. `TRUST_PROXY` is enabled only because Caddy is the sole ingress to the private game container; do not expose 8787 or enable that flag on a directly exposed standalone server.

## 5. Connect the published game

Open [Neck & Neck](https://mindlesstruffle.github.io/neck-and-neck/), choose **Party Post**, enter `wss://club.your-domain.com`, and connect. The address saves on that browser. Friends enter the same server address, then use an invite code or the same queue. Share the public hostname and invite code; never share SSH keys.

For a baked-in default address, add a GitHub repository **Actions variable** named `VITE_SERVER_URL` containing that public `wss://` URL, then rerun the Pages workflow. The build reads that variable. It is configuration, not a secret. Until a server is provisioned, the published game's online panel deliberately requires an endpoint instead of pretending players are online.

## Operations and limits

### Temporary E2.1.Micro profile

For a 1 GB Oracle E2.1.Micro, append `-f deploy/compose.micro.yaml` to every Compose command after the base file. This limits the server to two courts and sixteen connections, caps the Node heap at 192 MB, and reduces container memory limits. It does not establish that the shared CPU can sustain play; run a one-court load test on the VM before opening queues. E2 uses an x86 image. Oracle Linux uses the `opc` SSH user and its own package manager; the Ubuntu installation commands above do not apply to it.

```sh
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.micro.yaml up -d --build
```

- Run `npm test`, `npm run test:network`, `npm run test:simulation`, and `npm run test:load` before updates. The load test runs locally; actual Oracle CPU, region, network and phone performance still need measurement after provisioning.
- Physics runs at 120 Hz, snapshots at 20 Hz, and client inputs at 30 Hz. Clients predict only their own movement/neck, interpolate remote poses, and accept server ball contacts and scores. Internet latency still affects competitive hits; choose a region close to your players.
- The initial eight-room cap is conservative, not a promise of capacity on every VM. Start with two rooms if the VM is busy, monitor health/CPU and player latency, then increase only after measurement.
- Dropped connections have a 15-second rejoin window before forfeit. Restarting the server ends active rooms and matches; notify players before updating.
- Rooms and sessions live in memory. This version uses guest names and device-local cosmetics/clovers, with no accounts, payments, cloud inventory, public chat, or ranked economy. Clearing browser storage clears local progress.
- Rate, origin, message-size, session, connection, room, and input limits are enforced. Keep dependencies updated and the host patched. A public game can still need stronger abuse protection as its audience grows.

To update after pulling a reviewed release:

```sh
git pull --ff-only
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

To stop the club while retaining certificates:

```sh
sudo docker compose --env-file deploy/.env -f deploy/compose.yaml down
```

## Troubleshooting

- **Cannot connect locally:** run `npm run server`, check port 8787, and use `ws://127.0.0.1:8787` from the local HTTP preview.
- **TLS/health fails:** check DNS points to the current VM IP, Oracle ingress permits 80/443, and Caddy logs show certificate issuance. Do not ignore TLS errors.
- **Origin refused:** use the exact client origin in `ALLOWED_ORIGINS`, then recreate containers. The repository path `/neck-and-neck/` is not part of the origin.
- **Queue waits:** it needs real connected humans. 1v1 needs two; 2v2 needs four. A duo queues as a unit on one team.
- **Private start disabled/refused:** connect exactly two or four players, select balanced teams, and start from the host.
- **Choppy online play:** check round-trip latency, close competing tabs/downloads, lower room capacity, and inspect VM CPU. Native pointer capture works best in direct Chrome/Edge; embedded previews may reject it.

Provisioning handoff: once your VM exists, have its public IP, chosen DNS hostname and SSH connection ready. The remaining work is applying the commands above and testing the public endpoint with real remote players.

## Live E2 playtest deployment (2026-11-12)

The live client defaults to `wss://neck-club.147.5.119.55.sslip.io` through the repository Actions variable `VITE_SERVER_URL`. HTTPS `/health` exposes minimal status. The game itself is served by GitHub Pages.

This Oracle Linux E2 VM uses native systemd services, not Docker: `neck-club` runs Node 24 from `/opt/neck-node/bin/node` with application files in `/opt/neck-club`; `caddy` provides automatic HTTPS. Both start on boot. The game binds only to `127.0.0.1:8787`, allows the Pages origin, and caps capacity at two courts/sixteen connections with a 128 MB Node heap. Caddy configuration lives at `/etc/caddy/Caddyfile`. SSH is restricted to the administrator IP in both Oracle and firewalld; update both if that IP changes. Private keys remain outside this repository.

Check services with `sudo systemctl status neck-club caddy`; inspect logs with `sudo journalctl -u neck-club -u caddy --since '10 minutes ago'`. Restarting `neck-club` ends matches. Copy reviewed server/physics/protocol updates to `/opt/neck-club` before restarting. Do not use Docker commands above on this native deployment.

Validation: four-player host test sustained approximately 120 Hz physics and 20 Hz snapshots for 20 seconds; public TLS checks passed private 1v1/2v2 and both queues. These short tests do not guarantee sustained performance on shared E2 CPU. Keep the current measured cap until longer real-player sessions justify more.

For an idle deployment, run `SMOKE_SERVER_URL=wss://your-host node tests/deploy-smoke.mjs`. It creates test rooms and matches, then leaves them. Never run against a busy server. Set `SMOKE_TWO_COURTS=1` to also test eight clients across two concurrent 2v2 matches.

### Two-court optimization validation

The E2 cap is now two simultaneous matches (up to eight active players), with sixteen total connections for lobby headroom. Physics remains 120 Hz and snapshots remain 20 Hz. The server serializes each shared snapshot once per court, wakes its fixed-step loop every 8 ms instead of 4 ms, and scans session expiry every 100 ms.

A 180-second on-host test with continuous rematches, eight clients and 30 Hz input achieved 120 Hz physics per court, 20 Hz snapshots per client, 11.39 ms p95 event-loop delay, and zero dropped simulation time. Combined server plus synthetic clients averaged 9.7% of one CPU core and used 92.4 MB RSS; maximum individual server tick was 67.1 ms. This is measured headroom, not a guarantee against shared-host pauses or WAN latency. Do not increase capacity beyond two without another sustained test.

### Server health dashboard

Open `/serverhealth` on the Oracle hostname, or `/neck-and-neck/serverhealth/` on GitHub Pages. It refreshes cached aggregate telemetry every five seconds: active courts, players, queue, connections, host CPU/available RAM, process CPU/RSS, uptime and event-loop delay. It monitors this deployed game service, not other Oracle instances. CPU percentage is sampled usage, not burst-credit balance or guaranteed capacity. Stale and unreachable samples are explicitly marked.

Native deployments must include `server/resource-monitor.mjs` and `public/serverhealth/index.html` along with the game server. `/api/serverhealth` exposes only aggregate operational data; `/health` remains minimal. Cross-origin dashboard reads allow the configured game origin. Local preview: `npm run dev:online`, then `http://127.0.0.1:5173/serverhealth/`.

### Recovery safeguards

Guest sessions live in server memory. After a restart, the client now discards an expired saved token and reconnects as a fresh guest; it does not claim to restore a lost match or old invite code.

For the native systemd deployment, install `deploy/health-watchdog.sh` under `/opt/neck-club/deploy/`, copy the supplied watchdog service/timer to `/etc/systemd/system/`, run `sudo systemctl daemon-reload`, then `sudo systemctl enable --now neck-club-watchdog.timer`. It probes local game health and local verified HTTPS once a minute, restarts only after three consecutive failed probes, and does not mistake an unavailable game upstream for a broken proxy. Inspect recovery logs with `journalctl -t neck-club-watchdog`. It never reboots the VM. A kernel/host freeze cannot be repaired by a watchdog inside the same frozen VM; Oracle power recovery is still required.
