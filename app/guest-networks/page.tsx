"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";
import { listSites } from "@/services/sites-service";

export const dynamic = "force-dynamic";

type GuestNetworkRow = { id: string; name: string; ssid: string; vlan_id: number | null; isolation_enabled: boolean };

export default function GuestNetworksPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<GuestNetworkRow[]>({
    queryKey: ["guest-networks"],
    queryFn: coreFeaturesService.listGuestNetworks as () => Promise<GuestNetworkRow[]>,
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });

  const mutation = useMutation({
    mutationFn: coreFeaturesService.createGuestNetwork,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest-networks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, isolation_enabled }: { id: string; isolation_enabled: boolean }) =>
      coreFeaturesService.update("guest_networks", id, { isolation_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest-networks"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("guest_networks", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest-networks"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    mutation.mutate({ ...form, isolation_enabled: form.isolation_enabled === "true" });
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Guest Network Management">
      <FeatureCard title="Guest SSID & Isolation Controls">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Input name="name" placeholder="Mall Guest WiFi" required />
          <Input name="ssid" placeholder="Guest-Network" required />
          <Select name="site_id" defaultValue="">
            <option value="">Select site (optional)</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input name="vlan_id" placeholder="120" />
          <Input name="passphrase" placeholder="guest-pass" />
          <Select name="isolation_enabled" defaultValue="true">
            <option value="true">Isolation enabled</option>
            <option value="false">Isolation disabled</option>
          </Select>
          <Button type="submit">Create Guest Network</Button>
        </form>
        <div className="space-y-2 text-sm">
          {data.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{g.name} • SSID {g.ssid} • VLAN {g.vlan_id ?? "-"}</p>
              <div className="flex items-center gap-2">
                <Select
                  defaultValue={String(g.isolation_enabled)}
                  onChange={(e) => updateMutation.mutate({ id: g.id, isolation_enabled: e.target.value === "true" })}
                >
                  <option value="true">isolated</option>
                  <option value="false">open</option>
                </Select>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(g.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
