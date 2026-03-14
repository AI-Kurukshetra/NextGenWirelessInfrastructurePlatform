"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";
import { listSubscribers } from "@/services/subscribers-service";

export const dynamic = "force-dynamic";

type QosProfileRow = { id: string; name: string; priority: number; max_bandwidth_mbps: number };
type SubscriberQosRow = { id: string; subscriber_id: string; qos_profile_id: string };

export default function QosPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery<QosProfileRow[]>({
    queryKey: ["qos-profiles"],
    queryFn: coreFeaturesService.listQosProfiles as () => Promise<QosProfileRow[]>,
  });
  const { data: subscriberQos = [] } = useQuery<SubscriberQosRow[]>({
    queryKey: ["subscriber-qos"],
    queryFn: coreFeaturesService.listSubscriberQos as () => Promise<SubscriberQosRow[]>,
  });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });

  const addProfile = useMutation({
    mutationFn: coreFeaturesService.createQosProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qos-profiles"] }),
  });
  const addAssign = useMutation({
    mutationFn: coreFeaturesService.createSubscriberQos,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriber-qos"] }),
  });
  const removeMutation = useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => coreFeaturesService.remove(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qos-profiles"] });
      qc.invalidateQueries({ queryKey: ["subscriber-qos"] });
    },
  });

  const submit = (fn: (payload: Record<string, unknown>) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="QoS Controls & Bandwidth Throttling">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="QoS Profiles">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => addProfile.mutate(p))}>
            <Input name="name" placeholder="Voice Priority" required />
            <Input name="traffic_class" placeholder="voice" required />
            <Input name="priority" placeholder="1" required />
            <Input name="max_bandwidth_mbps" placeholder="50" required />
            <Input name="min_bandwidth_mbps" placeholder="10" required />
            <Button type="submit">Create</Button>
          </form>
          <div className="space-y-2 text-sm">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{p.name} • prio {p.priority} • max {p.max_bandwidth_mbps}Mbps</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "qos_profiles", id: p.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Assign QoS to Subscriber">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => addAssign.mutate(p))}>
            <Select name="subscriber_id" required defaultValue="">
              <option value="">Select subscriber</option>
              {subscribers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select name="qos_profile_id" required defaultValue="">
              <option value="">Select QoS profile</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Button type="submit">Assign</Button>
          </form>
          <p className="mb-2 text-xs text-slate-500">Assignments: {subscriberQos.length}</p>
          <div className="space-y-2 text-xs">
            {subscriberQos.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{row.subscriber_id} • profile {row.qos_profile_id}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "subscriber_qos", id: row.id })}>Remove</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
