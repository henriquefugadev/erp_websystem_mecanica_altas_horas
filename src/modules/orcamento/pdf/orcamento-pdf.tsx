import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarDinheiro, formatarPlaca, formatarTelefone } from "@/lib/format";
import type { Workshop } from "@/modules/workshop/domain/types";
import { calcularSubtotalItem } from "../domain/calculo";
import type { OrcamentoComRelacoes } from "../domain/types";

// @react-pdf/renderer tem seu próprio conjunto de primitivos (Document/Page/
// View/Text/Image) — não é HTML/DOM, então o estilo é StyleSheet.create, não
// Tailwind. Este layout reproduz a "Ordem de serviço" em papel que a oficina
// já usa: cabeçalho com logo + endereço, tabela de itens com cabeçalho amarelo,
// linha de MÃO DE OBRA somada, VALOR TOTAL em destaque e a caixa do PIX.
const AMARELO = "#FFDD00";
const PRETO = "#111111";
const BORDA = "#111111";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: PRETO },
  titulo: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
    marginBottom: 14,
  },
  cabecalho: { flexDirection: "row", gap: 12, marginBottom: 14 },
  logoBox: {
    width: 150,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  logo: { width: 132, height: 64, objectFit: "contain" },
  logoTelefone: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  logoNome: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center" },
  cabecalhoDir: { flex: 1, justifyContent: "space-between" },
  endereco: { fontSize: 12, fontFamily: "Helvetica-BoldOblique", lineHeight: 1.4 },
  servicoBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    padding: 6,
    minHeight: 40,
  },
  servicoLabel: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  servicoNome: { marginTop: 4, fontSize: 11 },
  // Bloco Data/Cliente/Veículo/Placa
  dados: {
    width: 300,
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 4,
    marginBottom: 14,
  },
  dadosLinha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDA },
  dadosLinhaUltima: { flexDirection: "row" },
  dadosRotulo: {
    width: 90,
    padding: 4,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: BORDA,
    backgroundColor: "#f2f2f2",
  },
  dadosValor: { flex: 1, padding: 4 },
  // Tabela de itens
  tabela: { borderWidth: 1, borderColor: BORDA, borderRadius: 4, overflow: "hidden" },
  th: {
    flexDirection: "row",
    backgroundColor: AMARELO,
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
  },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cccccc" },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellUlt: { padding: 4 },
  thText: { fontFamily: "Helvetica-Bold", textAlign: "center" },
  colQtd: { width: 42, textAlign: "center" },
  colNum: { width: 48, textAlign: "center" },
  colDesc: { flex: 1 },
  colPreco: { width: 90, textAlign: "right" },
  colTotal: { width: 90, textAlign: "right" },
  linhaMaoObra: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDA },
  maoObraLabel: { flex: 1, padding: 4, fontFamily: "Helvetica-Bold", textAlign: "center" },
  // Valor total
  totalLinha: { flexDirection: "row", marginTop: 8, justifyContent: "flex-end" },
  totalLabelBox: {
    backgroundColor: AMARELO,
    borderWidth: 1,
    borderColor: BORDA,
    padding: 5,
    width: 90,
    alignItems: "center",
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalValorBox: {
    borderWidth: 1,
    borderColor: BORDA,
    borderLeftWidth: 0,
    padding: 5,
    width: 90,
    alignItems: "flex-end",
  },
  totalValor: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  // PIX
  pix: { marginTop: 22, width: 300, borderWidth: 1, borderColor: BORDA, borderRadius: 4 },
  pixLinha: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDA },
  pixLinhaUltima: { flexDirection: "row" },
  pixRotulo: {
    width: 90,
    padding: 4,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: BORDA,
    textAlign: "center",
  },
  pixValor: { flex: 1, padding: 4, fontFamily: "Helvetica-Bold" },
});

function nomeVeiculo(v: OrcamentoComRelacoes["veiculo"]): string {
  if (!v) return "—";
  return [v.marca, v.modelo].filter(Boolean).join(" ") || "—";
}

