"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Adia a criação de um dialog até o primeiro clique.
 *
 * O portal do base-ui já não renderiza o CONTEÚDO do dialog enquanto ele está
 * fechado, mas o componente do dialog em si roda: seus `useForm`, `useState` e
 * `useEffect` são criados de qualquer jeito. Num card só isso é irrelevante;
 * no quadro do pátio, com uma dezena de OS na tela e três ou quatro dialogs por
 * card, vira um punhado de formulários que ninguém abriu.
 *
 * Enquanto fechado, aparece só o botão. Ao clicar, o dialog é montado já aberto
 * — e ao fechar, é desmontado de novo (mesmo comportamento que o dialog de
 * orçamento já usava; isto aqui só tira a duplicação).
 *
 * As props do botão são as do próprio Button, para o gatilho ficar idêntico ao
 * DialogTrigger que ele substitui.
 */
export function MontarAoAbrir({
  rotulo,
  children,
  ...botao
}: Omit<ComponentProps<typeof Button>, "children" | "onClick"> & {
  /** Conteúdo do botão (texto, ícone, ou os dois). */
  rotulo: ReactNode;
  /** Recebe as props controladas para repassar ao dialog. */
  children: (controle: {
    open: boolean;
    onOpenChange: (aberto: boolean) => void;
  }) => ReactNode;
}) {
  const [montado, setMontado] = useState(false);

  if (!montado) {
    return (
      <Button {...botao} onClick={() => setMontado(true)}>
        {rotulo}
      </Button>
    );
  }

  return (
    <>
      {children({
        open: true,
        onOpenChange: (aberto) => {
          if (!aberto) setMontado(false);
        },
      })}
    </>
  );
}
