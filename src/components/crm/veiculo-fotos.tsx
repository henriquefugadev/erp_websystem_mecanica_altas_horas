"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  enviarFotoAction,
  removerFotoAction,
} from "@/modules/crm/application/foto.actions";

type Foto = { nome: string; path: string; url: string };

export function VeiculoFotos({
  clienteId,
  veiculoId,
  fotosIniciais,
}: {
  clienteId: string;
  veiculoId: string;
  fotosIniciais: Foto[];
}) {
  const [fotos, setFotos] = useState(fotosIniciais);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function enviar(arquivo: File) {
    const formData = new FormData();
    formData.set("arquivo", arquivo);

    startTransition(async () => {
      const resultado = await enviarFotoAction(clienteId, veiculoId, formData);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      // A URL assinada só existe após recarregar a listagem; forçamos um
      // refresh simples da página para pegar a lista atualizada do server.
      window.location.reload();
    });
  }

  function remover(path: string) {
    startTransition(async () => {
      const resultado = await removerFotoAction(clienteId, path);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      setFotos((atual) => atual.filter((f) => f.path !== path));
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        {fotos.map((foto) => (
          <div key={foto.path} className="relative size-24 overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e privada por projeto Supabase; sem domínio fixo para configurar em next/image */}
            <img
              src={foto.url}
              alt="Foto do veículo"
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => remover(foto.path)}
              disabled={pending}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
              aria-label="Remover foto"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) enviar(arquivo);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="w-fit"
      >
        Adicionar foto
      </Button>
    </div>
  );
}
