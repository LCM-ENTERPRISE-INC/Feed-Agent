"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsvContacts = parseCsvContacts;
/**
 * Parses a raw CSV buffer into an array of CsvContact objects.
 * Skips empty lines and trims all cell values.
 *
 * @param buffer - The raw CSV file buffer (UTF-8 encoded).
 * @returns An array of parsed contact rows.
 * @throws {Error} If required columns (name, phoneNumber) are absent in the header.
 */
function parseCsvContacts(buffer) {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
        throw new Error('CSV file must contain a header row and at least one data row.');
    }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const nameAliases = ['name', 'nome', 'contato', 'contact'];
    const phoneAliases = ['phonenumber', 'telefone', 'phone', 'numero', 'celular'];
    let nameIdx = -1;
    let phoneIdx = -1;
    for (let i = 0; i < headers.length; i++) {
        if (nameAliases.includes(headers[i]))
            nameIdx = i;
        if (phoneAliases.includes(headers[i]))
            phoneIdx = i;
    }
    if (nameIdx === -1 || phoneIdx === -1) {
        throw new Error('O arquivo CSV precisa ter as colunas "Nome" e "Telefone" (ou equivalentes). ' +
            `Cabeçalhos encontrados: [${headers.join(', ')}]`);
    }
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx] || '';
        const phoneNumber = cols[phoneIdx] || '';
        if (name && phoneNumber) {
            results.push({ name, phoneNumber });
        }
    }
    return results;
}
