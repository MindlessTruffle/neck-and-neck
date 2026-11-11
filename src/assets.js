/** Resolve bundled assets on localhost and GitHub Pages project URLs. */
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
