/**
 * Minimal, zero-dependency CSV parser.
 *
 * Expects a CSV file with a header row. Parses each subsequent row
 * into an object keyed by the header columns.
 *
 * Supported format:
 *   name,phoneNumber
 *   João da Silva,5511999990001
 */

export interface CsvContact {
  name:        string;
  phoneNumber: string;
}

/**
 * Parses a raw CSV buffer into an array of CsvContact objects.
 * Skips empty lines and trims all cell values.
 *
 * @param buffer - The raw CSV file buffer (UTF-8 encoded).
 * @returns An array of parsed contact rows.
 * @throws {Error} If required columns (name, phoneNumber) are absent in the header.
 */
export function parseCsvContacts(buffer: Buffer): CsvContact[] {
  const text  = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const nameIdx  = headers.indexOf('name');
  const phoneIdx = headers.indexOf('phonenumber');

  if (nameIdx === -1 || phoneIdx === -1) {
    throw new Error(
      'CSV must have "name" and "phoneNumber" columns. ' +
      `Found headers: [${headers.join(', ')}]`,
    );
  }

  const results: CsvContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const name        = cols[nameIdx]  || '';
    const phoneNumber = cols[phoneIdx] || '';

    if (name && phoneNumber) {
      results.push({ name, phoneNumber });
    }
  }

  return results;
}
