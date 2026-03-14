import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [sites, links, equipment, networks] = await Promise.all([
    ctx.supabase.from("sites").select("id,name,latitude,longitude"),
    ctx.supabase.from("wireless_links").select("id,source_site_id,destination_site_id,status,capacity_mbps"),
    ctx.supabase.from("equipment").select("id,name,site_id,status"),
    ctx.supabase.from("networks").select("id,name,topology,status"),
  ]);

  if (sites.error || links.error || equipment.error || networks.error) {
    return NextResponse.json({ error: "Unable to load topology" }, { status: 400 });
  }

  const nodeMap = new Map<
    string,
    {
      id: string;
      label: string;
      type: string;
      status: string;
      x: number;
      y: number;
      latitude: number | null;
      longitude: number | null;
    }
  >();
  const siteRows = sites.data ?? [];
  const validGeoSites = siteRows.filter((site) => Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)));
  const latitudes = validGeoSites.map((site) => Number(site.latitude));
  const longitudes = validGeoSites.map((site) => Number(site.longitude));
  const minLat = latitudes.length ? Math.min(...latitudes) : 0;
  const maxLat = latitudes.length ? Math.max(...latitudes) : 1;
  const minLon = longitudes.length ? Math.min(...longitudes) : 0;
  const maxLon = longitudes.length ? Math.max(...longitudes) : 1;
  const latRange = Math.max(maxLat - minLat, 0.05);
  const lonRange = Math.max(maxLon - minLon, 0.05);

  for (let i = 0; i < siteRows.length; i += 1) {
    const site = siteRows[i];
    const lat = Number(site.latitude);
    const lon = Number(site.longitude);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
    const geoX = 60 + ((lon - minLon) / lonRange) * 740;
    const geoY = 40 + (1 - (lat - minLat) / latRange) * 280;

    nodeMap.set(site.id, {
      id: site.id,
      label: site.name,
      type: "site",
      status: "online",
      x: hasGeo ? geoX : 120 + (i % 4) * 180,
      y: hasGeo ? geoY : 120 + Math.floor(i / 4) * 140,
      latitude: hasGeo ? lat : null,
      longitude: hasGeo ? lon : null,
    });
  }

  const siteEquipmentIndex = new Map<string, number>();
  for (const eq of equipment.data ?? []) {
    if (!nodeMap.has(eq.site_id)) continue;
    const offsetIndex = siteEquipmentIndex.get(eq.site_id) ?? 0;
    siteEquipmentIndex.set(eq.site_id, offsetIndex + 1);
    const angle = (offsetIndex % 8) * (Math.PI / 4);
    const radius = 24 + Math.floor(offsetIndex / 8) * 10;
    nodeMap.set(eq.id, {
      id: eq.id,
      label: eq.name,
      type: "equipment",
      status: eq.status,
      x: (nodeMap.get(eq.site_id)?.x ?? 100) + Math.cos(angle) * radius,
      y: (nodeMap.get(eq.site_id)?.y ?? 100) + Math.sin(angle) * radius,
      latitude: null,
      longitude: null,
    });
  }

  return NextResponse.json({
    data: {
      networks: networks.data ?? [],
      nodes: Array.from(nodeMap.values()),
      links: links.data ?? [],
    },
  });
}
