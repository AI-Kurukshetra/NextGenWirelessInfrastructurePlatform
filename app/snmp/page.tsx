"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { FeatureCard } from "@/components/common/feature-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { coreFeaturesService } from "@/services/core-features-service";

export const dynamic = "force-dynamic";

export default function SnmpPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["snmp"], queryFn: coreFeaturesService.listSnmpProfiles });
  const mutation = useMutation({
    mutationFn: coreFeaturesService.createSnmpProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snmp"] }),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget).entries()));
    e.currentTarget.reset();
  };

  return (
    <AppShell title="SNMP Integration">
      <FeatureCard title="SNMP Monitoring Profiles">
        <form className="mb-3 grid gap-2 md:grid-cols-3" onSubmit={onSubmit}>
          <Input name="name" placeholder="Default SNMP" required />
          <Select name="version" defaultValue="v2c">
            <option value="v2c">v2c</option>
            <option value="v3">v3</option>
          </Select>
          <Input name="community" placeholder="public" />
          <Input name="auth_protocol" placeholder="SHA" />
          <Input name="privacy_protocol" placeholder="AES" />
          <Input name="poll_interval_sec" placeholder="60" />
          <Button type="submit">Save SNMP Profile</Button>
        </form>
        <div className="space-y-2 text-sm">{data.map((s: any) => <p key={s.id}>{s.name} • {s.version} • every {s.poll_interval_sec}s</p>)}</div>
      </FeatureCard>
    </AppShell>
  );
}
