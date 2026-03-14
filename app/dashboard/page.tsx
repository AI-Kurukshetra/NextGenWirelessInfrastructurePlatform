"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertList } from "@/components/common/alert-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CoverageMap, type CoverageMapPoint } from "@/components/coverage/coverage-map";
import { AppShell } from "@/components/layout/app-shell";
import { useRealtimeMetrics } from "@/hooks/use-realtime-metrics";
import { formatNumber } from "@/lib/utils";
import { listActiveAlerts } from "@/services/alerts-service";
import { coreFeaturesService } from "@/services/core-features-service";
import { getDashboardOpsSummary, getDashboardSummary, getLiveEvents, getRecentMetrics } from "@/services/dashboard-service";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  useRealtimeMetrics();
  const qc = useQueryClient();
  const [liveEventsPage, setLiveEventsPage] = useState(1);
  const liveEventsPageSize = 5;

  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const { data: ops } = useQuery({ queryKey: ["dashboard-ops"], queryFn: getDashboardOpsSummary });
  const { data: metrics = [] } = useQuery({ queryKey: ["metrics"], queryFn: () => getRecentMetrics(24) });
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts"], queryFn: listActiveAlerts });
  const { data: liveEvents = [] } = useQuery({ queryKey: ["live-events"], queryFn: () => getLiveEvents(20) });
  const { data: thresholds = [] } = useQuery({
    queryKey: ["metric-thresholds"],
    queryFn: coreFeaturesService.listMetricThresholds as () => Promise<Array<{ id: string; target_type: string; latency_max: number | null; packet_loss_max: number | null; signal_strength_min: number | null; enabled: boolean }>>,
  });
  const { data: topology } = useQuery({
    queryKey: ["topology"],
    queryFn: async () => {
      const res = await fetch("/api/networks/topology");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Unable to load topology");
      return payload.data as {
        nodes: Array<{ id: string; label: string; type: string; status: string; x: number; y: number; latitude: number | null; longitude: number | null }>;
        links: Array<{ id: string; source_site_id: string; destination_site_id: string; status: string }>;
      };
    },
  });
  const topologyMapPoints = useMemo<CoverageMapPoint[]>(
    () =>
      (topology?.nodes ?? [])
        .filter((node) => node.type === "site" && typeof node.latitude === "number" && typeof node.longitude === "number")
        .map((node) => ({
          id: `topology-${node.id}`,
          label: node.label,
          latitude: Number(node.latitude),
          longitude: Number(node.longitude),
          color: node.status === "online" ? "#0ea5e9" : node.status === "warning" ? "#f97316" : "#64748b",
          markerSize: 6,
        })),
    [topology?.nodes]
  );

  const liveEventsPageCount = Math.max(1, Math.ceil(liveEvents.length / liveEventsPageSize));
  useEffect(() => {
    if (liveEventsPage > liveEventsPageCount) setLiveEventsPage(liveEventsPageCount);
  }, [liveEventsPage, liveEventsPageCount]);

  const pagedLiveEvents = useMemo(() => {
    const start = (liveEventsPage - 1) * liveEventsPageSize;
    return liveEvents.slice(start, start + liveEventsPageSize);
  }, [liveEvents, liveEventsPage]);

  return (
    <AppShell title="Network Dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Network health" value={`${summary?.networkHealth ?? 0}%`} />
        <MetricCard title="Active sites" value={formatNumber(summary?.activeSites ?? 0)} />
        <MetricCard title="Connected subscribers" value={formatNumber(summary?.connectedSubscribers ?? 0)} />
        <MetricCard
          title="Equipment status"
          value={`${summary?.onlineEquipment ?? 0}/${summary?.totalEquipment ?? 0}`}
          subtitle="online / total"
        />
        <MetricCard title="Alert count" value={formatNumber(summary?.alertCount ?? 0)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Throughput (Mbps)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="throughput" stroke="#0284c7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Latency (ms)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Packet Loss (%)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="packetLoss" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AlertList alarms={alerts} pageSize={5} />
        <Card>
          <CardHeader>
            <CardTitle>Live Operations Feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pagedLiveEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-slate-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant={event.severity === "critical" || event.severity === "high" ? "danger" : "info"}>
                    {event.type}
                  </Badge>
                  <span className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700">{event.message}</p>
              </div>
            ))}
            {liveEvents.length > liveEventsPageSize ? (
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setLiveEventsPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span className="text-xs text-slate-500">
                  Page {liveEventsPage} / {liveEventsPageCount}
                </span>
                <Button variant="outline" size="sm" onClick={() => setLiveEventsPage((p) => Math.min(liveEventsPageCount, p + 1))}>
                  Next
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Managed networks" value={formatNumber(ops?.totalNetworks ?? 0)} />
        <MetricCard
          title="P2P link health"
          value={`${ops?.p2pLinksUp ?? 0}/${ops?.p2pLinksTotal ?? 0}`}
          subtitle="up / total"
        />
        <MetricCard title="Failovers (24h)" value={formatNumber(ops?.failoverEvents24h ?? 0)} />
        <MetricCard title="Firmware compliance" value={`${ops?.firmwareCompliance ?? 0}%`} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Topology Control View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topologyMapPoints.length > 0 ? (
            <div>
              <CoverageMap points={topologyMapPoints} />
              <p className="mt-2 text-xs text-slate-500">Site topology map (geographic view)</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">No geo-mapped site coordinates available yet. Showing logical topology view.</p>
              <svg viewBox="0 0 860 360" className="h-72 w-full rounded bg-slate-50">
                {(topology?.links ?? []).map((link) => {
                  const source = topology?.nodes.find((node) => node.id === link.source_site_id);
                  const target = topology?.nodes.find((node) => node.id === link.destination_site_id);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={link.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={link.status === "up" ? "#16a34a" : link.status === "degraded" ? "#eab308" : "#dc2626"}
                      strokeWidth={2}
                    />
                  );
                })}
                {(topology?.nodes ?? []).map((node) => (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r={12} fill={node.status === "online" ? "#0ea5e9" : node.status === "warning" ? "#f97316" : "#64748b"} />
                    <text x={node.x + 16} y={node.y + 4} className="fill-slate-700 text-[11px]">{node.label}</text>
                  </g>
                ))}
              </svg>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Realtime Threshold Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="mb-3 grid gap-2 md:grid-cols-3"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = Object.fromEntries(new FormData(event.currentTarget).entries());
              await coreFeaturesService.createMetricThreshold({
                target_type: form.target_type,
                latency_max: form.latency_max || null,
                packet_loss_max: form.packet_loss_max || null,
                signal_strength_min: form.signal_strength_min || null,
                enabled: true,
              });
              qc.invalidateQueries({ queryKey: ["metric-thresholds"] });
              event.currentTarget.reset();
            }}
          >
            <Select name="target_type" defaultValue="organization">
              <option value="organization">organization</option>
              <option value="site">site</option>
              <option value="equipment">equipment</option>
            </Select>
            <Input name="latency_max" placeholder="120" />
            <Input name="packet_loss_max" placeholder="3" />
            <Input name="signal_strength_min" placeholder="-75" />
            <Button type="submit">Add Threshold Policy</Button>
          </form>
          <div className="space-y-2 text-xs text-slate-600">
            {thresholds.map((threshold) => (
              <p key={threshold.id}>
                {threshold.target_type} • latency &lt;= {threshold.latency_max ?? "-"} • loss &lt;= {threshold.packet_loss_max ?? "-"} • signal &gt;= {threshold.signal_strength_min ?? "-"} • {threshold.enabled ? "enabled" : "disabled"}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
