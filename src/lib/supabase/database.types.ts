// Tipos manuais espelhando supabase/migrations/0001_init.sql. Quando o
// projeto Supabase real existir, isso pode ser substituído por
// `supabase gen types typescript` — mantendo o mesmo formato `Database`.
// `Relationships: []` e `Views: {}` são exigidos pela forma GenericSchema
// do @supabase/postgrest-js — sem eles a inferência de tipos do client
// (`.from(...)`) quebra silenciosamente para `never`.

export type Papel = "admin" | "gerente";
export type TipoCliente = "PF" | "PJ";
export type AcaoAuditoria = "INSERT" | "UPDATE" | "DELETE";

export type TipoCategoriaFinanceira = "receita" | "despesa";
export type TipoContaFinanceira = "receber" | "pagar";
export type StatusFinanceiro = "aberta" | "parcial" | "liquidada" | "cancelada";
export type FormaPagamento =
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "pix"
  | "boleto";
export type StatusOS = "aguardando" | "em_execucao" | "parado" | "concluido" | "cancelada";

export interface Database {
  public: {
    Tables: {
      workshop: {
        Row: {
          id: string;
          nome: string;
          fuso_horario: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          fuso_horario?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workshop"]["Insert"]>;
        Relationships: [];
      };
      usuario: {
        Row: {
          id: string;
          nome: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["usuario"]["Insert"]>;
        Relationships: [];
      };
      usuario_workshop: {
        Row: {
          usuario_id: string;
          workshop_id: string;
          papel: Papel;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          workshop_id: string;
          papel: Papel;
        };
        Update: Partial<
          Database["public"]["Tables"]["usuario_workshop"]["Insert"]
        >;
        Relationships: [];
      };
      cliente: {
        Row: {
          id: string;
          workshop_id: string;
          tipo: TipoCliente;
          nome: string;
          documento: string;
          telefone: string;
          email: string | null;
          cep: string;
          logradouro: string;
          numero: string;
          complemento: string | null;
          bairro: string;
          cidade: string;
          estado: string;
          origem: string | null;
          notas: string | null;
          consente_email: boolean;
          consente_sms: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          tipo: TipoCliente;
          nome: string;
          documento: string;
          telefone: string;
          email?: string | null;
          cep: string;
          logradouro: string;
          numero: string;
          complemento?: string | null;
          bairro: string;
          cidade: string;
          estado: string;
          origem?: string | null;
          notas?: string | null;
          consente_email?: boolean;
          consente_sms?: boolean;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["cliente"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [];
      };
      veiculo: {
        Row: {
          id: string;
          workshop_id: string;
          cliente_id: string;
          placa: string;
          marca: string | null;
          modelo: string;
          versao: string | null;
          ano: number | null;
          combustivel: string | null;
          cor: string | null;
          chassi: string | null;
          renavam: string | null;
          quilometragem: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          cliente_id: string;
          placa: string;
          marca?: string | null;
          modelo: string;
          versao?: string | null;
          ano?: number | null;
          combustivel?: string | null;
          cor?: string | null;
          chassi?: string | null;
          renavam?: string | null;
          quilometragem?: number | null;
          notas?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["veiculo"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [
          {
            foreignKeyName: "veiculo_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "cliente";
            referencedColumns: ["id"];
          },
        ];
      };
      auditoria: {
        Row: {
          id: string;
          workshop_id: string;
          tabela: string;
          registro_id: string;
          usuario_id: string | null;
          acao: AcaoAuditoria;
          dados_antigos: Record<string, unknown> | null;
          dados_novos: Record<string, unknown> | null;
          instante: string;
        };
        Insert: never; // append-only via trigger, nunca via insert direto
        Update: never;
        Relationships: [];
      };
      categoria_financeira: {
        Row: {
          id: string;
          workshop_id: string;
          tipo: TipoCategoriaFinanceira;
          nome: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          tipo: TipoCategoriaFinanceira;
          nome: string;
          ativo?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["categoria_financeira"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [];
      };
      conta_financeira: {
        Row: {
          id: string;
          workshop_id: string;
          tipo: TipoContaFinanceira;
          descricao: string;
          cliente_id: string | null;
          fornecedor_nome: string | null;
          categoria_id: string;
          valor_total: number;
          data_emissao: string;
          status: StatusFinanceiro;
          observacoes: string | null;
          ordem_servico_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          tipo: TipoContaFinanceira;
          descricao: string;
          cliente_id?: string | null;
          fornecedor_nome?: string | null;
          categoria_id: string;
          valor_total: number;
          data_emissao?: string;
          status?: StatusFinanceiro;
          observacoes?: string | null;
          ordem_servico_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["conta_financeira"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [
          {
            foreignKeyName: "conta_financeira_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "cliente";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conta_financeira_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categoria_financeira";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conta_financeira_ordem_servico_id_fkey";
            columns: ["ordem_servico_id"];
            isOneToOne: false;
            referencedRelation: "ordem_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      parcela_financeira: {
        Row: {
          id: string;
          workshop_id: string;
          conta_id: string;
          numero: number;
          valor: number;
          vencimento: string;
          valor_pago: number;
          desconto: number;
          status: StatusFinanceiro;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          conta_id: string;
          numero: number;
          valor: number;
          vencimento: string;
          valor_pago?: number;
          desconto?: number;
          status?: StatusFinanceiro;
        };
        Update: Partial<Database["public"]["Tables"]["parcela_financeira"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "parcela_financeira_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "conta_financeira";
            referencedColumns: ["id"];
          },
        ];
      };
      pagamento_financeira: {
        Row: {
          id: string;
          workshop_id: string;
          parcela_id: string;
          valor: number;
          desconto: number;
          data_pagamento: string;
          forma_pagamento: FormaPagamento;
          observacoes: string | null;
          estornado: boolean;
          estornado_em: string | null;
          estornado_por: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          parcela_id: string;
          valor: number;
          desconto?: number;
          data_pagamento?: string;
          forma_pagamento: FormaPagamento;
          observacoes?: string | null;
          created_by?: string | null;
        };
        Update: never; // baixa é imutável; estorno é lançamento compensatório via RPC
        Relationships: [
          {
            foreignKeyName: "pagamento_financeira_parcela_id_fkey";
            columns: ["parcela_id"];
            isOneToOne: false;
            referencedRelation: "parcela_financeira";
            referencedColumns: ["id"];
          },
        ];
      };
      ordem_servico: {
        Row: {
          id: string;
          workshop_id: string;
          numero: number;
          cliente_id: string;
          veiculo_id: string;
          queixa: string;
          descricao: string | null;
          tecnico: string | null;
          status: StatusOS;
          galpao: number | null;
          data_abertura: string;
          data_inicio: string | null;
          data_pausa: string | null;
          data_conclusao: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          cliente_id: string;
          veiculo_id: string;
          queixa: string;
          descricao?: string | null;
          tecnico?: string | null;
          status?: StatusOS;
          galpao?: number | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["ordem_servico"]["Insert"] & {
            data_inicio: string | null;
            data_pausa: string | null;
            data_conclusao: string | null;
            deleted_at: string | null;
          }
        >;
        Relationships: [
          {
            foreignKeyName: "ordem_servico_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "cliente";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordem_servico_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      vw_inadimplencia: {
        Row: {
          parcela_id: string;
          workshop_id: string;
          conta_id: string;
          descricao: string;
          cliente_id: string | null;
          cliente_nome: string | null;
          fornecedor_nome: string | null;
          tipo: TipoContaFinanceira;
          numero: number;
          vencimento: string;
          saldo: number;
          dias_atraso: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      buscar_clientes: {
        Args: { p_termo: string };
        Returns: Database["public"]["Tables"]["cliente"]["Row"][];
      };
      criar_conta_financeira: {
        Args: {
          p_workshop_id: string;
          p_tipo: TipoContaFinanceira;
          p_descricao: string;
          p_categoria_id: string;
          p_valor_total: number;
          p_data_emissao: string;
          p_cliente_id: string | null;
          p_fornecedor_nome: string | null;
          p_observacoes: string | null;
          p_created_by: string;
          p_parcelas: { numero: number; valor: number; vencimento: string }[];
          p_ordem_servico_id?: string | null;
        };
        Returns: string;
      };
      registrar_pagamento: {
        Args: {
          p_parcela_id: string;
          p_valor: number;
          p_desconto: number;
          p_data_pagamento: string;
          p_forma_pagamento: FormaPagamento;
          p_observacoes: string | null;
          p_created_by: string;
        };
        Returns: string;
      };
      estornar_pagamento: {
        Args: { p_pagamento_id: string; p_estornado_por: string };
        Returns: void;
      };
      financeiro_fluxo_caixa: {
        Args: { p_de: string; p_ate: string };
        Returns: { dia: string; entradas: number; saidas: number }[];
      };
      financeiro_resumo: {
        Args: { p_de: string; p_ate: string };
        Returns: {
          total_a_receber: number;
          total_a_pagar: number;
          recebido_periodo: number;
          pago_periodo: number;
          total_inadimplente: number;
        }[];
      };
      concluir_ordem_servico: {
        Args: {
          p_ordem_id: string;
          p_itens: { categoria_id: string; valor: number }[] | null;
          p_vencimento: string | null;
          p_created_by: string;
        };
        Returns: string[];
      };
    };
  };
}
