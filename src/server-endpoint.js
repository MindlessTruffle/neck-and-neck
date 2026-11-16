// Keep existing saved settings working when the public game hostname changes.
export function migrateServerEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'wss:' && url.hostname === 'neck-club.147.5.119.55.sslip.io' && !url.port && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) {
      url.hostname = 'neck-club.147.5.119.55.nip.io';
      return url.href;
    }
  } catch {}
  return value;
}
