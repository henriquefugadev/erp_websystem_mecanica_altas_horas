"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { ServicoCatalogo } from "@/modules/servicos/data/servico-catalogo.repository";
import {
  atualizarServicoAction,
  criarServicoAction,
  excluirServicoAction,
} from "@/modules/servicos/application/servico-catalogo.actions";
import { formatarDinheiro } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Catálogo de serviços frequentes. Alimenta o autocomplete da descrição no
 * orçamento do pátio: digitar as primeiras letras traz o serviço e já preenche
 * o preço cadastrado. É a tela que mais economiza digitação da Michele.
 */
export function ConfiguracoesServicos({ servicos }: { servicos: ServicoCatalogo[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catálogo de serviços</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          Serviços que a oficina faz sempre, com o preço de tabela. No orçamento, basta digitar
          as primeiras letras: o serviço aparece na lista e o preço já vem preenchido (dá para
          mudar linha a linha). Preço <strong>0</strong> = só a sugestão do nome.
        </p>

        <div className="grid gap-2">
          {servicos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          )}
          {servicos.map((servico) => (
            <LinhaServico key={servico.id} servico={servico} />
          ))}
        </div>

        <NovoServico />
      </CardContent>
    </Card>
  );
}

function LinhaServico({ servico }: { servico: ServicoCatalogo }) {
  const [nome, setNome] = useState(servico.nome);
  const [preco, setPreco] = useState(String(servico.preco_padrao));
  const [ativo, setAtivo] = useState(servico.ativo);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const alterado =
    nome.trim() !== servico.nome ||
    Number(preco) !== servico.preco_padrao ||
    ativo !== servico.ativo;

  async function salvar() {
    setSalvando(true);
    const resultado = await atualizarServicoAction(servico.id, {
      nome,
      precoPadrao: preco === "" ? 0 : preco,
      duracaoMinutos: servico.duracao_minutos ?? "",
      ativo,
    });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Serviço atualizado.");
  }

  async function excluir() {
    setExcluindo(true);
    const resultado = await excluirServicoAction(servico.id);
    setExcluindo(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Serviço excluído.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="min-w-40 flex-1"
        aria-label="Nome do serviço"
      />
      <Input
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
        type="text"
        inputMode="decimal"
        className="w-28"
        aria-label={`Preço de ${servico.nome}`}
        title={
          Number(preco) > 0 ? formatarDinheiro(Number(preco)) : "Sem preço de tabela"
        }
      />
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
        aria-label={`Excluir ${servico.nome}`}
        title="Excluir"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function NovoServico() {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (nome.trim() === "") return;
    setSalvando(true);
    const resultado = await criarServicoAction({
      nome,
      precoPadrao: preco === "" ? 0 : preco,
      duracaoMinutos: "",
      ativo: true,
    });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Serviço adicionado.");
    setNome("");
    setPreco("");
  }

  return (
    <div className="grid gap-2 border-t pt-4">
      <Label>Adicionar serviço</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Troca de óleo e filtro"
          className="min-w-40 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Input
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          type="text"
          inputMode="decimal"
          placeholder="Preço"
          className="w-28"
          aria-label="Preço do novo serviço"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
        />
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
