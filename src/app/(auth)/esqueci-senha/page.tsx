"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { solicitarResetSenhaAction } from "@/modules/auth/application/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

type Input = z.infer<typeof schema>;

export default function EsqueciSenhaPage() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema) });

  async function onSubmit(dados: Input) {
    setErro(null);
    const resultado = await solicitarResetSenhaAction(dados);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Recuperar senha</CardTitle>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <div className="grid gap-4 text-sm">
              <p>
                Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique
                a caixa de entrada (e o spam).
              </p>
              <Link href="/login" className="text-muted-foreground hover:underline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="email" required>
                  E-mail
                </Label>
                <Input id="email" type="email" {...register("email")} />
                <Erro msg={errors.email?.message} />
              </div>
              <Erro msg={erro} />
              <Button type="submit" disabled={isSubmitting} className="mt-2">
                Enviar link
              </Button>
              <Link
                href="/login"
                className="text-center text-sm text-muted-foreground hover:underline"
              >
                Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
