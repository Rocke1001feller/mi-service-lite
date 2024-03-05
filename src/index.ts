import { getMiService } from "./mi/index";
import { MiNA } from "./mi/mina";
import { MiIOT } from "./mi/miot";
import { Debugger } from "./utils/debug";

export { MiNA, MiIOT };

export interface MiServiceConfig {
  userId: string;
  password: string;
  did?: string;
  enableTrace?: boolean;
}

export async function getMiIOT(
  config: MiServiceConfig
): Promise<MiIOT | undefined> {
  Debugger.enableTrace = config.enableTrace;
  return getMiService({ service: "miiot", ...config }) as any;
}

export async function getMiNA(
  config: MiServiceConfig
): Promise<MiNA | undefined> {
  Debugger.enableTrace = config.enableTrace;
  return getMiService({ service: "mina", ...config }) as any;
}
