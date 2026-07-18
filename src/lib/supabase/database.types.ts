// Tipos manuais espelhando supabase/migrations/0001_init.sql. Quando o
// projeto Supabase real existir, isso pode ser substituído por
// `supabase gen types typescript` — mantendo o mesmo formato `Database`.
// `Relationships: []` e `Views: {}` são exigidos pela forma GenericSchema
// do @supabase/postgrest-js — sem eles a inferência de tipos do client
// (`.from(...)`) quebra silenciosamente para `never`.

export type Papel = "admin" | "gerente";
export type TipoCliente = "PF" | "PJ";
export type AcaoAuditoria = "INSERT" | "UPDATE" | "DELETE";

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
    };
    Views: Record<string, never>;
    Functions: {
      buscar_clientes: {
        Args: { p_termo: string };
        Returns: Database["public"]["Tables"]["cliente"]["Row"][];
      };
    };
  };
}
