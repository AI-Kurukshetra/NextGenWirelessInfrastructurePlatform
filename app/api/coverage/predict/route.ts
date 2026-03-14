import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { model_id?: string; name?: string };
  if (!body.model_id) return NextResponse.json({ error: "model_id is required" }, { status: 400 });

  const { data: model, error: modelError } = await ctx.supabase
    .from("rf_propagation_models")
    .select("id,name,site_id,frequency_mhz,tx_power_dbm,antenna_height_m,predicted_radius_km")
    .eq("id", body.model_id)
    .single();
  if (modelError) return NextResponse.json({ error: modelError.message }, { status: 400 });

  const { data: site } = await ctx.supabase
    .from("sites")
    .select("latitude,longitude,tower_height")
    .eq("id", model.site_id)
    .maybeSingle();

  const [measurementRes, scanRes] = await Promise.all([
    ctx.supabase
      .from("coverage_measurements")
      .select("signal_strength,sinr")
      .eq("site_id", model.site_id)
      .order("collected_at", { ascending: false })
      .limit(120),
    ctx.supabase
      .from("spectrum_scans")
      .select("interference_score,channel_utilization")
      .eq("site_id", model.site_id)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const measurements = measurementRes.data ?? [];
  const scans = scanRes.data ?? [];

  const avgSignal = measurements.length
    ? measurements.reduce((acc, row) => acc + Number(row.signal_strength ?? -75), 0) / measurements.length
    : -70;
  const avgSinr = measurements.length
    ? measurements.reduce((acc, row) => acc + Number(row.sinr ?? 18), 0) / measurements.length
    : 18;
  const avgInterference = scans.length
    ? scans.reduce((acc, row) => acc + Number(row.interference_score ?? 0), 0) / scans.length
    : 20;
  const avgUtilization = scans.length
    ? scans.reduce((acc, row) => acc + Number(row.channel_utilization ?? 40), 0) / scans.length
    : 40;

  const baseRadius = Number(model.predicted_radius_km);
  const txPower = Number(model.tx_power_dbm);
  const antennaHeight = Number(model.antenna_height_m ?? site?.tower_height ?? 20);
  const frequencyMhz = Number(model.frequency_mhz);

  const powerFactor = (txPower - 18) * 0.025;
  const heightFactor = Math.log10(Math.max(antennaHeight, 3)) * 0.18;
  const frequencyPenalty = Math.log10(Math.max(frequencyMhz, 700) / 900) * 0.42;
  const signalFactor = (avgSignal + 70) * 0.015;
  const sinrFactor = (avgSinr - 18) * 0.01;
  const interferencePenalty = avgInterference * 0.0045;
  const utilizationPenalty = Math.max(0, avgUtilization - 65) * 0.0035;

  const adjustedRadius = Number(
    (
      baseRadius
      * (1 + powerFactor + heightFactor - frequencyPenalty + signalFactor + sinrFactor - interferencePenalty - utilizationPenalty)
    ).toFixed(2)
  );
  const finalRadius = Number(Math.min(50, Math.max(0.3, adjustedRadius || baseRadius || 1)).toFixed(2));

  const predictionGeoJson = site
    ? {
        type: "Point",
        coordinates: [Number(site.longitude), Number(site.latitude)],
        properties: {
          radius_km: finalRadius,
          frequency_mhz: model.frequency_mhz,
          tx_power_dbm: model.tx_power_dbm,
          antenna_height_m: antennaHeight,
          avg_signal_dbm: Number(avgSignal.toFixed(2)),
          avg_sinr: Number(avgSinr.toFixed(2)),
          avg_interference: Number(avgInterference.toFixed(2)),
          avg_channel_utilization: Number(avgUtilization.toFixed(2)),
        },
      }
    : null;

  const { data, error } = await ctx.supabase
    .from("coverage_predictions")
    .insert({
      model_id: model.id,
      prediction_name: body.name ?? `${model.name} prediction`,
      confidence: Number(Math.max(0.45, Math.min(0.96, 0.9 - avgInterference * 0.003 - Math.abs(avgSignal + 68) * 0.006)).toFixed(2)),
      recommended_radius_km: finalRadius,
      recommended_geojson: predictionGeoJson,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
