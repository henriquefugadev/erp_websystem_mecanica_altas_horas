"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { redefinirSenhaAction } from "@/modules/auth/application/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Erro } from "@/components/ui/erro";

const schema = z
  .object({
    senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
    confirmar: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.senha === d.confirmar, {
    message: "As senhas não conferem",
    path: ["confirmar"],
  });

type Input = z.infer<typeof schema>;

export default function RedefinirSenhaPage() {
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema) });

  async function onSubmit(dados: Input) {
    setErro(null);
    // Sucesso redireciona no servidor (redirect); só retorna aqui em caso de erro.
    const resultado = await redefinirSenhaAction({ senha: dados.senha });
    if (!resultado.ok) setErro(resultado.erro);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Nova senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <p className="text-sm text-muted-foreground">Defina a nova senha da sua conta.</p>
            <div className="grid gap-1.5">
              <Label htmlFor="senha" required>
                Nova senha
              </Label>
              <Input id="senha" type="password" {...register("senha")} />
              <Erro msg={errors.senha?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmar" required>
                Confirmar senha
              </Label>
              <Input id="confirmar" type="password" {...register("confirmar")} />
              <Erro msg={errors.confirmar?.message} />
            </div>
            <Erro msg={erro} />
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
