"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NavGroup, NavItem } from "./nav-items";

/**
 * Ordem personalizada dos botões da sidebar.
 *
 * A gerente pode arrastar os itens para deixar os que mais usa no topo.
 * A ordem escolhida é salva no navegador (localStorage), por grupo, e
 * sobrevive a recarregamentos e novas sessões. Itens novos (adicionados
 * numa futura versão do sistema) que ainda não estejam na ordem salva
 * aparecem no fim, na ordem padrão do código.
 */

const STORAGE_KEY = "sidebar-nav-order-v1";

/** groupId -> lista de hrefs na ordem escolhida pelo usuário. */
type OrderMap = Record<string, string[]>;

function lerSalvo(): OrderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OrderMap) : {};
  } catch {
    return {};
  }
}

function salvar(order: OrderMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Sem localStorage (modo privado/quota): a ordem só vale nesta sessão.
  }
}

/** Reordena `items` seguindo a lista de hrefs salva. Itens fora da lista
 *  salva vão para o fim, preservando a ordem original entre eles. */
function ordenar(items: NavItem[], hrefs?: string[]): NavItem[] {
  if (!hrefs?.length) return items;
  const pos = new Map(hrefs.map((href, i) => [href, i]));
  const semOrdem = hrefs.length; // qualquer item novo fica depois dos conhecidos
  // Array.prototype.sort é estável, então itens com a mesma chave mantêm ordem.
  return [...items].sort(
    (a, b) => (pos.get(a.href) ?? semOrdem) - (pos.get(b.href) ?? semOrdem)
  );
}

export function useNavOrder(grupos: NavGroup[]) {
  const [order, setOrder] = useState<OrderMap>({});

  // Carrega a ordem salva só depois de montar, para o HTML do servidor e o
  // primeiro render do cliente baterem (evita erro de hidratação).
  useEffect(() => {
    setOrder(lerSalvo());
  }, []);

  const gruposOrdenados = useMemo(
    () =>
      grupos.map((grupo) => ({
        ...grupo,
        items: ordenar(grupo.items, order[grupo.id]),
      })),
    [grupos, order]
  );

  /** Move o item `fromHref` para a posição do item `toHref`, dentro do grupo. */
  const mover = useCallback(
    (groupId: string, fromHref: string, toHref: string) => {
      if (fromHref === toHref) return;
      setOrder((prev) => {
        const grupo = grupos.find((g) => g.id === groupId);
        if (!grupo) return prev;

        const hrefs = ordenar(grupo.items, prev[groupId]).map((i) => i.href);
        const from = hrefs.indexOf(fromHref);
        const to = hrefs.indexOf(toHref);
        if (from === -1 || to === -1) return prev;

        hrefs.splice(to, 0, hrefs.splice(from, 1)[0]);
        const next = { ...prev, [groupId]: hrefs };
        salvar(next);
        return next;
      });
    },
    [grupos]
  );

  return { gruposOrdenados, mover };
}
