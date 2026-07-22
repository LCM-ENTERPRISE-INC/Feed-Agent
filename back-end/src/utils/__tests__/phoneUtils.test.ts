import { sanitizePhoneNumber, isValidPhoneNumber, toWhatsAppJid, phoneLookupVariants, maskPhone } from '../phoneUtils';

describe('PhoneUtils', () => {
  describe('sanitizePhoneNumber', () => {
    it('should strip non-digit characters', () => {
      expect(sanitizePhoneNumber('+55 (11) 99999-0001')).toBe('5511999990001');
      expect(sanitizePhoneNumber('55 11 9 9999 0001')).toBe('5511999990001');
    });

    it('should throw if number is too short', () => {
      expect(() => sanitizePhoneNumber('123456789')).toThrow('Invalid phone number'); // 9 digits
    });

    it('should throw if number is too long', () => {
      expect(() => sanitizePhoneNumber('1234567890123456')).toThrow('Invalid phone number'); // 16 digits
    });

    it('should process exact 10 and 15 digit boundaries successfully', () => {
      expect(sanitizePhoneNumber('1234567890')).toBe('1234567890');
      expect(sanitizePhoneNumber('123456789012345')).toBe('123456789012345');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid numbers with formatting', () => {
      expect(isValidPhoneNumber('+55 11 99999-0001')).toBe(true);
    });

    it('should return false for invalid length', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('1234567890123456789')).toBe(false);
    });
  });

  describe('toWhatsAppJid', () => {
    it('should append the s.whatsapp.net suffix', () => {
      expect(toWhatsAppJid('5511999990001')).toBe('5511999990001@s.whatsapp.net');
    });
  });

  describe('phoneLookupVariants', () => {
    it('returns with/without Brazilian 9th digit', () => {
      const withNine = phoneLookupVariants('5511999990001');
      expect(withNine).toEqual(expect.arrayContaining(['5511999990001', '551199990001']));
      const withoutNine = phoneLookupVariants('551199990001');
      expect(withoutNine).toEqual(expect.arrayContaining(['551199990001', '5511999990001']));
    });
  });

  describe('maskPhone', () => {
    it('masks middle digits', () => {
      expect(maskPhone('5511999990001')).toBe('5511***01');
    });
  });
});
