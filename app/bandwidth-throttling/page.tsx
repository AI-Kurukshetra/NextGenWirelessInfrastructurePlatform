"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { listSubscribers } from "@/services/subscribers-service";

export const dynamic = "force-dynamic";

export default function BandwidthThrottlingPage() {
  const { data: subscribers = [] } = useQuery({ queryKey: ["subscribers"], queryFn: listSubscribers });

  return (
    <AppShell title="Bandwidth Throttling Enforcement">
      <FeatureCard title="Effective Speed Limits by Subscription Tier">
        <div className="space-y-2 text-sm">
          {subscribers.map((s: any) => (
            <p key={s.id}>
              {s.name} • status {s.status} • enforced {s.enforced_speed_limit ?? 0} Mbps
            </p>
          ))}
        </div>
      </FeatureCard>
    </AppShell>
  );
}
