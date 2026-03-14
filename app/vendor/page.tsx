"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listEquipment } from "@/services/equipment-service";
import { coreFeaturesService } from "@/services/core-features-service";

type VendorProfile = { id: string; name: string; vendor: string; transport: string; enabled: boolean };
type ProvisioningJob = { id: string; equipment_id: string; vendor: string; mode: string; status: string; created_at: string };
type Capability = { vendor: string; capabilities: string[] };

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "request failed");
  return payload;
}

async function getCapabilities() {
  const res = await fetch("/api/vendor/capabilities");
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error ?? "Unable to fetch capabilities");
  return (payload.data ?? []) as Capability[];
}

export const dynamic = "force-dynamic";

export default function VendorPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string>("");

  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });
  const { data: profiles = [] } = useQuery<VendorProfile[]>({
    queryKey: ["vendor-profiles"],
    queryFn: coreFeaturesService.listVendorDeviceProfiles as () => Promise<VendorProfile[]>,
  });
  const { data: jobs = [] } = useQuery<ProvisioningJob[]>({
    queryKey: ["provisioning-jobs"],
    queryFn: coreFeaturesService.listProvisioningJobs as () => Promise<ProvisioningJob[]>,
  });
  const { data: capabilities = [] } = useQuery({ queryKey: ["vendor-capabilities"], queryFn: getCapabilities });

  const createProfile = useMutation({
    mutationFn: coreFeaturesService.createVendorDeviceProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-profiles"] }),
  });

  const provisionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost("/api/vendor/provision", body),
    onSuccess: (payload) => {
      setMessage(payload?.data?.result?.summary ?? "Provisioning completed");
      qc.invalidateQueries({ queryKey: ["provisioning-jobs"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiPost("/api/vendor/sync", {}),
    onSuccess: (payload) => {
      const synced = Number(payload?.data?.synced ?? 0);
      setMessage(`Vendor sync completed for ${synced} device(s)`);
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  const onProfileSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    createProfile.mutate({ ...form, config_template: {} });
    e.currentTarget.reset();
  };

  const onProvisionSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    const fd = new FormData(e.currentTarget);
    provisionMutation.mutate({
      equipment_id: String(fd.get("equipment_id")),
      profile_id: String(fd.get("profile_id") || "") || null,
      mode: String(fd.get("mode") || "provision"),
      dry_run: fd.get("dry_run") === "true",
      params: {
        channel_width_mhz: Number(fd.get("channel_width_mhz") || 40),
        tx_power_dbm: Number(fd.get("tx_power_dbm") || 20),
        country_code: String(fd.get("country_code") || "US"),
      },
    });
  };

  return (
    <AppShell title="Vendor Integration & Provisioning">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Vendor Profiles (Cambium Line Ready)">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">Run vendor inventory sync to infer adapters and provisioning state.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => syncMutation.mutate()}>
              Sync Inventory
            </Button>
          </div>
          <form className="mb-3 grid gap-2" onSubmit={onProfileSubmit}>
            <Input name="name" placeholder="Cambium ePMP Baseline" required />
            <Select name="vendor" defaultValue="cambium">
              <option value="cambium">cambium</option>
              <option value="mikrotik">mikrotik</option>
              <option value="generic">generic</option>
            </Select>
            <Input name="model_pattern" placeholder="ePMP" />
            <Select name="transport" defaultValue="https">
              <option value="https">https</option>
              <option value="snmp">snmp</option>
              <option value="ssh">ssh</option>
              <option value="api">api</option>
            </Select>
            <Button type="submit">Create Profile</Button>
          </form>

          <div className="space-y-2 text-sm">
            {profiles.map((p) => (
              <div key={p.id} className="rounded border border-slate-200 p-2">
                {p.name} • {p.vendor} • {p.transport} • {p.enabled ? "enabled" : "disabled"}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded border border-slate-200 p-2 text-xs text-slate-600">
            {capabilities.map((c) => (
              <p key={c.vendor}>{c.vendor}: {c.capabilities.join(", ")}</p>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Provision Device">
          <form className="mb-3 grid gap-2" onSubmit={onProvisionSubmit}>
            <Select name="equipment_id" defaultValue="" required>
              <option value="">Select equipment</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} • {eq.model}</option>)}
            </Select>
            <Select name="profile_id" defaultValue="">
              <option value="">Select profile (optional)</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select name="mode" defaultValue="provision">
              <option value="provision">provision</option>
              <option value="backup">backup</option>
              <option value="firmware">firmware</option>
              <option value="diagnostic">diagnostic</option>
            </Select>
            <Input name="country_code" placeholder="US" />
            <Input name="channel_width_mhz" placeholder="40" />
            <Input name="tx_power_dbm" placeholder="20" />
            <Select name="dry_run" defaultValue="false">
              <option value="false">execute</option>
              <option value="true">dry-run</option>
            </Select>
            <Button type="submit">Run</Button>
          </form>
          {message ? <p className="mb-2 text-sm text-emerald-600">{message}</p> : null}

          <div className="space-y-2 text-xs">
            {jobs.slice(0, 30).map((j) => (
              <div key={j.id} className="rounded border border-slate-200 p-2">
                {j.vendor} • {j.mode} • {j.status} • {new Date(j.created_at).toLocaleString()}
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
