import { encodeQuery } from "../utils/codec";
import { uuid } from "../utils/hash";
import { Http } from "../utils/http";
import { jsonDecode, jsonEncode } from "../utils/json";
import { MiAccount, MiConversations } from "./types";

export class MiNA {
  account: MiAccount;

  constructor(account: MiAccount) {
    this.account = account;
  }

  static async getDevice(account: MiAccount) {
    const devices = await this.__callMina(
      account,
      "GET",
      "/admin/v2/device_list"
    );
    const d = (devices ?? []).find((e: any) =>
      [e.deviceID, e.name, e.alias].includes(account.did)
    );
    if (!d) {
      return undefined;
    }
    return { ...d, deviceId: d.deviceID };
  }

  private static async __callMina(
    account: MiAccount,
    method: "GET" | "POST",
    path: string,
    data?: any
  ): Promise<any> {
    data = {
      ...data,
      requestId: uuid(),
      timestamp: Math.floor(Date.now() / 1000),
    };
    const url = "https://api2.mina.mi.com" + path;
    const config = {
      headers: { "User-Agent": "MICO/AndroidApp/@SHIP.TO.2A2FE0D7@/2.4.40" },
      cookies: {
        userId: account.userId,
        serviceToken: account.serviceToken,
        sn: account.device?.serialNumber,
        hardware: account.device?.hardware,
        deviceId: account.device?.deviceId,
        deviceSNProfile: account.device?.deviceSNProfile,
      },
    };
    let res;
    if (method === "GET") {
      res = await Http.get(url, data, config);
    } else {
      res = await Http.post(url, encodeQuery(data), config);
    }
    if (res.code !== 0) {
      console.error("_callMina failed", res);
      return undefined;
    }
    return res.data;
  }

  private async _callMina(
    method: "GET" | "POST",
    path: string,
    data?: any
  ): Promise<any> {
    return MiNA.__callMina(this.account, method, path, data);
  }

  private _callUbus(method: string, path: string, message: any) {
    message = jsonEncode(message);
    return this._callMina("POST", "/remote/ubus", {
      deviceId: this.account.device?.deviceId,
      path,
      method,
      message,
    });
  }

  getDevices() {
    return this._callMina("GET", "/admin/v2/device_list");
  }

  getStatus() {
    return this._callUbus("player_get_play_status", "mediaplayer", {});
  }

  play(url: string) {
    return this._callUbus("player_play_url", "mediaplayer", {
      url: url,
      type: 1,
    });
  }

  pause() {
    return this._callUbus("player_play_operation", "mediaplayer", {
      action: "pause",
    });
  }

  resume() {
    return this._callUbus("player_play_operation", "mediaplayer", {
      action: "play",
    });
  }

  tts(text: string) {
    return this._callUbus("text_to_speech", "mibrain", {
      text: text,
    });
  }

  setVolume(volume: number) {
    return this._callUbus("player_set_volume", "mediaplayer", {
      volume: volume,
    });
  }

  /**
   * 消息从新到旧排序
   */
  async getConversations(limit = 10): Promise<MiConversations | undefined> {
    const res = await Http.get(
      "https://userprofile.mina.mi.com/device_profile/v2/conversation",
      {
        limit,
        requestId: uuid(),
        source: "dialogu",
        hardware: this.account.device?.hardware,
      },
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; 000; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 /XiaoMi/HybridView/ micoSoundboxApp/i appVersion/A_2.4.40",
          Referer: "https://userprofile.mina.mi.com/dialogue-note/index.html",
        },
        cookies: {
          userId: this.account.userId,
          serviceToken: this.account.serviceToken,
          deviceId: this.account.device?.deviceId,
        },
      }
    );
    if (res.code !== 0) {
      console.error("getConversations failed", res);
      return undefined;
    }
    return jsonDecode(res.data);
  }
}
