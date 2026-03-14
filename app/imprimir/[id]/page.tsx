"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Document, Page, Text, View, StyleSheet, Image as PDFImage, pdf, Link as PDFLink } from "@react-pdf/renderer";

interface Cliente {
  nome_razao_social: string;
  cpf_cnpj: string;
  telefone: string;
  contato_nome: string;
  endereco?: string; 
  rua_numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface Vendedor {
  nome: string;
  telefone: string;
}

interface Empresa {
  nome_fantasia: string;
  cnpj: string;
  telefone: string;
  logo_url: string;
  endereco_completo?: string; 
  rua_numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface ProdutoJoin {
  imagem_url: string;
}

interface ItemOrcamento {
  descricao: string;
  quantidade: number;
  valor_unitario_aplicado: number;
  subtotal: number;
  produtos?: ProdutoJoin | ProdutoJoin[] | null;
  medidas?: string;
  desconto?: number;
}

interface Orcamento {
  numero_orcamento: number;
  data_emissao: string;
  valor_total: number;
  observacoes: string;
  user_id: string;
  vendedores?: Vendedor | Vendedor[] | null;
}

interface Anexo {
  id: string;
  file_name: string;
  file_url: string;
}

interface DadosImpressao {
  orcamento: Orcamento;
  cliente: Cliente;
  itens: ItemOrcamento[];
  empresa: Empresa | null;
  anexos: Anexo[]; 
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

const formatarData = (dataStr: string) => {
  if (!dataStr) return "";
  const data = new Date(dataStr);
  data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
  return new Intl.DateTimeFormat('pt-BR').format(data);
};

const montarEnderecoLinhas = (
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

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 80, paddingLeft: 40, paddingRight: 40, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#f3f4f6", borderBottomStyle: "solid", paddingBottom: 20, marginBottom: 30 },
  logoContainer: { width: "55%" },
  logo: { width: 140, height: 60, objectFit: "contain", marginBottom: 10 },
  companyName: { fontSize: 14, fontWeight: "bold", color: "#111827", marginBottom: 4, textTransform: "uppercase" },
  companyText: { fontSize: 9, color: "#4b5563", marginBottom: 2 },
  invoiceTitleBlock: { width: "45%", alignItems: "flex-end" },
  invoiceTitle: { fontSize: 24, fontWeight: "bold", color: "#2563eb", marginBottom: 10 },
  invoiceDetails: { fontSize: 10, color: "#4b5563", marginBottom: 3 },

  divider: { borderTopWidth: 1.5, borderTopColor: "#e5e7eb", borderTopStyle: "solid", marginVertical: 5 },

  clientSection: { backgroundColor: "#f9fafb", padding: 15, borderRadius: 6, marginBottom: 30, flexDirection: "row", justifyContent: "space-between" },
  clientTitle: { fontSize: 9, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", fontWeight: "bold" },
  clientName: { fontSize: 14, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  clientInfo: { fontSize: 10, color: "#4b5563", marginBottom: 3 },
  
  table: { width: "100%", marginBottom: 30 },
  tableHeader: { flexDirection: "row", backgroundColor: "#2563eb", padding: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: "center" },
  tableHeaderText: { color: "#ffffff", fontSize: 9, fontWeight: "bold", textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid", paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, alignItems: "center" },
  
  colImg: { width: "10%", alignItems: "center", justifyContent: "center" },
  colDesc: { width: "45%", paddingRight: 5, justifyContent: "center"},
  colDescHeader: { width: "45%" },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right", fontWeight: "bold", color: "#111827" },

  tableCell: { fontSize: 9, color: "#374151" },
  itemImage: { width: 35, height: 35, objectFit: "cover", borderRadius: 4 },
  medidasText: { fontSize: 8, color: "#6b7280", marginTop: 3 },

  totalSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 30 },
  totalBox: { backgroundColor: "#f9fafb", padding: 15, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: "#2563eb", borderLeftStyle: "solid", width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  totalTextNormal: { fontSize: 10, color: "#4b5563" },
  totalTextDiscount: { fontSize: 10, color: "#ef4444" },
  totalDivider: { borderTopWidth: 1, borderTopColor: "#e5e7eb", borderTopStyle: "solid", marginVertical: 5 },
  totalTextFinal: { fontSize: 11, color: "#6b7280", fontWeight: "bold", textTransform: "uppercase" },
  totalValueFinal: { fontSize: 16, fontWeight: "bold", color: "#111827", textAlign: "right" },
  
  obsSection: { marginBottom: 20 },
  obsTitle: { fontSize: 10, color: "#9ca3af", marginBottom: 5, textTransform: "uppercase" },
  obsText: { fontSize: 10, color: "#4b5563", lineHeight: 1.5, backgroundColor: "#f9fafb", padding: 12, borderRadius: 6 },
  
  anexosSection: { backgroundColor: "#eff6ff", padding: 12, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: "#3b82f6", borderLeftStyle: "solid", marginBottom: 30 },
  anexosTitle: { fontSize: 10, color: "#1e3a8a", fontWeight: "bold", textTransform: "uppercase", marginBottom: 6 },
  anexosLink: { fontSize: 9, color: "#2563eb", textDecoration: "underline", marginBottom: 4 },
  anexosWarning: { fontSize: 8, color: "#60a5fa", marginTop: 6 },

  signaturesContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 40, marginBottom: 20 },
  signatureBlock: { width: "45%", alignItems: "center" },
  signatureLine: { width: "100%", borderTopWidth: 1, borderTopColor: "#9ca3af", borderTopStyle: "solid", marginBottom: 5 },
  signatureText: { fontSize: 10, fontWeight: "bold", color: "#111827", textAlign: "center" },
  signatureRole: { fontSize: 8, color: "#6b7280", textAlign: "center" },

  fixedFooterText: { position: "absolute", bottom: 30, left: 0, right: 0, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  pageNumber: { position: "absolute", bottom: 15, left: 0, right: 0, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  continueText: { position: "absolute", bottom: 45, right: 40, fontSize: 8, color: "#2563eb", fontWeight: "bold" },
});

const OrcamentoPDF = ({ dados }: { dados: DadosImpressao }) => {
  const vendedor = Array.isArray(dados.orcamento.vendedores) 
    ? dados.orcamento.vendedores[0] 
    : dados.orcamento.vendedores;

  const totalBruto = dados.itens?.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario_aplicado), 0) || 0;
  const totalDescontos = dados.itens?.reduce((acc, item) => acc + Number(item.desconto || 0), 0) || 0;

  const enderecoEmpresa = montarEnderecoLinhas(
    dados.empresa?.rua_numero,
    dados.empresa?.bairro,
    dados.empresa?.cidade,
    dados.empresa?.uf,
    dados.empresa?.endereco_completo
  );

  const enderecoCliente = montarEnderecoLinhas(
    dados.cliente?.rua_numero,
    dados.cliente?.bairro,
    dados.cliente?.cidade,
    dados.cliente?.uf,
    dados.cliente?.endereco
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {dados.empresa?.logo_url ? <PDFImage src={dados.empresa.logo_url} style={styles.logo} /> : null}
            <Text style={styles.companyName}>{dados.empresa?.nome_fantasia || "EMPRESA NÃO INFORMADA"}</Text>
            {dados.empresa?.cnpj ? <Text style={styles.companyText}>CNPJ: {dados.empresa.cnpj}</Text> : null}
            {dados.empresa?.telefone ? <Text style={styles.companyText}>Tel: {dados.empresa.telefone}</Text> : null}
            {enderecoEmpresa.linha1 ? <Text style={styles.companyText}>{enderecoEmpresa.linha1}</Text> : null}
            {enderecoEmpresa.linha2 ? <Text style={styles.companyText}>{enderecoEmpresa.linha2}</Text> : null}
          </View>
          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.invoiceTitle}>ORÇAMENTO</Text>
            <Text style={styles.invoiceDetails}>Nº: {String(dados.orcamento.numero_orcamento || 0).padStart(5, '0')}</Text>
            <Text style={styles.invoiceDetails}>Emissão: {formatarData(dados.orcamento.data_emissao)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.clientSection}>
          <View style={{ width: '55%' }}>
            <Text style={styles.clientTitle}>Preparado Para:</Text>
            <Text style={styles.clientName}>{dados.cliente?.nome_razao_social || "Cliente"}</Text>
            {dados.cliente?.contato_nome ? <Text style={styles.clientInfo}>Contato: {dados.cliente.contato_nome}</Text> : null}
            {dados.cliente?.cpf_cnpj ? <Text style={styles.clientInfo}>CPF/CNPJ: {dados.cliente.cpf_cnpj}</Text> : null}
            {dados.cliente?.telefone ? <Text style={styles.clientInfo}>Telefone: {dados.cliente.telefone}</Text> : null}
            {enderecoCliente.linha1 ? <Text style={styles.clientInfo}>Endereço: {enderecoCliente.linha1}</Text> : null}
            {enderecoCliente.linha2 ? <Text style={styles.clientInfo}>{enderecoCliente.linha2}</Text> : null}
          </View>
          
          <View style={{ width: '45%', alignItems: 'flex-end' }}>
            <Text style={styles.clientTitle}>Vendedor Responsável:</Text>
            {vendedor ? (
              <>
                <Text style={styles.clientName}>{vendedor.nome}</Text>
                {vendedor.telefone ? <Text style={styles.clientInfo}>Tel: {vendedor.telefone}</Text> : null}
              </>
            ) : (
              <Text style={styles.clientInfo}>Não informado</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colImg}><Text style={styles.tableHeaderText}>Imagem</Text></View>
            <View style={styles.colDescHeader}><Text style={styles.tableHeaderText}>Descrição do Serviço / Produto</Text></View>
            <View style={styles.colQty}><Text style={styles.tableHeaderText}>Qtd</Text></View>
            <View style={styles.colUnit}><Text style={styles.tableHeaderText}>V. Unit</Text></View>
            <View style={styles.colTotal}><Text style={styles.tableHeaderText}>Subtotal</Text></View>
          </View>

          {dados.itens?.map((item: ItemOrcamento, index: number) => {
            const urlDaImagem = Array.isArray(item.produtos) ? item.produtos[0]?.imagem_url : item.produtos?.imagem_url;
            return (
              <View style={styles.tableRow} key={index} wrap={false}>
                <View style={styles.colImg}>
                  {urlDaImagem ? <PDFImage src={urlDaImagem} style={styles.itemImage} /> : <Text style={{ fontSize: 8, color: "#9ca3af" }}>-</Text>}
                </View>
                <View style={styles.colDesc}>
                  <Text style={styles.tableCell}>{item.descricao || "Item"}</Text>
                  {item.medidas ? <Text style={styles.medidasText}>Medidas: {item.medidas}</Text> : null}
                </View>
                <Text style={[styles.colQty, styles.tableCell]}>{String(item.quantidade || 0)}</Text>
                <Text style={[styles.colUnit, styles.tableCell]}>{formatarMoeda(item.valor_unitario_aplicado)}</Text>
                <Text style={[styles.colTotal, styles.tableCell]}>{formatarMoeda(item.subtotal)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalSection} wrap={false}>
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalTextNormal}>Subtotal Bruto:</Text>
              <Text style={styles.totalTextNormal}>{formatarMoeda(totalBruto)}</Text>
            </View>
            {totalDescontos > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalTextDiscount}>Descontos Aplicados:</Text>
                <Text style={styles.totalTextDiscount}>- {formatarMoeda(totalDescontos)}</Text>
              </View>
            )}
            <View style={styles.totalDivider} />
            <View style={[styles.totalRow, { marginTop: 5, alignItems: "center" }]}>
              <Text style={styles.totalTextFinal}>Valor Total</Text>
              <Text style={styles.totalValueFinal}>{formatarMoeda(dados.orcamento.valor_total)}</Text>
            </View>
          </View>
        </View>

        {dados.orcamento.observacoes ? (
          <View style={styles.obsSection} wrap={false}>
            <Text style={styles.obsTitle}>Observações e Condições:</Text>
            <Text style={styles.obsText}>{dados.orcamento.observacoes}</Text>
          </View>
        ) : null}

        {/* 🚀 BUG CORRIGIDO: EMOJI REMOVIDO PARA NÃO QUEBRAR O PDF */}
        {dados.anexos && dados.anexos.length > 0 ? (
          <View style={styles.anexosSection} wrap={false}>
            <Text style={styles.anexosTitle}>ANEXOS E ARQUIVOS DO PROJETO</Text>
            {dados.anexos.map((anexo, idx) => (
              <PDFLink key={idx} src={anexo.file_url} style={styles.anexosLink}>
                {anexo.file_name} (Clique aqui para abrir)
              </PDFLink>
            ))}
            <Text style={styles.anexosWarning}>
              * Os arquivos acima estão disponíveis para visualização e download pelo prazo de validade deste orçamento.
            </Text>
          </View>
        ) : null}

        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>{dados.empresa?.nome_fantasia || "Assinatura Comercial"}</Text>
            <Text style={styles.signatureRole}>Departamento de Vendas</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>{dados.cliente?.nome_razao_social || "Assinatura do Cliente"}</Text>
            <Text style={styles.signatureRole}>De acordo com os termos</Text>
          </View>
        </View>

        <Text style={styles.fixedFooterText} fixed>
          Este documento tem validade de 15 dias a partir da data de emissão.
        </Text>
        
        <Text render={({ pageNumber, totalPages }) => (
          pageNumber < totalPages ? "CONTINUA NA PRÓXIMA PÁGINA ➔" : ""
        )} fixed style={styles.continueText} />

        <Text render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed style={styles.pageNumber} />

      </Page>
    </Document>
  );
};

export default function ImprimirOrcamento() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const action = searchParams.get("action") || "view";

  const [error, setError] = useState("");

  useEffect(() => {
    const processarPDF = async () => {
      try {
        const { data: orcamento, error: erroOrc } = await supabase
          .from("orcamentos")
          .select(`
            *, 
            clientes ( nome_razao_social, cpf_cnpj, telefone, endereco, contato_nome, rua_numero, bairro, cidade, uf ),
            vendedores ( nome, telefone )
          `)
          .eq("id", id)
          .single();

        if (erroOrc) throw erroOrc;

        const { data: itens, error: erroItens } = await supabase
          .from("itens_orcamento")
          .select(`*, produtos ( imagem_url )`)
          .eq("orcamento_id", id);

        if (erroItens) throw erroItens;

        const { data: empresa } = await supabase
          .from("empresa_perfil")
          .select("*")
          .eq("user_id", orcamento.user_id)
          .single();

        const { data: anexosData } = await supabase
          .from("orcamento_anexos")
          .select("*")
          .eq("orcamento_id", id);

        const dadosCompletos: DadosImpressao = {
          orcamento: orcamento as unknown as Orcamento,
          cliente: Array.isArray(orcamento.clientes) ? orcamento.clientes[0] : (orcamento.clientes as unknown as Cliente),
          itens: itens as ItemOrcamento[],
          empresa: empresa as Empresa | null,
          anexos: (anexosData as Anexo[]) || [] 
        };

        const blob = await pdf(<OrcamentoPDF dados={dadosCompletos} />).toBlob();
        const urlCriada = URL.createObjectURL(blob);

        if (action === "download") {
          const a = document.createElement("a");
          a.href = urlCriada;
          a.download = `Orcamento_${String(dadosCompletos.orcamento.numero_orcamento).padStart(5, '0')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => window.close(), 100);
        } else {
          window.location.replace(urlCriada);
        }

      } catch (error) {
        console.error("Erro:", error);
        setError("Não foi possível gerar o orçamento.");
      }
    };

    if (id) processarPDF();
  }, [id, action]);

  if (error) {
    return <div className="h-screen flex items-center justify-center text-red-500 font-bold bg-gray-900">{error}</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#323639]">
      <p className="text-gray-400 text-sm font-semibold tracking-[0.2em] uppercase animate-pulse">
        Gerando PDF...
      </p>
    </div>
  );
}