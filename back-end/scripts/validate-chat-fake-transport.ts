/**
 * Local fake-transport validation for Bate-Papo (no real WhatsApp / no mongod binary).
 * Run from back-end: npx jest --runInBand --testPathPatterns=ChatService
 *
 * This script mirrors the happy-path assertions used in ChatService tests.
 */
import assert from 'assert';

async function main() {
  // Delegate to the unit suite conceptually — keep a tiny pure check here for CI docs.
  const { phoneLookupVariants, maskPhone } = await import('../src/utils/phoneUtils');
  const variants = phoneLookupVariants('5511999990001');
  assert.ok(variants.includes('551199990001'), 'BR 9th digit variant missing');
  assert.strictEqual(maskPhone('5511999990001'), '5511***01');
  console.log('[ok] fake-transport prerequisites (phone variants + masking)');
  console.log('[done] run: npm test -- --testPathPatterns=ChatService');
}

main().catch((err) => {
  console.error('[fail]', err?.message || err);
  process.exit(1);
});
