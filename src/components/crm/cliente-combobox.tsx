"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarPlaca } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buscarClientesComVeiculosAction,
  type ClienteOpcaoBusca,
} from "@/modules/crm/application/cliente.actions";
import { CriarClienteRapidoDialog } from "./criar-cliente-rapido-dialog";

const DEBOUNCE_MS = 250;

function resumoPlacas(cliente: ClienteOpcaoBusca): string {
  return cliente.veiculo.map((v) => formatarPlaca(v.placa)).join(" · ");
}

export function ClienteCombobox({
  value,
  onSelect,
  placeholder = "Buscar cliente...",
  id,
  permitirCriar = true,
}: {
  value: ClienteOpcaoBusca | null;
  onSelect: (cliente: ClienteOpcaoBusca | null) => void;
  placeholder?: string;
  id?: string;
  permitirCriar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<ClienteOpcaoBusca[]>([]);
  const [pending, startTransition] = useTransition();
  const [criarAberto, setCriarAberto] = useState(false);

  // Busca sob demanda (debounce simples) em vez de carregar todos os
  // clientes de uma vez — usa buscar_clientes_veiculos() (unaccent + placa).
  useEffect(() => {
    if (!open) return;

    const handle = setTimeout(() => {
      startTransition(async () => {
        const resultado = await buscarClientesComVeiculosAction(termo);
        setOpcoes(resultado);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [termo, open]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.nome : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Nome, placa, documento ou telefone..."
              value={termo}
              onValueChange={setTermo}
            />
            <CommandList>
              {pending ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando...
                </div>
              ) : (
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              )}
              <CommandGroup>
                {opcoes.map((cliente) => (
                  <CommandItem
                    key={cliente.id}
                    value={cliente.id}
                    data-checked={value?.id === cliente.id}
                    onSelect={() => {
                      onSelect(cliente);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{cliente.nome}</span>
                      {cliente.veiculo.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {resumoPlacas(cliente)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              {permitirCriar && (
                <CommandGroup>
                  <CommandItem
                    value="__criar__"
                    onSelect={() => {
                      setOpen(false);
                      setCriarAberto(true);
                    }}
                  >
                    <UserPlus className="size-4" />
                    {termo.trim() ? `Cadastrar “${termo.trim()}”` : "Cadastrar novo cliente"}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {permitirCriar && (
        <CriarClienteRapidoDialog
          open={criarAberto}
          onOpenChange={setCriarAberto}
          termoInicial={termo.trim()}
          onCriado={(cliente) => onSelect(cliente)}
        />
      )}
    </>
  );
}
