"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { validarPlaca } from "@/lib/validators/veiculo";
import {
  criarClienteComVeiculoAction,
  type ClienteOpcaoBusca,
} from "@/modules/crm/application/cliente.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Campos {
  nome: string;
  telefone: string;
  placa: string;
  modelo: string;
}

function iniciais(termo: string): Campos {
  // Se o termo digitado parece uma placa, joga ele no campo placa; senão, no
  // nome — pra Michele não reescrever o que já digitou na busca.
  const ehPlaca = validarPlaca(termo);
  return {
    nome: ehPlaca ? "" : termo,
    telefone: "",
    placa: ehPlaca ? termo.toUpperCase() : "",
    modelo: "",
  };
}

export function CriarClienteRapidoDialog({
  open,
  onOpenChange,
  termoInicial = "",
  onCriado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  termoInicial?: string;
  onCriado: (cliente: ClienteOpcaoBusca) => void;
}) {
  const [campos, setCampos] = useState<Campos>(() => iniciais(termoInicial));
  const [enviando, setEnviando] = useState(false);

  // Reabrir o dialog com um termo novo deve repreencher os campos.
  useEffect(() => {
    if (open) setCampos(iniciais(termoInicial));
  }, [open, termoInicial]);

  function set<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    setEnviando(true);
    try {
      const resultado = await criarClienteComVeiculoAction(
        { tipo: "PF", nome: campos.nome, telefone: campos.telefone },
        { placa: campos.placa, modelo: campos.modelo }
      );
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Cliente e veículo cadastrados.");
      onCriado(resultado.data);
      onOpenChange(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastro rápido</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="rapido-nome" required>
              Nome
            </Label>
            <Input
              id="rapido-nome"
              autoFocus
              value={campos.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rapido-telefone" required>
              Telefone
            </Label>
            <Input
              id="rapido-telefone"
              inputMode="tel"
              placeholder="(64) 99999-9999"
              value={campos.telefone}
              onChange={(e) => set("telefone", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="rapido-placa" required>
                Placa
              </Label>
              <Input
                id="rapido-placa"
                autoCapitalize="characters"
                placeholder="ABC1D23"
                value={campos.placa}
                onChange={(e) => set("placa", e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rapido-modelo" required>
                Modelo
              </Label>
              <Input
                id="rapido-modelo"
                placeholder="Gol, Onix..."
                value={campos.modelo}
                onChange={(e) => set("modelo", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={enviando}
              className="bg-action text-action-foreground hover:bg-action/90"
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
