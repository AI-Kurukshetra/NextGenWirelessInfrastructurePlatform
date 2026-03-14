"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";
import { listSites } from "@/services/sites-service";
import { listSubscribers } from "@/services/subscribers-service";
import { listEquipment } from "@/services/equipment-service";

export const dynamic = "force-dynamic";

type NetworkRow = { id: string; name: string; topology: string; status: string };
type LinkRow = { id: string; frequency_mhz: number; capacity_mbps: number; status: string };
type SectorRow = { id: string; sector_name: string; azimuth: number; beamwidth: number };
type ClientRow = { id: string; subscriber_id: string; sector_id: string; signal_strength: number | null };
type FailoverRow = { id: string; network_id: string; enabled: boolean };
type PoolRow = { id: string; name: string; algorithm: string; max_sessions: number };
type MemberRow = { id: string; pool_id: string; link_id: string; weight: number };
type MeshRow = { id: string; equipment_id: string; parent_node_id: string | null; hops: number };

export default function NetworksPage() {
  const qc = useQueryClient();

  const { data: networks = [] } = useQuery<NetworkRow[]>({ queryKey: ["networks"], queryFn: coreFeaturesService.listNetworks as () => Promise<NetworkRow[]> });
  const { data: links = [] } = useQuery<LinkRow[]>({ queryKey: ["wireless-links"], queryFn: coreFeaturesService.listWirelessLinks as () => Promise<LinkRow[]> });
  const { data: sectors = [] } = useQuery<SectorRow[]>({ queryKey: ["ptmp-sectors"], queryFn: coreFeaturesService.listPtmpSectors as () => Promise<SectorRow[]> });
  const { data: clients = [] } = useQuery<ClientRow[]>({ queryKey: ["ptmp-clients"], queryFn: coreFeaturesService.listPtmpClients as () => Promise<ClientRow[]> });
  const { data: failover = [] } = useQuery<FailoverRow[]>({ queryKey: ["failover-policies"], queryFn: coreFeaturesService.listFailoverPolicies as () => Promise<FailoverRow[]> });
  const { data: pools = [] } = useQuery<PoolRow[]>({ queryKey: ["lb-pools"], queryFn: coreFeaturesService.listLoadBalancingPools as () => Promise<PoolRow[]> });
  const { data: members = [] } = useQuery<MemberRow[]>({ queryKey: ["lb-members"], queryFn: coreFeaturesService.listLoadBalancingMembers as () => Promise<MemberRow[]> });
  const { data: mesh = [] } = useQuery<MeshRow[]>({ queryKey: ["mesh-nodes"], queryFn: coreFeaturesService.listMeshNodes as () => Promise<MeshRow[]> });
  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: listSites });
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: listEquipment });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["networks"] });
    qc.invalidateQueries({ queryKey: ["wireless-links"] });
    qc.invalidateQueries({ queryKey: ["ptmp-sectors"] });
    qc.invalidateQueries({ queryKey: ["ptmp-clients"] });
    qc.invalidateQueries({ queryKey: ["failover-policies"] });
    qc.invalidateQueries({ queryKey: ["lb-pools"] });
    qc.invalidateQueries({ queryKey: ["lb-members"] });
    qc.invalidateQueries({ queryKey: ["mesh-nodes"] });
  };

  const createNetwork = useMutation({ mutationFn: coreFeaturesService.createNetwork, onSuccess: refreshAll });
  const createLink = useMutation({ mutationFn: coreFeaturesService.createWirelessLink, onSuccess: refreshAll });
  const createSector = useMutation({ mutationFn: coreFeaturesService.createPtmpSector, onSuccess: refreshAll });
  const createClient = useMutation({ mutationFn: coreFeaturesService.createPtmpClient, onSuccess: refreshAll });
  const createFailover = useMutation({ mutationFn: coreFeaturesService.createFailoverPolicy, onSuccess: refreshAll });
  const createPool = useMutation({ mutationFn: coreFeaturesService.createLoadBalancingPool, onSuccess: refreshAll });
  const createMember = useMutation({ mutationFn: coreFeaturesService.createLoadBalancingMember, onSuccess: refreshAll });
  const createMesh = useMutation({ mutationFn: coreFeaturesService.createMeshNode, onSuccess: refreshAll });

  const removeMutation = useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => coreFeaturesService.remove(table, id),
    onSuccess: refreshAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ table, id, payload }: { table: string; id: string; payload: Record<string, unknown> }) =>
      coreFeaturesService.update(table, id, payload),
    onSuccess: refreshAll,
  });

  const submit = (fn: (payload: Record<string, unknown>) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    fn(Object.fromEntries(form.entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="Network Topology (P2P / P2MP / Mesh)">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard title="Networks">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createNetwork.mutate(p))}>
            <Input name="name" placeholder="Backbone West" required />
            <Select name="topology" defaultValue="p2p">
              <option value="p2p">p2p</option>
              <option value="ptmp">ptmp</option>
              <option value="mesh">mesh</option>
            </Select>
            <Button type="submit">Add</Button>
          </form>
          <div className="space-y-2 text-sm">
            {networks.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{n.name} • {n.topology} • {n.status}</p>
                <div className="flex items-center gap-2">
                  <Select
                    defaultValue={n.status}
                    onChange={(e) => updateMutation.mutate({ table: "networks", id: n.id, payload: { status: e.target.value } })}
                  >
                    <option value="active">active</option>
                    <option value="degraded">degraded</option>
                    <option value="inactive">inactive</option>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "networks", id: n.id })}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Point-to-Point Wireless Links">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createLink.mutate(p))}>
            <Select name="network_id" defaultValue="">
              <option value="">Select network (optional)</option>
              {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
            <Select name="source_site_id" required defaultValue="">
              <option value="">Source site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select name="destination_site_id" required defaultValue="">
              <option value="">Destination site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="frequency_mhz" placeholder="5800" required />
            <Input name="capacity_mbps" placeholder="1000" required />
            <Input name="channel_width_mhz" placeholder="40" required />
            <Button type="submit">Add</Button>
          </form>
          <div className="space-y-2 text-sm">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{l.frequency_mhz}MHz • {l.capacity_mbps}Mbps • {l.status}</p>
                <div className="flex items-center gap-2">
                  <Select
                    defaultValue={l.status}
                    onChange={(e) => updateMutation.mutate({ table: "wireless_links", id: l.id, payload: { status: e.target.value } })}
                  >
                    <option value="up">up</option>
                    <option value="degraded">degraded</option>
                    <option value="down">down</option>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "wireless_links", id: l.id })}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Point-to-Multipoint Distribution">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createSector.mutate(p))}>
            <Select name="site_id" required defaultValue="">
              <option value="">Select site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="sector_name" placeholder="Sector-A" required />
            <Input name="azimuth" placeholder="120" required />
            <Input name="beamwidth" placeholder="60" required />
            <Input name="max_subscribers" placeholder="64" />
            <Button type="submit">Add Sector</Button>
          </form>
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createClient.mutate(p))}>
            <Select name="sector_id" required defaultValue="">
              <option value="">Select sector</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.sector_name}</option>)}
            </Select>
            <Select name="subscriber_id" required defaultValue="">
              <option value="">Select subscriber</option>
              {subscribers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input name="signal_strength" placeholder="-55" />
            <Button type="submit">Attach Client</Button>
          </form>
          <div className="space-y-2 text-xs text-slate-600">
            {sectors.map((s) => (
              <div key={s.id} className="rounded border border-slate-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p>{s.sector_name} • az {s.azimuth} • bw {s.beamwidth}</p>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "ptmp_sectors", id: s.id })}>Delete</Button>
                </div>
              </div>
            ))}
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>client {c.subscriber_id} • sector {c.sector_id} • {c.signal_strength ?? "-"} dBm</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "ptmp_clients", id: c.id })}>Detach</Button>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Automated Failover Policies">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createFailover.mutate(p))}>
            <Select name="network_id" required defaultValue="">
              <option value="">Select network</option>
              {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
            <Select name="primary_link_id" required defaultValue="">
              <option value="">Primary link</option>
              {links.map((l) => <option key={l.id} value={l.id}>{l.id.slice(0, 8)} • {l.frequency_mhz}MHz</option>)}
            </Select>
            <Select name="backup_link_id" required defaultValue="">
              <option value="">Backup link</option>
              {links.map((l) => <option key={l.id} value={l.id}>{l.id.slice(0, 8)} • {l.frequency_mhz}MHz</option>)}
            </Select>
            <Input name="latency_threshold_ms" placeholder="120" />
            <Input name="packet_loss_threshold" placeholder="2.5" />
            <Button type="submit">Add Policy</Button>
          </form>
          <div className="space-y-2 text-sm">
            {failover.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{f.network_id} • {f.enabled ? "enabled" : "disabled"}</p>
                <div className="flex items-center gap-2">
                  <Select
                    defaultValue={String(f.enabled)}
                    onChange={(e) => updateMutation.mutate({ table: "failover_policies", id: f.id, payload: { enabled: e.target.value === "true" } })}
                  >
                    <option value="true">enabled</option>
                    <option value="false">disabled</option>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "failover_policies", id: f.id })}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Load Balancing">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createPool.mutate(p))}>
            <Input name="name" placeholder="ISP-Pool-1" required />
            <Select name="algorithm" defaultValue="round_robin">
              <option value="round_robin">round_robin</option>
              <option value="least_conn">least_conn</option>
              <option value="weighted">weighted</option>
            </Select>
            <Input name="max_sessions" placeholder="10000" />
            <Button type="submit">Add Pool</Button>
          </form>
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createMember.mutate(p))}>
            <Select name="pool_id" required defaultValue="">
              <option value="">Pool</option>
              {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select name="link_id" required defaultValue="">
              <option value="">Link</option>
              {links.map((l) => <option key={l.id} value={l.id}>{l.id.slice(0, 8)} • {l.frequency_mhz}MHz</option>)}
            </Select>
            <Input name="weight" placeholder="1" />
            <Button type="submit">Add Member</Button>
          </form>
          <div className="space-y-2 text-sm">
            {pools.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{p.name} • {p.algorithm} • {p.max_sessions}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "load_balancing_pools", id: p.id })}>Delete</Button>
              </div>
            ))}
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{m.pool_id} • link {m.link_id} • w={m.weight}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "load_balancing_members", id: m.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Mesh Network Support">
          <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={submit((p) => createMesh.mutate(p))}>
            <Select name="equipment_id" required defaultValue="">
              <option value="">Equipment</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </Select>
            <Select name="parent_node_id" defaultValue="">
              <option value="">Parent node (optional)</option>
              {mesh.map((m) => <option key={m.id} value={m.id}>{m.id.slice(0, 8)}</option>)}
            </Select>
            <Input name="hops" placeholder="0" />
            <Button type="submit">Add Mesh Node</Button>
          </form>
          <div className="space-y-2 text-sm">
            {mesh.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
                <p>{m.equipment_id} • parent {m.parent_node_id ?? "root"} • hops {m.hops}</p>
                <Button size="sm" variant="outline" onClick={() => removeMutation.mutate({ table: "mesh_nodes", id: m.id })}>Delete</Button>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
    </AppShell>
  );
}
