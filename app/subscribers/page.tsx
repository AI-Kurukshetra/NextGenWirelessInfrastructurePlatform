"use client";

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
import { listServicePlans } from "@/services/service-plans-service";
import { listSites } from "@/services/sites-service";
import {
  assignSubscriberQos,
  bulkUpdateSubscriberStatus,
  createSubscriber,
  listSubscriberQosAssignments,
  listSubscribers,
  updateSubscriber,
  updateSubscriberAccessControls,
} from "@/services/subscribers-service";
import type { SubscriberFormValues } from "@/types";

type QosProfileOption = {
  id: string;
  name: string;
};

const defaultForm: SubscriberFormValues = {
  name: "",
  email: "",
  service_plan_id: "",
  status: "active",
  connection_site: "",
};

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  active: "success",
  suspended: "danger",
  pending: "warning",
};
const pageSize = 10;

export const dynamic = "force-dynamic";

export default function SubscribersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const { data: profile } = useUserProfile();
  const canManage = profile?.role === "admin" || profile?.role === "operator";

  const { data: subscribers = [], isLoading, error } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });
  const { data: plans = [] } = useQuery({ queryKey: ["service-plans"], queryFn: listServicePlans });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: qosAssignments = [] } = useQuery({ queryKey: ["subscriber-qos"], queryFn: listSubscriberQosAssignments });
  const { data: qosProfiles = [] } = useQuery<QosProfileOption[]>({
    queryKey: ["qos-profiles"],
    queryFn: () => import("@/services/core-features-service").then((m) => m.coreFeaturesService.listQosProfiles() as Promise<QosProfileOption[]>),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["subscriber-sessions"],
    queryFn: () => import("@/services/core-features-service").then((m) => m.coreFeaturesService.listSubscriberSessions() as Promise<Array<{ subscriber_id: string; session_state: string }>>),
  });
  const { data: provisioningJobs = [] } = useQuery({
    queryKey: ["subscriber-provisioning-jobs"],
    queryFn: () =>
      import("@/services/core-features-service").then(
        (m) => m.coreFeaturesService.listSubscriberProvisioningJobs() as Promise<Array<{ id: string; subscriber_id: string; action: string; status: string; created_at: string }>>
      ),
  });

  const qosBySubscriber = useMemo(
    () =>
      qosAssignments.reduce<Record<string, { name: string; max_bandwidth_mbps: number; priority: number }>>((acc, row) => {
        if (row.qos_profile) {
          acc[row.subscriber_id] = {
            name: row.qos_profile.name,
            max_bandwidth_mbps: row.qos_profile.max_bandwidth_mbps,
            priority: row.qos_profile.priority,
          };
        }
        return acc;
      }, {}),
    [qosAssignments]
  );

  const filtered = useMemo(
    () => subscribers.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(search.toLowerCase())),
    [subscribers, search]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  const createMutation = useMutation({
    mutationFn: createSubscriber,
    onSuccess: () => {
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" | "pending" }) =>
      updateSubscriber(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscribers"] }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: "active" | "suspended" | "pending" }) =>
      bulkUpdateSubscriberStatus(ids, status),
    onSuccess: () => {
      setSelected({});
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
    },
  });

  const accessMutation = useMutation({
    mutationFn: ({ id, access_control, enforced_speed_limit }: { id: string; access_control: string; enforced_speed_limit: number }) =>
      updateSubscriberAccessControls(id, { access_control, enforced_speed_limit }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscribers"] }),
  });

  const qosMutation = useMutation({
    mutationFn: ({ subscriberId, qosProfileId }: { subscriberId: string; qosProfileId: string }) =>
      assignSubscriberQos(subscriberId, qosProfileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriber-qos"] }),
  });
  const provisioningMutation = useMutation({
    mutationFn: ({ subscriber_id, action }: { subscriber_id: string; action: "activate" | "suspend" | "resume" | "disconnect" }) =>
      fetch("/api/subscribers/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriber_id, action }),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriber-provisioning-jobs"] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    createMutation.mutate(form);
  };

  return (
    <AppShell title="Subscriber Management">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Input placeholder="Search subscribers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <p className="text-sm text-slate-500">{filtered.length} subscriber(s)</p>
      </div>

      {canManage ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ ids: selectedIds, status: "active" })} disabled={!selectedIds.length}>
            Bulk Activate ({selectedIds.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ ids: selectedIds, status: "suspended" })} disabled={!selectedIds.length}>
            Bulk Suspend
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkMutation.mutate({ ids: selectedIds, status: "pending" })} disabled={!selectedIds.length}>
            Bulk Set Pending
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Subscriber</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
                </div>
                <div>
                  <Label>Service plan</Label>
                  <Select value={form.service_plan_id} onChange={(e) => setForm((prev) => ({ ...prev, service_plan_id: e.target.value }))} required>
                    <option value="">Select plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Connection site</Label>
                  <Select value={form.connection_site} onChange={(e) => setForm((prev) => ({ ...prev, connection_site: e.target.value }))} required>
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as SubscriberFormValues["status"] }))}>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="pending">pending</option>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create subscriber"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-slate-500">Loading subscribers...</p> : null}
            {error ? <p className="text-sm text-red-600">Unable to load subscribers.</p> : null}
            {!isLoading && !error && filtered.length === 0 ? <p className="text-sm text-slate-500">No subscribers found.</p> : null}
            <div className="overflow-auto">
              <Table>
                <THead>
                  <TR>
                    {canManage ? <TH>Select</TH> : null}
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Plan</TH>
                    <TH>Status</TH>
                    <TH>Access</TH>
                    <TH>Speed</TH>
                    <TH>QoS</TH>
                    <TH>Session</TH>
                    <TH>Action</TH>
                    <TH>AAA</TH>
                  </TR>
                </THead>
                <TBody>
                  {paged.map((subscriber) => (
                    <TR key={subscriber.id}>
                      {canManage ? (
                        <TD>
                          <input
                            type="checkbox"
                            checked={Boolean(selected[subscriber.id])}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [subscriber.id]: e.target.checked }))}
                          />
                        </TD>
                      ) : null}
                      <TD>{subscriber.name}</TD>
                      <TD>{subscriber.email}</TD>
                      <TD>{subscriber.plan?.name ?? "-"}</TD>
                      <TD>
                        <Badge variant={statusVariant[subscriber.status] ?? "default"}>{subscriber.status}</Badge>
                      </TD>
                      <TD>
                        <Select
                          defaultValue={subscriber.access_control ?? "standard"}
                          disabled={!canManage}
                          onChange={(e) =>
                            accessMutation.mutate({
                              id: subscriber.id,
                              access_control: e.target.value,
                              enforced_speed_limit: Number(subscriber.enforced_speed_limit ?? 0),
                            })
                          }
                        >
                          <option value="standard">standard</option>
                          <option value="restricted">restricted</option>
                          <option value="premium">premium</option>
                        </Select>
                      </TD>
                      <TD>
                        <Input
                          type="number"
                          defaultValue={Number(subscriber.enforced_speed_limit ?? 0)}
                          disabled={!canManage}
                          onBlur={(e) =>
                            accessMutation.mutate({
                              id: subscriber.id,
                              access_control: subscriber.access_control ?? "standard",
                              enforced_speed_limit: Number(e.target.value),
                            })
                          }
                        />
                      </TD>
                      <TD>
                        <Select
                          defaultValue={qosAssignments.find((q) => q.subscriber_id === subscriber.id)?.qos_profile?.id ?? ""}
                          disabled={!canManage}
                          onChange={(e) => qosMutation.mutate({ subscriberId: subscriber.id, qosProfileId: e.target.value })}
                        >
                          <option value="">No QoS</option>
                          {qosProfiles.map((q) => (
                            <option key={q.id} value={q.id}>{q.name}</option>
                          ))}
                        </Select>
                        {qosBySubscriber[subscriber.id] ? (
                          <p className="text-xs text-slate-500">prio {qosBySubscriber[subscriber.id].priority}</p>
                        ) : null}
                      </TD>
                      <TD>
                        {(sessions.find((s) => s.subscriber_id === subscriber.id)?.session_state ?? "offline")}
                      </TD>
                      <TD>
                        <Select
                          defaultValue={subscriber.status}
                          disabled={!canManage}
                          onChange={(event) => updateMutation.mutate({ id: subscriber.id, status: event.target.value as "active" | "suspended" | "pending" })}
                        >
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="pending">pending</option>
                        </Select>
                      </TD>
                      <TD>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => provisioningMutation.mutate({ subscriber_id: subscriber.id, action: "activate" })}
                            disabled={!canManage}
                          >
                            Activate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => provisioningMutation.mutate({ subscriber_id: subscriber.id, action: "suspend" })}
                            disabled={!canManage}
                          >
                            Suspend
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="text-xs text-slate-500">Page {page} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</Button>
            </div>
            <div className="mt-4 space-y-1 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Recent AAA Provisioning Jobs</p>
              {provisioningJobs.slice(0, 10).map((job) => (
                <p key={job.id}>
                  {job.subscriber_id.slice(0, 8)} • {job.action} • {job.status} • {new Date(job.created_at).toLocaleString()}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
