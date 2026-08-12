import { getSessaoAtual, type SessaoAtual } from "@/lib/supabase/sessao";

/**
 * Retorno padrão de toda server action: sucesso com dados ou erro com mensagem
 * pronta para a tela. Estava declarado idêntico em 13 arquivos de actions —
 * agora vive aqui e os módulos reexportam para não quebrar imports existentes.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string };

export const ERRO_SESSAO = "Sessão expirada. Faça login novamente.";

type Guard =
  | { ok: true; sessao: SessaoAtual }
  | { ok: false; erro: string };

/**
 * Exige usuário autenticado. Substitui o bloco
 * `const sessao = await getSessaoAtual(); if (!sessao) return {...}`
 * repetido em ~30 actions.
 */
export async function exigirSessao(): Promise<Guard> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { ok: false, erro: ERRO_SESSAO };
  return { ok: true, sessao };
}

/**
 * Exige admin (Jadson). Parametrização e configuração são dele; a RLS já
 * bloqueia a escrita no banco, isso barra mais cedo com mensagem clara — um
 * update sem policy afeta 0 linhas e não levanta erro, o que passaria a
 * impressão de "salvou".
 */
export async function exigirAdmin(
  acao = "alterar as configurações"
): Promise<Guard> {
  const guard = await exigirSessao();
  if (!guard.ok) return guard;
  if (guard.sessao.papel !== "admin") {
    return { ok: false, erro: `Só o administrador pode ${acao}.` };
  }
  return guard;
}
