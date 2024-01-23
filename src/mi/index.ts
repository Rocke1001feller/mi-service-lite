import { readJSON, writeJSON } from "../utils/io";
import { uuid } from "../utils/hash";
import { MiAccount, getAccount } from "./account";
import { MiIOT } from "./miot";
import { MiNA } from "./mina";

interface Store {
  miiot?: MiAccount;
  mina?: MiAccount;
}
const kConfigFile = ".mi.json";

export async function getMiService(config: {
  service: "miiot" | "mina";
  username: string;
  password: string;
  deviceId?: string;
}) {
  const { service, username, password, deviceId = uuid() } = config;
  let account: MiAccount | undefined;
  const store: Store = (await readJSON(kConfigFile)) ?? {};
  account = await getAccount({
    ...store[service],
    username,
    password,
    deviceId,
    sid: service === "miiot" ? "xiaomiio" : "micoapi",
  });
  if (!account?.serviceToken) {
    return undefined;
  }
  store[service] = account;
  await writeJSON(kConfigFile, store);
  return service === "miiot" ? new MiIOT(account) : new MiNA(account);
}
