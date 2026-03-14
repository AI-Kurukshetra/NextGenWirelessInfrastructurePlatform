"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Button } from "@/components/ui/button";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

type MeshNodeRow = { id: string; equipment_id: string; parent_node_id: string | null; hops: number };

export default function MeshPage() {
  const qc = useQueryClient();
  const { data: mesh = [] } = useQuery<MeshNodeRow[]>({
    queryKey: ["mesh-nodes"],
    queryFn: coreFeaturesService.listMeshNodes as () => Promise<MeshNodeRow[]>,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => coreFeaturesService.remove("mesh_nodes", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mesh-nodes"] }),
  });

  return (
    <AppShell title="Mesh Network Support">
      <FeatureCard title="Self-Healing Mesh Node Topology">
        <div className="space-y-2 text-sm">
          {mesh.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <p>{m.equipment_id} • parent {m.parent_node_id ?? "root"} • hops {m.hops}</p>
              <Button size="sm" variant="outline" onClick={() => removeMutation.mutate(m.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
