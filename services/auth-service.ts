import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { UserRole } from "@/types";

export async function signUp(email: string, password: string, fullName: string, role: UserRole = "operator") {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw error;
  return data;
}
