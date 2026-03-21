// ─── Interfaces compartilhadas ──────────────────────────────────────────────

export interface Cliente {
  nome_razao_social: string;
  cpf_cnpj: string;
  telefone: string;
  contato_nome: string;
  endereco?: string;
  rua_numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface Vendedor {
  nome: string;
  telefone: string;
  email?: string;
}

export interface Empresa {
  nome_fantasia: string;
  cnpj: string;
  telefone: string;
  logo_url: string;
  endereco_completo?: string;
  rua_numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface ProdutoJoin {
  imagem_url: string;
}

export interface ItemOrcamento {
  descricao: string;
  quantidade: number;
  valor_unitario_aplicado: number;
  subtotal: number;
  produtos?: ProdutoJoin | ProdutoJoin[] | null;
  medidas?: string;
  desconto?: number;
}

export interface Orcamento {
  numero_orcamento: number;
  data_emissao: string;
  valor_total: number;
  observacoes: string;
  user_id: string;
  vendedores?: Vendedor | Vendedor[] | null;
  prazo?: string;
  forma_pagamento?: string;
  endereco_obra?: string;
  contato_obra?: string;
  validade_proposta?: string;
}

export interface Anexo {
  id: string;
  file_name: string;
  file_url: string;
}

export interface DadosImpressao {
  orcamento: Orcamento;
  cliente: Cliente;
  itens: ItemOrcamento[];
  empresa: Empresa | null;
  anexos: Anexo[];
}

// ─── Funções utilitárias ────────────────────────────────────────────────────

export const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
};

export const formatarData = (dataStr: string) => {
  if (!dataStr) return "";
  const data = new Date(dataStr);
  data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
  return new Intl.DateTimeFormat("pt-BR").format(data);
};

export const montarEnderecoLinhas = (
  rua?: string,
  bairro?: string,
  cidade?: string,
  uf?: string,
  fallbackAntigo?: string
) => {
  if (rua || bairro || cidade || uf) {
    const linha1 = rua || "";
    let linha2 = "";
    if (bairro) linha2 += bairro;
    if (cidade) linha2 += linha2 ? ` - ${cidade}` : cidade;
    if (uf) linha2 += cidade ? `/${uf}` : uf;
    return { linha1, linha2 };
  }
  return { linha1: fallbackAntigo || "", linha2: "" };
};
