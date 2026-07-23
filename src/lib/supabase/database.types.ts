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
export type StatusPedidoCompra = "aberto" | "parcial" | "recebido" | "cancelado";
export type TipoMovimentacaoEstoque =
  | "entrada"
  | "saida_consumo"
  | "devolucao"
  | "perda"
  | "ajuste";
export type StatusOrcamento =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "aprovado_parcial"
  | "recusado"
  | "cancelado";
export type StatusOrcamentoEfetivo = StatusOrcamento | "expirado";
export type TipoItemOrcamento = "peca" | "servico";

export interface Database {
  public: {
    Tables: {
      workshop: {
        Row: {
          id: string;
          nome: string;
          fuso_horario: string;
          razao_social: string | null;
          cnpj: string | null;
          telefone: string | null;
          email: string | null;
          cep: string | null;
          logradouro: string | null;
          numero: string | null;
          complemento: string | null;
          bairro: string | null;
          cidade: string | null;
          estado: string | null;
          condicoes_pagamento_padrao: string | null;
          validade_orcamento_dias: number;
          logo_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          fuso_horario?: string;
          razao_social?: string | null;
          cnpj?: string | null;
          telefone?: string | null;
          email?: string | null;
          cep?: string | null;
          logradouro?: string | null;
          numero?: string | null;
          complemento?: string | null;
          bairro?: string | null;
          cidade?: string | null;
          estado?: string | null;
          condicoes_pagamento_padrao?: string | null;
          validade_orcamento_dias?: number;
          logo_path?: string | null;
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
          bairro: string | null;
          cidade: string | null;
          estado: string | null;
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
          bairro?: string | null;
          cidade?: string | null;
          estado?: string | null;
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
          fornecedor_id: string | null;
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
          fornecedor_id?: string | null;
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
          {
            foreignKeyName: "conta_financeira_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedor";
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
          funcionario_id: string | null;
          status: StatusOS;
          galpao: number | null;
          orcamento_id: string | null;
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
          funcionario_id?: string | null;
          status?: StatusOS;
          galpao?: number | null;
          orcamento_id?: string | null;
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
          {
            foreignKeyName: "ordem_servico_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionario";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamento: {
        Row: {
          id: string;
          workshop_id: string;
          numero: number;
          cliente_id: string;
          veiculo_id: string;
          queixa: string;
          observacoes: string | null;
          condicoes_pagamento: string | null;
          status: StatusOrcamento;
          valor_total: number;
          data_emissao: string;
          validade: string;
          enviado_em: string | null;
          respondido_em: string | null;
          ordem_servico_id: string | null;
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
          observacoes?: string | null;
          condicoes_pagamento?: string | null;
          status?: StatusOrcamento;
          valor_total?: number;
          validade: string;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["orcamento"]["Insert"] & {
            enviado_em: string | null;
            respondido_em: string | null;
            ordem_servico_id: string | null;
            deleted_at: string | null;
          }
        >;
        Relationships: [
          {
            foreignKeyName: "orcamento_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "cliente";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamento_item: {
        Row: {
          id: string;
          workshop_id: string;
          orcamento_id: string;
          peca_id: string | null;
          tipo: TipoItemOrcamento;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
          desconto: number;
          aprovado: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          orcamento_id: string;
          peca_id?: string | null;
          tipo: TipoItemOrcamento;
          descricao: string;
          quantidade?: number;
          preco_unitario: number;
          desconto?: number;
          aprovado?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_item"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "orcamento_item_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "orcamento";
            referencedColumns: ["id"];
          },
        ];
      };
      fornecedor: {
        Row: {
          id: string;
          workshop_id: string;
          nome: string;
          documento: string | null;
          telefone: string | null;
          email: string | null;
          contato_nome: string | null;
          condicoes_pagamento: string | null;
          prazo_entrega_dias: number | null;
          observacoes: string | null;
          ativo: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          nome: string;
          documento?: string | null;
          telefone?: string | null;
          email?: string | null;
          contato_nome?: string | null;
          condicoes_pagamento?: string | null;
          prazo_entrega_dias?: number | null;
          observacoes?: string | null;
          ativo?: boolean;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["fornecedor"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [];
      };
      funcionario: {
        Row: {
          id: string;
          workshop_id: string;
          nome: string;
          funcao: string | null;
          telefone: string | null;
          email: string | null;
          ativo: boolean;
          observacoes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          nome: string;
          funcao?: string | null;
          telefone?: string | null;
          email?: string | null;
          ativo?: boolean;
          observacoes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["funcionario"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [];
      };
      pedido_compra: {
        Row: {
          id: string;
          workshop_id: string;
          numero: number;
          fornecedor_id: string;
          categoria_id: string;
          status: StatusPedidoCompra;
          data_emissao: string;
          previsao_entrega: string | null;
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
          fornecedor_id: string;
          categoria_id: string;
          status?: StatusPedidoCompra;
          data_emissao?: string;
          previsao_entrega?: string | null;
          observacoes?: string | null;
          ordem_servico_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["pedido_compra"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [
          {
            foreignKeyName: "pedido_compra_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedor";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedido_compra_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categoria_financeira";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedido_compra_ordem_servico_id_fkey";
            columns: ["ordem_servico_id"];
            isOneToOne: false;
            referencedRelation: "ordem_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      pedido_compra_item: {
        Row: {
          id: string;
          workshop_id: string;
          pedido_id: string;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
          quantidade_recebida: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          pedido_id: string;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
          quantidade_recebida?: number;
        };
        Update: Partial<Database["public"]["Tables"]["pedido_compra_item"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "pedido_compra_item_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedido_compra";
            referencedColumns: ["id"];
          },
        ];
      };
      recebimento_compra: {
        Row: {
          id: string;
          workshop_id: string;
          pedido_id: string;
          data_recebimento: string;
          observacoes: string | null;
          conta_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          pedido_id: string;
          data_recebimento?: string;
          observacoes?: string | null;
          conta_id?: string | null;
          created_by?: string | null;
        };
        Update: never; // recebimento é imutável, histórico de conferência
        Relationships: [
          {
            foreignKeyName: "recebimento_compra_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedido_compra";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recebimento_compra_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "conta_financeira";
            referencedColumns: ["id"];
          },
        ];
      };
      recebimento_item: {
        Row: {
          id: string;
          workshop_id: string;
          recebimento_id: string;
          pedido_item_id: string;
          quantidade_recebida: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          recebimento_id: string;
          pedido_item_id: string;
          quantidade_recebida: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "recebimento_item_recebimento_id_fkey";
            columns: ["recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimento_compra";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recebimento_item_pedido_item_id_fkey";
            columns: ["pedido_item_id"];
            isOneToOne: false;
            referencedRelation: "pedido_compra_item";
            referencedColumns: ["id"];
          },
        ];
      };
      peca: {
        Row: {
          id: string;
          workshop_id: string;
          sku: string | null;
          nome: string;
          fabricante: string | null;
          aplicacao: string | null;
          unidade: string;
          localizacao: string | null;
          preco_venda: number;
          custo_medio: number;
          estoque_minimo: number;
          estoque_atual: number;
          ativo: boolean;
          observacoes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          sku?: string | null;
          nome: string;
          fabricante?: string | null;
          aplicacao?: string | null;
          unidade?: string;
          localizacao?: string | null;
          preco_venda?: number;
          estoque_minimo?: number;
          ativo?: boolean;
          observacoes?: string | null;
          created_by?: string | null;
        };
        // custo_medio e estoque_atual são derivados do ledger (trigger
        // app.aplicar_movimento_estoque) — a aplicação nunca os grava direto,
        // então ficam fora do Insert/Update expostos ao client.
        Update: Partial<
          Database["public"]["Tables"]["peca"]["Insert"] & {
            deleted_at: string | null;
          }
        >;
        Relationships: [];
      };
      movimentacao_estoque: {
        Row: {
          id: string;
          workshop_id: string;
          peca_id: string;
          tipo: TipoMovimentacaoEstoque;
          quantidade: number;
          custo_unitario: number | null;
          ordem_servico_id: string | null;
          observacao: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_id: string;
          peca_id: string;
          tipo: TipoMovimentacaoEstoque;
          quantidade: number;
          custo_unitario?: number | null;
          ordem_servico_id?: string | null;
          observacao?: string | null;
          created_by?: string | null;
        };
        Update: never; // ledger imutável — só INSERT, nunca UPDATE/DELETE
        Relationships: [
          {
            foreignKeyName: "movimentacao_estoque_peca_id_fkey";
            columns: ["peca_id"];
            isOneToOne: false;
            referencedRelation: "peca";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimentacao_estoque_ordem_servico_id_fkey";
            columns: ["ordem_servico_id"];
            isOneToOne: false;
            referencedRelation: "ordem_servico";
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
      vw_orcamento: {
        Row: {
          id: string;
          workshop_id: string;
          numero: number;
          cliente_id: string;
          veiculo_id: string;
          queixa: string;
          observacoes: string | null;
          condicoes_pagamento: string | null;
          status: StatusOrcamento;
          valor_total: number;
          data_emissao: string;
          validade: string;
          enviado_em: string | null;
          respondido_em: string | null;
          ordem_servico_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          status_efetivo: StatusOrcamentoEfetivo;
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
          p_fornecedor_id?: string | null;
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
      criar_pedido_compra: {
        Args: {
          p_workshop_id: string;
          p_fornecedor_id: string;
          p_categoria_id: string;
          p_data_emissao: string;
          p_previsao_entrega: string | null;
          p_observacoes: string | null;
          p_ordem_servico_id: string | null;
          p_created_by: string;
          p_itens: { descricao: string; quantidade: number; preco_unitario: number }[];
        };
        Returns: string;
      };
      receber_pedido_compra: {
        Args: {
          p_pedido_id: string;
          p_itens: { pedido_item_id: string; quantidade: number }[];
          p_data_recebimento: string;
          p_vencimento: string;
          p_observacoes: string | null;
          p_created_by: string;
        };
        Returns: string;
      };
      consumir_peca_os: {
        Args: {
          p_ordem_id: string;
          p_peca_id: string;
          p_quantidade: number;
          p_created_by: string;
        };
        Returns: string;
      };
      ajustar_estoque: {
        Args: {
          p_peca_id: string;
          p_quantidade_contada: number;
          p_observacao: string | null;
          p_created_by: string;
        };
        Returns: string;
      };
      criar_orcamento: {
        Args: {
          p_workshop_id: string;
          p_cliente_id: string;
          p_veiculo_id: string;
          p_queixa: string;
          p_observacoes: string | null;
          p_condicoes_pagamento: string | null;
          p_validade: string;
          p_itens: {
            tipo: TipoItemOrcamento;
            descricao: string;
            quantidade: number;
            preco_unitario: number;
            desconto?: number;
            peca_id?: string | null;
          }[];
          p_created_by: string;
        };
        Returns: string;
      };
      aprovar_orcamento: {
        Args: {
          p_orcamento_id: string;
          p_itens_aprovados: string[];
          p_created_by: string;
        };
        Returns: string;
      };
    };
  };
}
