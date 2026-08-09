"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  entrada: unknown
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const dados = entrada as { email?: string; senha?: string };
  if (!dados.email || !dados.senha) {
    return { ok: false, erro: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.email,
    password: dados.senha,
  });

  if (error) {
    console.error("[loginAction] erro do Supabase:", error.status, error.message);
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  redirect("/clientes");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Envia o e-mail de redefinição de senha do Supabase. O link volta para
// /auth/callback, que troca o código pela sessão e leva a /redefinir-senha.
export async function solicitarResetSenhaAction(
  entrada: unknown
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const dados = entrada as { email?: string };
  if (!dados.email) return { ok: false, erro: "Informe o e-mail." };

  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "https";
  const origem = `${protocolo}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(dados.email, {
    redirectTo: `${origem}/auth/callback?next=/redefinir-senha`,
  });

  if (error) {
    console.error("[solicitarResetSenhaAction] erro do Supabase:", error.status, error.message);
    return { ok: false, erro: "Não foi possível enviar o e-mail agora. Tente novamente." };
  }
  return { ok: true };
}

// Define a nova senha do usuário logado pela sessão de recuperação (criada ao
// clicar no link do e-mail). Sem essa sessão, o Supabase recusa.
export async function redefinirSenhaAction(
  entrada: unknown
): Promise<{ ok: false; erro: string }> {
  const dados = entrada as { senha?: string };
  if (!dados.senha || dados.senha.length < 6) {
    return { ok: false, erro: "A senha deve ter ao menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: dados.senha });
  if (error) {
    console.error("[redefinirSenhaAction] erro do Supabase:", error.status, error.message);
    return {
      ok: false,
      erro: "Não foi possível redefinir a senha. Peça um novo link e tente de novo.",
    };
  }

  redirect("/clientes");
}
