/**
 * Utilitários de importação CSV de contatos — alinhados à API:
 * POST /api/contacts/import espera colunas `name` e `phoneNumber` (multipart field: `file`).
 */

export interface ImportContactRow {
  index: number;
  name: string;
  /** Telefone só dígitos (E.164 sem '+'), pronto para a API. */
  phone: string;
  valid: boolean;
  errors: string[];
  /** Motivo principal para resumo (quando inválido). */
  issue?: 'empty_name' | 'empty_phone' | 'invalid_phone' | 'duplicate_file';
}

export interface ImportPreviewSummary {
  total: number;
  valid: number;
  duplicatesInFile: number;
  invalid: number;
  missingPhone: number;
  missingName: number;
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
 * Remove máscara (+, espaços, hífen, parênteses) sem remover o DDI quando presente.
 * Se o número parecer BR local (10–11 dígitos sem DDI), prefixa 55.
 */
export function normalizePhoneForImport(raw: string): { phone: string; error?: string; empty?: boolean } {
  let digits = raw.replace(/\D/g, '');
  if (!digits) {
    return { phone: '', error: 'Telefone vazio', empty: true };
  }
  // Não remove DDI existente; apenas completa BR local sem país
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

/** Normaliza nome de cabeçalho para comparação. */
export function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_]+/g, '');
}

/** Verifica se o CSV possui colunas de nome e telefone (incluindo aliases). */
export function hasContactImportHeaders(fields: string[] | undefined): boolean {
  if (!fields || fields.length === 0) return false;
  const normalized = fields.map(normalizeHeaderKey);
  const hasName = normalized.some((h) => (HEADER_ALIASES.name as readonly string[]).includes(h));
  const hasPhone = normalized.some((h) => (HEADER_ALIASES.phone as readonly string[]).includes(h));
  return hasName && hasPhone;
}

/** Detecta delimitador: vírgula ou ponto e vírgula. */
export function detectCsvDelimiter(sample: string): ',' | ';' {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim()) || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

/** Converte uma linha do Papa Parse em linha de importação validada. */
export function mapCsvRowToImport(row: CsvRecord, index: number): ImportContactRow {
  const name = pickField(row, HEADER_ALIASES.name);
  const rawPhone = pickField(row, HEADER_ALIASES.phone);
  const errors: string[] = [];
  let issue: ImportContactRow['issue'];

  if (!name) {
    errors.push('Nome vazio');
    issue = 'empty_name';
  }

  const { phone, error: phoneError, empty } = normalizePhoneForImport(rawPhone);
  if (phoneError) {
    errors.push(phoneError);
    if (!issue) issue = empty ? 'empty_phone' : 'invalid_phone';
  }

  return {
    index,
    name,
    phone,
    valid: errors.length === 0,
    errors,
    issue,
  };
}

/**
 * Marca duplicados de telefone dentro do próprio arquivo.
 * A primeira ocorrência válida permanece; as seguintes tornam-se inválidas.
 */
export function markDuplicatesInFile(rows: ImportContactRow[]): ImportContactRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    if (!row.valid || !row.phone) return row;
    if (seen.has(row.phone)) {
      return {
        ...row,
        valid: false,
        issue: 'duplicate_file',
        errors: [...row.errors, `Telefone duplicado no arquivo (primeira ocorrência na linha ${seen.get(row.phone)})`],
      };
    }
    seen.set(row.phone, row.index);
    return row;
  });
}

/** Resume o preview local (antes do envio à API). */
export function summarizeImportPreview(rows: ImportContactRow[]): ImportPreviewSummary {
  let duplicatesInFile = 0;
  let invalid = 0;
  let missingPhone = 0;
  let missingName = 0;
  let valid = 0;

  for (const row of rows) {
    if (row.valid) {
      valid++;
      continue;
    }
    if (row.issue === 'duplicate_file') duplicatesInFile++;
    else if (row.issue === 'empty_phone') missingPhone++;
    else if (row.issue === 'empty_name') missingName++;
    else invalid++;
  }

  return {
    total: rows.length,
    valid,
    duplicatesInFile,
    invalid,
    missingPhone,
    missingName,
  };
}

export function formatImportPreviewMessage(summary: ImportPreviewSummary): string {
  return [
    `Total lido: ${summary.total}`,
    `Válidos: ${summary.valid}`,
    `Duplicados no arquivo: ${summary.duplicatesInFile}`,
    `Inválidos: ${summary.invalid}`,
    `Sem telefone: ${summary.missingPhone}`,
    summary.missingName ? `Sem nome: ${summary.missingName}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

function escapeCsv(value: string): string {
  if (/[",\n\r;]/.test(value)) {
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
Contato Teste 1,5562999999999
Contato Teste 2,5562988888888
`;
