"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";
import { listEquipment } from "@/services/equipment-service";

export const dynamic = "force-dynamic";

type ConfigBackupRow = { id: string; equipment_id: string; version: string; label: string };
type FirmwareCampaignRow = { id: string; name: string; firmware_version: string; status: string };
type FirmwareCampaignDeviceRow = { campaign_id: string; status: "pending" | "applied" | "failed" | "rolled_back" };

async function postApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "API request failed");
  }
  return response.json();
}

export default function ConfigurationsPage() {
  const qc = useQueryClient();
  const [assignIds, setAssignIds] = useState("");
  const [activeCampaign, setActiveCampaign] = useState<string>("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");

  const { data: backups = [] } = useQuery<ConfigBackupRow[]>({
    queryKey: ["config-backups"],
    queryFn: coreFeaturesService.listConfigBackups as () => Promise<ConfigBackupRow[]>,
  });
  const { data: campaigns = [] } = useQuery<FirmwareCampaignRow[]>({
    queryKey: ["firmware-campaigns"],
    queryFn: coreFeaturesService.listFirmwareCampaigns as () => Promise<FirmwareCampaignRow[]>,
  });
  const { data: campaignDevices = [] } = useQuery<FirmwareCampaignDeviceRow[]>({
    queryKey: ["firmware-campaign-devices"],
    queryFn: coreFeaturesService.listFirmwareCampaignDevices as () => Promise<FirmwareCampaignDeviceRow[]>,
  });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });

  const addBackup = useMutation({
    mutationFn: coreFeaturesService.createConfigBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config-backups"] }),
  });
  const addCampaign = useMutation({
    mutationFn: coreFeaturesService.createFirmwareCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firmware-campaigns"] }),
  });

  const restoreConfig = useMutation({
    mutationFn: ({ backupId }: { backupId: string }) => postApi("/api/configuration/restore", { backup_id: backupId }),
  });

  const assignTargets = useMutation({
    mutationFn: ({ campaignId, equipmentIds }: { campaignId: string; equipmentIds: string[] }) =>
      postApi("/api/firmware/assign", { campaign_id: campaignId, equipment_ids: equipmentIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firmware-campaign-devices"] }),
  });

  const deployCampaign = useMutation({
    mutationFn: ({ campaignId }: { campaignId: string }) => postApi("/api/firmware/deploy", { campaign_id: campaignId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firmware-campaigns"] });
      qc.invalidateQueries({ queryKey: ["firmware-campaign-devices"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  const rollbackCampaign = useMutation({
    mutationFn: ({ campaignId }: { campaignId: string }) => postApi("/api/firmware/rollback", { campaign_id: campaignId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firmware-campaigns"] });
      qc.invalidateQueries({ queryKey: ["firmware-campaign-devices"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  const submit = (fn: (payload: Record<string, unknown>) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  const deviceStats = useMemo(() => {
    const grouped: Record<string, { total: number; pending: number; applied: number; failed: number; rolled_back: number }> = {};
    for (const row of campaignDevices) {
      if (!grouped[row.campaign_id]) grouped[row.campaign_id] = { total: 0, pending: 0, applied: 0, failed: 0, rolled_back: 0 };
      grouped[row.campaign_id].total += 1;
      if (row.status in grouped[row.campaign_id]) grouped[row.campaign_id][row.status as "pending"] += 1;
    }
    return grouped;
  }, [campaignDevices]);

  return (
    <AppShell title="Config Backup / Restore & Firmware Rollout Workflows">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Configuration Backup & Restore">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => addBackup.mutate(p))}>
            <Select name="equipment_id" defaultValue="" required>
              <option value="">Select equipment</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </Select>
            <Input name="version" placeholder="v1" required />
            <Input name="label" placeholder="pre-change" required />
            <Input name="config_blob" placeholder="interface wlan1 ..." required />
            <Button type="submit">Backup Config</Button>
          </form>
          <div className="space-y-2 text-sm">
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{b.equipment_id} • {b.version} • {b.label}</p>
                <Button size="sm" variant="outline" onClick={() => restoreConfig.mutate({ backupId: b.id })}>Restore</Button>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Firmware Campaign Lifecycle">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => addCampaign.mutate(p))}>
            <Input name="name" placeholder="Wave 1 Upgrade" required />
            <Input name="firmware_version" placeholder="8.0.1" required />
            <Input name="target_model" placeholder="Cambium ePMP 3000" />
            <Input name="scheduled_at" type="datetime-local" />
            <Select name="rollout_strategy" defaultValue="rolling">
              <option value="rolling">rolling</option>
              <option value="canary">canary</option>
              <option value="all_at_once">all_at_once</option>
            </Select>
            <Button type="submit">Create Campaign</Button>
          </form>

          <div className="mb-3 rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs text-slate-500">Assign target devices</p>
            <div className="flex gap-2">
              <Select value={activeCampaign} onChange={(e) => setActiveCampaign(e.target.value)}>
                <option value="">Select campaign</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={selectedEquipmentId} onChange={(e) => setSelectedEquipmentId(e.target.value)}>
                <option value="">Select equipment</option>
                {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!selectedEquipmentId) return;
                  const ids = assignIds.split(",").map((v) => v.trim()).filter(Boolean);
                  if (!ids.includes(selectedEquipmentId)) ids.push(selectedEquipmentId);
                  setAssignIds(ids.join(","));
                }}
                disabled={!selectedEquipmentId}
              >
                Add
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  assignTargets.mutate({
                    campaignId: activeCampaign,
                    equipmentIds: assignIds.split(",").map((v) => v.trim()).filter(Boolean),
                  })
                }
                disabled={!activeCampaign || !assignIds.trim()}
              >
                Assign
              </Button>
            </div>
            <Input className="mt-2" value={assignIds} onChange={(e) => setAssignIds(e.target.value)} placeholder="Selected equipment IDs" />
            <p className="mt-2 text-xs text-slate-500">Available equipment: {equipment.length}</p>
          </div>

          <div className="space-y-2 text-sm">
            {campaigns.map((c) => {
              const stats = deviceStats[c.id] ?? { total: 0, pending: 0, applied: 0, failed: 0, rolled_back: 0 };
              return (
                <div key={c.id} className="rounded border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{c.name} • {c.firmware_version} • {c.status}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => deployCampaign.mutate({ campaignId: c.id })}>Deploy</Button>
                      <Button size="sm" variant="outline" onClick={() => rollbackCampaign.mutate({ campaignId: c.id })}>Rollback</Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    targets {stats.total} | pending {stats.pending} | applied {stats.applied} | failed {stats.failed} | rolled back {stats.rolled_back}
                  </p>
                </div>
              );
            })}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
