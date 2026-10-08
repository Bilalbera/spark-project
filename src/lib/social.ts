import { supabase } from "@/lib/site-client";

export type MiniProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; last_seen: string };

export async function fetchProfiles(ids: string[]) {
  if (!ids.length) return new Map<string, MiniProfile>();
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url, last_seen").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export async function fetchFriends(me: string) {
  const { data } = await supabase.from("friendships").select("user_id, friend_id").or(`user_id.eq.${me},friend_id.eq.${me}`);
  const ids = [...new Set((data ?? []).map((f) => (f.user_id === me ? f.friend_id : f.user_id)))];
  const map = await fetchProfiles(ids);
  return ids.map((id) => map.get(id)).filter(Boolean) as MiniProfile[];
}

export async function openConversation(otherId: string) {
  const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user_id: otherId });
  if (error) throw error;
  return data as string;
}
