"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useUserProfile } from "@/hooks/use-user-profile";
import { getEquipmentById, getEquipmentHealthTimeline, updateEquipment } from "@/services/equipment-service";

const statusVariant: Record<string, "success" | "danger" | "warning" | "info"> = {
  online: "success",
  offline: "danger",
  warning: "warning",
  maintenance: "info",
};

export const dynamic = "force-dynamic";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const equipmentId = useMemo(() => params.id, [params.id]);
  const [saved, setSaved] = useState(false);
  const { data: profile } = useUserProfile();
  const canUpdate = profile?.role === "admin" || profile?.role === "operator" || profile?.role === "technician";

  const { data: equipment, refetch, isLoading } = useQuery({
    queryKey: ["equipment", equipmentId],
    queryFn: () => getEquipmentById(equipmentId),
    enabled: Boolean(equipmentId),
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["equipment-health-timeline", equipmentId],
    queryFn: () => getEquipmentHealthTimeline(equipmentId, 40),
    enabled: Boolean(equipmentId),
  });

  const mutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateEquipment(equipmentId, {
        name: String(formData.get("name")),
        model: String(formData.get("model")),
        vendor: String(formData.get("vendor") ?? ""),
        management_ip: String(formData.get("management_ip") ?? ""),
        firmware_version: String(formData.get("firmware_version")),
        status: String(formData.get("status")) as "online" | "offline" | "warning" | "maintenance",
        temperature: Number(formData.get("temperature")),
      }),
    onSuccess: async () => {
      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdate) return;
    mutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <AppShell title="Equipment Details">
      <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Monitor Device Health</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !equipment ? (
            <p className="text-sm text-slate-500">Equipment not found.</p>
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="flex items-center gap-3 rounded-md bg-slate-100 p-3">
                <span className="text-sm text-slate-600">Current status:</span>
                <Badge variant={statusVariant[equipment.status] ?? "default"}>{equipment.status}</Badge>
                <span className="text-sm text-slate-600">Last seen: {new Date(equipment.last_seen).toLocaleString()}</span>
                <span className="text-sm text-slate-600">Vendor: {equipment.vendor ?? "-"}</span>
                <span className="text-sm text-slate-600">Provisioning: {equipment.provisioning_state ?? "-"}</span>
              </div>
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={equipment.name} required disabled={!canUpdate} />
              </div>
              <div>
                <Label>Model</Label>
                <Input name="model" defaultValue={equipment.model} required disabled={!canUpdate} />
              </div>
              <div>
                <Label>Vendor</Label>
                <Select name="vendor" defaultValue={equipment.vendor ?? "generic"} disabled={!canUpdate}>
                  <option value="cambium">cambium</option>
                  <option value="mikrotik">mikrotik</option>
                  <option value="generic">generic</option>
                </Select>
              </div>
              <div>
                <Label>Management IP</Label>
                <Input name="management_ip" defaultValue={equipment.management_ip ?? ""} disabled={!canUpdate} />
              </div>
              <div>
                <Label>Firmware version</Label>
                <Input name="firmware_version" defaultValue={equipment.firmware_version} required disabled={!canUpdate} />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={equipment.status} disabled={!canUpdate}>
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                  <option value="warning">warning</option>
                  <option value="maintenance">maintenance</option>
                </Select>
              </div>
              <div>
                <Label>Temperature (C)</Label>
                <Input name="temperature" type="number" defaultValue={equipment.temperature} required disabled={!canUpdate} />
              </div>
              {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
              <Button type="submit" disabled={mutation.isPending || !canUpdate}>
                {mutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Health Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="health" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </div>
    </AppShell>
  );
}
