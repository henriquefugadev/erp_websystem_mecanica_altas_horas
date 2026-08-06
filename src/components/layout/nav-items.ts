import {
  Boxes,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  LayoutGrid,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  /** Identificador estável do grupo — usado como chave para salvar a ordem
   *  personalizada dos botões. Não muda mesmo que a posição do grupo mude. */
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "principal",
    items: [
      { href: "/financeiro", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/orcamentos", label: "Orçamentos", icon: ClipboardList },
      { href: "/patio", label: "Pátio", icon: LayoutGrid },
      { href: "/financeiro/contas", label: "Contas", icon: Receipt },
      { href: "/financeiro/categorias", label: "Categorias", icon: Tags },
      { href: "/estoque", label: "Estoque", icon: Boxes },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    items: [
      { href: "/cotacoes", label: "Cotações", icon: DollarSign },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/compras", label: "Pedidos", icon: ShoppingCart },
      { href: "/funcionarios", label: "Funcionários", icon: UserCog },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
    ],
  },
];
