import type { Database } from "@/lib/supabase/database.types";

export type Funcionario = Database["public"]["Tables"]["funcionario"]["Row"];
