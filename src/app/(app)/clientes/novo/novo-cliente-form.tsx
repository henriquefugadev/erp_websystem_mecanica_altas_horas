"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clienteSchema } from "@/lib/validators/cliente.schema";
import { veiculoSchema } from "@/lib/validators/veiculo.schema";
import {
  clienteDefaultValues,
  type ClienteFormOutput,
  type ClienteFormValues,
} from "@/components/crm/cliente-form-schema";
import {
  veiculoDefaultValues,
  type VeiculoFormOutput,
  type VeiculoFormValues,
} from "@/components/crm/veiculo-form-schema";
import { ClienteFields } from "@/components/crm/cliente-fields";
import { VeiculoFields } from "@/components/crm/veiculo-fields";
import { criarClienteAction } from "@/modules/crm/application/cliente.actions";
import { criarVeiculoAction } from "@/modules/crm/application/veiculo.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

const VEICULO_VAZIO_MODELO = "";

export function NovoClienteForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [incluirVeiculo, setIncluirVeiculo] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const clienteForm = useForm<ClienteFormValues, unknown, ClienteFormOutput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: clienteDefaultValues,
  });

  const veiculoForm = useForm<VeiculoFormValues, unknown, VeiculoFormOutput>({
    resolver: zodResolver(veiculoSchema),
    defaultValues: veiculoDefaultValues,
  });

  async function onSubmit() {
    setErro(null);
    setEnviando(true);
    try {
      const clienteValido = await clienteForm.trigger();
      const veiculoPreenchido =
        incluirVeiculo &&
        veiculoForm.getValues("modelo") !== VEICULO_VAZIO_MODELO;
      const veiculoValido = veiculoPreenchido
        ? await veiculoForm.trigger()
        : true;

      if (!clienteValido || !veiculoValido) return;

      const resultadoCliente = await criarClienteAction(
        clienteForm.getValues()
      );
      if (!resultadoCliente.ok) {
        setErro(resultadoCliente.erro);
        return;
      }

      if (veiculoPreenchido) {
        const resultadoVeiculo = await criarVeiculoAction(
          resultadoCliente.data.id,
          veiculoForm.getValues()
        );
        if (!resultadoVeiculo.ok) {
          toast.error(
            `Cliente salvo, mas o veículo não pôde ser salvo: ${resultadoVeiculo.erro}`
          );
        }
      }

      toast.success("Cliente cadastrado.");
      router.push(`/clientes/${resultadoCliente.data.id}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ClienteFields
            register={clienteForm.register}
            errors={clienteForm.formState.errors}
            control={clienteForm.control}
            setValue={clienteForm.setValue}
            getValues={clienteForm.getValues}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Veículo</CardTitle>
          {!incluirVeiculo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIncluirVeiculo(true)}
            >
              Adicionar veículo
            </Button>
          )}
        </CardHeader>
        {incluirVeiculo && (
          <CardContent>
            <VeiculoFields
              register={veiculoForm.register}
              errors={veiculoForm.formState.errors}
            />
          </CardContent>
        )}
      </Card>

      <Erro msg={erro} />

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={enviando}
          className="bg-action text-action-foreground hover:bg-action/90"
        >
          Salvar cliente
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
