import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as generatedClient } from "@/integrations/supabase/client";
import type { Database } from "./site-database.types";

// Keep the existing external site's schema distinct from the newly provisioned Cloud schema.
// This reuses the same client, session and RLS enforcement; no connection or data migration.
export const supabase = generatedClient as unknown as SupabaseClient<Database>;
