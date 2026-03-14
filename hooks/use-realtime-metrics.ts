"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function useRealtimeMetrics() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel("metrics-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "performance_metrics" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
          queryClient.invalidateQueries({ queryKey: ["metrics"] });
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alarms" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
          queryClient.invalidateQueries({ queryKey: ["live-events"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "failover_events" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-ops"] });
          queryClient.invalidateQueries({ queryKey: ["live-events"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "equipment_health_snapshots" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["predictive-scores"] });
          queryClient.invalidateQueries({ queryKey: ["metrics"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);
}
