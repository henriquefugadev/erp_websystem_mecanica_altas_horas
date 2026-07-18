export function mensagemDeErro(e: unknown, mensagemPadrao: string): string {
  if (e && typeof e === "object") {
    if ("code" in e && e.code === "23505") {
      return "Já existe um registro com esses dados nesta oficina.";
    }
    // RAISE EXCEPTION em plpgsql (registrar_pagamento, criar_conta_financeira,
    // estornar_pagamento) usa código P0001; a mensagem já é redigida para o
    // usuário final, então pode ser exibida diretamente.
    if ("code" in e && e.code === "P0001" && "message" in e && typeof e.message === "string") {
      return e.message;
    }
  }
  return mensagemPadrao;
}
