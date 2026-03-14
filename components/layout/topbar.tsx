"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";

export function Topbar({ title }: { title: string }) {
  const { supabase, user } = useAuth();
  const { data: profile } = useUserProfile();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">
          {user?.email ?? ""} {profile?.role ? `• ${profile.role}` : ""}
        </p>
      </div>
      <Button variant="outline" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </header>
  );
}
