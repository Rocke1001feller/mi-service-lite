import { decodeMiIOT, encodeMiIOT, encodeQuery } from "../utils/codec";
import { Http } from "../utils/http";
import { jsonDecode } from "../utils/json";
import { MiAccount, MiIOTDevice } from "./types";

type MiIOTMiAccount = MiAccount & { device: MiIOTDevice };

export class MiIOT {
  account: MiIOTMiAccount;

  constructor(account: MiIOTMiAccount) {
    this.account = account;
  }

  static async getDevice(
    account: MiIOTMiAccount,
    getVirtualModel = false,
    getHuamiDevices = 0
  ): Promise<MiIOTDevice | undefined> {
    const res = await this.__calMiIO(account, "POST", "/home/device_list", {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    const device = (res?.list ?? []).find((e: any) =>
      [e.did, e.name].includes(account.did)
    );
    return device;
  }

  private static async __calMiIO(
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
      console.error("_calMiIO failed", res);
      return undefined;
    }
    res = await decodeMiIOT(
      account.pass!.ssecurity!,
      data._nonce,
      res.data,
      res.headers["miot-content-encoding"] === "GZIP"
    );
    return jsonDecode(res)?.result;
  }

  private async _calMiIO(method: "GET" | "POST", path: string, data?: any) {
    return MiIOT.__calMiIO(this.account, method, path, data);
  }

  private _callHome(method: string, params: any, id = 1) {
    return this._calMiIO("POST", "/home/rpc/" + this.account.device.did, {
      id,
      method,
      params,
    });
  }

  private _callMiIOT(cmd: string, params: any, datasource = 3) {
    return this._calMiIO("POST", "/miotspec/" + cmd, { params, datasource });
  }

  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._calMiIO("POST", "/home/device_list", {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }

  getHomeProps(props: any) {
    return this._callHome("get_prop", props);
  }

  setHomeProps(props: any) {
    return Promise.all(props.map((i: any) => this.setHomeProp(i[0], i[1])));
  }

  getHomeProp(prop: string) {
    return this.getHomeProps([prop]).then((result) => result[0]);
  }

  setHomeProp(prop: string, value: any) {
    return this._callHome(
      "set_" + prop,
      Array.isArray(value) ? value : [value]
    );
  }

  async getProps(iids: [number, number][]) {
    const params = iids.map((i) => ({
      did: this.account.device.did,
      siid: i[0],
      piid: i[1],
    }));
    const res = await this._callMiIOT("prop/get", params);
    return (res ?? []).map((it: any) => it["value"] || null);
  }

  async setProps(props: [number, number, any][]) {
    const params = props.map((i) => ({
      did: this.account.device.did,
      siid: i[0],
      piid: i[1],
      value: i[2],
    }));
    const res = await this._callMiIOT("prop/set", params);
    return res.map((it: any) => it["code"] || -1);
  }

  async getProp(iid: [number, number]) {
    const res = await this.getProps([iid]);
    return res?.[0];
  }

  async setProp(iid: [number, number], value: any) {
    const res = await this.setProps([[iid[0], iid[1], value]]);
    return res?.[0];
  }

  doAction(iid: [number, number], args = []) {
    return this._callMiIOT("action", {
      did: this.account.device.did,
      siid: iid[0],
      aiid: iid[1],
      in: args,
    });
  }
}
