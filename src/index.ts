import { getMiService } from "./mi/index";
import { MiNA } from "./mi/mina";
import { MiIOT } from "./mi/miot";
import { Debugger } from "./utils/debug";
import { Http } from "./utils/http";

export { MiNA, MiIOT };

export interface MiServiceConfig {
  userId: string;
  password: string;
  did?: string;
  enableTrace?: boolean;
  /**
   * 网络请求超时时间，单位毫秒，默认 3000（3 秒）
   */
  timeout?: number;
}

export async function getMiIOT(
  config: MiServiceConfig
): Promise<MiIOT | undefined> {
  Debugger.enableTrace = config.enableTrace;
  Http.timeout = config.timeout ?? Http.timeout;
  return getMiService({ service: "miiot", ...config }) as any;
}

export async function getMiNA(
  config: MiServiceConfig
): Promise<MiNA | undefined> {
  Debugger.enableTrace = config.enableTrace;
  Http.timeout = config.timeout ?? Http.timeout;
  return getMiService({ service: "mina", ...config }) as any;
}
