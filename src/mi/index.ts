import { readJSON, writeJSON } from "../utils/io";
import { uuid } from "../utils/hash";
import { getAccount } from "./account";
import { MiIOT } from "./miot";
import { MiNA } from "./mina";
import { MiAccount } from "./types";

interface Store {
  miiot?: MiAccount;
  mina?: MiAccount;
}
const kConfigFile = ".mi.json";

export async function getMiService(config: {
  service: "miiot" | "mina";
  userId?: string;
  password?: string;
  did?: string;
  relogin?: boolean;
}) {
  const { service, userId, password, did, relogin } = config;
  const overrides: any = relogin ? {} : { did, userId, password };
  const randomDeviceId = "android_" + uuid();
  const store: Store = (await readJSON(kConfigFile)) ?? {};
  let account = {
    deviceId: randomDeviceId,
    ...store[service],
    ...overrides,
    sid: service === "miiot" ? "xiaomiio" : "micoapi",
  };
  if (!account.userId || !account.password) {
    console.error("❌ 没有找到账号或密码，请检查是否已配置相关参数：userId, password");
    return;
  }
  account = await getAccount(account);
  if (!account?.serviceToken || !account.pass?.ssecurity) {
    return undefined;
  }
  store[service] = account;
  await writeJSON(kConfigFile, store);
  return service === "miiot"
    ? new MiIOT(account as any)
    : new MiNA(account as any);
}
