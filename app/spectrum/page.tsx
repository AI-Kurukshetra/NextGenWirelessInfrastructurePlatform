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
import { listEquipment } from "@/services/equipment-service";

export const dynamic = "force-dynamic";

type SpectrumAllocationRow = {
  id: string;
  site_id: string | null;
  equipment_id: string | null;
  frequency_mhz: number;
  bandwidth_mhz: number;
  tx_power_dbm: number | null;
};

export default function SpectrumPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<SpectrumAllocationRow[]>({
    queryKey: ["spectrum"],
    queryFn: coreFeaturesService.listSpectrumAllocations as () => Promise<SpectrumAllocationRow[]>,
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });
  const { data: scans = [] } = useQuery({
    queryKey: ["spectrum-scans"],
    queryFn: coreFeaturesService.listSpectrumScans as () => Promise<Array<{ id: string; frequency_mhz: number; interference_score: number; created_at: string }>>,
  });
  const { data: recommendations = [] } = useQuery({
    queryKey: ["channel-recommendations"],
    queryFn: coreFeaturesService.listChannelRecommendations as () => Promise<Array<{ id: string; current_frequency_mhz: number | null; recommended_frequency_mhz: number; reason: string; status: string }>>,
  });

  const mutation = useMutation({
    mutationFn: coreFeaturesService.createSpectrumAllocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spectrum"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("spectrum_allocations", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spectrum"] }),
  });
  const optimizeMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      fetch("/api/spectrum/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => res.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-recommendations"] });
      qc.invalidateQueries({ queryKey: ["spectrum-scans"] });
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Spectrum Management">
      <FeatureCard title="Frequency Allocation & Interference Controls">
        <form className="mb-4 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Select name="site_id" defaultValue="" required>
            <option value="">Select site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select name="equipment_id" defaultValue="">
            <option value="">Select equipment (optional)</option>
            {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </Select>
          <Input name="frequency_mhz" placeholder="5800" required />
          <Input name="bandwidth_mhz" placeholder="40" required />
          <Input name="tx_power_dbm" placeholder="20" />
          <Input name="noise_floor_dbm" placeholder="-96" />
          <Button type="submit">Allocate</Button>
        </form>
        <div className="mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => optimizeMutation.mutate({})}>
            Run Channel Optimization
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {data.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{s.frequency_mhz}MHz / {s.bandwidth_mhz}MHz • power {s.tx_power_dbm ?? "-"} dBm</p>
              <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(s.id)}>Delete</Button>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Recent Spectrum Scans</p>
          {scans.slice(0, 20).map((scan) => (
            <p key={scan.id}>
              {scan.frequency_mhz}MHz • interference {(scan.interference_score * 100).toFixed(0)}% • {new Date(scan.created_at).toLocaleString()}
            </p>
          ))}
        </div>

        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Channel Recommendations</p>
          {recommendations.slice(0, 20).map((rec) => (
            <p key={rec.id}>
              {rec.current_frequency_mhz ?? "-"} → {rec.recommended_frequency_mhz}MHz • {rec.status} • {rec.reason}
            </p>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
