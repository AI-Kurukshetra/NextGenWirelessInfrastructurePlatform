"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export type CoverageMapPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  color: string;
  markerSize: number;
  coverageRadiusKm?: number;
};

type CoverageMapProps = {
  points: CoverageMapPoint[];
};

export function CoverageMap({ points }: CoverageMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    map.setView([20.5937, 78.9629], 4);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const latLngs: L.LatLngExpression[] = [];

    points.forEach((point) => {
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;

      const latLng: L.LatLngTuple = [point.latitude, point.longitude];
      latLngs.push(latLng);

      if (point.coverageRadiusKm && point.coverageRadiusKm > 0) {
        L.circle(latLng, {
          radius: point.coverageRadiusKm * 1000,
          color: point.color,
          fillColor: point.color,
          fillOpacity: 0.14,
          weight: 2,
        })
          .bindTooltip(point.label)
          .addTo(layer);

        L.circleMarker(latLng, {
          radius: 4,
          color: point.color,
          fillColor: point.color,
          fillOpacity: 1,
          weight: 1,
        })
          .bindTooltip(point.label)
          .addTo(layer);
        return;
      }

      L.circleMarker(latLng, {
        radius: Math.max(3, Math.min(point.markerSize, 10)),
        color: point.color,
        fillColor: point.color,
        fillOpacity: 0.95,
        weight: 1,
      })
        .bindTooltip(point.label)
        .addTo(layer);
    });

    if (!latLngs.length) {
      map.setView([20.5937, 78.9629], 4);
      return;
    }

    map.fitBounds(L.latLngBounds(latLngs).pad(0.2), { maxZoom: 16 });
  }, [points]);

  return <div ref={mapContainerRef} className="h-72 w-full rounded border border-slate-200" />;
}
