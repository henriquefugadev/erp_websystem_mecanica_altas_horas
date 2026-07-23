import type { Database } from "@/lib/supabase/database.types";

export type Workshop = Database["public"]["Tables"]["workshop"]["Row"];
