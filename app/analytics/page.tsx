"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { getAnalyticsSummary, getBusinessOpsMetrics, getLatencyPercentiles, getNetworkUptime, getSubscriberGrowth, getThroughputTrends, getTopProblemDevices } from "@/services/analytics-service";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);

  const { data: throughput = [] } = useQuery({ queryKey: ["analytics-throughput", days], queryFn: () => getThroughputTrends(days) });
  const { data: subscriberGrowth = [] } = useQuery({ queryKey: ["analytics-subscriber-growth", days], queryFn: () => getSubscriberGrowth(days) });
  const { data: uptime = [] } = useQuery({ queryKey: ["analytics-uptime", days], queryFn: () => getNetworkUptime(days) });
  const { data: summary } = useQuery({ queryKey: ["analytics-summary", days], queryFn: () => getAnalyticsSummary(days) });
  const { data: pct } = useQuery({ queryKey: ["analytics-latency-pct", days], queryFn: () => getLatencyPercentiles(days) });
  const { data: problemDevices = [] } = useQuery({ queryKey: ["analytics-problem-devices", days], queryFn: () => getTopProblemDevices(days) });
  const { data: business } = useQuery({ queryKey: ["analytics-business-ops", days], queryFn: () => getBusinessOpsMetrics(Math.max(days, 30)) });

  return (
    <AppShell title="Network Analytics">
      <div className="mb-4 flex gap-2">
        {[7, 14, 30, 90].map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-md px-3 py-1 text-sm ${days === value ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}
            onClick={() => setDays(value)}
          >
            {value}d
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Avg Throughput" value={`${summary?.avgThroughput ?? 0} Mbps`} />
        <MetricCard title="Avg Latency" value={`${summary?.avgLatency ?? 0} ms`} />
        <MetricCard title="Avg Packet Loss" value={`${summary?.avgPacketLoss ?? 0}%`} />
        <MetricCard title="Active Subscribers" value={`${summary?.activeSubscribers ?? 0}`} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <MetricCard title="Latency P50" value={`${pct?.p50 ?? 0} ms`} />
        <MetricCard title="Latency P90" value={`${pct?.p90 ?? 0} ms`} />
        <MetricCard title="Latency P99" value={`${pct?.p99 ?? 0} ms`} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="MRR (USD)" value={`$${business?.monthlyRecurringRevenue ?? 0}`} />
        <MetricCard title="Ticket Resolution" value={`${business?.avgTicketResolutionHours ?? 0}h`} />
        <MetricCard title="Spectrum Efficiency" value={`${business?.spectrumEfficiency ?? 0}%`} />
        <MetricCard title="Coverage / Site" value={`${business?.coverageAreaPerSiteKm2 ?? 0} km²`} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <MetricCard title="Failure Rate" value={`${business?.equipmentFailureRate ?? 0}%`} />
        <MetricCard title="Install Time" value={`${business?.avgInstallTimeHours ?? 0}h`} />
        <MetricCard title="CAC Estimate" value={`$${business?.customerAcquisitionCostEstimate ?? 0}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Throughput Trends">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="throughput" stroke="#0284c7" fill="#7dd3fc" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Subscriber Growth">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={subscriberGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line dataKey="subscribers" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Network Uptime %">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uptime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line dataKey="uptime" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Top Unstable Devices</h3>
        <div className="space-y-2 text-sm">
          {problemDevices.map((d) => (
            <p key={d.equipment_id}>
              {d.equipment_id} • avg latency {d.avg_latency}ms • avg loss {d.avg_packet_loss}% • samples {d.samples}
            </p>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
