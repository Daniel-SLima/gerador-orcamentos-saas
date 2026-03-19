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
  email?: string;
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
  // 🚀 ADICIONADO: Novos campos que vêm do banco
  prazo?: string;
  forma_pagamento?: string;
  endereco_obra?: string;
  contato_obra?: string;
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
  page: { paddingTop: 30, paddingBottom: 60, paddingLeft: 40, paddingRight: 40, fontFamily: "Helvetica", backgroundColor: "#ffffff" },

  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: "#9ca3af", borderBottomStyle: "solid", paddingBottom: 15, marginBottom: 15 },

  logoContainer: { width: "55%" },
  // Ajustes de margem negativa (marginLeft e marginTop) para alinhar a logo atual perfeitamente com o texto e o título
  logo: { width: 160, height: 70, objectFit: "contain", marginBottom: 0, marginLeft: -10, marginTop: -15 },

  companyTextWrapper: { paddingLeft: 12 },
  companyText: { fontSize: 9, color: "#374151", marginBottom: 1 },

  invoiceTitleBlock: { width: "45%", alignItems: "flex-end" },
  invoiceTitle: { fontSize: 24, fontWeight: "bold", color: "#2563eb", marginBottom: 8 },
  invoiceDetails: { fontSize: 10, color: "#4b5563", marginBottom: 3 },

  divider: { borderTopWidth: 1, borderTopColor: "#d1d5db", borderTopStyle: "solid", marginVertical: 5 },

  clientSection: { backgroundColor: "#f9fafb", padding: 12, borderRadius: 6, marginBottom: 20 },
  clientTitle: { fontSize: 9, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", fontWeight: "bold" },
  clientName: { fontSize: 14, fontWeight: "bold", color: "#111827", marginBottom: 8 },

  clientGridRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  clientGridCol: { width: "48%", fontSize: 10, color: "#4b5563" },
  clientLabel: { fontWeight: "bold", color: "#374151" },

  table: { width: "100%", marginBottom: 25 },
  tableHeader: { flexDirection: "row", backgroundColor: "#2563eb", padding: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: "center" },
  tableHeaderText: { color: "#ffffff", fontSize: 9, fontWeight: "bold", textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid", paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, alignItems: "center" },

  colImg: { width: "15%", alignItems: "center", justifyContent: "center" },
  colDesc: { width: "40%", paddingRight: 5, justifyContent: "center" },
  colDescHeader: { width: "40%" },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right", fontWeight: "bold", color: "#111827" },

  tableCell: { fontSize: 9, color: "#374151" },
  itemImage: { width: 50, height: 50, objectFit: "contain", borderRadius: 4 },
  medidasText: { fontSize: 8, color: "#6b7280", marginTop: 3 },

  totalSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  totalBox: { backgroundColor: "#f9fafb", padding: 12, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: "#2563eb", borderLeftStyle: "solid", width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  totalTextNormal: { fontSize: 10, color: "#4b5563" },
  totalTextDiscount: { fontSize: 10, color: "#ef4444" },
  totalDivider: { borderTopWidth: 1, borderTopColor: "#e5e7eb", borderTopStyle: "solid", marginVertical: 5 },
  totalTextFinal: { fontSize: 11, color: "#6b7280", fontWeight: "bold", textTransform: "uppercase" },
  totalValueFinal: { fontSize: 16, fontWeight: "bold", color: "#111827", textAlign: "right" },

  // 🚀 ADICIONADO: Estilos para o bloco de Prazo e Forma de Pagamento
  infoSection: { marginBottom: 15 },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { fontSize: 10, fontWeight: "bold", color: "#6b7280", width: 130 },
  infoValue: { fontSize: 10, color: "#4b5563", flex: 1 },

  obsSection: { marginBottom: 20 },
  obsTitle: { fontSize: 10, color: "#9ca3af", marginBottom: 1, textTransform: "uppercase" },
  obsText: { fontSize: 10, color: "#4b5563", lineHeight: 1.5, backgroundColor: "#f9fafb", padding: 6, borderRadius: 6 },

  anexosSection: { backgroundColor: "#eff6ff", padding: 12, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: "#3b82f6", borderLeftStyle: "solid", marginBottom: 20 },
  anexosTitle: { fontSize: 10, color: "#1e3a8a", fontWeight: "bold", textTransform: "uppercase", marginBottom: 6 },
  anexosLink: { fontSize: 9, color: "#2563eb", textDecoration: "underline", marginBottom: 4 },
  anexosWarning: { fontSize: 8, color: "#60a5fa", marginTop: 6 },

  signaturesContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 30, marginBottom: 10 },
  signatureBlock: { width: "45%", alignItems: "center" },
  signatureLine: { width: "100%", borderTopWidth: 1, borderTopColor: "#9ca3af", borderTopStyle: "solid", marginBottom: 5 },
  signatureText: { fontSize: 10, fontWeight: "bold", color: "#111827", textAlign: "center", textTransform: "uppercase" },
  signatureRole: { fontSize: 8, color: "#6b7280", textAlign: "center" },

  termsBlock: { marginTop: 15, padding: 12, backgroundColor: "#f9fafb", borderRadius: 6 },
  termTitle: { fontSize: 9, color: "#9ca3af", fontWeight: "bold", textTransform: "uppercase", marginBottom: 6 },
  termLine: { fontSize: 9, color: "#4b5563", marginBottom: 3 },

  fixedFooterText: { position: "absolute", bottom: 25, left: 0, right: 0, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  pageNumber: { position: "absolute", bottom: 12, left: 0, right: 0, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  continueText: { position: "absolute", bottom: 35, right: 40, fontSize: 8, color: "#2563eb", fontWeight: "bold" },
});

const BlocoAssinaturas = ({ dados, isOP }: { dados: DadosImpressao, isOP?: boolean }) => {
  if (isOP) {
    const vendedor = Array.isArray(dados.orcamento.vendedores) ? dados.orcamento.vendedores[0] : dados.orcamento.vendedores;
    return (
      <View wrap={false} style={{ marginTop: 40, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 40 }}>
          <View style={{ width: "40%", alignItems: "center" }}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Gerente</Text>
          </View>
          <View style={{ width: "40%", alignItems: "center" }}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Jaime</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <View style={{ width: "40%", alignItems: "center" }}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Financeiro</Text>
          </View>
          <View style={{ width: "40%", alignItems: "center" }}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>{vendedor?.nome || "Vendedor"}</Text>
            {vendedor?.email && <Text style={{ fontSize: 8, color: "#2563eb", marginTop: 2 }}>{vendedor.email}</Text>}
            <Text style={styles.signatureRole}>Já Assinado Digitalmente</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View wrap={false}>
      <View style={styles.signaturesContainer}>
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
    </View>
  );
};

const OrcamentoPDF = ({ dados, isOP }: { dados: DadosImpressao, isOP?: boolean }) => {
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

  const imagensAnexas = dados.anexos?.filter(a => a.file_url.match(/\.(jpeg|jpg|png|webp)$/i)) || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {dados.empresa?.logo_url ? <PDFImage src={dados.empresa.logo_url} style={styles.logo} /> : null}

            <View style={styles.companyTextWrapper}>
              {dados.empresa?.cnpj ? <Text style={styles.companyText}>CNPJ: {dados.empresa.cnpj}</Text> : null}
              {dados.empresa?.telefone ? <Text style={styles.companyText}>Tel: {dados.empresa.telefone}</Text> : null}
              {enderecoEmpresa.linha1 || enderecoEmpresa.linha2 ? (
                <Text style={styles.companyText}>
                  {[enderecoEmpresa.linha1, enderecoEmpresa.linha2].filter(Boolean).join(" - ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.invoiceTitle}>{isOP ? "ORDEM DE\nPRODUÇÃO" : "ORÇAMENTO"}</Text>
            <Text style={styles.invoiceDetails}>Nº: {String(dados.orcamento.numero_orcamento || 0).padStart(5, '0')}</Text>
            <Text style={styles.invoiceDetails}>Emissão: {formatarData(dados.orcamento.data_emissao)}</Text>

            {vendedor ? (
              <>
                <Text style={[styles.invoiceDetails, { marginTop: 4 }]}>Vendedor: {vendedor.nome}</Text>
                {vendedor.email && <Text style={styles.invoiceDetails}>{vendedor.email}</Text>}
              </>
            ) : null}
            {vendedor?.telefone ? (
              <Text style={styles.invoiceDetails}>Tel: {vendedor.telefone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.clientSection}>
          <Text style={styles.clientTitle}>Preparado Para:</Text>
          <Text style={styles.clientName}>{dados.cliente?.nome_razao_social || "Cliente"}</Text>

          <View style={styles.clientGridRow}>
            <Text style={styles.clientGridCol}><Text style={styles.clientLabel}>CNPJ/CPF: </Text>{dados.cliente?.cpf_cnpj || "-"}</Text>
            <Text style={styles.clientGridCol}><Text style={styles.clientLabel}>Contato: </Text>{dados.cliente?.contato_nome || "-"}</Text>
          </View>

          <View style={styles.clientGridRow}>
            <Text style={styles.clientGridCol}><Text style={styles.clientLabel}>Telefone: </Text>{dados.cliente?.telefone || "-"}</Text>
            <Text style={styles.clientGridCol}></Text>
          </View>

          <View style={[styles.clientGridRow]}>
            <Text style={{ fontSize: 10, color: "#4b5563", width: "100%" }}>
              <Text style={styles.clientLabel}>Endereço: </Text>
              {enderecoCliente.linha1} {enderecoCliente.linha2 ? ` - ${enderecoCliente.linha2}` : ""}
            </Text>
          </View>

          {isOP && (dados.orcamento.endereco_obra || dados.orcamento.contato_obra) && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb", borderTopStyle: "solid" }}>
              <Text style={styles.clientTitle}>Dados da Obra:</Text>
              {dados.orcamento.contato_obra ? (
                <Text style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}><Text style={styles.clientLabel}>Contato/Resp: </Text>{dados.orcamento.contato_obra}</Text>
              ) : null}
              {dados.orcamento.endereco_obra ? (
                <Text style={{ fontSize: 10, color: "#4b5563" }}><Text style={styles.clientLabel}>Endereço: </Text>{dados.orcamento.endereco_obra}</Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colImg}><Text style={styles.tableHeaderText}>Imagem</Text></View>
            <View style={isOP ? { ...styles.colDescHeader, width: "75%" } : styles.colDescHeader}><Text style={styles.tableHeaderText}>Descrição do Serviço / Produto</Text></View>
            <View style={styles.colQty}><Text style={styles.tableHeaderText}>Qtd</Text></View>
            {!isOP && <View style={styles.colUnit}><Text style={styles.tableHeaderText}>V. Unit</Text></View>}
            {!isOP && <View style={styles.colTotal}><Text style={styles.tableHeaderText}>Subtotal</Text></View>}
          </View>

          {dados.itens?.map((item: ItemOrcamento, index: number) => {
            const urlDaImagem = Array.isArray(item.produtos) ? item.produtos[0]?.imagem_url : item.produtos?.imagem_url;
            return (
              <View style={styles.tableRow} key={index} wrap={false}>
                <View style={styles.colImg}>
                  {urlDaImagem ? <PDFImage src={urlDaImagem} style={styles.itemImage} /> : <Text style={{ fontSize: 8, color: "#9ca3af" }}>-</Text>}
                </View>
                <View style={isOP ? { ...styles.colDesc, width: "75%" } : styles.colDesc}>
                  <Text style={styles.tableCell}>{item.descricao || "Item"}</Text>
                  {item.medidas ? <Text style={styles.medidasText}>Medidas: {item.medidas}</Text> : null}
                </View>
                <Text style={[styles.colQty, styles.tableCell]}>{String(item.quantidade || 0)}</Text>
                {!isOP && <Text style={[styles.colUnit, styles.tableCell]}>{formatarMoeda(item.valor_unitario_aplicado)}</Text>}
                {!isOP && <Text style={[styles.colTotal, styles.tableCell]}>{formatarMoeda(item.subtotal)}</Text>}
              </View>
            );
          })}
        </View>

        {!isOP && (
          <View style={styles.totalSection} wrap={false}>
            <View style={styles.totalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalTextNormal}>Subtotal Bruto:</Text>
                <Text style={styles.totalTextNormal}>{formatarMoeda(totalBruto)}</Text>
              </View>

              <View style={styles.totalDivider} />
              <View style={[styles.totalRow, { marginTop: 5, alignItems: "center" }]}>
                <Text style={styles.totalTextFinal}>Valor Total</Text>
                <Text style={styles.totalValueFinal}>{formatarMoeda(dados.orcamento.valor_total)}</Text>
              </View>
              {totalDescontos > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalTextDiscount}>Descontos Aplicados:</Text>
                  <Text style={styles.totalTextDiscount}>- {formatarMoeda(totalDescontos)}</Text>
                </View>
              )}
              {(dados.orcamento.prazo || dados.orcamento.forma_pagamento) ? (
                <View style={styles.infoSection} wrap={false}>
                  {dados.orcamento.prazo ? (
                    <View style={styles.infoRow}>
                      <Text style={{ fontSize: 10, color: "#4b5563", width: "100%" }}>
                        <Text style={{ fontWeight: "bold", color: "#6b7280" }}>Prazo: </Text>
                        {dados.orcamento.prazo}
                      </Text>
                    </View>
                  ) : null}
                  {dados.orcamento.forma_pagamento ? (
                    <View style={styles.infoRow}>
                      <Text style={{ fontSize: 10, color: "#4b5563", width: "100%" }}>
                        <Text style={{ fontWeight: "bold", color: "#6b7280" }}>Forma de Pagamento: </Text>
                        {dados.orcamento.forma_pagamento}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        )}

        {dados.orcamento.observacoes ? (
          <View style={styles.obsSection} wrap={false}>
            <Text style={styles.obsTitle}>Observações e Condições:</Text>
            <Text style={styles.obsText}>{dados.orcamento.observacoes}</Text>
          </View>
        ) : null}
        <View style={styles.obsSection}>
          <Text style={styles.obsTitle}>Informações Importantes:</Text>
          <Text style={styles.obsText}>Os serviços só poderão ser executados mediante autorização do cliente.
            {"\n"}Licença junto à Prefeitura é de responsabilidade do cliente.
            {"\n"}O cliente deverá fornecer ponto de energia junto ao local de instalação do letreiro.
          </Text>
        </View>

        {dados.anexos && dados.anexos.length > 0 ? (
          <View style={styles.anexosSection} wrap={false}>
            <Text style={styles.anexosTitle}>ANEXOS DO PROJETO</Text>
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

        <BlocoAssinaturas dados={dados} isOP={isOP} />

        <Text style={styles.fixedFooterText} fixed>
          Este documento tem validade de 15 dias a partir da data de emissão.
        </Text>

        <Text render={({ pageNumber, totalPages }) => (
          pageNumber < totalPages ? "CONTINUA NA PRÓXIMA PÁGINA" : ""
        )} fixed style={styles.continueText} />

        <Text render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed style={styles.pageNumber} />

      </Page>

      {imagensAnexas.map((img, idx) => (
        <Page key={`anexo-${idx}`} size="A4" style={styles.page}>
          <Text style={[styles.invoiceTitle, { fontSize: 16, marginBottom: 15 }]}>ANEXO: {img.file_name}</Text>

          <View style={{ flex: 1, marginVertical: 10, alignItems: "center", justifyContent: "center" }}>
            <PDFImage src={img.file_url} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </View>

          <BlocoAssinaturas dados={dados} isOP={isOP} />

          <Text style={styles.fixedFooterText} fixed>Este documento tem validade de 15 dias a partir da data de emissão.</Text>
          <Text render={({ pageNumber, totalPages }) => (`Página ${pageNumber} de ${totalPages}`)} fixed style={styles.pageNumber} />
        </Page>
      ))}

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
            vendedores ( nome, telefone, email )
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
          .limit(1)
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

        const isOP = action === "op";
        const blob = await pdf(<OrcamentoPDF dados={dadosCompletos} isOP={isOP} />).toBlob();
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