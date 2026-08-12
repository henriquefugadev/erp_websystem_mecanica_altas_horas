/**
 * Mensagem de erro de campo/formulário. Existia copiada em 12 componentes com
 * exatamente este corpo — agora é um lugar só, o que também dá um ponto único
 * para melhorar acessibilidade (role="alert") sem caçar arquivo por arquivo.
 */
export function Erro({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {msg}
    </p>
  );
}
