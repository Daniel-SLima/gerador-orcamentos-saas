/**
 * OrcamentoPDF.tsx
 * Componente responsável pela geração do PDF de ORÇAMENTO.
 * Para modificações de layout/estilo exclusivas do orçamento, edite aqui.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PDFImage,
  Link as PDFLink,
  Font,
} from "@react-pdf/renderer";

Font.registerHyphenationCallback((word) => [word]);
import {
  DadosImpressao,
  ItemOrcamento,
  formatarMoeda,
  formatarData,
  montarEnderecoLinhas,
} from "./types";

// ─── Estilos do Orçamento ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 185,
    paddingBottom: 60,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },

  header: {
    position: "absolute",
    top: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#9ca3af",
    borderBottomStyle: "solid",
    paddingBottom: 15,
  },

  logoContainer: { width: "55%" },
  logo: {
    width: 230,
    height: 95,
    objectFit: "contain",
    marginBottom: 0,
    marginLeft: -23,
    marginTop: -20,
  },

  companyTextWrapper: { paddingLeft: 12, marginTop: -15 },
  companyText: { fontSize: 9, color: "#374151", marginBottom: 1 },

  invoiceTitleBlock: { width: "45%", alignItems: "flex-end" },
  invoiceTitle: { fontSize: 13, fontWeight: "bold", color: "#2563eb", marginBottom: 8 },
  invoiceDetails: { fontSize: 10, color: "#4b5563", marginBottom: 3 },

  divider: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderTopStyle: "solid",
    marginVertical: 5,
  },

  clientSection: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 6,
    marginBottom: 5,
    marginTop: -30,
  },
  clientTitle: {
    fontSize: 9,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  clientName: { fontSize: 14, fontWeight: "bold", color: "#111827", marginBottom: 8 },

  clientGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  clientGridCol: { width: "48%", fontSize: 10, color: "#4b5563" },
  clientLabel: { fontWeight: "bold", color: "#374151" },

  table: { width: "100%", marginBottom: 25 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: "center",
  },
  tableHeaderText: { color: "#ffffff", fontSize: 9, fontWeight: "bold", textAlign: "center" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderBottomStyle: "solid",
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
    alignItems: "center",
  },

  colIndex: { width: "5%", alignItems: "center", justifyContent: "center" },
  colImg: { width: "12%", alignItems: "center", justifyContent: "center" },
  colDesc: { width: "38%", paddingLeft: 15, paddingRight: 5, justifyContent: "center" },
  colDescHeader: { width: "38%", paddingLeft: 15 },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right", fontWeight: "bold", color: "#111827" },

  tableCell: { fontSize: 9, color: "#374151" },
  itemImage: { width: 50, height: 50, objectFit: "contain", padding: 1 },
  medidasText: { fontSize: 8, color: "#6b7280", marginTop: 3 },

  totalSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  totalBox: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
    borderLeftStyle: "solid",
    width: "50%",
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  totalTextNormal: { fontSize: 10, color: "#4b5563" },
  totalTextDiscount: { fontSize: 10, color: "#ef4444" },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopStyle: "solid",
    marginVertical: 5,
  },
  totalTextFinal: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  totalValueFinal: { fontSize: 16, fontWeight: "bold", color: "#111827", textAlign: "right" },

  infoSection: { marginBottom: 15 },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { fontSize: 10, fontWeight: "bold", color: "#6b7280", width: 130 },
  infoValue: { fontSize: 10, color: "#4b5563", flex: 1 },

  obsSection: { marginBottom: 20, width: "100%" },
  obsTitle: { fontSize: 10, color: "#9ca3af", marginBottom: 1, textTransform: "uppercase" },
  obsText: {
    fontSize: 10,
    color: "#4b5563",
    lineHeight: 1.5,
    backgroundColor: "#f9fafb",
    padding: 6,
    borderRadius: 6,
    width: "100%",
    flexShrink: 0,
  },

  anexosSection: {
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    borderLeftStyle: "solid",
    marginBottom: 20,
  },
  anexosTitle: {
    fontSize: 10,
    color: "#1e3a8a",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  anexosLink: { fontSize: 9, color: "#2563eb", textDecoration: "underline", marginBottom: 4 },
  anexosWarning: { fontSize: 8, color: "#60a5fa", marginTop: 6 },

  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 5,
  },
  signatureBlock: { width: "45%", alignItems: "center" },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#9ca3af",
    borderTopStyle: "solid",
    marginBottom: 5,
  },
  signatureText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    textTransform: "uppercase",
  },
  signatureRole: { fontSize: 8, color: "#6b7280", textAlign: "center" },

  introTextSection: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderTopStyle: "solid",
    paddingTop: 8,
    marginBottom: 10,
  },
  introText: { fontSize: 9, color: "#374151", textAlign: "left", fontStyle: "italic" },

  fixedFooterText: {
    position: "absolute",
    bottom: 25,
    left: 0,
    right: 0,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
  continueText: {
    position: "absolute",
    bottom: 35,
    right: 40,
    fontSize: 8,
    color: "#2563eb",
    fontWeight: "bold",
  },
});

// ─── Sub-componente: Bloco de Assinaturas (Orçamento) ──────────────────────

const BlocoAssinaturas = ({ dados }: { dados: DadosImpressao }) => (
  <View wrap={false}>
    <View style={styles.signaturesContainer}>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureText}>{dados.empresa?.nome_fantasia || "Assinatura Comercial"}</Text>
        <Text style={styles.signatureRole}>Departamento Comercial</Text>
      </View>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureText}>{dados.cliente?.nome_razao_social || "Assinatura do Cliente"}</Text>
        <Text style={styles.signatureRole}>De acordo com os termos</Text>
      </View>
    </View>
    <View style={{ marginTop: 15, alignItems: "center", paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 9, color: "#374151", fontStyle: "italic", textAlign: "center" }}>
        A Salvador Comunicação Visual agradece a solicitação. Estamos à disposição para qualquer dúvida.
      </Text>
    </View>
  </View>
);

// ─── Componente principal: OrcamentoPDF ────────────────────────────────────

export const OrcamentoPDF = ({ dados }: { dados: DadosImpressao }) => {
  const vendedor = Array.isArray(dados.orcamento.vendedores)
    ? dados.orcamento.vendedores[0]
    : dados.orcamento.vendedores;

  const totalBruto =
    dados.itens?.reduce((acc, item) => acc + item.quantidade * item.valor_unitario_aplicado, 0) || 0;
  const totalDescontos =
    dados.itens?.reduce((acc, item) => acc + Number(item.desconto || 0), 0) || 0;

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

  const imagensAnexas =
    dados.anexos?.filter((a) => a.file_url.match(/\.(jpeg|jpg|png|webp)$/i)) || [];

  const renderHeader = (tituloAlternativo?: string) => (
    <View style={styles.header} fixed>
      <View style={styles.logoContainer}>
        {dados.empresa?.logo_url ? (
          <PDFImage src={dados.empresa.logo_url} style={styles.logo} />
        ) : null}
        <View style={styles.companyTextWrapper}>
          {dados.empresa?.cnpj ? (
            <Text style={styles.companyText}>CNPJ: {dados.empresa.cnpj}</Text>
          ) : null}
          {dados.empresa?.telefone ? (
            <Text style={styles.companyText}>Tel: {dados.empresa.telefone}</Text>
          ) : null}
          {enderecoEmpresa.linha1 || enderecoEmpresa.linha2 ? (
            <>
              <Text style={styles.companyText}>
                {[enderecoEmpresa.linha1, enderecoEmpresa.linha2].filter(Boolean).join(" - ")}
              </Text>
              {dados.empresa?.cep ? (
                <Text style={styles.companyText}>CEP: {dados.empresa.cep}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.invoiceTitleBlock}>
        <Text style={styles.invoiceTitle}>{tituloAlternativo || "ORÇAMENTO"}</Text>
        <Text style={styles.invoiceDetails}>
          Nº: {String(dados.orcamento.numero_orcamento || 0).padStart(5, "0")}
        </Text>
        <Text style={styles.invoiceDetails}>
          Emissão: {formatarData(dados.orcamento.data_emissao)}
        </Text>
        {vendedor ? (
          <>
            <Text style={[styles.invoiceDetails, { marginTop: 4 }]}>Comercial: {vendedor.nome}</Text>
            {vendedor.email && <Text style={styles.invoiceDetails}>{vendedor.email}</Text>}
          </>
        ) : null}
        {vendedor?.telefone ? (
          <Text style={styles.invoiceDetails}>Tel: {vendedor.telefone}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {renderHeader()}

        {/* Dados do Cliente */}
        <View style={styles.clientSection}>
          <Text style={styles.clientTitle}>Preparado Para:</Text>
          <Text style={styles.clientName}>{dados.cliente?.nome_razao_social || "Cliente"}</Text>

          <View style={styles.clientGridRow}>
            <Text style={styles.clientGridCol}>
              <Text style={styles.clientLabel}>CNPJ/CPF: </Text>
              {dados.cliente?.cpf_cnpj || "-"}
            </Text>
            <Text style={styles.clientGridCol}>
              <Text style={styles.clientLabel}>Contato: </Text>
              {dados.cliente?.contato_nome || "-"}
            </Text>
          </View>

          <View style={styles.clientGridRow}>
            <Text style={styles.clientGridCol}>
              <Text style={styles.clientLabel}>Telefone: </Text>
              {dados.cliente?.telefone || "-"}
            </Text>
            <Text style={styles.clientGridCol} />
          </View>

          <View style={[styles.clientGridRow, { flexDirection: "column" }]}>
            <Text style={{ fontSize: 10, color: "#4b5563", width: "100%", marginBottom: 2 }}>
              <Text style={styles.clientLabel}>Endereço: </Text>
              {enderecoCliente.linha1}
              {enderecoCliente.linha2 ? ` - ${enderecoCliente.linha2}` : ""} -{" "}
              {dados.cliente.cep}
            </Text>
          </View>
        </View>

        {/* Frase introdutória */}
        <View style={styles.introTextSection}>
          <Text style={styles.introText}>
            Conforme solicitado, apresentamos nossa proposta para a confecção de produto(s) e/ou
            execução de serviço(s), conforme descrito abaixo:
          </Text>
        </View>

        {/* Tabela de itens */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colIndex}>
              <Text style={styles.tableHeaderText}>Item</Text>
            </View>
            <View style={styles.colImg}>
              <Text style={styles.tableHeaderText}>Imagem</Text>
            </View>
            <View style={styles.colDescHeader}>
              <Text style={styles.tableHeaderText}>Descrição do Serviço / Produto</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.tableHeaderText}>Qtd</Text>
            </View>
            <View style={styles.colUnit}>
              <Text style={styles.tableHeaderText}>V. Unit</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableHeaderText}>Subtotal</Text>
            </View>
          </View>

          {dados.itens?.map((item: ItemOrcamento, index: number) => {
            let urlDaImagem = Array.isArray(item.produtos)
              ? item.produtos[0]?.imagem_url
              : item.produtos?.imagem_url;

            // Transforma URL do Cloudinary para JPEG on-the-fly para compatibilidade com PDF
            if (urlDaImagem && urlDaImagem.includes("cloudinary.com") && urlDaImagem.match(/\.webp$/i)) {
              urlDaImagem = urlDaImagem.replace(/\.webp$/i, ".jpg");
            }

            return (
              <View style={styles.tableRow} key={index} wrap={false}>
                <View style={styles.colIndex}>
                  <Text style={[styles.tableCell, { fontWeight: "bold" }]}>{String.fromCharCode(65 + index)}</Text>
                </View>
                <View style={styles.colImg}>
                  {urlDaImagem ? (
                    <PDFImage src={urlDaImagem} style={styles.itemImage} />
                  ) : (
                    <Text style={{ fontSize: 8, color: "#9ca3af" }}>-</Text>
                  )}
                </View>
                <View style={styles.colDesc}>
                  <Text style={styles.tableCell}>{item.descricao || "Item"}</Text>
                  {item.medidas ? (
                    <Text style={styles.medidasText}>{item.medidas}</Text>
                  ) : null}
                </View>
                <Text style={[styles.colQty, styles.tableCell]}>
                  {String(item.quantidade || 0)}
                </Text>
                <Text style={[styles.colUnit, styles.tableCell]}>
                  {formatarMoeda(item.valor_unitario_aplicado)}
                </Text>
                <Text style={[styles.colTotal, styles.tableCell]}>
                  {formatarMoeda(item.subtotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Totais */}
        <View style={styles.totalSection} wrap={false}>
          <View style={styles.totalBox}>
            {totalDescontos > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalTextNormal}>Subtotal Bruto:</Text>
                  <Text style={styles.totalTextNormal}>{formatarMoeda(totalBruto)}</Text>
                </View>
                <View style={styles.totalDivider} />
              </>
            )}

            <View style={[styles.totalRow, { marginTop: 5, alignItems: "center" }]}>
              <Text style={styles.totalTextFinal}>Valor Total</Text>
              <Text style={styles.totalValueFinal}>
                {formatarMoeda(dados.orcamento.valor_total)}
              </Text>
            </View>

            {totalDescontos > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalTextDiscount}>Descontos Aplicados:</Text>
                <Text style={styles.totalTextDiscount}>- {formatarMoeda(totalDescontos)}</Text>
              </View>
            )}

            {(dados.orcamento.prazo ||
              dados.orcamento.forma_pagamento ||
              dados.orcamento.validade_proposta) ? (
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
                      <Text style={{ fontWeight: "bold", color: "#6b7280" }}>
                        Forma de Pagamento:{" "}
                      </Text>
                      {dados.orcamento.forma_pagamento}
                    </Text>
                  </View>
                ) : null}
                {dados.orcamento.validade_proposta ? (
                  <View style={styles.infoRow}>
                    <Text style={{ fontSize: 10, color: "#4b5563", width: "100%" }}>
                      <Text style={{ fontWeight: "bold", color: "#6b7280" }}>
                        Validade da Proposta:{" "}
                      </Text>
                      {dados.orcamento.validade_proposta}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* Observações */}
        <View style={styles.obsSection}>
          <Text style={styles.obsTitle}>Observações e Condições:</Text>
          <Text style={[styles.obsText, { width: "100%" }]}>
            {dados.orcamento.observacoes ? dados.orcamento.observacoes + "\n" : ""}
            {"Os serviços só poderão ser executados mediante autorização do cliente.\n"}
            {"Licença junto à Prefeitura é de responsabilidade do cliente.\n"}
            {"O cliente deverá fornecer ponto de energia elétrica junto ao local de instalação."}
          </Text>
        </View>

        {/* Anexos com links */}
        {dados.anexos && dados.anexos.length > 0 ? (
          <View style={styles.anexosSection} wrap={false}>
            <Text style={styles.anexosTitle}>ANEXOS DO PROJETO</Text>
            {dados.anexos.map((anexo, idx) => (
              <PDFLink key={idx} src={anexo.file_url} style={styles.anexosLink}>
                {anexo.file_name} (Clique aqui para abrir)
              </PDFLink>
            ))}
            <Text style={styles.anexosWarning}>
              * Os arquivos acima estão disponíveis para visualização e download pelo prazo de
              validade deste orçamento.
            </Text>
          </View>
        ) : null}

        <BlocoAssinaturas dados={dados} />

        <Text
          render={({ pageNumber, totalPages }) =>
            pageNumber < totalPages ? "CONTINUA NA PRÓXIMA PÁGINA" : ""
          }
          fixed
          style={styles.continueText}
        />
        <Text
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
          style={styles.pageNumber}
        />
      </Page>

      {/* Páginas de imagens anexas */}
      {imagensAnexas.map((img, idx) => {
        let pdfImageUrl = img.file_url;
        if (pdfImageUrl && pdfImageUrl.includes("cloudinary.com") && pdfImageUrl.match(/\.webp$/i)) {
          pdfImageUrl = pdfImageUrl.replace(/\.webp$/i, ".jpg");
        }
        return (
        <Page key={`anexo-${idx}`} size="A4" style={styles.page}>
          {renderHeader(`ANEXO: ${img.file_name}`)}
          <View style={{ flex: 1, marginVertical: 10, alignItems: "center", justifyContent: "center" }}>
            <PDFImage
              src={pdfImageUrl}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </View>
          <BlocoAssinaturas dados={dados} />
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
            style={styles.pageNumber}
          />
        </Page>
      )})}
    </Document>
  );
};