export function OrcamentoPdf({
  orcamento,
  workshop,
  logoUrl,
}: {
  orcamento: OrcamentoComRelacoes;
  workshop: Workshop;
  logoUrl: string | null;
}) {
  const enderecoLinha1 = workshop.logradouro ? `End: ${workshop.logradouro}` : null;
  const enderecoLinha2 = [
    workshop.numero ? `N: ${workshop.numero}` : null,
    workshop.bairro ? `Bairro: ${workshop.bairro}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const telefone = workshop.telefone ? formatarTelefone(workshop.telefone) : null;
  // Técnico responsável pela OS de origem, quando houver — vai em "Serviço
  // feito por". Orçamento avulso (sem OS) fica só com o rótulo, como antes.
  const tecnico = orcamento.ordem_servico?.funcionario?.nome ?? null;

  // Peças entram como linhas individuais; serviços são somados numa única linha
  // "MÃO DE OBRA", como no modelo em papel da oficina.
  const pecas = orcamento.orcamento_item.filter((i) => i.tipo === "peca");
  const servicos = orcamento.orcamento_item.filter((i) => i.tipo === "servico");
  const totalMaoObra = servicos.reduce(
    (soma, i) =>
      soma +
      calcularSubtotalItem({
        quantidade: i.quantidade,
        precoUnitario: i.preco_unitario,
        desconto: i.desconto,
      }),
    0
  );

  const placaKm = [
    orcamento.veiculo?.placa ? formatarPlaca(orcamento.veiculo.placa) : null,
    orcamento.veiculo?.quilometragem
      ? `${orcamento.veiculo.quilometragem.toLocaleString("pt-BR")} km`
      : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>Ordem de serviço</Text>

        <View style={styles.cabecalho}>
          <View style={styles.logoBox}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf/renderer não tem prop alt.
              <Image src={logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.logoNome}>{workshop.nome}</Text>
            )}
            {telefone && <Text style={styles.logoTelefone}>{telefone}</Text>}
          </View>
          <View style={styles.cabecalhoDir}>
            <View>
              {enderecoLinha1 && <Text style={styles.endereco}>{enderecoLinha1}</Text>}
              {enderecoLinha2 !== "" && <Text style={styles.endereco}>{enderecoLinha2}</Text>}
              {telefone && <Text style={styles.endereco}>{`Fone: ${telefone}`}</Text>}
            </View>
            <View style={styles.servicoBox}>
              <Text style={styles.servicoLabel}>SERVIÇO FEITO POR:</Text>
              {tecnico && <Text style={styles.servicoNome}>{tecnico}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.dados}>
          <View style={styles.dadosLinha}>
            <Text style={styles.dadosRotulo}>DATA:</Text>
            <Text style={styles.dadosValor}>{formatarData(orcamento.data_emissao)}</Text>
          </View>
          <View style={styles.dadosLinha}>
            <Text style={styles.dadosRotulo}>CLIENTE:</Text>
            <Text style={styles.dadosValor}>{orcamento.cliente?.nome ?? "—"}</Text>
          </View>
          <View style={styles.dadosLinha}>
            <Text style={styles.dadosRotulo}>VEÍCULO:</Text>
            <Text style={styles.dadosValor}>
              {nomeVeiculo(orcamento.veiculo)}
              {orcamento.veiculo?.cor ? ` - ${orcamento.veiculo.cor}` : ""}
            </Text>
          </View>
          <View style={styles.dadosLinhaUltima}>
            <Text style={styles.dadosRotulo}>PLACA/KM:</Text>
            <Text style={styles.dadosValor}>{placaKm || "—"}</Text>
          </View>
        </View>

        <View style={styles.tabela}>
          <View style={styles.th}>
            <Text style={[styles.cell, styles.colQtd, styles.thText]}>Qtd</Text>
            <Text style={[styles.cell, styles.colNum, styles.thText]}>Item N.º</Text>
            <Text style={[styles.cell, styles.colDesc, styles.thText]}>Descrição</Text>
            <Text style={[styles.cell, styles.colPreco, styles.thText]}>Preço Unitário</Text>
            <Text style={[styles.cellUlt, styles.colTotal, styles.thText]}>Total</Text>
          </View>

          {pecas.map((item, indice) => (
            <View key={item.id} style={styles.tr} wrap={false}>
              <Text style={[styles.cell, styles.colQtd]}>{item.quantidade}</Text>
              <Text style={[styles.cell, styles.colNum]}>{indice + 1}</Text>
              <Text style={[styles.cell, styles.colDesc]}>{item.descricao}</Text>
              <Text style={[styles.cell, styles.colPreco]}>
                {formatarDinheiro(item.preco_unitario)}
              </Text>
              <Text style={[styles.cellUlt, styles.colTotal]}>
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

          {servicos.length > 0 && (
            <View style={styles.linhaMaoObra} wrap={false}>
              <Text style={styles.maoObraLabel}>MÃO DE OBRA</Text>
              <Text style={[styles.cell, styles.colPreco]}>{formatarDinheiro(totalMaoObra)}</Text>
              <Text style={[styles.cellUlt, styles.colTotal]}>{formatarDinheiro(totalMaoObra)}</Text>
            </View>
          )}
        </View>

        <View style={styles.totalLinha}>
          <View style={styles.totalLabelBox}>
            <Text style={styles.totalLabel}>VALOR TOTAL</Text>
          </View>
          <View style={styles.totalValorBox}>
            <Text style={styles.totalValor}>{formatarDinheiro(orcamento.valor_total)}</Text>
          </View>
        </View>

        {(workshop.chave_pix || workshop.pix_favorecido) && (
          <View style={styles.pix}>
            {workshop.chave_pix && (
              <View style={styles.pixLinha}>
                <Text style={styles.pixRotulo}>CHAVE PIX:</Text>
                <Text style={styles.pixValor}>{workshop.chave_pix}</Text>
              </View>
            )}
            {workshop.pix_favorecido && (
              <View style={styles.pixLinhaUltima}>
                <Text style={styles.pixRotulo}>NOME:</Text>
                <Text style={styles.pixValor}>{workshop.pix_favorecido}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
