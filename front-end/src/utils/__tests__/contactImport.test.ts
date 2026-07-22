import { describe, it, expect } from 'vitest';
import {
  normalizePhoneForImport,
  mapCsvRowToImport,
  buildContactsImportCsv,
  cleanCsvCell,
  hasContactImportHeaders,
  detectCsvDelimiter,
  markDuplicatesInFile,
  summarizeImportPreview,
  formatImportPreviewMessage,
} from '@/utils/contactImport';

describe('contactImport', () => {
  it('1) aceita CSV name,phoneNumber', () => {
    const row = mapCsvRowToImport({ name: 'Contato Teste 1', phoneNumber: '5562999999999' }, 1);
    expect(row.valid).toBe(true);
    expect(row.phone).toBe('5562999999999');
    expect(hasContactImportHeaders(['name', 'phoneNumber'])).toBe(true);
  });

  it('2) aceita cabeçalhos Nome,Telefone', () => {
    const row = mapCsvRowToImport({ Nome: 'Ana', Telefone: '62988888888' }, 1);
    expect(row.valid).toBe(true);
    expect(row.phone).toBe('5562988888888');
    expect(hasContactImportHeaders(['Nome', 'Telefone'])).toBe(true);
  });

  it('3) normaliza telefones com máscara', () => {
    expect(normalizePhoneForImport('(62) 99999-9999').phone).toBe('5562999999999');
    expect(normalizePhoneForImport('62 99999-9999').phone).toBe('5562999999999');
  });

  it('4) normaliza telefones com +55', () => {
    expect(normalizePhoneForImport('+55 62 99999-9999').phone).toBe('5562999999999');
    expect(normalizePhoneForImport('+5562999999999').phone).toBe('5562999999999');
  });

  it('5) rejeita nome vazio (linha incompleta)', () => {
    const row = mapCsvRowToImport({ name: '', phoneNumber: '5562999999999' }, 1);
    expect(row.valid).toBe(false);
    expect(row.issue).toBe('empty_name');
  });

  it('6) rejeita número inválido', () => {
    const row = mapCsvRowToImport({ name: 'X', phoneNumber: '123' }, 1);
    expect(row.valid).toBe(false);
    expect(row.issue).toBe('invalid_phone');
  });

  it('7) marca duplicado dentro do CSV', () => {
    const a = mapCsvRowToImport({ name: 'A', phoneNumber: '5562999999999' }, 1);
    const b = mapCsvRowToImport({ name: 'B', phoneNumber: '5562999999999' }, 2);
    const marked = markDuplicatesInFile([a, b]);
    expect(marked[0].valid).toBe(true);
    expect(marked[1].valid).toBe(false);
    expect(marked[1].issue).toBe('duplicate_file');
  });

  it('8) CSV sem coluna de telefone', () => {
    expect(hasContactImportHeaders(['name', 'email'])).toBe(false);
    expect(hasContactImportHeaders(['nome'])).toBe(false);
  });

  it('9) arquivo vazio / sem campos', () => {
    expect(hasContactImportHeaders([])).toBe(false);
    expect(hasContactImportHeaders(undefined)).toBe(false);
  });

  it('10) detecta delimitador ponto e vírgula', () => {
    expect(detectCsvDelimiter('name;phoneNumber\nA;5562999999999')).toBe(';');
    expect(detectCsvDelimiter('name,phoneNumber\nA,5562999999999')).toBe(',');
  });

  it('resume preview no formato solicitado', () => {
    const rows = markDuplicatesInFile([
      mapCsvRowToImport({ name: 'A', phoneNumber: '5562999999999' }, 1),
      mapCsvRowToImport({ name: 'B', phoneNumber: '5562999999999' }, 2),
      mapCsvRowToImport({ name: 'C', phoneNumber: '' }, 3),
      mapCsvRowToImport({ name: 'D', phoneNumber: '12' }, 4),
      mapCsvRowToImport({ name: '', phoneNumber: '5562888888888' }, 5),
      mapCsvRowToImport({ name: 'E', phoneNumber: '5562777777777' }, 6),
    ]);
    const summary = summarizeImportPreview(rows);
    expect(summary.total).toBe(6);
    expect(summary.valid).toBe(2);
    expect(summary.duplicatesInFile).toBe(1);
    expect(summary.missingPhone).toBe(1);
    expect(summary.invalid).toBe(1);
    expect(summary.missingName).toBe(1);
    expect(formatImportPreviewMessage(summary)).toContain('Total lido: 6');
  });

  it('gera CSV compatível com a API', () => {
    const csv = buildContactsImportCsv([
      { name: 'Ana', phone: '5562999999999' },
      { name: 'Nome, Com Vírgula', phone: '5562888888888' },
    ]);
    expect(csv.startsWith('name,phoneNumber\n')).toBe(true);
    expect(csv).toContain('Ana,5562999999999');
    expect(csv).toContain('"Nome, Com Vírgula",5562888888888');
  });

  it('limpa aspas de célula', () => {
    expect(cleanCsvCell('"João"')).toBe('João');
  });

  it('aceita aliases name,phone', () => {
    const row = mapCsvRowToImport({ name: 'Z', phone: '5562111111111' }, 1);
    expect(row.valid).toBe(true);
    expect(hasContactImportHeaders(['name', 'phone'])).toBe(true);
  });
});
