/**
 * OrdemProducaoPDF.tsx
 * Componente responsável pela geração do PDF de ORDEM DE PRODUÇÃO (OP).
 * Para modificações de layout/estilo exclusivas da OP, edite aqui.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PDFImage,
} from "@react-pdf/renderer";
import {
  DadosImpressao,
  ItemOrcamento,
  formatarMoeda,
  formatarData,
  montarEnderecoLinhas,
} from "./types";

// ─── Estilos da OP ──────────────────────────────────────────────────────────

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

  colImg: { width: "15%", alignItems: "center", justifyContent: "center" },
  colDesc: { width: "75%", paddingRight: 5, justifyContent: "center" },
  colDescHeader: { width: "75%" },
  colQty: { width: "10%", textAlign: "center" },

  tableCell: { fontSize: 9, color: "#374151" },
  itemImage: { width: 50, height: 50, objectFit: "contain", padding: 1 },
  medidasText: { fontSize: 8, color: "#6b7280", marginTop: 3 },

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

  introTextSection: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderTopStyle: "solid",
    paddingTop: 8,
    marginBottom: 10,
  },
  introText: { fontSize: 9, color: "#374151", textAlign: "left", fontStyle: "italic" },

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

// ─── Sub-componente: Bloco de Assinaturas (OP) ─────────────────────────────

const BlocoAssinaturasOP = ({ dados }: { dados: DadosImpressao }) => {
  const vendedor = Array.isArray(dados.orcamento.vendedores)
    ? dados.orcamento.vendedores[0]
    : dados.orcamento.vendedores;

  return (
    <View wrap={false} style={{ marginTop: 30, marginBottom: 10 }}>
      {/* Linha 1: Gerente | Jaime */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 30 }}>
        <View style={{ width: "40%", alignItems: "center" }}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>Gerente</Text>
        </View>
        <View style={{ width: "40%", alignItems: "center" }}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>Jaime</Text>
        </View>
      </View>

      {/* Linha 2: Financeiro | Vendedor */}
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <View style={{ width: "40%", alignItems: "center" }}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>Financeiro</Text>
        </View>
        <View style={{ width: "40%", alignItems: "center" }}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureText}>{vendedor?.nome || "Vendedor"}</Text>
          {vendedor?.email && (
            <Text style={{ fontSize: 8, color: "#2563eb", marginTop: 2 }}>{vendedor.email}</Text>
          )}
          <Text style={styles.signatureRole}>Já Assinado Digitalmente</Text>
        </View>
      </View>

      {/* Mensagem de agradecimento */}
      <View style={{ marginTop: 15, alignItems: "center", paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 9, color: "#374151", fontStyle: "italic", textAlign: "center" }}>
          A Salvador Comunicação Visual agradece a solicitação. Estamos à disposição para qualquer dúvida.
        </Text>
      </View>
    </View>
  );
};

// ─── Componente principal: OrdemProducaoPDF ────────────────────────────────

export const OrdemProducaoPDF = ({ dados }: { dados: DadosImpressao }) => {
  const vendedor = Array.isArray(dados.orcamento.vendedores)
    ? dados.orcamento.vendedores[0]
    : dados.orcamento.vendedores;

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
        <Text style={styles.invoiceTitle}>{tituloAlternativo || "ORDEM DE\nPRODUÇÃO"}</Text>
        <Text style={styles.invoiceDetails}>
          Nº: {String(dados.orcamento.numero_orcamento || 0).padStart(5, "0")}
        </Text>
        <Text style={styles.invoiceDetails}>
          Emissão: {formatarData(dados.orcamento.data_emissao)}
        </Text>
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

          {/* Dados da Obra (exclusivo da OP) */}
          {(dados.orcamento.endereco_obra || dados.orcamento.contato_obra) && (
            <View
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
                borderTopStyle: "solid",
              }}
            >
              <Text style={styles.clientTitle}>Dados da Obra:</Text>
              {dados.orcamento.contato_obra ? (
                <Text style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}>
                  <Text style={styles.clientLabel}>Contato/Resp: </Text>
                  {dados.orcamento.contato_obra}
                </Text>
              ) : null}
              {dados.orcamento.endereco_obra ? (
                <Text style={{ fontSize: 10, color: "#4b5563" }}>
                  <Text style={styles.clientLabel}>Endereço: </Text>
                  {dados.orcamento.endereco_obra}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Frase introdutória */}
        <View style={styles.introTextSection}>
          <Text style={styles.introText}>
            Conforme solicitado, apresentamos nossa proposta para a confecção de produto(s) e/ou
            execução de serviço(s), conforme descrito abaixo:
          </Text>
        </View>

        {/* Tabela de itens (sem preços na OP) */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={styles.colImg}>
              <Text style={styles.tableHeaderText}>Imagem</Text>
            </View>
            <View style={styles.colDescHeader}>
              <Text style={styles.tableHeaderText}>Descrição do Serviço / Produto</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.tableHeaderText}>Qtd</Text>
            </View>
          </View>

          {dados.itens?.map((item: ItemOrcamento, index: number) => {
            const urlDaImagem = Array.isArray(item.produtos)
              ? item.produtos[0]?.imagem_url
              : item.produtos?.imagem_url;
            return (
              <View style={styles.tableRow} key={index} wrap={false}>
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
              </View>
            );
          })}
        </View>

        {/* Observações */}
        <View style={styles.obsSection}>
          <Text style={styles.obsTitle}>Observações e Condições:</Text>
          <Text style={[styles.obsText, { width: "100%" }]}>
            {dados.orcamento.observacoes ? dados.orcamento.observacoes + "\n" : ""}
            {"Os serviços só poderão ser executados mediante autorização do cliente.\n"}
            {"Licença junto à Prefeitura é de responsabilidade do cliente.\n"}
            {"O cliente deverá fornecer ponto de energia elétrica junto ao local de instalação do letreiro."}
          </Text>
        </View>

        <BlocoAssinaturasOP dados={dados} />

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
      {imagensAnexas.map((img, idx) => (
        <Page key={`anexo-${idx}`} size="A4" style={styles.page}>
          {renderHeader(`ANEXO: ${img.file_name}`)}
          <View
            style={{ flex: 1, marginVertical: 10, alignItems: "center", justifyContent: "center" }}
          >
            <PDFImage
              src={img.file_url}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </View>
          <BlocoAssinaturasOP dados={dados} />
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
            style={styles.pageNumber}
          />
        </Page>
      ))}
    </Document>
  );
};
