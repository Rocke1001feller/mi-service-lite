import { clamp } from "../utils/base";
import { encodeBase64, encodeQuery } from "../utils/codec";
import { uuid } from "../utils/hash";
import { Http } from "../utils/http";
import { getExtname, readFile } from "../utils/io";
import { jsonDecode, jsonEncode } from "../utils/json";
import { MiAccount, MiConversations, MinaDevice } from "./types";

type MinaMiAccount = MiAccount & { device: MinaDevice };

export class MiNA {
  account: MinaMiAccount;

  constructor(account: MinaMiAccount) {
    this.account = account as any;
  }

  static async getDevice(account: MinaMiAccount): Promise<MinaMiAccount> {
    if (account.sid !== "micoapi") {
      return account;
    }
    const devices = await this.__callMina(
      account,
      "GET",
      "/admin/v2/device_list"
    );
    const device = (devices ?? []).find((e: any) =>
      [e.deviceID, e.name, e.alias].includes(account.did)
    );
    if (device) {
      account.device = { ...device, deviceId: device.deviceID };
    }
    return account;
  }

  private static async __callMina(
    account: MinaMiAccount,
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

  private _callUbus(scope: string, command: string, message: any) {
    message = jsonEncode(message);
    return this._callMina("POST", "/remote/ubus", {
      deviceId: this.account.device?.deviceId,
      path: scope,
      method: command,
      message,
    });
  }

  getDevices() {
    return this._callMina("GET", "/admin/v2/device_list");
  }

  async getStatus() {
    const data = await this._callUbus(
      "mediaplayer",
      "player_get_play_status",
      {}
    );
    const res = jsonDecode(data?.info);
    if (!data || data.code !== 0 || !res) {
      return;
    }
    const map = { 0: "idle", 1: "playing", 2: "paused", 3: "loading" } as any;
    return {
      ...res,
      status: map[res.status],
      volume: res.volume,
    };
  }

  async getVolume() {
    const data = await this.getStatus();
    return data?.volume;
  }

  async setVolume(volume: number) {
    volume = Math.round(clamp(volume, 0, 100));
    const res = await this._callUbus("mediaplayer", "player_set_volume", {
      volume: volume,
    });
    return res?.code === 0;
  }

  async play(options?: {
    tts?: string;
    url?: string;
    file?: string;
    local?: string;
  }) {
    let res;
    const { tts, url, file, local } = options ?? {};
    if (tts) {
      res = await this._callUbus("mibrain", "text_to_speech", {
        text: tts,
        save: 0,
      });
    } else if (url) {
      res = await this._callUbus("mediaplayer", "player_play_url", {
        url,
        type: 1,
      });
    } else if (file) {
      const mimeType = getExtname(file);
      const audioBytes = await readFile<string>(file, "base64");
      const audioURL = `data:audio/${mimeType};base64,${audioBytes}`;
      res = await this._callUbus("mediaplayer", "player_play_url", {
        url: audioURL,
        type: 1,
      });
    } else if (local) {
      let path = local;
      const pathBase64 = encodeBase64(path);
      res = await this._callUbus("mediaplayer", "player_play_filepath", {
        path,
        pathBase64,
        name: "media",
        nameBase64: "bWVkaWE=",
      });
    } else {
      res = await this._callUbus("mediaplayer", "player_play_operation", {
        action: "play",
      });
    }
    return res?.code === 0;
  }

  async pause() {
    const res = await this._callUbus("mediaplayer", "player_play_operation", {
      action: "pause",
    });
    return res?.code === 0;
  }

  async playOrPause() {
    const res = await this._callUbus("mediaplayer", "player_play_operation", {
      action: "toggle",
    });
    return res?.code === 0;
  }

  async stop() {
    const res = await this._callUbus("mediaplayer", "player_play_operation", {
      action: "stop",
    });
    return res?.code === 0;
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
