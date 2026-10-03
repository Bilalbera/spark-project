import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { session, user: session?.user ?? null, loading };
}

export function useAuth() {
  const { session, user, loading } = useSession();

  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      // Fallback: profile row missing (trigger not applied yet) — create it.
      const meta = (user!.user_metadata ?? {}) as Record<string, string | undefined>;
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user!.id,
            email: user!.email ?? null,
            display_name: meta["full_name"] ?? meta["name"] ?? user!.email?.split("@")[0] ?? null,
            avatar_url: meta["avatar_url"] ?? meta["picture"] ?? null,
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (insErr) {
        console.error("Profil oluşturulamadı", insErr);
        return null;
      }
      return created ?? null;
    },
  });

  const roleQuery = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });

  return {
    session,
    user,
    loading: loading || (!!user && (profileQuery.isLoading || roleQuery.isLoading)),
    profile: profileQuery.data ?? null,
    isFounder: (roleQuery.data ?? []).includes("founder"),
  };
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
}
