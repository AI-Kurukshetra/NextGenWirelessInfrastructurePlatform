export type SupportedVendor = "cambium" | "mikrotik" | "generic";

export interface VendorEquipment {
  id: string;
  name: string;
  model: string;
  vendor: string | null;
  firmware_version: string;
  management_ip: string | null;
}

export interface VendorProfile {
  id: string;
  name: string;
  vendor: SupportedVendor;
  model_pattern: string | null;
  transport: "https" | "snmp" | "ssh" | "api";
  config_template: Record<string, unknown>;
}

export interface ProvisioningRequest {
  equipment: VendorEquipment;
  profile: VendorProfile | null;
  mode: "provision" | "backup" | "firmware" | "diagnostic";
  params: Record<string, unknown>;
}

export interface ProvisioningResult {
  ok: boolean;
  vendor: SupportedVendor;
  summary: string;
  payload: Record<string, unknown>;
}

interface VendorAdapter {
  vendor: SupportedVendor;
  supportsModel(model: string): boolean;
  buildPayload(input: ProvisioningRequest): Record<string, unknown>;
  provision(input: ProvisioningRequest): Promise<ProvisioningResult>;
  capabilities(): string[];
}

class CambiumAdapter implements VendorAdapter {
  vendor: SupportedVendor = "cambium";

  supportsModel(model: string) {
    const m = model.toLowerCase();
    return m.includes("cambium") || m.includes("epmp") || m.includes("cnwave") || m.includes("cnpilot");
  }

  buildPayload(input: ProvisioningRequest) {
    return {
      protocol: input.profile?.transport ?? "https",
      endpoint: input.equipment.management_ip ?? "unconfigured",
      mode: input.mode,
      template: {
        system: {
          hostname: input.equipment.name,
          timezone: "UTC",
          vendor_profile: input.profile?.name ?? "default-cambium",
        },
        radio: {
          channel_width_mhz: input.params.channel_width_mhz ?? 40,
          tx_power_dbm: input.params.tx_power_dbm ?? 20,
          country_code: input.params.country_code ?? "US",
        },
        qos: {
          scheduler: input.params.scheduler ?? "hqf",
          management_vlan: input.params.management_vlan ?? 10,
        },
      },
    };
  }

  async provision(input: ProvisioningRequest): Promise<ProvisioningResult> {
    const payload = this.buildPayload(input);
    return {
      ok: true,
      vendor: this.vendor,
      summary: `Cambium ${input.mode} executed for ${input.equipment.model}`,
      payload,
    };
  }

  capabilities() {
    return [
      "provisioning-template",
      "config-backup",
      "firmware-upgrade",
      "diagnostics-capture",
      "qos-baseline",
    ];
  }
}

class MikroTikAdapter implements VendorAdapter {
  vendor: SupportedVendor = "mikrotik";

  supportsModel(model: string) {
    return model.toLowerCase().includes("mikrotik");
  }

  buildPayload(input: ProvisioningRequest) {
    return {
      transport: input.profile?.transport ?? "ssh",
      endpoint: input.equipment.management_ip ?? "unconfigured",
      script: {
        set_identity: input.equipment.name,
        wlan_country: input.params.country_code ?? "united states",
        channel_width: input.params.channel_width_mhz ?? "20/40mhz-Ce",
      },
    };
  }

  async provision(input: ProvisioningRequest): Promise<ProvisioningResult> {
    return {
      ok: true,
      vendor: this.vendor,
      summary: `MikroTik ${input.mode} simulated successfully`,
      payload: this.buildPayload(input),
    };
  }

  capabilities() {
    return ["routeros-script", "backup", "firmware-upgrade", "snmp-bootstrap"];
  }
}

class GenericAdapter implements VendorAdapter {
  vendor: SupportedVendor = "generic";
  supportsModel() {
    return true;
  }
  buildPayload(input: ProvisioningRequest) {
    return {
      mode: input.mode,
      equipment_id: input.equipment.id,
      profile: input.profile?.name ?? "generic",
      params: input.params,
    };
  }
  async provision(input: ProvisioningRequest): Promise<ProvisioningResult> {
    return {
      ok: true,
      vendor: this.vendor,
      summary: `Generic ${input.mode} workflow generated`,
      payload: this.buildPayload(input),
    };
  }
  capabilities() {
    return ["basic-provisioning", "command-templating"];
  }
}

const adapters: VendorAdapter[] = [new CambiumAdapter(), new MikroTikAdapter(), new GenericAdapter()];

export function inferVendor(model: string, existingVendor?: string | null): SupportedVendor {
  if (existingVendor === "cambium" || existingVendor === "mikrotik" || existingVendor === "generic") {
    return existingVendor;
  }

  const lower = model.toLowerCase();
  if (lower.includes("cambium") || lower.includes("epmp") || lower.includes("cnwave") || lower.includes("cnpilot")) {
    return "cambium";
  }
  if (lower.includes("mikrotik")) return "mikrotik";
  return "generic";
}

export function resolveVendorAdapter(vendor: SupportedVendor, model: string): VendorAdapter {
  return adapters.find((adapter) => adapter.vendor === vendor && adapter.supportsModel(model))
    ?? adapters.find((adapter) => adapter.vendor === vendor)
    ?? adapters[adapters.length - 1];
}

export function listVendorCapabilities() {
  return adapters.map((adapter) => ({
    vendor: adapter.vendor,
    capabilities: adapter.capabilities(),
  }));
}
