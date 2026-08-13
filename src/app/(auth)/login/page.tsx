"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginAction } from "@/modules/auth/application/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

type LoginInput = z.infer<typeof loginSchema>;

/**
 * Motivos pelos quais outra tela devolveu a pessoa para cá. Sem isto, os dois
 * casos abaixo terminavam num formulário de login mudo — a pessoa reentrava e
 * era devolvida de novo, sem nunca saber o porquê.
 */
const AVISOS: Record<string, string> = {
  // `/auth/callback` quando o código do e-mail não vale mais.
  link: "Esse link de e-mail expirou ou já foi usado. Peça um novo em “Esqueci a senha”.",
  // Login existe no Auth, mas não está ligado a nenhuma oficina — entrar de
  // novo não resolve, só o administrador resolve (ver DEPLOY-VERCEL.md).
  "sem-oficina":
    "Seu acesso ainda não está vinculado a uma oficina. Peça ao administrador para liberar — entrar de novo não vai adiantar.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const aviso = AVISOS[useSearchParams().get("erro") ?? ""] ?? null;
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(dados: LoginInput) {
    setErro(null);
    const resultado = await loginAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Mecânica Altas Horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aviso && (
            <p
              role="alert"
              className="mb-4 rounded-md bg-alert/10 p-3 text-sm text-alert"
            >
              {aviso}
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email" required>E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
              <Erro msg={errors.email?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senha" required>Senha</Label>
              <Input id="senha" type="password" {...register("senha")} />
              <Erro msg={errors.senha?.message} />
            </div>
            <Erro msg={erro} />
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              Entrar
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            <Link href="/esqueci-senha" className="text-muted-foreground hover:underline">
              Esqueci a senha
            </Link>
            <Link href="/cadastro" className="text-muted-foreground hover:underline">
              Criar cadastro
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
