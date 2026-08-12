"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Car, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarPlaca } from "@/lib/format";
import { criarOrdemAction } from "@/modules/patio/application/ordem-servico.actions";
import type {
  ClienteOpcaoBusca,
  VeiculoOpcaoBusca,
} from "@/modules/crm/application/cliente.actions";
import { ClienteCombobox } from "@/components/crm/cliente-combobox";
import { VeiculoFotos } from "@/components/crm/veiculo-fotos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const QUEIXAS_RAPIDAS = ["Olha aí", "Revisão", "Barulho", "Não liga", "Não sei"];

interface Registrado {
  clienteId: string;
  veiculo: VeiculoOpcaoBusca;
}

export function EntradaForm() {
  const [cliente, setCliente] = useState<ClienteOpcaoBusca | null>(null);
  const [veiculo, setVeiculo] = useState<VeiculoOpcaoBusca | null>(null);
  const [queixa, setQueixa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState<Registrado | null>(null);

  function selecionarCliente(c: ClienteOpcaoBusca | null) {
    setCliente(c);
    // Auto-seleciona o veículo quando só há um (caso mais comum e o do
    // cadastro relâmpago) — um toque a menos pra Michele.
    setVeiculo(c && c.veiculo.length === 1 ? c.veiculo[0] : null);
  }

  async function registrar() {
    if (!cliente || !veiculo) return;
    setEnviando(true);
    try {
      const resultado = await criarOrdemAction({
        clienteId: cliente.id,
        veiculoId: veiculo.id,
        queixa,
        descricao: "",
        funcionarioId: "",
      });
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Entrada registrada.");
      setRegistrado({ clienteId: cliente.id, veiculo });
    } finally {
      setEnviando(false);
    }
  }

  function novaEntrada() {
    setCliente(null);
    setVeiculo(null);
    setQueixa("");
    setRegistrado(null);
  }

  if (registrado) {
    return (
      <div className="mx-auto grid max-w-md gap-6 py-4">
        <div className="grid justify-items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-action/15 text-action">
            <Check className="size-7" />
          </div>
          <h1 className="font-heading text-2xl">Entrada registrada</h1>
          <p className="text-muted-foreground">
            {registrado.veiculo.modelo} — {formatarPlaca(registrado.veiculo.placa)} entrou no
            pátio, aguardando avaliação.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-6">
            <Label>Foto do veículo (opcional)</Label>
            <VeiculoFotos
              clienteId={registrado.clienteId}
              veiculoId={registrado.veiculo.id}
              fotosIniciais={[]}
            />
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Button
            size="lg"
            onClick={novaEntrada}
            className="bg-action text-action-foreground hover:bg-action/90"
          >
            <Plus className="size-5" />
            Registrar outro veículo
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/patio" />}>
            Ir para o Pátio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-6 py-4">
      <div className="grid gap-1">
        <h1 className="font-heading text-2xl">Entrada de veículo</h1>
        <p className="text-sm text-muted-foreground">
          Busque pela placa ou nome. Se for cliente novo, cadastre na hora.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Cliente</Label>
        <ClienteCombobox value={cliente} onSelect={selecionarCliente} />
      </div>

      {cliente && cliente.veiculo.length > 0 && (
        <div className="grid gap-2">
          <Label>Veículo</Label>
          <div className="grid gap-2">
            {cliente.veiculo.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVeiculo(v)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  veiculo?.id === v.id
                    ? "border-action bg-action/10"
                    : "border-input hover:bg-muted/60"
                )}
              >
                <Car className="size-5 shrink-0 text-muted-foreground" />
                <div className="grid">
                  <span className="font-medium">
                    {[v.marca, v.modelo].filter(Boolean).join(" ")}
                  </span>
                  <span className="text-sm text-muted-foreground">{formatarPlaca(v.placa)}</span>
                </div>
                {veiculo?.id === v.id && <Check className="ml-auto size-5 text-action" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {cliente && cliente.veiculo.length === 0 && (
        <p className="text-sm text-alert">
          Esse cliente não tem veículo cadastrado. Cadastre um pelo botão de busca (“Cadastrar”).
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="queixa">Queixa do cliente (opcional)</Label>
        <div className="flex flex-wrap gap-2">
          {QUEIXAS_RAPIDAS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQueixa(q)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                queixa === q
                  ? "border-action bg-action/10 text-foreground"
                  : "border-input text-muted-foreground hover:bg-muted/60"
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <Textarea
          id="queixa"
          rows={2}
          placeholder="Ex.: barulho ao frear, revisão dos 40 mil..."
          value={queixa}
          onChange={(e) => setQueixa(e.target.value)}
        />
      </div>

      <Button
        size="lg"
        disabled={!cliente || !veiculo || enviando}
        onClick={registrar}
        className="bg-action text-action-foreground hover:bg-action/90"
      >
        Registrar entrada
      </Button>
    </div>
  );
}
