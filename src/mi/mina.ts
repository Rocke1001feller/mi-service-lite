import { encodeQuery } from "../utils/codec";
import { randomString } from "../utils/hash";
import { Http } from "../utils/http";
import { jsonDecode, jsonEncode } from "../utils/json";
import { MiAccount } from "./account";

interface Conversations {
  bitSet: number[];
  records: {
    bitSet: number[];
    answers: {
      bitSet: number[];
      type: string;
      tts: {
        bitSet: number[];
        text: string;
      };
    }[];
    time: number;
    query: string;
    requestId: string;
  }[];
  nextEndTime: number;
}

export class MiNA {
  account: MiAccount;

  constructor(account: MiAccount) {
    this.account = account;
  }

  private async _callMina(uri: string, data?: any): Promise<any> {
    const requestId = "app_ios_" + randomString(30);
    if (data) {
      data["requestId"] = requestId;
      data["deviceId"] = this.account.deviceId;
    } else {
      uri += "&requestId=" + requestId;
    }
    let res;
    let url = /^https?:/.test(uri) ? uri : "https://api2.mina.mi.com" + uri;
    const headers = {
      "User-Agent":
        "MiHome/6.0.103 (com.xiaomi.mihome; build:6.0.103.1; iOS 14.4.0) Alamofire/6.0.103 MICO/iOSApp/appStore/6.0.103",
      Cookie: `PassportDeviceId=${this.account.deviceId}; serviceToken="${this.account.serviceToken}"; userId=${this.account.userId}`,
    } as any;
    if (data) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      res = await Http.post(url, encodeQuery(data), { headers: headers });
    } else {
      res = await Http.get(url, { headers: headers });
    }
    if (!res.data || res.data.code != 0) {
      throw res;
    }
    return res.data.data;
  }

  private _callUbus(method: string, path: string, message: any) {
    message = jsonEncode(message);
    return this._callMina("/remote/ubus", {
      message,
      method,
      path,
    });
  }

  getDevices(master = 0) {
    return this._callMina("/admin/v2/device_list?master=" + master);
  }

  getStatus(deviceId: string) {
    return this._callUbus("player_get_play_status", "mediaplayer", {
      media: "app_ios",
    });
  }

  play(deviceId: string, url: string) {
    return this._callUbus("player_play_url", "mediaplayer", {
      url: url,
      type: 1,
      media: "app_ios",
    });
  }

  pause(deviceId: string) {
    return this._callUbus("player_play_operation", "mediaplayer", {
      action: "pause",
      media: "app_ios",
    });
  }

  resume(deviceId: string) {
    return this._callUbus("player_play_operation", "mediaplayer", {
      action: "play",
      media: "app_ios",
    });
  }

  tts(deviceId: string, text: string) {
    return this._callUbus("text_to_speech", "mibrain", {
      text: text,
    });
  }

  setVolume(deviceId: string, volume: number) {
    return this._callUbus("player_set_volume", "mediaplayer", {
      volume: volume,
      media: "app_ios",
    });
  }

  async getConversations(
    deviceId: string,
    hardware: string,
    limit = 2
  ): Promise<Conversations | undefined> {
    const headers = {
      "User-Agent":
        "MiHome/6.0.103 (com.xiaomi.mihome; build:6.0.103.1; iOS 14.4.0) Alamofire/6.0.103 MICO/iOSApp/appStore/6.0.103",
      Cookie: `deviceId=${deviceId}; serviceToken="${this.account.serviceToken}"; userId=${this.account.userId}`,
    };
    let url = `https://userprofile.mina.mi.com/device_profile/v2/conversation?source=dialogu&hardware=${hardware}&timestamp=${Date.now()}&limit=${limit}`;
    const res = await Http.get(url, {
      headers,
    }).catch((err) => {
      console.error("getConversations failed", err);
      return undefined;
    });
    if (res?.data?.code !== 0) {
      console.error("getConversations failed", res?.data);
      return undefined;
    }
    return jsonDecode(res?.data?.data);
  }
}
