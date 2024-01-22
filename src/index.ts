import { getMiService } from "./mi/index";

interface MiServiceConfig {
  username: string;
  password: string;
  deviceId?: string;
}

export async function getMiIOT(config: MiServiceConfig) {
  return getMiService({ service: "miiot", ...config });
}

export async function getMiNA(config: MiServiceConfig) {
  return getMiService({ service: "mina", ...config });
}
