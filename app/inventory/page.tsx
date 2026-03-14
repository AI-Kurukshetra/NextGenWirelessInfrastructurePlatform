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

type InventoryItem = { id: string; name: string; category: string; status: string; quantity: number; site_id: string | null };

export const dynamic = "force-dynamic";

export default function InventoryPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items"],
    queryFn: coreFeaturesService.listInventoryItems as () => Promise<InventoryItem[]>,
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });

  const createMutation = useMutation({
    mutationFn: coreFeaturesService.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => coreFeaturesService.update("inventory_items", id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("inventory_items", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-items"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    createMutation.mutate(form);
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Inventory Management">
      <FeatureCard title="Inventory">
        <form className="mb-3 grid gap-2 md:grid-cols-4" onSubmit={onSubmit}>
          <Input name="name" placeholder="ePMP 3000 Radio" required />
          <Input name="category" placeholder="radio" required />
          <Input name="vendor" placeholder="Cambium" />
          <Input name="model" placeholder="ePMP 3000" />
          <Input name="serial_number" placeholder="SN-123" />
          <Input name="quantity" placeholder="5" required />
          <Select name="status" defaultValue="in_stock">
            <option value="in_stock">in_stock</option>
            <option value="allocated">allocated</option>
            <option value="maintenance">maintenance</option>
            <option value="retired">retired</option>
          </Select>
          <Select name="site_id" defaultValue="">
            <option value="">Select site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button type="submit">Add Item</Button>
        </form>

        <div className="space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{item.name} • qty {item.quantity} • {item.status}</p>
              <div className="flex gap-2">
                <Select defaultValue={item.status} onChange={(e) => updateMutation.mutate({ id: item.id, status: e.target.value })}>
                  <option value="in_stock">in_stock</option>
                  <option value="allocated">allocated</option>
                  <option value="maintenance">maintenance</option>
                  <option value="retired">retired</option>
                </Select>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(item.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
