"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/common/table";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useUserProfile } from "@/hooks/use-user-profile";
import { createEquipment, getLatestEquipmentHealth, listEquipment } from "@/services/equipment-service";
import { listSites } from "@/services/sites-service";
import type { EquipmentFormValues } from "@/types";

const defaultForm: EquipmentFormValues = {
  name: "",
  model: "",
  vendor: "cambium",
  management_ip: "",
  provisioning_state: "unprovisioned",
  firmware_version: "",
  site_id: "",
  status: "online",
  temperature: 35,
};

const statusVariant: Record<string, "success" | "danger" | "warning" | "info"> = {
  online: "success",
  offline: "danger",
  warning: "warning",
  maintenance: "info",
};
const pageSize = 8;

export const dynamic = "force-dynamic";

export default function EquipmentPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: profile } = useUserProfile();
  const canManage = profile?.role === "admin" || profile?.role === "operator";

  const { data: equipment = [], isLoading, error } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });
  const { data: healthRows = [] } = useQuery({ queryKey: ["equipment-health-latest"], queryFn: getLatestEquipmentHealth });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const healthByEquipment = useMemo(
    () =>
      healthRows.reduce<Record<string, { health_score: number; latency: number | null; packet_loss: number | null }>>((acc, row) => {
        acc[row.equipment_id] = { health_score: row.health_score, latency: row.latency, packet_loss: row.packet_loss };
        return acc;
      }, {}),
    [healthRows]
  );

  const filtered = useMemo(
    () =>
      equipment.filter((device) =>
        `${device.name} ${device.model} ${device.firmware_version}`.toLowerCase().includes(search.toLowerCase())
      ),
    [equipment, search]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const mutation = useMutation({
    mutationFn: createEquipment,
    onSuccess: () => {
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    mutation.mutate(form);
  };

  return (
    <AppShell title="Equipment Management">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name/model/firmware..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <p className="text-sm text-slate-500">{filtered.length} device(s)</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Add Device</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <Label>Device name</Label>
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} required />
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Select value={form.vendor ?? "generic"} onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}>
                    <option value="cambium">cambium</option>
                    <option value="mikrotik">mikrotik</option>
                    <option value="generic">generic</option>
                  </Select>
                </div>
                <div>
                  <Label>Management IP</Label>
                  <Input value={form.management_ip ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, management_ip: e.target.value }))} />
                </div>
                <div>
                  <Label>Firmware version</Label>
                  <Input
                    value={form.firmware_version}
                    onChange={(e) => setForm((prev) => ({ ...prev, firmware_version: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Site</Label>
                  <Select value={form.site_id} onChange={(e) => setForm((prev) => ({ ...prev, site_id: e.target.value }))} required>
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as EquipmentFormValues["status"] }))}
                  >
                    <option value="online">online</option>
                    <option value="offline">offline</option>
                    <option value="warning">warning</option>
                    <option value="maintenance">maintenance</option>
                  </Select>
                </div>
                <div>
                  <Label>Temperature (C)</Label>
                  <Input
                    type="number"
                    value={form.temperature}
                    onChange={(e) => setForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Adding..." : "Add device"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-slate-500">Loading devices...</p> : null}
            {error ? <p className="text-sm text-red-600">Unable to load devices.</p> : null}
            {!isLoading && !error && filtered.length === 0 ? <p className="text-sm text-slate-500">No devices found.</p> : null}
            <div className="overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Model</TH>
                    <TH>Vendor</TH>
                    <TH>Firmware</TH>
                    <TH>Status</TH>
                    <TH>Provisioning</TH>
                    <TH>Health</TH>
                    <TH>Latency</TH>
                    <TH>Loss</TH>
                    <TH>Temp</TH>
                    <TH>Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {paged.map((device) => (
                    <TR key={device.id}>
                      <TD>{device.name}</TD>
                      <TD>{device.model}</TD>
                      <TD>{device.vendor ?? "-"}</TD>
                      <TD>{device.firmware_version}</TD>
                      <TD>
                        <Badge variant={statusVariant[device.status] ?? "default"}>{device.status}</Badge>
                      </TD>
                      <TD>{device.provisioning_state ?? "-"}</TD>
                      <TD>{healthByEquipment[device.id]?.health_score ?? "-"}</TD>
                      <TD>{healthByEquipment[device.id]?.latency ?? "-"}ms</TD>
                      <TD>{healthByEquipment[device.id]?.packet_loss ?? "-"}%</TD>
                      <TD>{device.temperature}C</TD>
                      <TD>
                        <Link href={`/equipment/${device.id}`} className="text-sm font-medium text-sky-700 underline">
                          View
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <span className="text-xs text-slate-500">
                Page {page} / {pageCount}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
