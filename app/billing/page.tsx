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

type BillingRecord = { id: string; invoice_number: string; amount: number; status: string; due_date: string };

export const dynamic = "force-dynamic";

export default function BillingPage() {
  const qc = useQueryClient();
  const { data: records = [] } = useQuery<BillingRecord[]>({
    queryKey: ["billing-records"],
    queryFn: coreFeaturesService.listBillingRecords as () => Promise<BillingRecord[]>,
  });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });

  const createMutation = useMutation({
    mutationFn: coreFeaturesService.createBillingRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-records"] }),
  });
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.update("billing_records", id, { status: "paid", paid_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-records"] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("billing_records", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-records"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMutation.mutate(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Billing">
      <FeatureCard title="Billing Records">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Select name="subscriber_id" defaultValue="" required>
            <option value="">Select subscriber</option>
            {subscribers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input name="invoice_number" placeholder="INV-2026-0001" required />
          <Input name="amount" placeholder="49.99" required />
          <Input name="currency" placeholder="USD" />
          <Input name="due_date" type="date" required />
          <Select name="status" defaultValue="due">
            <option value="due">due</option>
            <option value="overdue">overdue</option>
            <option value="paid">paid</option>
            <option value="void">void</option>
          </Select>
          <Button type="submit">Create Invoice</Button>
        </form>

        <div className="space-y-2 text-sm">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{r.invoice_number} • {r.amount} • {r.status} • due {r.due_date}</p>
              <div className="flex gap-2">
                {r.status !== "paid" ? <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(r.id)}>Mark paid</Button> : null}
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(r.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
