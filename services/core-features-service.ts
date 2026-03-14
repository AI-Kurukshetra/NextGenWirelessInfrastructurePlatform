import { getSupabaseBrowserClient } from "@/lib/supabase";

async function list<T>(table: string, order = "created_at", ascending = false) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function create<T>(table: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data as T;
}

async function update<T>(table: string, id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as T;
}

async function remove(table: string, id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export const coreFeaturesService = {
  listNetworks: () => list("networks"),
  createNetwork: (payload: Record<string, unknown>) => create("networks", payload),

  listWirelessLinks: () => list("wireless_links"),
  createWirelessLink: (payload: Record<string, unknown>) => create("wireless_links", payload),

  listPtmpSectors: () => list("ptmp_sectors"),
  createPtmpSector: (payload: Record<string, unknown>) => create("ptmp_sectors", payload),

  listPtmpClients: () => list("ptmp_clients"),
  createPtmpClient: (payload: Record<string, unknown>) => create("ptmp_clients", payload),

  listSpectrumAllocations: () => list("spectrum_allocations"),
  createSpectrumAllocation: (payload: Record<string, unknown>) => create("spectrum_allocations", payload),

  listQosProfiles: () => list("qos_profiles"),
  createQosProfile: (payload: Record<string, unknown>) => create("qos_profiles", payload),

  listSubscriberQos: () => list("subscriber_qos"),
  createSubscriberQos: (payload: Record<string, unknown>) => create("subscriber_qos", payload),

  listFailoverPolicies: () => list("failover_policies"),
  createFailoverPolicy: (payload: Record<string, unknown>) => create("failover_policies", payload),
  listFailoverEvents: () => list("failover_events"),

  listSecurityPolicies: () => list("security_policies"),
  createSecurityPolicy: (payload: Record<string, unknown>) => create("security_policies", payload),

  listCoverageZones: () => list("coverage_zones"),
  createCoverageZone: (payload: Record<string, unknown>) => create("coverage_zones", payload),
  listRfPropagationModels: () => list("rf_propagation_models"),
  createRfPropagationModel: (payload: Record<string, unknown>) => create("rf_propagation_models", payload),
  listCoverageMeasurements: () => list("coverage_measurements", "collected_at", false),
  createCoverageMeasurement: (payload: Record<string, unknown>) => create("coverage_measurements", payload),

  listConfigBackups: () => list("device_config_backups"),
  createConfigBackup: (payload: Record<string, unknown>) => create("device_config_backups", payload),

  listFirmwareCampaigns: () => list("firmware_campaigns"),
  createFirmwareCampaign: (payload: Record<string, unknown>) => create("firmware_campaigns", payload),
  listFirmwareCampaignDevices: () => list("firmware_campaign_devices", "updated_at", false),

  listGuestNetworks: () => list("guest_networks"),
  createGuestNetwork: (payload: Record<string, unknown>) => create("guest_networks", payload),

  listLoadBalancingPools: () => list("load_balancing_pools"),
  createLoadBalancingPool: (payload: Record<string, unknown>) => create("load_balancing_pools", payload),

  listLoadBalancingMembers: () => list("load_balancing_members"),
  createLoadBalancingMember: (payload: Record<string, unknown>) => create("load_balancing_members", payload),

  listMeshNodes: () => list("mesh_nodes"),
  createMeshNode: (payload: Record<string, unknown>) => create("mesh_nodes", payload),

  listApiIntegrations: () => list("api_integrations"),
  createApiIntegration: (payload: Record<string, unknown>) => create("api_integrations", payload),

  listSnmpProfiles: () => list("snmp_profiles"),
  createSnmpProfile: (payload: Record<string, unknown>) => create("snmp_profiles", payload),

  listTrafficShapingPolicies: () => list("traffic_shaping_policies"),
  createTrafficShapingPolicy: (payload: Record<string, unknown>) => create("traffic_shaping_policies", payload),

  listMobileCommands: () => list("mobile_commands"),
  createMobileCommand: (payload: Record<string, unknown>) => create("mobile_commands", payload),

  listTickets: () => list("tickets"),
  createTicket: (payload: Record<string, unknown>) => create("tickets", payload),

  listInventoryItems: () => list("inventory_items"),
  createInventoryItem: (payload: Record<string, unknown>) => create("inventory_items", payload),

  listMaintenanceTasks: () => list("maintenance_tasks"),
  createMaintenanceTask: (payload: Record<string, unknown>) => create("maintenance_tasks", payload),

  listBillingRecords: () => list("billing_records", "due_date", true),
  createBillingRecord: (payload: Record<string, unknown>) => create("billing_records", payload),

  listAdvancedFeatureProfiles: () => list("advanced_feature_profiles"),
  createAdvancedFeatureRun: (payload: Record<string, unknown>) => create("advanced_feature_runs", payload),
  listAdvancedFeatureRuns: () => list("advanced_feature_runs"),

  listVendorDeviceProfiles: () => list("vendor_device_profiles"),
  createVendorDeviceProfile: (payload: Record<string, unknown>) => create("vendor_device_profiles", payload),
  listProvisioningJobs: () => list("provisioning_jobs"),

  listReportJobs: () => list("report_jobs"),
  createReportJob: (payload: Record<string, unknown>) => create("report_jobs", payload),

  listSecurityEvents: () => list("security_events"),
  listVpnTunnels: () => list("vpn_tunnels"),
  createVpnTunnel: (payload: Record<string, unknown>) => create("vpn_tunnels", payload),

  listCoveragePredictions: () => list("coverage_predictions"),
  listSpectrumScans: () => list("spectrum_scans"),
  createSpectrumScan: (payload: Record<string, unknown>) => create("spectrum_scans", payload),
  listChannelRecommendations: () => list("channel_recommendations"),

  listMetricThresholds: () => list("metric_thresholds"),
  createMetricThreshold: (payload: Record<string, unknown>) => create("metric_thresholds", payload),

  listSubscriberProvisioningJobs: () => list("subscriber_provisioning_jobs"),
  listSubscriberSessions: () => list("subscriber_sessions", "updated_at", false),

  listPredictiveMaintenanceScores: () => list("predictive_maintenance_scores"),

  listInnovationBacklog: () => list("innovation_backlog"),
  createInnovationBacklogItem: (payload: Record<string, unknown>) => create("innovation_backlog", payload),
  listInnovationPilots: () => list("innovation_pilots"),
  createInnovationPilot: (payload: Record<string, unknown>) => create("innovation_pilots", payload),

  update,
  remove,
};
