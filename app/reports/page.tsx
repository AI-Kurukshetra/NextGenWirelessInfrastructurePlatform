"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";

type ReportJob = {
  id: string;
  name: string;
  report_type: string;
  cadence: string;
  output_format: string;
  status: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

async function exportReport(type: string, format: "csv" | "json") {
  const response = await fetch(`/api/reports/export?type=${type}&format=${format}`);
  if (!response.ok) throw new Error("Export failed");

  if (format === "json") return response.json();
  const text = await response.text();
  return { data: text };
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string>("");

  const { data: jobs = [] } = useQuery<ReportJob[]>({
    queryKey: ["report-jobs"],
    queryFn: coreFeaturesService.listReportJobs as () => Promise<ReportJob[]>,
  });

  const createJob = useMutation({
    mutationFn: coreFeaturesService.createReportJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-jobs"] }),
  });

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    createJob.mutate({
      name: form.name,
      report_type: form.report_type,
      cadence: form.cadence,
      output_format: form.output_format,
      status: "pending",
      filters: {},
    });
    event.currentTarget.reset();
  };

  return (
    <AppShell title="Reports & Historical Analytics">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Scheduled Reports">
          <form className="mb-3 grid gap-2 md:grid-cols-2" onSubmit={onCreate}>
            <Input name="name" placeholder="Weekly Uptime Summary" required />
            <Select name="report_type" defaultValue="network_health">
              <option value="network_health">network_health</option>
              <option value="subscriber_growth">subscriber_growth</option>
              <option value="incident_summary">incident_summary</option>
              <option value="capacity_planning">capacity_planning</option>
            </Select>
            <Select name="cadence" defaultValue="weekly">
              <option value="manual">manual</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </Select>
            <Select name="output_format" defaultValue="csv">
              <option value="csv">csv</option>
              <option value="json">json</option>
            </Select>
            <Button type="submit">Create Report Job</Button>
          </form>

          <div className="space-y-2 text-sm">
            {jobs.map((job) => (
              <div key={job.id} className="rounded border border-slate-200 p-2">
                {job.name} • {job.report_type} • {job.cadence} • {job.output_format} • {job.status}
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Export On Demand">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await exportReport("network_health", "csv");
                setPreview(String((result as { data: string }).data).slice(0, 1200));
              }}
            >
              Preview Network Health CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = (await exportReport("subscriber_growth", "json")) as { data: unknown };
                setPreview(JSON.stringify(result.data, null, 2).slice(0, 1200));
              }}
            >
              Preview Subscriber JSON
            </Button>
          </div>
          <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-700">{preview || "Run an export preview"}</pre>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
