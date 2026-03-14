import type { EquipmentStatus, SubscriberStatus, UserRole } from "./database";

export interface AuthFormValues {
  email: string;
  password: string;
  fullName?: string;
  role?: UserRole;
}

export interface SiteFormValues {
  name: string;
  latitude: number;
  longitude: number;
  tower_height: number;
}

export interface EquipmentFormValues {
  name: string;
  model: string;
  firmware_version: string;
  site_id: string;
  status: EquipmentStatus;
  temperature: number;
  vendor?: string;
  management_ip?: string;
  provisioning_state?: "unprovisioned" | "provisioning" | "provisioned" | "failed";
}

export interface SubscriberFormValues {
  name: string;
  email: string;
  service_plan_id: string;
  status: SubscriberStatus;
  connection_site: string;
}
