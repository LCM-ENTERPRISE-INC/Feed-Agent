/**
 * Utilitários de importação CSV de contatos — alinhados à API:
 * POST /api/contacts/import espera colunas `name` e `phoneNumber`.
 */

export interface ImportContactRow {
  index: number;
  name: string;
  /** Telefone só dígitos (E.164 sem '+'), pronto para a API. */
  phone: string;
  valid: boolean;
  errors: string[];
}

type CsvRecord = Record<string, string | undefined>;

const HEADER_ALIASES = {
  name: ['name', 'nome'],
  phone: ['phonenumber', 'phone', 'telefone', 'celular'],
} as const;

/** Remove aspas externas e espaços. */
export function cleanCsvCell(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Normaliza telefone para o formato aceito pelo backend (10–15 dígitos).
 * Prefixa 55 quando o número parece BR local (10–11 dígitos sem DDI).
 */
export function normalizePhoneForImport(raw: string): { phone: string; error?: string } {
  let digits = raw.replace(/\D/g, '');
  if (!digits) {
    return { phone: '', error: 'Telefone vazio' };
  }
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) {
    return {
      phone: digits,
      error: `Número inválido (${digits.length} dígitos; esperado 10–15, ex.: 5511999990001)`,
    };
  }
  return { phone: digits };
}

function pickField(row: CsvRecord, aliases: readonly string[]): string {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = key.trim().toLowerCase().replace(/[\s_]+/g, '');
    if (aliases.includes(normalized)) {
      return cleanCsvCell(value);
    }
  }
  return '';
}

/** Converte uma linha do Papa Parse em linha de importação validada. */
export function mapCsvRowToImport(row: CsvRecord, index: number): ImportContactRow {
  const name = pickField(row, HEADER_ALIASES.name);
  const rawPhone = pickField(row, HEADER_ALIASES.phone);
  const errors: string[] = [];

  if (!name) errors.push('Nome vazio');

  const { phone, error: phoneError } = normalizePhoneForImport(rawPhone);
  if (phoneError) errors.push(phoneError);

  return {
    index,
    name,
    phone,
    valid: errors.length === 0,
    errors,
  };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Gera CSV no formato exato da API (`name,phoneNumber`). */
export function buildContactsImportCsv(rows: Array<{ name: string; phone: string }>): string {
  const lines = ['name,phoneNumber'];
  for (const row of rows) {
    lines.push(`${escapeCsv(row.name)},${escapeCsv(row.phone)}`);
  }
  return `${lines.join('\n')}\n`;
}

export const CONTACTS_IMPORT_TEMPLATE = `name,phoneNumber
João da Silva,5511999990001
Maria de Souza,5511988880002
`;
