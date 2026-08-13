/**
 * Mensagem de erro de campo/formulário. Existia copiada em 12 componentes com
 * exatamente este corpo — agora é um lugar só, o que também dá um ponto único
 * para melhorar acessibilidade (role="alert") sem caçar arquivo por arquivo.
 */
// `string | null` porque as telas guardam o erro em `useState<string | null>`,
// e `string | undefined` porque é o tipo de `errors.campo?.message` do
// react-hook-form. Os dois chegam aqui, e ambos significam "nada a mostrar".
export function Erro({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {msg}
    </p>
  );
}
