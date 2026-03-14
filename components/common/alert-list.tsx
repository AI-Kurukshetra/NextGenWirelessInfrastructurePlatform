"use client";

import { useEffect, useMemo, useState } from "react";
import type { Alarm } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const severityVariant: Record<Alarm["severity"], "danger" | "warning" | "info" | "default"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
};

type AlertListProps = {
  alarms: Alarm[];
  pageSize?: number;
};

export function AlertList({ alarms, pageSize }: AlertListProps) {
  const [page, setPage] = useState(1);
  const isPaginated = Boolean(pageSize && pageSize > 0);
  const safePageSize = pageSize ?? 1;
  const pageCount = isPaginated ? Math.max(1, Math.ceil(alarms.length / safePageSize)) : 1;

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const displayedAlarms = useMemo(() => {
    if (!isPaginated) return alarms;
    const start = (page - 1) * safePageSize;
    return alarms.slice(start, start + safePageSize);
  }, [alarms, isPaginated, page, safePageSize]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alarms.length === 0 ? <p className="text-sm text-slate-500">No active alerts</p> : null}
        {displayedAlarms.map((alarm) => (
          <div key={alarm.id} className="rounded-md border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Badge variant={severityVariant[alarm.severity]}>{alarm.severity.toUpperCase()}</Badge>
              <span className="text-xs text-slate-500">{formatDate(alarm.created_at)}</span>
            </div>
            <p className="text-sm font-medium text-slate-900">{alarm.message}</p>
          </div>
        ))}
        {isPaginated && alarms.length > (pageSize ?? 0) ? (
          <div className="flex items-center justify-end gap-2 pt-1">
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
        ) : null}
      </CardContent>
    </Card>
  );
}
