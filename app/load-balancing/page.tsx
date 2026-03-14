"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

type LoadBalancingPoolRow = { id: string; name: string; algorithm: string; max_sessions: number };
type LoadBalancingMemberRow = { id: string; pool_id: string; link_id: string; weight: number };

export default function LoadBalancingPage() {
  const qc = useQueryClient();
  const { data: pools = [] } = useQuery<LoadBalancingPoolRow[]>({
    queryKey: ["lb-pools"],
    queryFn: coreFeaturesService.listLoadBalancingPools as () => Promise<LoadBalancingPoolRow[]>,
  });
  const { data: members = [] } = useQuery<LoadBalancingMemberRow[]>({
    queryKey: ["lb-members"],
    queryFn: coreFeaturesService.listLoadBalancingMembers as () => Promise<LoadBalancingMemberRow[]>,
  });

  const removeMutation = useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => coreFeaturesService.remove(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lb-pools"] });
      qc.invalidateQueries({ queryKey: ["lb-members"] });
    },
  });

  return (
    <AppShell title="Load Balancing">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Pools">
          <div className="space-y-2 text-sm">
            {pools.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{p.name} • {p.algorithm} • {p.max_sessions}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "load_balancing_pools", id: p.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
        <FeatureCard title="Pool Members">
          <div className="space-y-2 text-sm">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{m.pool_id} • link {m.link_id} • w={m.weight}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "load_balancing_members", id: m.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
