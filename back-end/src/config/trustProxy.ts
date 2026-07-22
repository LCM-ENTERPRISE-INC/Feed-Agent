/**
 * Resolve Express `trust proxy` hop count for a single nginx reverse proxy.
 * Default: 1. Rejects unsafe/non-integer values.
 */
export function resolveTrustProxyHops(
  raw: string | undefined = process.env.TRUST_PROXY_HOPS,
): number {
  const value = raw === undefined || raw === '' ? '1' : raw;
  const hops = Number(value);

  if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
    throw new Error(
      `Invalid TRUST_PROXY_HOPS="${value}". Expected an integer from 0 to 5 (prefer 1 behind nginx).`,
    );
  }

  return hops;
}
