import { decodeMiIOT, encodeMiIOT, encodeQuery } from "../utils/codec";
import { Http } from "../utils/http";
import { jsonDecode } from "../utils/json";
import { MiAccount } from "./account";

// "LX06": ("5-1", "5-5"), 小爱音箱 Pro

export class MiIOT { 
  account: MiAccount;
  server: string;

  constructor(
    account: MiAccount,
    region: "cn" | "de" | "i2" | "ru" | "sg" | "us" = "cn"
  ) {
    this.account = account;
    const prefix = region === "cn" ? "" : region + ".";
    this.server = `https://${prefix}api.io.mi.com/app`;
  }

  private async _calMiIOT(uri: string, data: any) {
    if (data) {
      data = encodeMiIOT("POST", uri, data, this.account.ssecurity);
    }
    const headers = {
      "User-Agent":
        "iOS-14.4-6.0.103-iPhone12,3--D7744744F7AF32F0544445285880DD63E47D9BE9-8816080-84A3F44E137B71AE-iPhone",
      "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
      "miot-accept-encoding": "GZIP",
      "miot-encrypt-algorithm": "ENCRYPT-RC4",
      Cookie: `PassportDeviceId=${this.account.deviceId}; serviceToken="${this.account.serviceToken}"; userId=${this.account.userId}`,
    } as any;
    let res;
    if (data) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      res = await Http.post(this.server + uri, encodeQuery(data), {
        headers: headers,
        validateStatus: () => true,
      });
    } else {
      res = await Http.get(this.server + uri, {
        headers: headers,
        validateStatus: () => true,
      });
    }
    if (typeof res.data != "string") {
      throw res;
    }
    res = await decodeMiIOT(
      this.account.ssecurity,
      data._nonce,
      res.data,
      res.headers["miot-content-encoding"] == "GZIP"
    );
    return jsonDecode(res)?.result;
  }

  private _callHome(did: string, method: string, params: any) {
    return this._calMiIOT("/home/rpc/" + did, {
      id: 1,
      method: method,
      accessKey: "IOS00026747c5acafc2",
      params: params,
    });
  }

  private _callMiIOT(cmd: string, params: any) {
    return this._calMiIOT("/miotspec/" + cmd, {
      params: params,
      datasource: 3,
    });
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

  async getDevices(getVirtualModel = false, getHuamiDevices = 0) {
    const res = await this._calMiIOT("/home/getDevices", {
      getVirtualModel: getVirtualModel,
      getHuamiDevices: getHuamiDevices,
    });
    return res?.list;
  }
}
