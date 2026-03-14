export type UserRole = "admin" | "operator" | "technician";
export type EquipmentStatus = "online" | "offline" | "warning" | "maintenance";
export type SubscriberStatus = "active" | "suspended" | "pending";
export type AlarmSeverity = "critical" | "high" | "medium" | "low";

export type UUID = string;

export interface Organization {
  id: UUID;
  name: string;
  created_at: string;
}

export interface UserProfile {
  id: UUID;
  organization_id: UUID;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Site {
  id: UUID;
  name: string;
  latitude: number;
  longitude: number;
  tower_height: number;
  organization_id: UUID;
  created_at: string;
}

export interface Equipment {
  id: UUID;
  name: string;
  model: string;
  vendor?: string;
  management_ip?: string;
  provisioning_state?: "unprovisioned" | "provisioning" | "provisioned" | "failed";
  firmware_version: string;
  site_id: UUID;
  organization_id: UUID;
  status: EquipmentStatus;
  temperature: number;
  last_seen: string;
  created_at: string;
}

export interface Link {
  id: UUID;
  source_site_id: UUID;
  destination_site_id: UUID;
  capacity_mbps: number;
  utilization_percent: number;
  organization_id: UUID;
  created_at: string;
}

export interface ServicePlan {
  id: UUID;
  name: string;
  speed_limit: number;
  monthly_price: number;
  bandwidth_cap: number;
  organization_id: UUID;
  created_at: string;
}

export interface Subscriber {
  id: UUID;
  name: string;
  email: string;
  service_plan_id: UUID;
  status: SubscriberStatus;
  connection_site: UUID;
  organization_id: UUID;
  account_number?: string;
  last_online_at?: string;
  access_control?: string;
  enforced_speed_limit?: number;
  created_at: string;
}

export interface PerformanceMetric {
  id: UUID;
  equipment_id: UUID;
  organization_id: UUID;
  throughput: number;
  latency: number;
  packet_loss: number;
  signal_strength: number;
  recorded_at: string;
}

export interface Alarm {
  id: UUID;
  severity: AlarmSeverity;
  message: string;
  equipment_id: UUID | null;
  site_id: UUID | null;
  organization_id: UUID;
  resolved: boolean;
  created_at: string;
}

export interface DashboardSummary {
  networkHealth: number;
  activeSites: number;
  connectedSubscribers: number;
  onlineEquipment: number;
  totalEquipment: number;
  alertCount: number;
}
