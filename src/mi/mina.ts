import { clamp } from "../utils/base";
import { encodeQuery } from "../utils/codec";
import { uuid } from "../utils/hash";
import { Http } from "../utils/http";
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

  ubus(scope: string, command: string, message?: any) {
    message = jsonEncode(message ?? {});
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

  async getStatus(): Promise<
    | {
      volume: number;
      status: "idle" | "playing" | "paused" | "stopped" | "unknown";
      media_type?: number;
      loop_type?: number;
    }
    | undefined
  > {
    const data = await this.ubus("mediaplayer", "player_get_play_status");
    const res = jsonDecode(data?.info);
    if (!data || data.code !== 0 || !res) {
      return;
    }
    const map = { 0: "idle", 1: "playing", 2: "paused", 3: "stopped" } as any;
    return {
      ...res,
      status: map[res.status] ?? "unknown",
      volume: res.volume,
    };
  }

  async getVolume() {
    const data = await this.getStatus();
    return data?.volume;
  }

  async setVolume(volume: number) {
    volume = Math.round(clamp(volume, 6, 100));
    const res = await this.ubus("mediaplayer", "player_set_volume", {
      volume: volume,
    });
    return res?.code === 0;
  }

  async play(options?: { tts?: string; url?: string }) {
    let res;
    const { tts, url } = options ?? {};
    if (tts) {
      res = await this.ubus("mibrain", "text_to_speech", {
        text: tts,
        save: 0,
      });
    } else if (url) {
      res = await this.ubus("mediaplayer", "player_play_url", {
        url,
        type: 1,
      });
    } else {
      res = await this.ubus("mediaplayer", "player_play_operation", {
        action: "play",
      });
    }
    return res?.code === 0;
  }

  async pause() {
    const res = await this.ubus("mediaplayer", "player_play_operation", {
      action: "pause",
    });
    return res?.code === 0;
  }

  async playOrPause() {
    const res = await this.ubus("mediaplayer", "player_play_operation", {
      action: "toggle",
    });
    return res?.code === 0;
  }

  async stop() {
    const res = await this.ubus("mediaplayer", "player_play_operation", {
      action: "stop",
    });
    return res?.code === 0;
  }

  /**
   * 注意：
   * 只拉取用户主动请求，设备被动响应的消息，
   * 不包含设备主动回应用户的消息。
   *
   * - 从游标处由新到旧拉取
   * - 结果包含游标消息本身
   * - 消息列表从新到旧排序
   */
  async getConversations(options?: {
    limit?: number;
    timestamp?: number;
  }): Promise<MiConversations | undefined> {
    const { limit = 10, timestamp } = options ?? {};
    const res = await Http.get(
      "https://userprofile.mina.mi.com/device_profile/v2/conversation",
      {
        limit,
        timestamp,
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
