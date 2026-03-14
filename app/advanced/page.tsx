"use client";

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";

type AdvancedProfile = { id: string; feature_key: string; name: string; enabled: boolean };
type AdvancedRun = { id: string; feature_key: string; status: string; created_at: string; result: { summary?: string; score?: number } | null };

export const dynamic = "force-dynamic";

export default function AdvancedPage() {
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery<AdvancedProfile[]>({
    queryKey: ["advanced-feature-profiles"],
    queryFn: coreFeaturesService.listAdvancedFeatureProfiles as () => Promise<AdvancedProfile[]>,
  });
  const { data: runs = [] } = useQuery<AdvancedRun[]>({
    queryKey: ["advanced-feature-runs"],
    queryFn: coreFeaturesService.listAdvancedFeatureRuns as () => Promise<AdvancedRun[]>,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => coreFeaturesService.update("advanced_feature_profiles", id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advanced-feature-profiles"] }),
  });

  const runMutation = useMutation({
    mutationFn: coreFeaturesService.createAdvancedFeatureRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advanced-feature-runs"] }),
  });
  const executeMutation = useMutation({
    mutationFn: (runId: string) =>
      fetch("/api/advanced/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      }).then((res) => res.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advanced-feature-runs"] }),
  });

  const onRunSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    runMutation.mutate({
      feature_key: form.feature_key,
      status: "queued",
      input: { params: String(form.params ?? "") },
      result: null,
      started_at: new Date().toISOString(),
    });
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Advanced Features Lab">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Differentiating Features">
          <div className="space-y-2 text-sm">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{profile.name}</p>
                <Select
                  defaultValue={String(profile.enabled)}
                  onChange={(e) => toggleMutation.mutate({ id: profile.id, enabled: e.target.value === "true" })}
                >
                  <option value="true">enabled</option>
                  <option value="false">disabled</option>
                </Select>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Run Simulation">
          <form className="mb-3 grid gap-2" onSubmit={onRunSubmit}>
            <Select name="feature_key" defaultValue="" required>
              <option value="">Select feature</option>
              {profiles.map((p) => <option key={p.id} value={p.feature_key}>{p.name}</option>)}
            </Select>
            <Input name="params" placeholder='{"window":"24h"}' />
            <Button type="submit">Queue Run</Button>
          </form>

          <div className="space-y-2 text-xs">
            {runs.slice(0, 40).map((run) => (
              <div key={run.id} className="rounded border border-slate-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p>{run.feature_key} • {run.status} • {new Date(run.created_at).toLocaleString()}</p>
                  {run.status !== "completed" ? (
                    <Button size="sm" variant="outline" onClick={() => executeMutation.mutate(run.id)}>Execute</Button>
                  ) : null}
                </div>
                {run.result?.summary ? <p className="text-slate-600">result: {run.result.summary} (score {run.result.score ?? "-"})</p> : null}
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
