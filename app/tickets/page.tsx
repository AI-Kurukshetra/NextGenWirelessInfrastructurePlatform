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
import { listSubscribers } from "@/services/subscribers-service";

type Ticket = { id: string; title: string; status: string; priority: string };

export const dynamic = "force-dynamic";

export default function TicketsPage() {
  const qc = useQueryClient();
  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: coreFeaturesService.listTickets as () => Promise<Ticket[]>,
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });

  const createMutation = useMutation({
    mutationFn: coreFeaturesService.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => coreFeaturesService.update("tickets", id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("tickets", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    createMutation.mutate(form);
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Tickets">
      <FeatureCard title="Support & Operations Tickets">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Input name="title" placeholder="Backhaul packet drops" required />
          <Input name="description" placeholder="Observed high packet loss at night" />
          <Select name="priority" defaultValue="medium">
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </Select>
          <Select name="site_id" defaultValue="">
            <option value="">Site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          {tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{t.title} • {t.priority}</p>
              <div className="flex gap-2">
                <Select defaultValue={t.status} onChange={(e) => updateMutation.mutate({ id: t.id, status: e.target.value })}>
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </Select>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(t.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
