import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatarData,
  formatarDinheiro,
  formatarDocumento,
  formatarPlaca,
  formatarTelefone,
} from "@/lib/format";
import type { Workshop } from "@/modules/workshop/domain/types";
import { calcularSubtotalItem } from "../domain/calculo";
import type { OrcamentoComRelacoes } from "../domain/types";

// @react-pdf/renderer tem seu próprio conjunto de primitivos (Document/Page/
// View/Text/Image) — não é HTML/DOM, então o estilo é StyleSheet.create, não
// Tailwind. Cores seguem a paleta da marca (#16161A) só no texto/traços, sem
// preto/amarelo em excesso (o mesmo cuidado do design system do app).
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16161A" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: { width: 56, height: 56, objectFit: "contain" },
  workshopNome: { fontSize: 16, fontWeight: 700 },
  muted: { color: "#666666" },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
    color: "#666666",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#16161A",
    paddingBottom: 4,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingVertical: 4,
  },
  colDescricao: { flex: 3 },
  colQtd: { flex: 1, textAlign: "right" },
  colPreco: { flex: 1.2, textAlign: "right" },
  colDesconto: { flex: 1, textAlign: "right" },
  colSubtotal: { flex: 1.2, textAlign: "right" },
  total: { marginTop: 8, textAlign: "right", fontSize: 12, fontWeight: 700 },
  assinaturas: { marginTop: 48, flexDirection: "row", justifyContent: "space-between" },
  assinatura: {
    width: "45%",
    borderTopWidth: 1,
    borderTopColor: "#16161A",
    paddingTop: 4,
    textAlign: "center",
  },
});

export function OrcamentoPdf({
  orcamento,
  workshop,
  logoUrl,
}: {
  orcamento: OrcamentoComRelacoes;
  workshop: Workshop;
  logoUrl: string | null;
}) {
  const enderecoOficina = [
    workshop.logradouro,
    workshop.numero,
    workshop.bairro,
    workshop.cidade,
    workshop.estado,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.workshopNome}>{workshop.razao_social || workshop.nome}</Text>
            {workshop.cnpj && (
              <Text style={styles.muted}>CNPJ: {formatarDocumento(workshop.cnpj)}</Text>
            )}
            {enderecoOficina && <Text style={styles.muted}>{enderecoOficina}</Text>}
            {workshop.telefone && (
              <Text style={styles.muted}>{formatarTelefone(workshop.telefone)}</Text>
            )}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o primitivo do @react-pdf/renderer, não <img>; não tem prop alt. */}
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orçamento #{orcamento.numero}</Text>
          <View style={styles.row}>
            <Text>Emissão: {formatarData(orcamento.data_emissao)}</Text>
            <Text>Válido até: {formatarData(orcamento.validade)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <Text>{orcamento.cliente?.nome ?? "—"}</Text>
            {orcamento.cliente?.telefone && (
              <Text style={styles.muted}>{formatarTelefone(orcamento.cliente.telefone)}</Text>
            )}
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Veículo</Text>
            <Text>
              {[orcamento.veiculo?.marca, orcamento.veiculo?.modelo].filter(Boolean).join(" ") ||
                "—"}
            </Text>
            {orcamento.veiculo?.placa && (
              <Text style={styles.muted}>{formatarPlaca(orcamento.veiculo.placa)}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Queixa / diagnóstico</Text>
          <Text>{orcamento.queixa}</Text>
          {orcamento.observacoes && <Text style={styles.muted}>{orcamento.observacoes}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDescricao}>Descrição</Text>
            <Text style={styles.colQtd}>Qtd.</Text>
            <Text style={styles.colPreco}>Preço unit.</Text>
            <Text style={styles.colDesconto}>Desconto</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {orcamento.orcamento_item.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDescricao}>{item.descricao}</Text>
              <Text style={styles.colQtd}>{item.quantidade}</Text>
              <Text style={styles.colPreco}>{formatarDinheiro(item.preco_unitario)}</Text>
              <Text style={styles.colDesconto}>{formatarDinheiro(item.desconto)}</Text>
              <Text style={styles.colSubtotal}>
                {formatarDinheiro(
                  calcularSubtotalItem({
                    quantidade: item.quantidade,
                    precoUnitario: item.preco_unitario,
                    desconto: item.desconto,
                  })
                )}
              </Text>
            </View>
          ))}
          <Text style={styles.total}>Total: {formatarDinheiro(orcamento.valor_total)}</Text>
        </View>

        {orcamento.condicoes_pagamento && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condições de pagamento</Text>
            <Text>{orcamento.condicoes_pagamento}</Text>
          </View>
        )}

        <View style={styles.assinaturas}>
          <Text style={styles.assinatura}>{orcamento.cliente?.nome ?? "Cliente"}</Text>
          <Text style={styles.assinatura}>{workshop.razao_social || workshop.nome}</Text>
        </View>
      </Page>
    </Document>
  );
}
