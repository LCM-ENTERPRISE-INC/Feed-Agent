/**
 * Utility functions for WhatsApp phone number handling.
 *
 * WhatsApp JID format: <DDI><DDD><Number>@s.whatsapp.net
 * All numbers must be digits only, starting with the country code.
 * Example for Brazil: 5511999990001
 */

/** Regex that accepts 10 to 15 digit strings (E.164 without the '+' prefix). */
const PHONE_REGEX = /^\d{10,15}$/;

/**
 * Removes any non-digit characters and validates the resulting string
 * against the E.164-compatible format (10–15 digits, no '+').
 *
 * @param raw - The raw phone number string provided by the user.
 * @returns The sanitized, digit-only phone number string.
 * @throws {Error} If the sanitized number does not match the expected format.
 */
export function sanitizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (!PHONE_REGEX.test(digits)) {
    throw new Error(
      `Invalid phone number: "${raw}". ` +
      `Expected 10 to 15 digits (e.g. 5511999990001 for Brazil).`,
    );
  }

  return digits;
}

/**
 * Validates whether a string is a valid sanitized phone number
 * without throwing — useful for filtering operations.
 *
 * @param value - The phone number string to test.
 * @returns true if valid, false otherwise.
 */
export function isValidPhoneNumber(value: string): boolean {
  return PHONE_REGEX.test(value.replace(/\D/g, ''));
}

/**
 * Formats a sanitized phone number into a WhatsApp JID.
 *
 * @param phoneNumber - Already-sanitized digit-only number.
 * @returns JID string in the format "<number>@s.whatsapp.net".
 */
export function toWhatsAppJid(phoneNumber: string): string {
  return `${phoneNumber}@s.whatsapp.net`;
}

/**
 * Brazilian mobile numbers may appear with or without the 9th digit after the DDD.
 * Returns lookup variants so chat history / contacts do not duplicate by format.
 */
export function phoneLookupVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return [];

  const variants = new Set<string>([digits]);

  if (digits.startsWith('55') && digits.length === 13) {
    // 55 + DDD(2) + 9 + 8 digits → also match without the 9
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.startsWith('9') && rest.length === 9) {
      variants.add(`55${ddd}${rest.slice(1)}`);
    }
  } else if (digits.startsWith('55') && digits.length === 12) {
    // 55 + DDD(2) + 8 digits → also match with inserted 9
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 8) {
      variants.add(`55${ddd}9${rest}`);
    }
  }

  return [...variants];
}

/** Masks a phone for logs/docs — keeps country hint, hides the rest. */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}
