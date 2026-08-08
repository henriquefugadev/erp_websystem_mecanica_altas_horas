"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { NaturezaItemOrcamento } from "@/lib/supabase/database.types";
import type { TipoItemOrcamento } from "@/modules/orcamento/data/tipo-item.repository";
import {
  atualizarTipoItemAction,
  criarTipoItemAction,
  excluirTipoItemAction,
} from "@/modules/orcamento/application/tipo-item.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ConfiguracoesTipos({ tipos }: { tipos: TipoItemOrcamento[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tipos de item do orçamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          São as opções do campo <strong>Tipo</strong> no orçamento. A natureza define como o item
          é cobrado ao concluir a OS (Peça entra em Peças; Serviço, em Mão de obra) e o fluxo de
          compra.
        </p>

        <div className="grid gap-2">
          {tipos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado ainda.</p>
          )}
          {tipos.map((tipo) => (
            <LinhaTipo key={tipo.id} tipo={tipo} />
          ))}
        </div>

        <NovoTipo />
      </CardContent>
    </Card>
  );
}

function LinhaTipo({ tipo }: { tipo: TipoItemOrcamento }) {
  const router = useRouter();
  const [nome, setNome] = useState(tipo.nome);
  const [natureza, setNatureza] = useState<NaturezaItemOrcamento>(tipo.natureza);
  const [ativo, setAtivo] = useState(tipo.ativo);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const alterado =
    nome.trim() !== tipo.nome || natureza !== tipo.natureza || ativo !== tipo.ativo;

  async function salvar() {
    setSalvando(true);
    const resultado = await atualizarTipoItemAction(tipo.id, { nome, natureza, ativo });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Tipo atualizado.");
    router.refresh();
  }

  async function excluir() {
    setExcluindo(true);
    const resultado = await excluirTipoItemAction(tipo.id);
    setExcluindo(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success(
      resultado.data.desativado
        ? "Tipo já usado em orçamentos — foi desativado (some da lista de escolha)."
        : "Tipo excluído."
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="min-w-40 flex-1"
        aria-label="Nome do tipo"
      />
      <Select value={natureza} onValueChange={(v) => setNatureza(v as NaturezaItemOrcamento)}>
        <SelectTrigger className="w-32" aria-label="Natureza">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="peca">Peça</SelectItem>
          <SelectItem value="servico">Serviço</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="size-4 accent-[var(--action)]"
        />
        Ativo
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!alterado || salvando || nome.trim() === ""}
        onClick={salvar}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={excluindo}
        onClick={excluir}
        aria-label={`Excluir ${tipo.nome}`}
        title="Excluir"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function NovoTipo() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [natureza, setNatureza] = useState<NaturezaItemOrcamento>("peca");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (nome.trim() === "") return;
    setSalvando(true);
    const resultado = await criarTipoItemAction({ nome, natureza, ativo: true });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Tipo adicionado.");
    setNome("");
    setNatureza("peca");
    router.refresh();
  }

  return (
    <div className="grid gap-2 border-t pt-4">
      <Label>Adicionar tipo</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Terceirizado"
          className="min-w-40 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Select value={natureza} onValueChange={(v) => setNatureza(v as NaturezaItemOrcamento)}>
          <SelectTrigger className="w-32" aria-label="Natureza do novo tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="peca">Peça</SelectItem>
            <SelectItem value="servico">Serviço</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={salvando || nome.trim() === ""}
          onClick={adicionar}
        >
          <Plus className="size-4" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
