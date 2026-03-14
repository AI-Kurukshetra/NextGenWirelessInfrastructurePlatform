"use client";

import { FormEvent, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CoverageMap, type CoverageMapPoint } from "@/components/coverage/coverage-map";
import { coreFeaturesService } from "@/services/core-features-service";
import { listSites } from "@/services/sites-service";

type CoverageZoneRow = { id: string; name: string; radius_km: number | null; site_id: string | null; geojson: unknown };
type RfModelRow = { id: string; name: string; site_id: string; frequency_mhz: number; predicted_radius_km: number };
type MeasurementRow = { id: string; site_id: string | null; latitude: number; longitude: number; signal_strength: number; collected_at: string };
type PredictionRow = { id: string; model_id: string; prediction_name: string; confidence: number; recommended_radius_km: number; recommended_geojson: unknown };

export const dynamic = "force-dynamic";

function extractPointFromGeoJson(value: unknown): { lat: number; lon: number } | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as { type?: string; coordinates?: unknown };
  if (obj.type !== "Point" || !Array.isArray(obj.coordinates) || obj.coordinates.length < 2) return null;
  const [lon, lat] = obj.coordinates as [number, number];
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

export default function CoveragePage() {
  const qc = useQueryClient();

  const { data: zones = [] } = useQuery<CoverageZoneRow[]>({
    queryKey: ["coverage-zones"],
    queryFn: coreFeaturesService.listCoverageZones as () => Promise<CoverageZoneRow[]>,
  });
  const { data: models = [] } = useQuery<RfModelRow[]>({
    queryKey: ["rf-models"],
    queryFn: coreFeaturesService.listRfPropagationModels as () => Promise<RfModelRow[]>,
  });
  const { data: measurements = [] } = useQuery<MeasurementRow[]>({
    queryKey: ["coverage-measurements"],
    queryFn: coreFeaturesService.listCoverageMeasurements as () => Promise<MeasurementRow[]>,
  });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: predictions = [] } = useQuery<PredictionRow[]>({
    queryKey: ["coverage-predictions"],
    queryFn: coreFeaturesService.listCoveragePredictions as () => Promise<PredictionRow[]>,
  });

  const createZone = useMutation({
    mutationFn: coreFeaturesService.createCoverageZone,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-zones"] }),
  });
  const createModel = useMutation({
    mutationFn: coreFeaturesService.createRfPropagationModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rf-models"] }),
  });
  const createMeasurement = useMutation({
    mutationFn: coreFeaturesService.createCoverageMeasurement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-measurements"] }),
  });
  const removeMutation = useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => coreFeaturesService.remove(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coverage-zones"] });
      qc.invalidateQueries({ queryKey: ["rf-models"] });
      qc.invalidateQueries({ queryKey: ["coverage-measurements"] });
    },
  });
  const predictMutation = useMutation({
    mutationFn: (modelId: string) =>
      fetch("/api/coverage/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model_id: modelId }),
      }).then((res) => res.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coverage-predictions"] }),
  });

  const points = useMemo<CoverageMapPoint[]>(() => {
    const sitePoints = sites.map((site) => ({
      id: `site-${site.id}`,
      label: site.name,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      color: "#0ea5e9",
      markerSize: 6,
    }));

    const zonePoints: CoverageMapPoint[] = [];
    zones.forEach((zone) => {
      const linkedSite = zone.site_id ? sites.find((s) => s.id === zone.site_id) : null;
      const geoPoint = extractPointFromGeoJson(zone.geojson);
      const lat = linkedSite ? Number(linkedSite.latitude) : geoPoint?.lat;
      const lon = linkedSite ? Number(linkedSite.longitude) : geoPoint?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return;
      zonePoints.push({
        id: `zone-${zone.id}`,
        label: `${zone.name} zone`,
        latitude: lat,
        longitude: lon,
        color: "#22c55e",
        markerSize: 4,
        coverageRadiusKm: Math.max(0.1, Number(zone.radius_km ?? 1)),
      });
    });

    const measurementPoints = measurements.slice(0, 120).map((m) => ({
      id: `m-${m.id}`,
      label: `${m.signal_strength} dBm`,
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      color: m.signal_strength > -60 ? "#16a34a" : m.signal_strength > -70 ? "#eab308" : "#ef4444",
      markerSize: 3,
    }));

    const predictionPoints: CoverageMapPoint[] = [];
    predictions.forEach((prediction) => {
      const point = extractPointFromGeoJson(prediction.recommended_geojson);
      if (!point) return;
      predictionPoints.push({
        id: `p-${prediction.id}`,
        label: `${prediction.prediction_name} (${Math.round(prediction.confidence * 100)}%)`,
        latitude: point.lat,
        longitude: point.lon,
        color: "#6366f1",
        markerSize: 4,
        coverageRadiusKm: Math.max(0.1, Number(prediction.recommended_radius_km)),
      });
    });

    return [...sitePoints, ...zonePoints, ...measurementPoints, ...predictionPoints];
  }, [measurements, predictions, sites, zones]);

  const submit = (fn: (payload: Record<string, unknown>) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    fn(form);
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Coverage Planning Tools (GIS)">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold">GIS Coverage Map (OpenStreetMap)</h3>
        <CoverageMap points={points} />
        <p className="mt-2 text-xs text-slate-500">Blue: sites, Green rings: planned coverage, Purple rings: predicted overlays, Red/Yellow/Green points: measured signal quality.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FeatureCard title="Coverage Zones">
          <form className="mb-3 grid gap-2" onSubmit={submit((p) => createZone.mutate({ ...p, geojson: p.geojson ? JSON.parse(String(p.geojson)) : null }))}>
            <Input name="name" placeholder="Urban Cluster A" required />
            <Select name="site_id" defaultValue="">
              <option value="">Select site (optional)</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="radius_km" placeholder="5" />
            <Input name="geojson" placeholder='{"type":"Point","coordinates":[72.8,19.1]}' />
            <Button type="submit">Add Zone</Button>
          </form>
          <div className="space-y-2 text-sm">
            {zones.map((z) => (
              <div key={z.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{z.name} • radius {z.radius_km ?? "-"} km</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "coverage_zones", id: z.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="RF Propagation Models">
          <form className="mb-3 grid gap-2" onSubmit={submit((p) => createModel.mutate(p))}>
            <Input name="name" placeholder="ePMP Sector Model" required />
            <Select name="site_id" defaultValue="" required>
              <option value="">Select site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="frequency_mhz" placeholder="5800" required />
            <Input name="tx_power_dbm" placeholder="20" required />
            <Input name="antenna_height_m" placeholder="30" required />
            <Input name="predicted_radius_km" placeholder="6" required />
            <Button type="submit">Add Model</Button>
          </form>
          <div className="space-y-2 text-sm">
            {models.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{m.name} • {m.frequency_mhz}MHz • {m.predicted_radius_km}km</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => predictMutation.mutate(m.id)}>Predict</Button>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "rf_propagation_models", id: m.id })}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            {predictions.slice(0, 25).map((p) => (
              <p key={p.id}>{p.prediction_name} • radius {p.recommended_radius_km}km • confidence {(p.confidence * 100).toFixed(0)}%</p>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Field Measurements">
          <form className="mb-3 grid gap-2" onSubmit={submit((p) => createMeasurement.mutate(p))}>
            <Select name="site_id" defaultValue="">
              <option value="">Select site (optional)</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="latitude" placeholder="19.1234" required />
            <Input name="longitude" placeholder="72.8765" required />
            <Input name="signal_strength" placeholder="-64" required />
            <Input name="noise_floor" placeholder="-95" />
            <Input name="sinr" placeholder="22" />
            <Button type="submit">Add Measurement</Button>
          </form>
          <div className="space-y-2 text-xs">
            {measurements.slice(0, 40).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{m.latitude},{m.longitude} • {m.signal_strength} dBm</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "coverage_measurements", id: m.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
