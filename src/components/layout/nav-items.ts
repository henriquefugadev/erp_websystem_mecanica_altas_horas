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
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
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
    label: "Compras",
    items: [
      { href: "/cotacoes", label: "Cotações", icon: DollarSign },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/compras", label: "Pedidos", icon: ShoppingCart },
      { href: "/funcionarios", label: "Funcionários", icon: UserCog },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
    ],
  },
];
