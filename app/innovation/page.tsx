"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type BacklogItem = {
  id: string;
  name: string;
  category: string;
  maturity: string;
  impact_score: number;
  effort_score: number;
};

type Pilot = {
  id: string;
  backlog_id: string;
  status: string;
  hypothesis: string | null;
};

async function getInnovation() {
  const res = await fetch("/api/innovation");
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error ?? "Unable to load innovation backlog");
  return payload.data as { backlog: BacklogItem[]; pilots: Pilot[] };
}

async function createInnovation(payload: Record<string, unknown>) {
  const res = await fetch("/api/innovation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Unable to save innovation item");
  return body.data;
}

export const dynamic = "force-dynamic";

export default function InnovationPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["innovation"], queryFn: getInnovation });

  const mutation = useMutation({
    mutationFn: createInnovation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["innovation"] }),
  });

  const backlog = data?.backlog ?? [];
  const pilots = data?.pilots ?? [];

  const onBacklogSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    mutation.mutate({ kind: "backlog", name: form.name, category: form.category, notes: form.notes });
    event.currentTarget.reset();
  };

  const onPilotSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    mutation.mutate({ kind: "pilot", backlog_id: form.backlog_id, hypothesis: form.hypothesis });
    event.currentTarget.reset();
  };

  return (
    <AppShell title="Innovation Backlog & Pilots">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Innovation Backlog">
          <form className="mb-3 grid gap-2" onSubmit={onBacklogSubmit}>
            <Input name="name" placeholder="Satellite-terrestrial hybrid failover" required />
            <Select name="category" defaultValue="resilience">
              <option value="resilience">resilience</option>
              <option value="automation">automation</option>
              <option value="new_revenue">new_revenue</option>
              <option value="technician_experience">technician_experience</option>
            </Select>
            <Input name="notes" placeholder="Outcome and assumptions" />
            <Button type="submit">Add Idea</Button>
          </form>

          <div className="space-y-2 text-sm">
            {backlog.map((item) => (
              <div key={item.id} className="rounded border border-slate-200 p-2">
                {item.name} • {item.category} • {item.maturity} • impact {item.impact_score}/5 • effort {item.effort_score}/5
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Pilot Experiments">
          <form className="mb-3 grid gap-2" onSubmit={onPilotSubmit}>
            <Select name="backlog_id" defaultValue="" required>
              <option value="">Select backlog item</option>
              {backlog.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
            <Input name="hypothesis" placeholder="If we auto-switch links, downtime drops by 20%" />
            <Button type="submit">Create Pilot</Button>
          </form>

          <div className="space-y-2 text-sm">
            {pilots.map((pilot) => (
              <div key={pilot.id} className="rounded border border-slate-200 p-2">
                backlog {pilot.backlog_id.slice(0, 8)} • {pilot.status} • {pilot.hypothesis ?? "-"}
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
