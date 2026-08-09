import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino do link enviado por e-mail (reset de senha). Troca o `code` (PKCE)
// pela sessão e encaminha para `next` — em geral /redefinir-senha.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/clientes";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link`);
}
