"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import type { ItemCotacao } from "@/modules/orcamento/data/cotacao.repository";
import { salvarCotacoesAction } from "@/modules/orcamento/application/cotacao.actions";
import { aplicarMarkup } from "@/modules/orcamento/domain/calculo";
import { formatarDinheiro } from "@/lib/format";
import { descreverVeiculo, montarLinkWhatsApp, montarTextoCotacao } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FornecedorOpcao {
  id: string;
  nome: string;
  telefone: string | null;
}

type Filtro = "todos" | "sem_fornecedor" | "sem_preco";
type Valor = { fornecedorId: string; custo: string };

const FILTROS: { chave: Filtro; label: string }[] = [
  { chave: "sem_preco", label: "Sem preço" },
  { chave: "sem_fornecedor", label: "Sem fornecedor" },
  { chave: "todos", label: "Todos" },
];

function valorInicial(item: ItemCotacao): Valor {
  return {
    fornecedorId: item.fornecedorId ?? "",
    custo: item.custoCotado != null ? String(item.custoCotado) : "",
  };
}

function precoPreview(custo: string, markup: number): string {
  const n = Number(custo);
  if (custo.trim() === "" || Number.isNaN(n)) return "—";
  return formatarDinheiro(aplicarMarkup(n, markup));
}

export function CotacoesForm({
  itens,
  fornecedores,
  markup,
}: {
  itens: ItemCotacao[];
  fornecedores: FornecedorOpcao[];
  markup: number;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("sem_preco");
  const [enviando, setEnviando] = useState(false);
  const [valores, setValores] = useState<Record<string, Valor>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, valorInicial(i)]))
  );
  const inicial = useRef<Record<string, Valor>>(
    Object.fromEntries(itens.map((i) => [i.id, valorInicial(i)]))
  );

  const fornecedorPorId = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f])),
    [fornecedores]
  );

  function setValor(id: string, patch: Partial<Valor>) {
    setValores((atual) => ({ ...atual, [id]: { ...atual[id], ...patch } }));
  }

  function passaFiltro(id: string): boolean {
    const v = valores[id];
    if (filtro === "sem_fornecedor") return v.fornecedorId === "";
    if (filtro === "sem_preco") return v.custo.trim() === "";
    return true;
  }

  // Agrupa por orçamento (= por carro), respeitando o filtro atual.
  const grupos = useMemo(() => {
    const mapa = new Map<string, { info: ItemCotacao; itens: ItemCotacao[] }>();
    for (const item of itens) {
      if (!passaFiltro(item.id)) continue;
      const grupo = mapa.get(item.orcamentoId);
      if (grupo) grupo.itens.push(item);
      else mapa.set(item.orcamentoId, { info: item, itens: [item] });
    }
    return [...mapa.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, valores, filtro]);

  function botoesWhatsApp(grupoItens: ItemCotacao[], veiculo: ItemCotacao["veiculo"]) {
    if (!veiculo) return [];
    // Fornecedores distintos atribuídos a itens deste grupo, com telefone.
    const porFornecedor = new Map<string, ItemCotacao[]>();
    for (const item of grupoItens) {
      const fid = valores[item.id].fornecedorId;
      if (!fid) continue;
      const lista = porFornecedor.get(fid) ?? [];
      lista.push(item);
      porFornecedor.set(fid, lista);
    }

    return [...porFornecedor.entries()]
      .map(([fid, lista]) => {
        const fornecedor = fornecedorPorId.get(fid);
        if (!fornecedor?.telefone) return null;
        const texto = montarTextoCotacao(
          veiculo,
          lista.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade }))
        );
        return {
          fid,
          nome: fornecedor.nome,
          link: montarLinkWhatsApp(fornecedor.telefone, texto),
        };
      })
      .filter((x): x is { fid: string; nome: string; link: string } => x !== null);
  }

  async function salvar() {
    const alterados = itens
      .filter((i) => {
        const v = valores[i.id];
        const base = inicial.current[i.id];
        return v.fornecedorId !== base.fornecedorId || v.custo !== base.custo;
      })
      .map((i) => ({
        id: i.id,
        fornecedorId: valores[i.id].fornecedorId,
        custoCotado: valores[i.id].custo,
      }));

    if (alterados.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await salvarCotacoesAction({ itens: alterados });
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(`${alterados.length} cotação(ões) salva(s).`);
      inicial.current = { ...valores };
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (itens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma peça para cotar. As peças aparecem aqui quando um diagnóstico é lançado no pátio.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFiltro(f.chave)}
              className={
                "rounded-md px-3 py-1 text-sm transition-colors " +
                (filtro === f.chave
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <Button
          onClick={salvar}
          disabled={enviando}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Salvar cotações
        </Button>
      </div>

      {grupos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum item neste filtro.</p>
      )}

      {grupos.map((grupo) => {
        const veiculo = grupo.info.veiculo;
        const whats = botoesWhatsApp(grupo.itens, veiculo);
        return (
          <Card key={grupo.info.orcamentoId}>
            <CardHeader className="gap-1">
              <CardTitle className="font-heading text-base">
                {veiculo ? descreverVeiculo(veiculo) : `Orçamento #${grupo.info.orcamentoNumero}`}
              </CardTitle>
              {grupo.info.queixa && (
                <p className="text-xs text-muted-foreground">{grupo.info.queixa}</p>
              )}
              {whats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {whats.map((w) => (
                    <Button
                      key={w.fid}
                      size="sm"
                      variant="outline"
                      render={<a href={w.link} target="_blank" rel="noopener noreferrer" />}
                    >
                      <MessageCircle className="size-4" />
                      Cotar com {w.nome}
                    </Button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-2">
              {grupo.itens.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-4">
                    <p className="text-sm">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">Qtd.: {item.quantidade}</p>
                  </div>
                  <div className="col-span-4">
                    <Select
                      value={valores[item.id].fornecedorId}
                      onValueChange={(v) => setValor(item.id, { fornecedorId: v ?? "" })}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="Fornecedor">
                          {(v: string) => fornecedorPorId.get(v)?.nome ?? "Fornecedor"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Custo"
                      value={valores[item.id].custo}
                      onChange={(e) => setValor(item.id, { custo: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm">
                    <span className="text-xs text-muted-foreground">Venda: </span>
                    {precoPreview(valores[item.id].custo, markup)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
