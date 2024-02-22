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
  // 检测间隔（单位毫秒，默认 100 毫秒）
  interval?: number;
};

export class BaseSpeaker {
  MiNA?: MiNA;
  MiIOT?: MiIOT;

  interval: number;
  tts: TTSProvider;
  config: MiServiceConfig;
  constructor(config: BaseSpeakerConfig) {
    this.config = config;
    const { interval = 100, tts = "doubao" } = config;
    this.interval = interval;
    this.tts = tts;
  }

  async initMiServices() {
    this.MiNA = await getMiNA(this.config);
    this.MiIOT = await getMiIOT(this.config);
    assert(!!this.MiNA && !!this.MiIOT, "❌ init Mi Services failed");
  }

  wakeUp() {
    return this.MiIOT!.doAction(5, 3);
  }

  async unWakeUp() {
    await this.MiIOT!.setProperty(4, 1, true); // 关闭麦克风
    await this.MiIOT!.setProperty(4, 1, false); // 打开麦克风
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
    playSFX?: boolean;
    isNotResponding?: () => boolean;
  }) {
    let {
      text,
      audio,
      isNotResponding,
      playSFX = true,
      keepAlive = false,
      speaker = this._defaultSpeaker,
    } = options ?? {};
    // 播放回复
    if (audio) {
      // 音频回复
      await this.MiNA!.play({ url: audio });
    } else if (text) {
      // 文字回复
      switch (this.tts) {
        case "doubao":
          if (playSFX) {
            // 播放开始提示音
            await this.MiNA!.play({ url: process.env.AUDIO_BEEP });
          }
          // 在播放 TTS 语音之前，先取消小爱音箱的唤醒状态，防止将 TTS 语音识别成用户指令
          await this.unWakeUp();
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
      if (
        isNotResponding?.() || // 有新消息
        (res?.status === "playing" && res?.media_type) // 小爱自己开始播放音乐
      ) {
        // 响应被中断
        return;
      }
      if (res?.status && res.status !== "playing") {
        break;
      }
      await sleep(this.interval);
    }
    // 播放结束提示音
    if (!audio && playSFX) {
      await this.MiNA!.play({ url: process.env.AUDIO_BEEP });
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
