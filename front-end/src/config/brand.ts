/**
 * Fonte única de verdade da marca ZapBusiness (LCM no copyright institucional).
 * Identidade visual provisória até assets oficiais.
 */
export const BRAND = {
  productName: 'ZapBusiness',
  companyName: 'LCM Enterprise Ltda.',
  companyShort: 'LCM',
  /** Assinatura institucional (copyright / metadados). */
  signature: 'ZapBusiness by LCM',
  tagline: 'Automação inteligente para comunicação empresarial',
  description:
    'Central de comunicação empresarial para gerenciamento de contatos, conteúdos e campanhas.',
  institutionalLine:
    'Comunicação empresarial com mais controle, agilidade e organização.',
  solutionLine: 'Uma solução desenvolvida pela LCM Enterprise.',
  solutionLineFull: 'ZapBusiness é uma solução desenvolvida pela LCM Enterprise Ltda.',
  documentTitle: 'ZapBusiness | Comunicação empresarial',
  metaDescription:
    'Central de comunicação empresarial para gerenciamento de contatos, conteúdos e campanhas.',
  shortName: 'ZapBusiness',
  themeColor: '#07111F',
  loginCta: 'Entrar no ZapBusiness',
  integrationDisclaimer:
    'O ZapBusiness utiliza integrações com serviços de comunicação de terceiros. WhatsApp é uma marca registrada de seus respectivos proprietários. O ZapBusiness não é afiliado, patrocinado ou endossado pela Meta.',
} as const;

/** Rótulos de navegação (rotas internas inalteradas). */
export const NAV_LABELS = {
  dashboard: 'Visão geral',
  whatsapp: 'Conexão',
  contacts: 'Contatos',
  ocr: 'Leitor inteligente',
  drafts: 'Conteúdos',
  broadcast: 'Campanhas',
  help: 'Central de ajuda',
  settings: 'Configurações',
  profile: 'Perfil',
} as const;

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': NAV_LABELS.dashboard,
  '/whatsapp': NAV_LABELS.whatsapp,
  '/contacts': NAV_LABELS.contacts,
  '/ocr': NAV_LABELS.ocr,
  '/drafts': NAV_LABELS.drafts,
  '/broadcast': NAV_LABELS.broadcast,
  '/profile': NAV_LABELS.profile,
  '/settings': NAV_LABELS.settings,
  '/help': NAV_LABELS.help,
};

export function brandCopyright(year = new Date().getFullYear()): string {
  return `© ${year} ${BRAND.companyName}. Todos os direitos reservados.`;
}
