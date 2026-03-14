"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";
import { listEquipment } from "@/services/equipment-service";
import { listSites } from "@/services/sites-service";
import { listSubscribers } from "@/services/subscribers-service";

type MaintenanceTask = { id: string; title: string; status: string };
type Ticket = { id: string; title: string; status: string };

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery<MaintenanceTask[]>({
    queryKey: ["maintenance-tasks"],
    queryFn: coreFeaturesService.listMaintenanceTasks as () => Promise<MaintenanceTask[]>,
  });
  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: coreFeaturesService.listTickets as () => Promise<Ticket[]>,
  });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });
  const { data: predictiveScores = [] } = useQuery({
    queryKey: ["predictive-scores"],
    queryFn: coreFeaturesService.listPredictiveMaintenanceScores as () => Promise<Array<{ id: string; equipment_id: string; risk_score: number; failure_window_hours: number; recommendation: string }>>,
  });

  const createTask = useMutation({
    mutationFn: coreFeaturesService.createMaintenanceTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-tasks"] }),
  });
  const createTicket = useMutation({
    mutationFn: coreFeaturesService.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => coreFeaturesService.update("maintenance_tasks", id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-tasks"] }),
  });
  const removeTask = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("maintenance_tasks", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-tasks"] }),
  });
  const predictiveMutation = useMutation({
    mutationFn: () => fetch("/api/maintenance/predictive", { method: "POST" }).then((res) => res.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["predictive-scores"] }),
  });

  const onTaskSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createTask.mutate(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  const onTicketSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createTicket.mutate(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Maintenance">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Maintenance Tasks">
          <div className="mb-3">
            <Button type="button" variant="outline" onClick={() => predictiveMutation.mutate()}>
              Run Predictive Maintenance Scoring
            </Button>
          </div>
          <form className="mb-3 grid gap-2" onSubmit={onTaskSubmit}>
            <Input name="title" placeholder="Tower inspection" required />
            <Input name="description" placeholder="Quarterly maintenance visit" />
            <Select name="equipment_id" defaultValue="">
              <option value="">Equipment</option>
              {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select name="site_id" defaultValue="">
              <option value="">Site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="scheduled_at" type="datetime-local" />
            <Button type="submit">Create Task</Button>
          </form>

          <div className="space-y-2 text-sm">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{t.title} • {t.status}</p>
                <div className="flex gap-2">
                  <Select defaultValue={t.status} onChange={(e) => updateTask.mutate({ id: t.id, status: e.target.value })}>
                    <option value="scheduled">scheduled</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => removeTask.mutate(t.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Predicted Risk Scores</p>
            {predictiveScores.slice(0, 20).map((score) => (
              <p key={score.id}>
                eq {score.equipment_id.slice(0, 8)} • risk {score.risk_score}/100 • window {score.failure_window_hours}h • {score.recommendation}
              </p>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Maintenance Tickets">
          <form className="mb-3 grid gap-2" onSubmit={onTicketSubmit}>
            <Input name="title" placeholder="Subscriber outage" required />
            <Input name="description" placeholder="No signal in sector B" />
            <Select name="priority" defaultValue="medium">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </Select>
            <Select name="equipment_id" defaultValue="">
              <option value="">Equipment</option>
              {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select name="subscriber_id" defaultValue="">
              <option value="">Subscriber</option>
              {subscribers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Button type="submit">Create Ticket</Button>
          </form>

          <div className="space-y-2 text-sm">
            {tickets.slice(0, 25).map((t) => (
              <div key={t.id} className="rounded border border-slate-200 p-2">
                {t.title} • {t.status}
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
