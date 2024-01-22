import { readJSON, writeJSON } from "../utils/io";
import { randomString, uuid } from "../utils/hash";
import { MiAccount, getAccount } from "./account";
import { MiIOT } from "./miot";
import { MiNA } from "./mina";

interface Store {
  deviceId: string;
  userId: number;
  passToken: string;
  miiot?: string[];
  mina?: string[];
}

export async function getMiService(opt: {
  service: "miiot" | "mina";
  username: string;
  password: string;
  deviceId?: string;
}) {
  const { service, username, password, deviceId = "wb_" + uuid() } = opt;
  let account: MiAccount | undefined;
  const store: Store = (await readJSON(".mi")) ?? {
    deviceId,
    userId: 0,
    passToken: "",
  };
  if (!store[service]) {
    account = await getAccount({
      deviceId: store.deviceId,
      username,
      password,
      sid: service === "miiot" ? "xiaomiio" : "micoapi",
    });
    if (!account) {
      return undefined;
    }
    store.userId = account.userId;
    store.passToken = account.passToken;
    store[service] = [account.ssecurity, account.serviceToken];
    await writeJSON(".mi", store);
  } else {
    account = {
      deviceId: store.deviceId,
      userId: store.userId,
      passToken: store.passToken,
      ssecurity: store[service]![0],
      serviceToken: store[service]![1],
    };
  }
  return service === "miiot" ? new MiIOT(account) : new MiNA(account);
}
