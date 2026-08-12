"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  workshopSchema,
  type WorkshopFormValues,
  type WorkshopInput,
} from "@/lib/validators/workshop.schema";
import {
  atualizarConfiguracaoAction,
  enviarLogoAction,
  removerLogoAction,
} from "@/modules/workshop/application/workshop.actions";
import { normalizarCEP } from "@/lib/validators/contato";
import { buscarEnderecoPorCep } from "@/lib/format/via-cep";
import type { Workshop } from "@/modules/workshop/domain/types";
import type { ParametrosPatio } from "@/modules/workshop/domain/parametros";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Erro } from "@/components/ui/erro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function valoresIniciais(
  workshop: Workshop,
  parametros: ParametrosPatio
): WorkshopFormValues {
  return {
    nome: workshop.nome,
    razaoSocial: workshop.razao_social ?? "",
    cnpj: workshop.cnpj ?? "",
    telefone: workshop.telefone ?? "",
    email: workshop.email ?? "",
    cep: workshop.cep ?? "",
    logradouro: workshop.logradouro ?? "",
    numero: workshop.numero ?? "",
    complemento: workshop.complemento ?? "",
    bairro: workshop.bairro ?? "",
    cidade: workshop.cidade ?? "",
    estado: workshop.estado ?? "",
    condicoesPagamentoPadrao: workshop.condicoes_pagamento_padrao ?? "",
    chavePix: workshop.chave_pix ?? "",
    pixFavorecido: workshop.pix_favorecido ?? "",
    validadeOrcamentoDias: workshop.validade_orcamento_dias,
    markupPecaPercentual: workshop.markup_peca_percentual,
    valorHoraMaoObra: workshop.valor_hora_mao_obra,
    markupHabilitado: workshop.markup_habilitado,
    navOcultos: workshop.nav_ocultos ?? [],
    // Parâmetros do pátio: passam pelo domínio para que a tela mostre os mesmos
    // padrões que o sistema usa quando a coluna vem vazia (ou a migração 0023
    // ainda não rodou) — sem isso o formulário abriria zerado e "salvar"
    // gravaria zero em cima do comportamento atual.
    galpoesQuantidade: parametros.galpoes.length,
    galpaoCapacidade: parametros.capacidadeGalpao,
    galpaoNomes: parametros.nomesGalpao,
    slaAguardandoHoras: parametros.slaAguardandoHoras,
    slaConfirmacaoHoras: parametros.slaConfirmacaoHoras,
    slaExecucaoHoras: parametros.slaExecucaoHoras,
    slaParadoHoras: parametros.slaParadoHoras,
    garantiaMesesPadrao: parametros.garantiaMeses,
    diasOsConcluidaQuadro: parametros.diasOsConcluidaQuadro,
    categoriaPecaId: parametros.categoriaPecaId ?? "",
    categoriaMaoObraId: parametros.categoriaMaoObraId ?? "",
  };
}

const SEM_CATEGORIA = "__auto";

// Itens que a sidebar pode esconder — derivados de NAV_GROUPS para não
// duplicar rótulos. Configurações nunca entra (o admin precisa religar os
// outros a partir daqui).
const ITENS_SIDEBAR = NAV_GROUPS.flatMap((grupo) =>
  grupo.items
    .filter((item) => item.href !== "/configuracoes")
    .map((item) => ({ href: item.href, label: item.label }))
);

