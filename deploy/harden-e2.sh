#!/bin/bash
# Oracle Linux E2 micro: contain maintenance work and recover stalled services.
# Run as root on the game VM. No port, authentication or firewall changes.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run as root'; exit 1; }
[ -f /etc/oracle-release ] && [ -f /sys/fs/cgroup/cgroup.controllers ] || { echo 'Oracle Linux with cgroup v2 required'; exit 1; }
backup="/var/backups/neck-club-reliability-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
cp -a /etc/fstab "$backup/fstab"
systemctl cat neck-club caddy dnf-makecache.service > "$backup/units.txt"

# DNF metadata prefetch exhausted the entire VM on 2026-11-13. Keep its timer,
# but limit this service rather than letting it exhaust the host. This does not
# disable security updates or impose these limits on manual administrator DNF.
mkdir -p /etc/systemd/system/dnf-makecache.service.d
cat > /etc/systemd/system/dnf-makecache.service.d/neck-budget.conf <<'EOF'
[Service]
MemoryAccounting=true
MemoryHigh=192M
MemoryMax=320M
MemorySwapMax=256M
CPUWeight=10
IOWeight=10
OOMScoreAdjust=500
OOMPolicy=stop
TimeoutStartSec=5min
TimeoutStopSec=15s
EOF

# Extra swap is an emergency buffer, not additional match capacity.
if [ ! -e /neck-club.swap ]; then
  available=$(df -Pk / | awk 'NR==2 {print $4}')
  [ "$available" -gt 3145728 ] || { echo 'Need 3 GiB disk headroom'; exit 1; }
  (umask 077; dd if=/dev/zero of=/neck-club.swap bs=1M count=1536 status=none)
  mkswap /neck-club.swap
fi
[ -f /neck-club.swap ] && [ ! -L /neck-club.swap ] || exit 1
chmod 600 /neck-club.swap
if ! swapon --noheadings --show=NAME | grep -Fxq /neck-club.swap; then swapon /neck-club.swap; fi
grep -q '^/neck-club.swap[[:space:]]' /etc/fstab || printf '/neck-club.swap none swap sw 0 0\n' >> /etc/fstab
cat > /etc/sysctl.d/90-neck-club-reliability.conf <<'EOF'
vm.swappiness=20
kernel.panic=30
EOF
sysctl -p /etc/sysctl.d/90-neck-club-reliability.conf

for unit in neck-club caddy; do
  mkdir -p "/etc/systemd/system/$unit.service.d"
  cat > "/etc/systemd/system/$unit.service.d/recovery.conf" <<'EOF'
[Unit]
StartLimitIntervalSec=0
[Service]
Restart=always
RestartSec=3
TimeoutStopSec=10
OOMPolicy=kill
OOMScoreAdjust=-250
MemoryAccounting=true
EOF
done
cat >> /etc/systemd/system/neck-club.service.d/recovery.conf <<'EOF'
MemoryHigh=160M
MemoryMax=200M
MemorySwapMax=32M
EOF
cat >> /etc/systemd/system/caddy.service.d/recovery.conf <<'EOF'
MemoryHigh=64M
MemoryMax=100M
MemorySwapMax=16M
EOF

# A software watchdog covers a stalled PID 1 while the guest kernel can still
# schedule timers. It cannot repair a frozen hypervisor or total kernel lockup.
printf 'softdog\n' > /etc/modules-load.d/neck-watchdog.conf
printf 'options softdog soft_margin=120\n' > /etc/modprobe.d/neck-watchdog.conf
modprobe softdog
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/neck-watchdog.conf <<'EOF'
[Manager]
RuntimeWatchdogSec=120s
RebootWatchdogSec=5min
WatchdogDevice=/dev/watchdog0
EOF
systemctl daemon-reload
systemctl daemon-reexec
systemctl enable neck-club caddy neck-club-watchdog.timer
echo "Saved previous configuration: $backup"
systemctl show -p RuntimeWatchdogUSec
swapon --show
