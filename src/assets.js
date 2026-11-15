const revisions = typeof __ASSET_REVISIONS__ === 'undefined' ? {} : __ASSET_REVISIONS__;

/** Content-versioned public assets avoid stale model/texture caches after releases. */
export function versionedAssetPath(path, revisions = {}) {
  const clean = path.replace(/^\/+/, '');
  const revision = revisions[clean];
  return revision ? `${clean}?v=${revision}` : clean;
}
export function assetUrl(path) {
  return `${import.meta.env?.BASE_URL || '/'}${versionedAssetPath(path, revisions)}`;
}
