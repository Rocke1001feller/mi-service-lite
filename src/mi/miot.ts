import { decodeMiIOT, encodeMiIOT, encodeQuery } from "../utils/codec";
import { Http } from "../utils/http";
import { jsonDecode } from "../utils/json";
import { MiAccount } from "./types";

export class MiIOT {
  account: MiAccount;

  constructor(account: MiAccount) {
    this.account = account;
  }

  private async _calMiIO(method: "GET" | "POST", path: string, _data?: any) {
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
        userId: this.account.userId,
        serviceToken: this.account.serviceToken,
        sn: this.account.device?.serialNumber,
        hardware: this.account.device?.hardware,
        deviceId: this.account.device?.deviceId,
        deviceSNProfile: this.account.device?.deviceSNProfile,
      },
    };
    let res;
    const data = encodeMiIOT(method, path, _data, this.account.ssecurity!);
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
      this.account.ssecurity!,
      data._nonce,
      res.data,
      res.headers["miot-content-encoding"] === "GZIP"
    );
    return jsonDecode(res)?.result;
  }

  private _callHome(did: string, method: string, params: any) {
    return this._calMiIO("POST", "/home/rpc/" + did, {
      id: 1,
      method: method,
      accessKey: "IOS00026747c5acafc2", // todo android key
      params: params,
    });
  }

  private _callMiIOT(cmd: string, params: any) {
    return this._calMiIO("POST", "/miotspec/" + cmd, {
      params: params,
      datasource: 3,
    });
  }

  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._calMiIO("POST", "/home/getDevices", {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }

  getHomeProps(did: string, props: any) {
    return this._callHome(did, "get_prop", props);
  }

  setHomeProps(did: string, props: any) {
    return Promise.all(
      props.map((i: any) => this.setHomeProp(did, i[0], i[1]))
    );
  }

  getHomeProp(did: string, prop: string) {
    return this.getHomeProps(did, [prop]).then((result) => result[0]);
  }

  setHomeProp(did: string, prop: string, value: any) {
    return this._callHome(
      did,
      "set_" + prop,
      Array.isArray(value) ? value : [value]
    );
  }

  async getProps(did: string, iids: [number, number][]) {
    const params = iids.map((i) => ({
      did,
      siid: i[0],
      piid: i[1],
    }));
    const res = await this._callMiIOT("prop/get", params);
    return (res ?? []).map((it: any) => it["value"] || null);
  }

  async setProps(did: string, props: [number, number, any][]) {
    const params = props.map((i) => ({
      did,
      siid: i[0],
      piid: i[1],
      value: i[2],
    }));
    const res = await this._callMiIOT("prop/set", params);
    return res.map((it: any) => it["code"] || -1);
  }

  async getProp(did: string, iid: [number, number]) {
    const res = await this.getProps(did, [iid]);
    return res?.[0];
  }

  async setProp(did: string, iid: number[], value: any) {
    const res = await this.setProps(did, [[iid[0], iid[1], value]]);
    return res?.[0];
  }

  doAction(did: string, iid: number[], args = []) {
    return this._callMiIOT("action", {
      did,
      siid: iid[0],
      aiid: iid[1],
      in: args,
    });
  }
}
