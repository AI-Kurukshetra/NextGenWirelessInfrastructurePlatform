"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserProfile } from "@/hooks/use-user-profile";
import { getSiteById, updateSite } from "@/services/sites-service";

export const dynamic = "force-dynamic";

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const siteId = useMemo(() => params.id, [params.id]);
  const [saved, setSaved] = useState(false);
  const { data: profile } = useUserProfile();
  const canManage = profile?.role === "admin" || profile?.role === "operator";

  const { data: site, refetch, isLoading } = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteById(siteId),
    enabled: Boolean(siteId),
  });

  const mutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateSite(siteId, {
        name: String(formData.get("name")),
        latitude: Number(formData.get("latitude")),
        longitude: Number(formData.get("longitude")),
        tower_height: Number(formData.get("tower_height")),
      }),
    onSuccess: async () => {
      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    mutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <AppShell title="Site Details">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit Site</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !site ? (
            <p className="text-sm text-slate-500">Site not found.</p>
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={site.name} required disabled={!canManage} />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input
                  name="latitude"
                  type="number"
                  step="0.0001"
                  defaultValue={site.latitude}
                  required
                  disabled={!canManage}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  name="longitude"
                  type="number"
                  step="0.0001"
                  defaultValue={site.longitude}
                  required
                  disabled={!canManage}
                />
              </div>
              <div>
                <Label>Tower Height (m)</Label>
                <Input
                  name="tower_height"
                  type="number"
                  defaultValue={site.tower_height}
                  required
                  disabled={!canManage}
                />
              </div>
              {!canManage ? <p className="text-sm text-amber-700">Read-only access for technician role.</p> : null}
              {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
              <Button type="submit" disabled={mutation.isPending || !canManage}>
                {mutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
