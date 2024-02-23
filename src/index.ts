import { getMiService } from "./mi/index";
import { MiNA } from "./mi/mina";
import { MiIOT } from "./mi/miot";

export { MiNA, MiIOT };

export interface MiServiceConfig {
  userId: string;
  password: string;
  did?: string;
}

export async function getMiIOT(
  config: MiServiceConfig
): Promise<MiIOT | undefined> {
  return getMiService({ service: "miiot", ...config }) as any;
}

export async function getMiNA(
  config: MiServiceConfig
): Promise<MiNA | undefined> {
  return getMiService({ service: "mina", ...config }) as any;
}
