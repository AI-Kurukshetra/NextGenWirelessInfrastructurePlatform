"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";
import { listSubscribers } from "@/services/subscribers-service";
import { listSites } from "@/services/sites-service";
import { listServicePlans } from "@/services/service-plans-service";

export const dynamic = "force-dynamic";

type TrafficShapingRow = { id: string; name: string; target_type: string; max_rate_mbps: number };

export default function TrafficShapingPage() {
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<"plan" | "subscriber" | "site">("plan");

  const { data = [] } = useQuery<TrafficShapingRow[]>({
    queryKey: ["traffic-shaping"],
    queryFn: coreFeaturesService.listTrafficShapingPolicies as () => Promise<TrafficShapingRow[]>,
  });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: plans = [] } = useQuery({ queryKey: ["service-plans"], queryFn: listServicePlans });

  const mutation = useMutation({
    mutationFn: coreFeaturesService.createTrafficShapingPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traffic-shaping"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("traffic_shaping_policies", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["traffic-shaping"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const selectedTargetId = String(form.get(`${targetType}_target_id`) ?? "");
    mutation.mutate({
      name: String(form.get("name") ?? ""),
      target_type: targetType,
      target_id: selectedTargetId,
      max_rate_mbps: Number(form.get("max_rate_mbps") ?? 0),
      burst_mbps: Number(form.get("burst_mbps") ?? 0),
      priority: Number(form.get("priority") ?? 5),
    });
    e.currentTarget.reset();
    setTargetType("plan");
  };

  return (
    <AppShell title="Traffic Shaping">
      <FeatureCard title="Advanced Data Flow Policies">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Input name="name" placeholder="Gold Plan Burst" required />
          <Select name="target_type" value={targetType} onChange={(e) => setTargetType(e.target.value as "plan" | "subscriber" | "site")}>
            <option value="plan">plan</option>
            <option value="subscriber">subscriber</option>
            <option value="site">site</option>
          </Select>

          {targetType === "plan" ? (
            <Select name="plan_target_id" required defaultValue="">
              <option value="">Select service plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          ) : null}

          {targetType === "subscriber" ? (
            <Select name="subscriber_target_id" required defaultValue="">
              <option value="">Select subscriber</option>
              {subscribers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          ) : null}

          {targetType === "site" ? (
            <Select name="site_target_id" required defaultValue="">
              <option value="">Select site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          ) : null}

          <Input name="max_rate_mbps" placeholder="200" required />
          <Input name="burst_mbps" placeholder="50" required />
          <Input name="priority" placeholder="2" required />
          <Button type="submit">Create Policy</Button>
        </form>
        <div className="space-y-2 text-sm">
          {data.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{p.name} • {p.target_type} • {p.max_rate_mbps} Mbps</p>
              <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
