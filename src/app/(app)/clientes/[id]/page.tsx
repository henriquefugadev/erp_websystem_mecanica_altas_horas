import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessaoAtual } from "@/lib/supabase/sessao";
import { buscarClientePorId } from "@/modules/crm/data/cliente.repository";
import { listarFotos } from "@/modules/crm/data/foto.repository";
import { buscarHistoricoDoCliente } from "@/modules/patio/data/ordem-servico.repository";
import { HistoricoOsCliente } from "@/components/crm/historico-os";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VeiculoFotos } from "@/components/crm/veiculo-fotos";
import { formatarCEP, formatarDocumento, formatarPlaca, formatarTelefone } from "@/lib/format";
import { ExcluirClienteButton } from "./excluir-cliente-button";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await getSessaoAtual();
  if (!sessao) notFound();

  const supabase = await createClient();
  let cliente;
  try {
    cliente = await buscarClientePorId(supabase, id);
  } catch {
    notFound();
  }

  const veiculosComFotos = await Promise.all(
    cliente.veiculo.map(async (veiculo) => ({
      veiculo,
      fotos: await listarFotos(supabase, sessao.workshopId, veiculo.id),
    }))
  );

  const historico = await buscarHistoricoDoCliente(supabase, cliente.id);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">{cliente.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {cliente.tipo === "PF" ? "Pessoa física" : "Pessoa jurídica"}
            {cliente.documento ? ` · ${formatarDocumento(cliente.documento)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/clientes/${cliente.id}/editar`}
            className={buttonVariants({ variant: "outline" })}
          >
            Editar
          </Link>
          <ExcluirClienteButton clienteId={cliente.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Contato e endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Campo rotulo="Telefone" valor={formatarTelefone(cliente.telefone)} />
          <Campo rotulo="E-mail" valor={cliente.email ?? "—"} />
          <Campo
            rotulo="Endereço"
            valor={
              cliente.logradouro
                ? `${cliente.logradouro}, ${cliente.numero ?? "s/n"}${
                    cliente.complemento ? ` - ${cliente.complemento}` : ""
                  }`
                : "—"
            }
          />
          <Campo rotulo="Bairro" valor={cliente.bairro ?? "—"} />
          <Campo
            rotulo="Cidade/UF"
            valor={
              cliente.cidade || cliente.estado
                ? `${cliente.cidade ?? "—"}/${cliente.estado ?? "—"}`
                : "—"
            }
          />
          <Campo rotulo="CEP" valor={cliente.cep ? formatarCEP(cliente.cep) : "—"} />
        </CardContent>
      </Card>

      {cliente.notas && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Notas internas</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">
            {cliente.notas}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg">Veículos</h2>
      </div>

      {veiculosComFotos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum veículo cadastrado para este cliente.
        </p>
      )}

      {veiculosComFotos.map(({ veiculo, fotos }) => (
        <Card key={veiculo.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg">
                {veiculo.modelo}
              </CardTitle>
              <Badge variant="outline" className="mt-1">
                {formatarPlaca(veiculo.placa)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <Campo rotulo="Marca" valor={veiculo.marca ?? "—"} />
              <Campo rotulo="Ano" valor={veiculo.ano?.toString() ?? "—"} />
              <Campo rotulo="Cor" valor={veiculo.cor ?? "—"} />
              <Campo
                rotulo="Km"
                valor={veiculo.quilometragem?.toLocaleString("pt-BR") ?? "—"}
              />
            </div>
            <VeiculoFotos
              clienteId={cliente.id}
              veiculoId={veiculo.id}
              fotosIniciais={fotos}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg">Histórico de serviços</h2>
      </div>
      <HistoricoOsCliente historico={historico} />
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p>{valor}</p>
    </div>
  );
}
