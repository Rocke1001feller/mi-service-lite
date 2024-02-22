import { assert } from "console";
import { MiServiceConfig, getMiIOT, getMiNA } from "..";
import { MiNA } from "../mi/mina";
import { MiIOT } from "../mi/miot";
import { sleep } from "../utils/base";
import { Http } from "../utils/http";

type TTSProvider = "xiaoai" | "doubao";

type Speaker = {
  name: string;
  gender: "男" | "女";
  speaker: string;
};

export type BaseSpeakerConfig = MiServiceConfig & {
  // 语音合成服务商
  tts?: TTSProvider;
  // 检测间隔，单位毫秒（默认1秒）
  interval?: number;
};

export class BaseSpeaker {
  MiNA?: MiNA;
  MiIOT?: MiIOT;

  config: BaseSpeakerConfig;
  constructor(config: BaseSpeakerConfig) {
    const { interval = 1000, tts = "doubao" } = config;
    this.config = { ...config, interval, tts };
  }

  async initMiServices() {
    this.MiNA = await getMiNA(this.config);
    this.MiIOT = await getMiIOT(this.config);
    assert(!!this.MiNA && !!this.MiIOT, "❌ init Mi Services failed");
  }

  wakeUp() {
    return this.MiIOT!.doAction(5, 3);
  }

  preVolume?: number;
  async mute() {
    await this.MiNA!.pause();
    const volume = await this.MiNA!.getVolume();
    if ((volume ?? 0) > 6) {
      this.preVolume = volume;
    }
    return this.MiNA!.setVolume(6);
  }

  async unMute() {
    const volume = await this.MiNA!.getVolume();
    if (volume === 6 && this.preVolume) {
      return this.MiNA!.setVolume(this.preVolume);
    }
  }

  async response(options: {
    text?: string;
    audio?: string;
    speaker?: string;
    keepAlive?: boolean;
  }) {
    let {
      text,
      audio,
      keepAlive = false,
      speaker = this._defaultSpeaker,
    } = options ?? {};
    // 播放回复
    if (audio) {
      // 音频回复
      await this.MiNA!.play({ url: audio });
    } else if (text) {
      // 文字回复
      switch (this.config.tts) {
        case "doubao":
          text = encodeURIComponent(text);
          const doubaoTTS = process.env.TTS_DOUBAO;
          const url = `${doubaoTTS}?speaker=${speaker}&text=${text}`;
          await this.MiNA!.play({ url });
          break;
        case "xiaoai":
        default:
          await this.MiNA!.play({ tts: text });
          break;
      }
    }
    // 等待回答播放完毕
    while (true) {
      const res = await this.MiNA!.getStatus();
      if (res?.status && res.status !== "playing") {
        break;
      }
      await sleep(this.config.interval!);
    }
    // 保持唤醒状态
    if (keepAlive) {
      await this.wakeUp();
    }
  }

  private _doubaoSpeakers?: Speaker[];
  private _defaultSpeaker = "zh_female_maomao_conversation_wvae_bigtts";
  async switchDefaultSpeaker(speaker: string) {
    if (!this._doubaoSpeakers) {
      const doubaoSpeakers = process.env.SPEAKERS_DOUBAO;
      const res = await Http.get(doubaoSpeakers ?? "/");
      if (Array.isArray(res)) {
        this._doubaoSpeakers = res;
      }
    }
    if (!this._doubaoSpeakers) {
      return false;
    }
    const target = this._doubaoSpeakers.find(
      (e) => e.name === speaker || e.speaker === speaker
    );
    if (target) {
      this._defaultSpeaker = target.speaker;
    }
    return this._defaultSpeaker === target?.speaker;
  }
}
