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
            As contas de acesso são criadas pelo <strong>administrador da oficina</strong>. Não há
            cadastro aberto: controlar quem entra e quem altera dado é o motivo deste sistema
            existir.
          </p>
          <p className="text-muted-foreground">
            Precisa de acesso? Peça ao responsável para liberar o seu e-mail. Você recebe uma senha
            e pode trocá-la depois em &ldquo;Esqueci a senha&rdquo;.
          </p>
          <p className="text-muted-foreground">
            O cadastro em <strong>Funcionários</strong> é outra coisa: registra quem trabalha na
            oficina (para atribuir OS), não cria login.
          </p>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
