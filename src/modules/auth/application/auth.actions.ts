"use server";

import { redirect } from "next/navigation";
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
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  redirect("/clientes");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
