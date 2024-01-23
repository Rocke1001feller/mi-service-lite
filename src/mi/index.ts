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
  userId: string;
  password: string;
  did?: string;
}) {
  const randomDeviceId = "android_" + uuid();
  const { service, userId, password, did } = config;
  let account: MiAccount | undefined;
  const store: Store = (await readJSON(kConfigFile)) ?? {};
  account = await getAccount({
    deviceId: randomDeviceId,
    ...store[service],
    did,
    userId,
    password,
    sid: service === "miiot" ? "xiaomiio" : "micoapi",
  });
  if (!account?.serviceToken || !account.pass?.ssecurity) {
    return undefined;
  }
  store[service] = account;
  await writeJSON(kConfigFile, store);
  return service === "miiot" ? new MiIOT(account) : new MiNA(account);
}
