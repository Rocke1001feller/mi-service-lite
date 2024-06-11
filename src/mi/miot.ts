import { decodeMiIOT, encodeMiIOT, encodeQuery } from "../utils/codec";
import { Debugger } from "../utils/debug";
import { Http } from "../utils/http";
import { jsonEncode } from "../utils/json";
import { MiAccount, MiIOTDevice } from "./types";

type MiIOTMiAccount = MiAccount & { device: MiIOTDevice };

export class MiIOT {
  account: MiIOTMiAccount;

  constructor(account: MiIOTMiAccount) {
    this.account = account;
  }

  static async getDevice(account: MiIOTMiAccount): Promise<MiIOTMiAccount> {
    if (account.sid !== "xiaomiio") {
      return account;
    }
    const devices = await this.__callMiIOT(account, "POST", "/home/device_list", {
      getVirtualModel: false,
      getHuamiDevices: 0,
    });
    if (Debugger.enableTrace) {
      console.log("MiIOT 设备列表: ", jsonEncode(devices, { prettier: true }));
    }
    const device = (devices?.list ?? []).find((e: any) =>
      [e.did, e.name].includes(account.did)
    );
    if (device) {
      account.device = device;
    }
    return account;
  }

  private static async __callMiIOT(
    account: MiIOTMiAccount,
    method: "GET" | "POST",
    path: string,
    _data?: any
  ) {
    const url = "https://api.io.mi.com/app" + path;
    const config = {
      rawResponse: true,
      validateStatus: () => true,
      headers: {
        "User-Agent": "MICO/AndroidApp/@SHIP.TO.2A2FE0D7@/2.4.40",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "miot-accept-encoding": "GZIP",
        "miot-encrypt-algorithm": "ENCRYPT-RC4",
      },
      cookies: {
        countryCode: "CN",
        locale: "zh_CN",
        timezone: "GMT+08:00",
        timezone_id: "Asia/Shanghai",
        userId: account.userId,
        cUserId: account.pass?.cUserId,
        PassportDeviceId: account.deviceId,
        serviceToken: account.serviceToken,
        yetAnotherServiceToken: account.serviceToken,
      },
    };
    let res;
    const data = encodeMiIOT(method, path, _data, account.pass!.ssecurity!);
    if (method === "GET") {
      res = await Http.get(url, data, config);
    } else {
      res = await Http.post(url, encodeQuery(data as any), config);
    }
    if (typeof res.data !== "string") {
      console.error("_callMiIOT failed", res);
      return undefined;
    }
    res = await decodeMiIOT(
      account.pass!.ssecurity!,
      data._nonce,
      res.data,
      res.headers["miot-content-encoding"] === "GZIP"
    );
    return res?.result;
  }

  private async _callMiIOT(method: "GET" | "POST", path: string, data?: any) {
    return MiIOT.__callMiIOT(this.account, method, path, data);
  }

  rpc(method: string, params: any, id = 1) {
    return this._callMiIOT("POST", "/home/rpc/" + this.account.device.did, {
      id,
      method,
      params,
    });
  }

  /**
   * - datasource=1  优先从服务器缓存读取，没有读取到下发rpc；不能保证取到的一定是最新值
   * - datasource=2  直接下发rpc，每次都是设备返回的最新值
   * - datasource=3  直接读缓存；没有缓存的 code 是 -70xxxx；可能取不到值
   */
  private _callMiotSpec(command: string, params: any, datasource = 2) {
    return this._callMiIOT("POST", "/miotspec/" + command, {
      params,
      datasource,
    });
  }

  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._callMiIOT("POST", "/home/device_list", {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }

  async getProperty(scope: number, property: number) {
    const res = await this._callMiotSpec("prop/get", [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property,
      },
    ]);
    return (res ?? [])?.[0]?.value;
  }

  async setProperty(scope: number, property: number, value: any) {
    const res = await this._callMiotSpec("prop/set", [
      {
        did: this.account.device.did,
        siid: scope,
        piid: property,
        value: value,
      },
    ]);
    return (res ?? [])?.[0]?.code === 0;
  }

  async doAction(scope: number, action: number, args: any = []) {
    const res = await this._callMiotSpec("action", {
      did: this.account.device.did,
      siid: scope,
      aiid: action,
      in: Array.isArray(args) ? args : [args],
    });
    return res?.code === 0;
  }
}