export function ConfiguracoesForm({
  workshop,
  logoUrl,
  parametros,
  categoriasReceita,
}: {
  workshop: Workshop;
  logoUrl: string | null;
  parametros: ParametrosPatio;
  categoriasReceita: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<WorkshopFormValues, unknown, WorkshopInput>({
    resolver: zodResolver(workshopSchema),
    defaultValues: valoresIniciais(workshop, parametros),
  });

  const errors = form.formState.errors;
  const cepRegister = form.register("cep");
  const navOcultos = form.watch("navOcultos") ?? [];
  // Quantos campos de nome de galpão mostrar — acompanha o número digitado.
  const quantidadeGalpoes = Math.min(
    Math.max(Number(form.watch("galpoesQuantidade")) || 1, 1),
    12
  );

  function toggleNav(href: string, visivel: boolean) {
    const atuais = form.getValues("navOcultos") ?? [];
    const proximos = visivel
      ? atuais.filter((h) => h !== href)
      : [...atuais, href];
    form.setValue("navOcultos", proximos, { shouldDirty: true });
  }

  async function onSubmit(dados: WorkshopInput) {
    setErro(null);
    const resultado = await atualizarConfiguracaoAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    toast.success("Configurações salvas.");
    router.refresh();
  }

  async function preencherPorCep() {
    const digitos = normalizarCEP(form.getValues("cep") ?? "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(digitos);
    setBuscandoCep(false);
    if (!endereco) return;

    if (!form.getValues("logradouro") && endereco.logradouro) {
      form.setValue("logradouro", endereco.logradouro, { shouldValidate: true });
    }
    if (!form.getValues("bairro") && endereco.bairro) form.setValue("bairro", endereco.bairro);
    if (!form.getValues("cidade") && endereco.cidade) form.setValue("cidade", endereco.cidade);
    if (!form.getValues("estado") && endereco.estado) form.setValue("estado", endereco.estado);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    setEnviandoLogo(true);
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resultado = await enviarLogoAction(formData);
    setEnviandoLogo(false);

    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Logo atualizado.");
    router.refresh();
  }

  async function handleRemoverLogo() {
    if (!workshop.logo_path) return;
    const resultado = await removerLogoAction(workshop.logo_path);
    if (!resultado.ok) {
      toast.error(resultado.erro);
      return;
    }
    toast.success("Logo removido.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da oficina"
              className="h-16 w-16 rounded-md border object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviandoLogo}
              onClick={() => logoInputRef.current?.click()}
            >
              {enviandoLogo ? "Enviando..." : "Enviar logo"}
            </Button>
            {workshop.logo_path && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemoverLogo}>
                Remover
              </Button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nome" required>
                Nome fantasia
              </Label>
              <Input id="nome" {...form.register("nome")} />
              {errors.nome && <Erro msg={errors.nome.message} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input id="razaoSocial" {...form.register("razaoSocial")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" {...form.register("cnpj")} />
                {errors.cnpj && <Erro msg={errors.cnpj.message} />}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" {...form.register("telefone")} />
                {errors.telefone && <Erro msg={errors.telefone.message} />}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {errors.email && <Erro msg={errors.email.message} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  {...cepRegister}
                  onBlur={(e) => {
                    cepRegister.onBlur(e);
                    preencherPorCep();
                  }}
                />
                {errors.cep && <Erro msg={errors.cep.message} />}
                {buscandoCep && (
                  <p className="text-xs text-muted-foreground">Buscando endereço…</p>
                )}
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="logradouro">Endereço</Label>
                <Input id="logradouro" {...form.register("logradouro")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" {...form.register("numero")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" {...form.register("complemento")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" {...form.register("bairro")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" {...form.register("cidade")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="estado">UF</Label>
                <Input id="estado" maxLength={2} {...form.register("estado")} />
                {errors.estado && <Erro msg={errors.estado.message} />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Padrões de orçamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="condicoesPagamentoPadrao">Condições de pagamento padrão</Label>
              <Textarea
                id="condicoesPagamentoPadrao"
                rows={2}
                placeholder="Ex.: 50% de entrada, restante na entrega"
                {...form.register("condicoesPagamentoPadrao")}
              />
            </div>
            <div className="grid max-w-40 gap-1.5">
              <Label htmlFor="validadeOrcamentoDias" required>
                Validade do orçamento (dias)
              </Label>
              <Input
                id="validadeOrcamentoDias"
                type="number"
                min={1}
                {...form.register("validadeOrcamentoDias")}
              />
              {errors.validadeOrcamentoDias && (
                <Erro msg={errors.validadeOrcamentoDias.message} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="chavePix">Chave PIX</Label>
                <Input
                  id="chavePix"
                  placeholder="Ex.: 64996488838"
                  {...form.register("chavePix")}
                />
                <p className="text-xs text-muted-foreground">Aparece no rodapé do PDF da OS.</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pixFavorecido">Favorecido do PIX</Label>
                <Input
                  id="pixFavorecido"
                  placeholder="Ex.: MECÂNICA ALTAS HORAS (NUBANK)"
                  {...form.register("pixFavorecido")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Precificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--action)]"
                {...form.register("markupHabilitado")}
              />
              Habilitar o botão &ldquo;Aplicar markup&rdquo; no orçamento do pátio
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="markupPecaPercentual" required>
                  Markup de peça (%)
                </Label>
                <Input
                  id="markupPecaPercentual"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("markupPecaPercentual")}
                />
                <p className="text-xs text-muted-foreground">
                  Aplicado sobre o custo cotado para sugerir o preço de venda.
                </p>
                {errors.markupPecaPercentual && (
                  <Erro msg={errors.markupPecaPercentual.message} />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="valorHoraMaoObra">Valor da hora de mão de obra (R$)</Label>
                <Input
                  id="valorHoraMaoObra"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("valorHoraMaoObra")}
                />
                {errors.valorHoraMaoObra && <Erro msg={errors.valorHoraMaoObra.message} />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Galpões / baias</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              Quantas baias a oficina tem e quantos carros cabem em cada uma. O quadro do pátio
              usa isso para mostrar a lotação e para sugerir onde colocar o carro ao iniciar
              uma OS.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="galpoesQuantidade" required>
                  Quantidade de galpões
                </Label>
                <Input
                  id="galpoesQuantidade"
                  type="number"
                  min={1}
                  max={12}
                  {...form.register("galpoesQuantidade")}
                />
                <Erro msg={errors.galpoesQuantidade?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="galpaoCapacidade" required>
                  Carros por galpão
                </Label>
                <Input
                  id="galpaoCapacidade"
                  type="number"
                  min={1}
                  max={99}
                  {...form.register("galpaoCapacidade")}
                />
                <Erro msg={errors.galpaoCapacidade?.message} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nome de cada galpão</Label>
              <p className="text-xs text-muted-foreground">
                Opcional. Em branco, aparece como &ldquo;Galpão 1&rdquo;, &ldquo;Galpão 2&rdquo;…
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: quantidadeGalpoes }, (_, i) => (
                  <Input
                    key={i}
                    placeholder={`Galpão ${i + 1}`}
                    aria-label={`Nome do galpão ${i + 1}`}
                    {...form.register(`galpaoNomes.${i}`)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prazos e garantia</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              Passado o prazo sem a OS andar, o card do pátio ganha o aviso de{" "}
              <strong>Atenção</strong>. Serve para nada ficar esquecido — não bloqueia nada.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="slaAguardandoHoras" required>
                  Aguardando (h)
                </Label>
                <Input
                  id="slaAguardandoHoras"
                  type="number"
                  min={1}
                  {...form.register("slaAguardandoHoras")}
                />
                <Erro msg={errors.slaAguardandoHoras?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slaConfirmacaoHoras" required>
                  Confirmação (h)
                </Label>
                <Input
                  id="slaConfirmacaoHoras"
                  type="number"
                  min={1}
                  {...form.register("slaConfirmacaoHoras")}
                />
                <Erro msg={errors.slaConfirmacaoHoras?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slaExecucaoHoras" required>
                  Em execução (h)
                </Label>
                <Input
                  id="slaExecucaoHoras"
                  type="number"
                  min={1}
                  {...form.register("slaExecucaoHoras")}
                />
                <Erro msg={errors.slaExecucaoHoras?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="slaParadoHoras" required>
                  Parado (h)
                </Label>
                <Input
                  id="slaParadoHoras"
                  type="number"
                  min={1}
                  {...form.register("slaParadoHoras")}
                />
                <Erro msg={errors.slaParadoHoras?.message} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="garantiaMesesPadrao" required>
                  Garantia do serviço (meses)
                </Label>
                <Input
                  id="garantiaMesesPadrao"
                  type="number"
                  min={0}
                  max={120}
                  {...form.register("garantiaMesesPadrao")}
                />
                <p className="text-xs text-muted-foreground">
                  Carimbada ao concluir a OS. 0 desliga o aviso de garantia.
                </p>
                <Erro msg={errors.garantiaMesesPadrao?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="diasOsConcluidaQuadro" required>
                  OS concluída fica no quadro (dias)
                </Label>
                <Input
                  id="diasOsConcluidaQuadro"
                  type="number"
                  min={1}
                  max={365}
                  {...form.register("diasOsConcluidaQuadro")}
                />
                <p className="text-xs text-muted-foreground">
                  Depois disso ela só sai da tela do pátio — continua no histórico e no
                  financeiro.
                </p>
                <Erro msg={errors.diasOsConcluidaQuadro?.message} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias da conclusão</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              Ao concluir a OS, cada item vira conta a receber nestas categorias. Deixando em
              &ldquo;Automático&rdquo;, o sistema procura pelo nome (&ldquo;peça&rdquo; e
              &ldquo;mão de obra&rdquo;) — se você renomear a categoria, escolha aqui para não
              cair na categoria errada.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Peças</Label>
                <SelectCategoria
                  valor={form.watch("categoriaPecaId") ?? ""}
                  categorias={categoriasReceita}
                  aoMudar={(v) => form.setValue("categoriaPecaId", v, { shouldDirty: true })}
                  rotulo="Categoria das peças"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Mão de obra / serviços</Label>
                <SelectCategoria
                  valor={form.watch("categoriaMaoObraId") ?? ""}
                  categorias={categoriasReceita}
                  aoMudar={(v) => form.setValue("categoriaMaoObraId", v, { shouldDirty: true })}
                  rotulo="Categoria da mão de obra"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens da barra lateral</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-xs text-muted-foreground">
              Desmarque para esconder o item do menu (o código e as rotas continuam — dá para
              religar quando precisar).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ITENS_SIDEBAR.map((item) => {
                const oculto = navOcultos.includes(item.href);
                return (
                  <label key={item.href} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--action)]"
                      checked={!oculto}
                      onChange={(e) => toggleNav(item.href, e.target.checked)}
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-action text-action-foreground hover:bg-action/90"
          >
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Seletor de categoria financeira com a opção "Automático" (= não configurado,
 * o sistema decide pelo nome). O Select do base-ui não aceita valor "", por
 * isso o sentinela SEM_CATEGORIA vai e volta convertido.
 */
function SelectCategoria({
  valor,
  categorias,
  aoMudar,
  rotulo,
}: {
  valor: string;
  categorias: { id: string; nome: string }[];
  aoMudar: (valor: string) => void;
  rotulo: string;
}) {
  return (
    <Select
      value={valor === "" ? SEM_CATEGORIA : valor}
      onValueChange={(v) => aoMudar(v === SEM_CATEGORIA ? "" : (v ?? ""))}
    >
      <SelectTrigger aria-label={rotulo}>
        <SelectValue>
          {(v: string) =>
            v === SEM_CATEGORIA
              ? "Automático (pelo nome)"
              : (categorias.find((c) => c.id === v)?.nome ?? "Automático (pelo nome)")
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_CATEGORIA}>Automático (pelo nome)</SelectItem>
        {categorias.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
