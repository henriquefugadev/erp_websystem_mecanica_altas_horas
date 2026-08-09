import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Cadastro é feito pelo administrador (controle de acesso é o motivo do sistema
// existir), então esta tela orienta em vez de abrir signup público.
export default function CadastroPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Criar cadastro</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <p>
            As contas de acesso são criadas pelo administrador da oficina, em{" "}
            <strong>Funcionários</strong>. Isso mantém o controle de quem pode ver e alterar os
            dados.
          </p>
          <p className="text-muted-foreground">
            Precisa de acesso? Peça ao responsável (administrador) para cadastrar o seu e-mail. Você
            receberá uma senha e poderá trocá-la depois em &ldquo;Esqueci a senha&rdquo;.
          </p>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
