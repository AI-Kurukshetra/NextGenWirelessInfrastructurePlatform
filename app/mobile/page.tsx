"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { coreFeaturesService } from "@/services/core-features-service";
import { listEquipment } from "@/services/equipment-service";

type MobileCommandRow = { id: string; command: string; equipment_id: string; status: string };
type PendingCommand = { equipment_id: string; command: string; created_at: string };

const OFFLINE_QUEUE_KEY = "mobile_command_queue_v1";

function readQueue(): PendingCommand[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingCommand[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingCommand[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export const dynamic = "force-dynamic";

export default function MobileControlPage() {
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => (typeof window === "undefined" ? true : window.navigator.onLine));
  const [offlineQueue, setOfflineQueue] = useState<PendingCommand[]>(() => readQueue());
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [selectedCommand, setSelectedCommand] = useState<string>("reboot");

  const { data = [] } = useQuery<MobileCommandRow[]>({
    queryKey: ["mobile-commands"],
    queryFn: coreFeaturesService.listMobileCommands as () => Promise<MobileCommandRow[]>,
  });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });

  const mutation = useMutation({
    mutationFn: coreFeaturesService.createMobileCommand,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile-commands"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("mobile_commands", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile-commands"] }),
  });

  const flushOfflineQueue = useMutation({
    mutationFn: async () => {
      const queue = readQueue();
      for (const item of queue) {
        await coreFeaturesService.createMobileCommand({
          equipment_id: item.equipment_id,
          command: item.command,
          status: "queued",
        });
      }
      writeQueue([]);
    },
    onSuccess: () => {
      setOfflineQueue([]);
      qc.invalidateQueries({ queryKey: ["mobile-commands"] });
    },
  });

  useEffect(() => {
    const syncOnline = () => setIsOnline(window.navigator.onLine);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && readQueue().length) {
      flushOfflineQueue.mutate();
    }
  }, [flushOfflineQueue, isOnline]);

  const commandCount = useMemo(() => data.length + offlineQueue.length, [data.length, offlineQueue.length]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEquipmentId) return;

    if (isOnline) {
      mutation.mutate({ equipment_id: selectedEquipmentId, command: selectedCommand, status: "queued" });
      return;
    }

    const queued: PendingCommand = {
      equipment_id: selectedEquipmentId,
      command: selectedCommand,
      created_at: new Date().toISOString(),
    };
    const next = [...offlineQueue, queued];
    setOfflineQueue(next);
    writeQueue(next);
  };

  return (
    <AppShell title="Field Technician App">
      <div className="mx-auto w-full max-w-md space-y-3">
        <InstallPrompt />

        <div className={`rounded-lg border p-3 text-sm ${isOnline ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {isOnline ? "Online mode" : "Offline mode - commands will sync automatically when connectivity returns"}
        </div>

        <FeatureCard title="Quick Command Dispatch">
          <form className="space-y-2" onSubmit={onSubmit}>
            <Select value={selectedEquipmentId} onChange={(e) => setSelectedEquipmentId(e.target.value)} required>
              <option value="">Select equipment</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} • {eq.model}</option>)}
            </Select>
            <Select value={selectedCommand} onChange={(e) => setSelectedCommand(e.target.value)}>
              <option value="reboot">reboot</option>
              <option value="sync_config">sync_config</option>
              <option value="capture_diagnostics">capture_diagnostics</option>
            </Select>
            <Button className="w-full" type="submit">{isOnline ? "Queue Command" : "Save Offline"}</Button>
          </form>
        </FeatureCard>

        <FeatureCard title={`Command Log (${commandCount})`}>
          <div className="space-y-2 text-sm">
            {offlineQueue.map((c, index) => (
              <div key={`offline-${index}`} className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-700">
                {c.command} • {c.equipment_id} • pending offline sync
              </div>
            ))}
            {data.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{c.command} • {c.equipment_id} • {c.status}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(c.id)}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
