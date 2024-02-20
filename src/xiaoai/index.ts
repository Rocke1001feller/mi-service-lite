import { SpeakerMessage } from "../mi/types";
import { sleep } from "../utils/base";
import { AISpeaker, AISpeakerConfig } from "./ai";

export type XiaoAiSpeakerConfig = AISpeakerConfig & {
  /**
   * 拉取消息心跳间隔，默认1秒，单位毫秒
   */
  heartbeat?: number;
};

export class XiaoAiSpeaker extends AISpeaker {
  heartbeat = 1000;

  constructor(config: XiaoAiSpeakerConfig) {
    super(config);
    this.heartbeat = config.heartbeat ?? 1000;
  }

  private _status: "running" | "stopped" = "stopped";

  stop() {
    this._status = "stopped";
  }

  async run() {
    await this.initMiServices();
    if (!this.MiNA) {
      this.stop();
    }
    while (this._status === "running") {
      const nextMsg = await this.fetchNextMessage();
      // 异步处理消息，不阻塞正常消息拉取
      if (nextMsg) {
        this.onMessage(nextMsg);
      }
      await sleep(this.heartbeat);
    }
  }

  async fetchNextMessage(): Promise<SpeakerMessage | undefined> {
    // todo 获取最新的消息并处理
  }

  async onMessage(msg: SpeakerMessage) {
    // todo 是否需要响应用户请求
    // todo 会话模式开启/关闭（开启后3分钟内没有收到新的用户消息，则关闭）

    // AI 响应用户请求
    await this.askAI2Answer(msg);
  }
}
