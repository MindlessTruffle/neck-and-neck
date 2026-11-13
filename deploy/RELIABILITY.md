# E2 reliability and room cleanup — 13 November 2026

## Incident evidence

Persistent kernel logs recorded a global out-of-memory kill of `dnf` in
`dnf-makecache.service` at 13:40 UTC. Its anonymous resident memory reached
688,796 KiB; the original 498 MiB swap was full. Another metadata-cache run
started at 15:15 UTC; the previous boot's logs stopped at 15:16 UTC. This confirms
host memory exhaustion and strongly implicates repeated metadata prefetch in
the later freeze. It does not prove that every historical outage had one cause.

## Protection installed

`sudo bash deploy/harden-e2.sh` is intended only for this Oracle Linux / cgroup-v2
game VM. It saves the previous fstab and service definitions under
`/var/backups/neck-club-reliability-*` before applying changes.

- DNF background cache: 192 MiB soft pressure limit, 320 MiB RAM ceiling,
  256 MiB swap ceiling, five-minute timeout and lower CPU/I/O weight. Timer and
  security-update mechanisms remain enabled. A cache job may fail inside its
  own limits rather than exhausting the host. Manual DNF is unaffected.
- Additional 1.5 GiB swap file, mode 0600, persistent in fstab. Total swap is
  approximately 2 GiB. This is emergency headroom, not extra match capacity.
- Game/proxy: restart on exit, no restart-rate lockout, bounded shutdown,
  bounded RAM/swap, and a lower OOM-kill preference.
- Service health probes every 30 seconds. Three consecutive failed probes
  restart the failed service; a healthy probe resets its counter. An upstream
  game failure does not trigger a proxy restart.
- Oracle-signed `softdog` module feeds a 120-second PID-1 watchdog. Kernel panic
  reboot delay is 30 seconds. Software watchdog requires functioning guest-kernel
  timers; it cannot recover a frozen hypervisor or every hard kernel lockup.

No firewall, SSH access, TLS, authentication, or public-port changes are made.
Oracle Cloud Agent, firewall, audit logging and existing monitoring remain on.
Two simultaneous matches / 16 connections remain the production caps.

## Match lifecycle

- Explicit Leave clears client input, buffered snapshots, local slot, match and
  room immediately. Manual disconnect sends Leave and forgets its resume token.
- Back from Multiplayer to the cloud menu disconnects rather than leaving a
  hidden party or matchmaking queue active.
- An empty match is released immediately, even during its celebration.
- All completed courts, including private parties, disappear immediately after
  the final score. The server sends the final snapshot and result, releases the
  room, and stops its physics. Clients finish the cosmetic ragdoll celebration
  locally; players can create a new party or queue again from results.
- Connected clients keep retrying a lost server with jittered exponential
  backoff capped at 8–9.2 seconds, without an attempt limit. A restarted server's
  expired session token is discarded automatically. Deliberate Leave cancels
  recovery; protocol errors and a session moved to another tab remain terminal.
- Abrupt disconnects preserve the normal 15-second reconnect grace. Empty
  disconnected matches/rooms are then released; sessions expire after 60 seconds.

## Verification and operations

Run `npm run test:network` for lifecycle, reconnect, heartbeat, capacity, health,
and service-watchdog tests. `tests/room-reset.mjs` includes repeated leave/rejoin,
immediate empty-court release, queue-room reclamation and abrupt disconnects.
The public smoke test covers private/queued 1v1 and 2v2 plus two concurrent courts.

Inspect service recovery with:

```sh
systemctl status neck-club caddy neck-club-watchdog.timer
journalctl -u neck-club-watchdog.service -u neck-club -n 80
systemctl show -p RuntimeWatchdogUSec
cat /sys/class/watchdog/watchdog0/state
systemctl show dnf-makecache.service -p MemoryMax -p MemoryPeak -p Result
free -m
```

If rolling back, restore only the named reliability drop-ins and fstab changes
from the backup. Do not remove an active swap file: disable it with `swapoff`
only when enough RAM is available. Disable the manager watchdog before unloading
softdog. Existing watchdog units are separate from the new host-watchdog config.

A single free VM still has no failover during Oracle host/network outages.
These controls reduce avoidable downtime and provide bounded automatic recovery;
they do not establish a 100% uptime SLA or replace long-duration observation.

References: [systemd resource limits](https://freedesktop.org/software/systemd/man/latest/systemd.resource-control.html),
[systemd runtime watchdog](https://www.freedesktop.org/software/systemd/man/257/systemd-system.conf.html),
[Oracle systemd timers](https://docs.oracle.com/en/operating-systems/oracle-linux/9/systemd/WorkingWithTimers.html).
