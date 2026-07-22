import { describe, it, expect } from 'vitest';
import {
  normalizePhoneForImport,
  mapCsvRowToImport,
  buildContactsImportCsv,
  cleanCsvCell,
} from '@/utils/contactImport';

describe('contactImport', () => {
  it('normaliza telefone BR local com DDI 55', () => {
    expect(normalizePhoneForImport('(11) 99999-0001').phone).toBe('5511999990001');
    expect(normalizePhoneForImport('5511999990001').phone).toBe('5511999990001');
    expect(normalizePhoneForImport('+55 11 99999-0001').phone).toBe('5511999990001');
  });

  it('rejeita telefone incompleto', () => {
    const result = normalizePhoneForImport('11999');
    expect(result.error).toBeTruthy();
  });

  it('aceita cabeçalhos name/phoneNumber e aliases PT', () => {
    const en = mapCsvRowToImport({ name: 'Ana', phoneNumber: '5511999990001' }, 1);
    expect(en.valid).toBe(true);
    expect(en.phone).toBe('5511999990001');

    const pt = mapCsvRowToImport({ Nome: 'Ana', Telefone: '11999990001' }, 2);
    expect(pt.valid).toBe(true);
    expect(pt.phone).toBe('5511999990001');
  });

  it('gera CSV compatível com a API', () => {
    const csv = buildContactsImportCsv([
      { name: 'Ana', phone: '5511999990001' },
      { name: 'Nome, Com Vírgula', phone: '5511888880002' },
    ]);
    expect(csv).toContain('name,phoneNumber');
    expect(csv).toContain('Ana,5511999990001');
    expect(csv).toContain('"Nome, Com Vírgula",5511888880002');
  });

  it('limpa aspas de célula', () => {
    expect(cleanCsvCell('"João"')).toBe('João');
  });
});
