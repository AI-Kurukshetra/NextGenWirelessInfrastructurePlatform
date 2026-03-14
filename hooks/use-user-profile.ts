"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { AppRole } from "@/lib/permissions";

export function useUserProfile() {
  return useQuery<{ role: AppRole | null; fullName: string | null }>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return { role: null, fullName: null };

      const { data, error } = await supabase.from("users").select("role,full_name").eq("id", user.id).maybeSingle();
      if (error) throw error;

      return {
        role: (data?.role as AppRole | undefined) ?? null,
        fullName: data?.full_name ?? null,
      };
    },
  });
}
