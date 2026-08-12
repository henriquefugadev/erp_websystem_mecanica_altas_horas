"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  concluirOrdemSchema,
  editarOrdemSchema,
  ordemServicoSchema,
  type OrdemServicoInput,
} from "@/lib/validators/ordem-servico.schema";
import {
  arquivarOrdem,
  atualizarOrdem,
  buscarItensParaConclusao,
  buscarOrdemPorId,
  buscarParcelasReceberDaOs,
  cancelarOrdem,
  concluirOrdem,
  criarOrdem,
  desarquivarOrdem,
  enviarParaConfirmacao,
  iniciarOrdem,
  listarOcupacaoGalpoes,
  marcarClienteAvisado,
  moverGalpao,
  pausarOrdem,
  receberParcelasDaOs,
  retomarOrdem,
  voltarParaAguardando,
  type ItemConclusaoRevisao,
  type ParcelaReceber,
} from "@/modules/patio/data/ordem-servico.repository";
import { receberPagamentoSchema } from "@/lib/validators/financeiro.schema";
import { galpaoMenosOcupado, transicaoPermitida } from "@/modules/patio/domain/status";
import { STATUS_OS_LABEL, type Galpao, type MotivoParada } from "@/modules/patio/domain/types";
import { buscarParametros } from "@/modules/workshop/data/workshop.repository";
import { mensagemDeErro } from "@/modules/financeiro/application/erros";
import { exigirSessao, type ActionResult } from "@/lib/action-result";

export type { ActionResult };

type Client = Awaited<ReturnType<typeof createClient>>;

// Escolhe a baia menos ocupada respeitando a quantidade/capacidade que a
// oficina configurou. Duas consultas leves (parâmetros + galpão/status das OS
// ativas) no lugar do quadro inteiro com todos os embeds.
async function sugerirGalpao(supabase: Client, workshopId: string) {
  const [parametros, ocupacao] = await Promise.all([
    buscarParametros(supabase, workshopId),
    listarOcupacaoGalpoes(supabase),
  ]);
  return galpaoMenosOcupado(ocupacao, parametros.galpoes, parametros.capacidadeGalpao);
}

export async function criarOrdemAction(
  entrada: unknown
): Promise<ActionResult<{ id: string }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = ordemServicoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const ordem = await criarOrdem(supabase, guard.sessao.workshopId, guard.sessao.usuarioId, parsed.data);
    revalidatePath("/patio");
    return { ok: true, data: { id: ordem.id } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível abrir a OS. Tente novamente.") };
  }
}

// Edita queixa, observações e técnico de uma OS existente — a Michele viu algo
// a mais para fazer ou precisa trocar quem está cuidando do carro.
export async function editarOrdemAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = editarOrdemSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    await atualizarOrdem(supabase, id, {
      titulo: parsed.data.titulo ?? "",
      queixa: parsed.data.queixa ?? "",
      descricao: parsed.data.descricao ?? "",
      funcionarioId: parsed.data.funcionarioId ?? "",
    });
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível salvar a OS. Tente novamente.") };
  }
}

export async function iniciarOrdemAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao; lotado: boolean }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível iniciar.`,
      };
    }

    const { galpao, lotado } = await sugerirGalpao(supabase, guard.sessao.workshopId);

    await iniciarOrdem(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: { galpao, lotado } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível iniciar a OS. Tente novamente.") };
  }
}

export async function voltarOrdemAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "aguardando")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível voltar.`,
      };
    }

    await voltarParaAguardando(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível voltar a OS. Tente novamente.") };
  }
}

export async function pausarOrdemAction(
  id: string,
  motivo?: MotivoParada
): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "parado")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível pausar.`,
      };
    }

    await pausarOrdem(supabase, id, motivo);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível pausar a OS. Tente novamente.") };
  }
}

export async function retomarOrdemAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao | null }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível retomar.`,
      };
    }

    await retomarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: { galpao: (ordem.galpao as Galpao) ?? null } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível retomar a OS. Tente novamente.") };
  }
}

// Move a OS para "Esperando Confirmação do Cliente" — enviou o orçamento e
// aguarda o OK. Vem de "aguardando" (antes de começar) ou de "em_execucao"
// (durante o serviço, quando surge algo a aprovar).
export async function enviarConfirmacaoAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "aguardando_confirmacao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível enviar para confirmação.`,
      };
    }

    await enviarParaConfirmacao(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível enviar para confirmação. Tente novamente."),
    };
  }
}

