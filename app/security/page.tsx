"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

export default function SecurityPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["security-policies"], queryFn: coreFeaturesService.listSecurityPolicies });
  const { data: events = [] } = useQuery({ queryKey: ["security-events"], queryFn: coreFeaturesService.listSecurityEvents });
  const { data: tunnels = [] } = useQuery({ queryKey: ["vpn-tunnels"], queryFn: coreFeaturesService.listVpnTunnels });
  const mutation = useMutation({
    mutationFn: coreFeaturesService.createSecurityPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-policies"] }),
  });
  const tunnelMutation = useMutation({
    mutationFn: coreFeaturesService.createVpnTunnel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vpn-tunnels"] }),
  });
  const simulateMutation = useMutation({
    mutationFn: (scenario: string) =>
      fetch("/api/security/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-events"] });
      qc.invalidateQueries({ queryKey: ["vpn-tunnels"] });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    mutation.mutate({
      ...form,
      vpn_enabled: form.vpn_enabled === "true",
      ids_enabled: form.ids_enabled === "true",
      firewall_rules: JSON.parse(String(form.firewall_rules || "[]")),
    });
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Network Security Suite">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Firewall / VPN / IDS Policies">
          <form className="mb-3 grid gap-2 md:grid-cols-2" onSubmit={onSubmit}>
            <Input name="name" placeholder="Default Security Policy" required />
            <Select name="vpn_enabled" defaultValue="true">
              <option value="true">VPN enabled</option>
              <option value="false">VPN disabled</option>
            </Select>
            <Select name="ids_enabled" defaultValue="true">
              <option value="true">IDS enabled</option>
              <option value="false">IDS disabled</option>
            </Select>
            <Input name="firewall_rules" placeholder='[{"allow":"443/tcp"}]' />
            <Button type="submit">Save Policy</Button>
          </form>

          <form
            className="mb-3 grid gap-2 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = Object.fromEntries(new FormData(e.currentTarget).entries());
              tunnelMutation.mutate(form);
              e.currentTarget.reset();
            }}
          >
            <Input name="name" placeholder="West-DC VPN" required />
            <Input name="local_endpoint" placeholder="203.0.113.10" />
            <Input name="remote_endpoint" placeholder="198.51.100.4" />
            <Select name="status" defaultValue="up">
              <option value="up">up</option>
              <option value="degraded">degraded</option>
              <option value="down">down</option>
            </Select>
            <Button type="submit" variant="outline">Add VPN Tunnel</Button>
          </form>

          <div className="space-y-2 text-sm">{data.map((p: any) => <p key={p.id}>{p.name} • VPN {String(p.vpn_enabled)} • IDS {String(p.ids_enabled)}</p>)}</div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">{tunnels.map((t: any) => <p key={t.id}>{t.name} • {t.status} • {t.local_endpoint} → {t.remote_endpoint}</p>)}</div>
        </FeatureCard>

        <FeatureCard title="Security Operations Feed">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => simulateMutation.mutate("firewall_block")}>Simulate Firewall Block</Button>
            <Button size="sm" variant="outline" onClick={() => simulateMutation.mutate("ids_alert")}>Simulate IDS Alert</Button>
            <Button size="sm" variant="outline" onClick={() => simulateMutation.mutate("vpn_down")}>Simulate VPN Down</Button>
            <Button size="sm" variant="outline" onClick={() => simulateMutation.mutate("auth_failure")}>Simulate Auth Failure</Button>
          </div>
          <div className="space-y-2 text-sm">
            {events.slice(0, 50).map((event: any) => (
              <div key={event.id} className="rounded border border-slate-200 p-2">
                {event.event_type} • {event.severity} • {event.message}
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
