import { MiServiceConfig, getMiIOT, getMiNA } from "../";
import { MiNA } from "../mi/mina";
import { MiIOT } from "../mi/miot";
import { pickOne, sleep } from "../utils/base";
import { OnMessagePipe } from "./pipe";

type TTSProvider = "xiaoai" | "doubao";

export class XiaoAiSpeaker {
  MiNA?: MiNA;
  MiIOT?: MiIOT;

  // 心跳间隔（1秒）
  heartbeat = 1000;
  // 保持设备的唤醒状态
  keepAlive = false;
  // 语音合成服务商
  ttsProvider: TTSProvider = "doubao";

  pipe?: OnMessagePipe;

  config: MiServiceConfig;
  constructor(config: MiServiceConfig) {
    this.config = config;
  }

  async getLastMessage() {
    // 初始化 MiServices
    if (!this.MiNA) {
      this.MiNA = await getMiNA(this.config);
    }
    if (!this.MiIOT) {
      this.MiIOT = await getMiIOT(this.config);
    }
    // todo 获取最新的消息并处理
  }

  async askLLM(msg: any) {
    // todo
    return msg;
  }

  async onMessage(msg: any) {
    this.initOnMessagePipe();
    await this.pipe!.run(msg);
  }

  wakeUp() {
    return this.MiIOT!.doAction(5, 3);
  }

  async answer(
    text: string,
    options?: {
      tts?: TTSProvider;
      speaker?: string;
      keepAlive?: boolean;
    }
  ) {
    const {
      tts = "xiaoai",
      keepAlive = false,
      speaker = "zh_female_maomao_conversation_wvae_bigtts",
    } = options ?? {};
    // 播放回复音频
    switch (tts) {
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
    // 等待回答播放完毕
    while (true) {
      const res = await this.MiNA!.getStatus();
      if (res?.status && res.status !== "playing") {
        break;
      }
      await sleep(this.heartbeat);
    }
    // 保持唤醒状态
    if (keepAlive) {
      await this.wakeUp();
    }
  }

  initOnMessagePipe() {
    if (this.pipe) {
      return;
    }
    this.pipe = new OnMessagePipe();
    this.pipe.add(async (msg, data) => {
      // 暂停当前的响应
      await this.MiNA!.pause();
    });
    this.pipe.add(async (msg, data) => {
      // 思考中
      await this.answer(pickOne(["让我想想", "请稍等"])!, {
        tts: this.ttsProvider,
        keepAlive: false,
      });
    });
    this.pipe.add(async (msg, data) => {
      // 调用 LLM 获取回复
      const answer = await this.askLLM(msg);
      return { data: { answer } };
    });
    this.pipe.add(async (msg, data) => {
      if (!data.answer) {
        // 回复失败
        await this.answer(pickOne(["啊哦，出错了，稍后再试吧！"])!, {
          tts: this.ttsProvider,
          keepAlive: this.keepAlive,
        });
        return { stop: true };
      }
    });
    this.pipe.add(async (msg, data) => {
      // 回复用户
      await this.answer(data.answer, {
        tts: this.ttsProvider,
        keepAlive: this.keepAlive,
      });
    });
  }
}