// Cliente aprovou o orçamento: libera a OS para execução. Se ela já tinha
// galpão (veio da execução), retoma na mesma baia; senão, atribui o galpão
// menos ocupado, como um início normal.
export async function confirmarClienteAction(
  id: string
): Promise<ActionResult<{ galpao: Galpao | null }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "em_execucao")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível liberar para execução.`,
      };
    }

    if (ordem.galpao) {
      await retomarOrdem(supabase, id);
      revalidatePath("/patio");
      return { ok: true, data: { galpao: ordem.galpao as Galpao } };
    }

    const { galpao } = await sugerirGalpao(supabase, guard.sessao.workshopId);
    await iniciarOrdem(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: { galpao } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível liberar a OS. Tente novamente."),
    };
  }
}

export async function moverGalpaoAction(
  id: string,
  galpao: Galpao
): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    // A faixa válida agora depende da configuração da oficina (1..N galpões),
    // não mais de uma lista fixa 1|2|3.
    const parametros = await buscarParametros(supabase, guard.sessao.workshopId);
    if (!parametros.galpoes.includes(galpao)) {
      return { ok: false, erro: "Galpão inválido." };
    }

    await moverGalpao(supabase, id, galpao);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível mover a OS. Tente novamente.") };
  }
}

export async function cancelarOrdemAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "cancelada")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível cancelar.`,
      };
    }

    await cancelarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível cancelar a OS. Tente novamente.") };
  }
}

// Arquiva manualmente uma OS concluída — tira do quadro na hora, em vez de
// esperar os N dias da limpeza automática. Não apaga: a OS continua no histórico
// e nos relatórios. Só faz sentido em OS concluída (as outras ainda estão em
// andamento no pátio).
export async function arquivarOrdemAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (ordem.status !== "concluido") {
      return {
        ok: false,
        erro: `Só dá para arquivar uma OS concluída (esta está "${STATUS_OS_LABEL[ordem.status]}").`,
      };
    }

    await arquivarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível arquivar a OS. Tente novamente.") };
  }
}

// Traz de volta ao quadro uma OS arquivada. Alimenta o "Desfazer" do aviso que
// aparece logo depois de arquivar — arquivar some com o card na hora, e sem
// isto um clique errado não teria volta pela interface.
export async function desarquivarOrdemAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await desarquivarOrdem(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível trazer a OS de volta. Tente novamente."),
    };
  }
}

// Carrega o orçamento aprovado da OS (linha a linha) para a Michele revisar
// antes de concluir. Leitura pura — segue o padrão dos outros loaders de dialog.
// Sem sessão, `throw`: a RLS devolveria lista vazia, e o dialog abriria em
// branco como se a OS não tivesse orçamento. Melhor cair no error.tsx.
export async function buscarItensConclusaoAction(
  ordemId: string
): Promise<ItemConclusaoRevisao[]> {
  const guard = await exigirSessao();
  if (!guard.ok) throw new Error(guard.erro);

  const supabase = await createClient();
  return buscarItensParaConclusao(supabase, ordemId);
}

// Parcelas a receber em aberto da OS — o dialog de "Receber pagamento" mostra
// o que o cliente ainda deve.
export async function buscarPagamentoOsAction(ordemId: string): Promise<ParcelaReceber[]> {
  const guard = await exigirSessao();
  if (!guard.ok) throw new Error(guard.erro);

  const supabase = await createClient();
  return buscarParcelasReceberDaOs(supabase, ordemId);
}

// Registra o recebimento quando o cliente busca o carro e paga: quita o saldo
// integral de cada parcela em aberto da OS, com a forma e a data informadas.
export async function receberPagamentoOsAction(
  ordemId: string,
  entrada: unknown
): Promise<ActionResult<{ pagas: number }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = receberPagamentoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    // Uma chamada só: o laço pelas parcelas roda dentro da função do banco
    // (0026), numa transação. Se qualquer parcela recusar o lançamento, nada é
    // gravado — antes, o laço aqui deixava as anteriores pagas e reportava só
    // "não foi possível", sem dizer quais tinham entrado.
    const pagas = await receberParcelasDaOs(supabase, ordemId, guard.sessao.usuarioId, {
      dataPagamento: parsed.data.dataPagamento,
      formaPagamento: parsed.data.formaPagamento,
      observacoes: parsed.data.observacoes || null,
    });

    revalidatePath("/patio");
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { pagas } };
  } catch (e) {
    return {
      ok: false,
      erro: mensagemDeErro(e, "Não foi possível registrar o recebimento. Tente novamente."),
    };
  }
}

export async function concluirOrdemAction(
  id: string,
  entrada: unknown
): Promise<ActionResult<{ contaIds: string[] }>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const parsed = concluirOrdemSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  try {
    const ordem = await buscarOrdemPorId(supabase, id);
    if (!transicaoPermitida(ordem.status, "concluido")) {
      return {
        ok: false,
        erro: `OS está "${STATUS_OS_LABEL[ordem.status]}", não é possível concluir.`,
      };
    }

    const contaIds = await concluirOrdem(supabase, id, guard.sessao.usuarioId, {
      vencimento: parsed.data.vencimento || null,
      itens: parsed.data.itens,
    });

    revalidatePath("/patio");
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro");
    return { ok: true, data: { contaIds } };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível concluir a OS. Tente novamente.") };
  }
}

export async function avisarClienteAction(id: string): Promise<ActionResult<null>> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  try {
    await marcarClienteAvisado(supabase, id);
    revalidatePath("/patio");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, erro: mensagemDeErro(e, "Não foi possível marcar como avisado.") };
  }
}

export type { OrdemServicoInput };
