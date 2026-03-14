import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
