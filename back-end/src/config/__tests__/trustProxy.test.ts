import { resolveTrustProxyHops } from '../trustProxy';

describe('resolveTrustProxyHops', () => {
  const original = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('defaults to 1 when unset', () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(resolveTrustProxyHops()).toBe(1);
  });

  it('accepts explicit hop count', () => {
    expect(resolveTrustProxyHops('1')).toBe(1);
    expect(resolveTrustProxyHops('0')).toBe(0);
  });

  it('rejects invalid values', () => {
    expect(() => resolveTrustProxyHops('true')).toThrow(/Invalid TRUST_PROXY_HOPS/);
    expect(() => resolveTrustProxyHops('-1')).toThrow(/Invalid TRUST_PROXY_HOPS/);
    expect(() => resolveTrustProxyHops('99')).toThrow(/Invalid TRUST_PROXY_HOPS/);
  });
});
