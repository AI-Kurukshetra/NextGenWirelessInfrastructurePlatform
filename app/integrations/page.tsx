"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

type IntegrationRow = {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  last_sync_at: string | null;
};

async function syncIntegration(integrationId: string) {
  const response = await fetch("/api/integrations/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ integration_id: integrationId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Sync failed");
  }
  return response.json();
}

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<IntegrationRow[]>({
    queryKey: ["api-integrations"],
    queryFn: coreFeaturesService.listApiIntegrations as () => Promise<IntegrationRow[]>,
  });
  const mutation = useMutation({
    mutationFn: coreFeaturesService.createApiIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-integrations"] }),
  });

  const syncMutation = useMutation({
    mutationFn: syncIntegration,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-integrations"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      coreFeaturesService.update("api_integrations", id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-integrations"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("api_integrations", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-integrations"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    mutation.mutate({ ...form, enabled: form.enabled === "true" });
    e.currentTarget.reset();
  };

  return (
    <AppShell title="API Integrations">
      <FeatureCard title="Third-Party Integration Endpoints">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Input name="name" placeholder="CRM Sync" required />
          <Input name="provider" placeholder="Salesforce" required />
          <Input name="base_url" placeholder="https://api.example.com" />
          <Input name="api_key_encrypted" placeholder="encrypted-token" />
          <Select name="enabled" defaultValue="true">
            <option value="true">enabled</option>
            <option value="false">disabled</option>
          </Select>
          <Button type="submit">Add Integration</Button>
        </form>
        <div className="space-y-2 text-sm">
          {data.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{i.name} • {i.provider} • {i.enabled ? "on" : "off"} • last sync {i.last_sync_at ? new Date(i.last_sync_at).toLocaleString() : "never"}</p>
              <div className="flex items-center gap-2">
                <Select
                  defaultValue={String(i.enabled)}
                  onChange={(e) => updateMutation.mutate({ id: i.id, enabled: e.target.value === "true" })}
                >
                  <option value="true">enabled</option>
                  <option value="false">disabled</option>
                </Select>
                <Button size="sm" variant="outline" onClick={() => syncMutation.mutate(i.id)}>Sync now</Button>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(i.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
