"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

type FailoverPolicyRow = { id: string; network_id: string; latency_threshold_ms: number; enabled: boolean };
type FailoverEventRow = { id: string; action: string; details: string | null };

async function triggerFailover(policyId: string) {
  const response = await fetch("/api/failover/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ policy_id: policyId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Unable to trigger failover");
  }
  return response.json();
}

export default function FailoverPage() {
  const qc = useQueryClient();
  const { data: policies = [] } = useQuery<FailoverPolicyRow[]>({
    queryKey: ["failover-policies"],
    queryFn: coreFeaturesService.listFailoverPolicies as () => Promise<FailoverPolicyRow[]>,
  });
  const { data: events = [] } = useQuery<FailoverEventRow[]>({
    queryKey: ["failover-events"],
    queryFn: coreFeaturesService.listFailoverEvents as () => Promise<FailoverEventRow[]>,
  });

  const runMutation = useMutation({
    mutationFn: triggerFailover,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["failover-events"] }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => coreFeaturesService.remove(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["failover-policies"] });
      qc.invalidateQueries({ queryKey: ["failover-events"] });
    },
  });

  return (
    <AppShell title="Automated Failover">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Configured Policies">
          <div className="space-y-2 text-sm">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{p.network_id} • threshold {p.latency_threshold_ms}ms • {p.enabled ? "enabled" : "disabled"}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => runMutation.mutate(p.id)}>Run</Button>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "failover_policies", id: p.id })}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>
        <FeatureCard title="Failover Events">
          <div className="space-y-2 text-sm">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{e.action} • {e.details}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "failover_events", id: e.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
