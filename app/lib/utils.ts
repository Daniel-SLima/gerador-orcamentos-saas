/**
 * utils.ts
 * Funções utilitárias compartilhadas entre todas as páginas do dashboard.
 * Centralizadas aqui para evitar duplicação de código.
 */

/**
 * Formata um valor numérico em moeda BRL (R$ 1.234,56)
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/**
 * Formata uma string ISO de data para DD/MM/AAAA
 * Corrige o offset de fuso horário para exibir a data corretamente no Brasil.
 */
export function formatarData(dataStr: string): string {
  if (!dataStr) return '-';
  const data = new Date(dataStr);
  data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

/**
 * Formata uma string ISO de data para o formato curto MM/AAAA
 */
export function formatarDataMesAno(dataStr: string): string {
  if (!dataStr) return '-';
  const data = new Date(dataStr);
  data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(data);
}

/**
 * Retorna a data atual no Brasil no formato YYYY-MM-DD (compatível com input type="date")
 */
export function obterDataAtualBrasil(): string {
  const data = new Date();
  const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const dataFormatada = data.toLocaleDateString('pt-BR', options);
  const [dia, mes, ano] = dataFormatada.split('/');
  return `${ano}-${mes}-${dia}`;
}
