"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/common/table";
import { useUserProfile } from "@/hooks/use-user-profile";
import { createSite, deleteSite, listSites } from "@/services/sites-service";
import type { SiteFormValues } from "@/types";

const initialForm: SiteFormValues = {
  name: "",
  latitude: 0,
  longitude: 0,
  tower_height: 20,
};
const pageSize = 8;

export const dynamic = "force-dynamic";

export default function SitesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteFormValues>(initialForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: profile } = useUserProfile();
  const canManage = profile?.role === "admin" || profile?.role === "operator";

  const { data: sites = [], isLoading, error } = useQuery({ queryKey: ["sites"], queryFn: listSites });

  const filtered = useMemo(
    () => sites.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [sites, search]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedSites = filtered.slice((page - 1) * pageSize, page * pageSize);

  const createMutation = useMutation({
    mutationFn: createSite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      setForm(initialForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites"] }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <AppShell title="Sites Management">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search sites..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <p className="text-sm text-slate-500">{filtered.length} site(s)</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Site</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.latitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, latitude: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.longitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, longitude: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label>Tower Height (m)</Label>
                  <Input
                    type="number"
                    value={form.tower_height}
                    onChange={(e) => setForm((prev) => ({ ...prev, tower_height: Number(e.target.value) }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create site"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>Sites</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-slate-500">Loading sites...</p> : null}
            {error ? <p className="text-sm text-red-600">Unable to load sites.</p> : null}
            {!isLoading && !error && filtered.length === 0 ? <p className="text-sm text-slate-500">No sites found.</p> : null}
            <div className="overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Coordinates</TH>
                    <TH>Tower</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedSites.map((site) => (
                    <TR key={site.id}>
                      <TD>{site.name}</TD>
                      <TD>
                        {site.latitude}, {site.longitude}
                      </TD>
                      <TD>{site.tower_height}m</TD>
                      <TD className="space-x-2">
                        <Link href={`/sites/${site.id}`} className="text-sm font-medium text-sky-700 underline">
                          View
                        </Link>
                        {canManage ? (
                          <button
                            type="button"
                            className="text-sm font-medium text-red-700 underline"
                            onClick={() => deleteMutation.mutate(site.id)}
                          >
                            Delete
                          </button>
                        ) : null}
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
