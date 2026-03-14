"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertList } from "@/components/common/alert-list";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/use-user-profile";
import { listActiveAlerts, resolveAlert } from "@/services/alerts-service";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile();
  const canResolve = profile?.role === "admin" || profile?.role === "operator";
  const { data: alerts = [], isLoading, error } = useQuery({ queryKey: ["alerts"], queryFn: listActiveAlerts });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <AppShell title="Alerts">
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertList alarms={alerts} />
        <Card>
          <CardHeader>
            <CardTitle>Resolve Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <p className="text-sm text-slate-500">Loading alerts...</p> : null}
            {error ? <p className="text-sm text-red-600">Unable to load alerts.</p> : null}
            {!isLoading && !error && alerts.length === 0 ? <p className="text-sm text-slate-500">No pending alerts.</p> : null}
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                  <p className="text-xs text-slate-500">Severity: {alert.severity}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canResolve}
                  onClick={() => resolveMutation.mutate(alert.id)}
                >
                  Resolve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
