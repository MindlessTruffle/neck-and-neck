#!/bin/bash
# Run as root through the supplied systemd timer. Never reboot the host.
set -euo pipefail
state=/run/neck-club-watchdog
mkdir -p "$state"
chmod 700 "$state"
check_service() {
  service="$1"
  shift
  if curl --fail --silent --show-error --max-time 5 "$@" 2>/dev/null | grep -q '"ok":true'; then
    printf '0\n' > "$state/$service"
    return 0
  fi
  failures=0
  if [ -f "$state/$service" ]; then read -r failures < "$state/$service" || true; fi
  case "$failures" in ''|*[!0-9]*) failures=0;; esac
  failures=$((failures + 1))
  printf '%s\n' "$failures" > "$state/$service"
  logger -t neck-club-watchdog "$service health failure $failures of 3"
  if [ "$failures" -ge 3 ]; then
    logger -t neck-club-watchdog "Restarting unresponsive $service after three failed probes"
    systemctl restart "$service"
    printf '0\n' > "$state/$service"
  fi
  return 1
}
# Do not mistake a failed upstream game for a failed HTTPS proxy.
if check_service neck-club http://127.0.0.1:8787/health; then
  check_service caddy --resolve neck-club.147.5.119.55.sslip.io:443:127.0.0.1 https://neck-club.147.5.119.55.sslip.io/health || true
fi

