import { UserMessage } from "../mi/types";
import { firstOf, lastOf, sleep } from "../utils/base";
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
      if (nextMsg) {
        // 异步处理消息，不阻塞正常消息拉取
        this.onMessage(nextMsg);
      }
      await sleep(this.heartbeat);
    }
  }

  async onMessage(msg: UserMessage) {
    // todo 是否需要响应用户请求
    // todo 会话模式开启/关闭（开启后3分钟内没有收到新的用户消息，则关闭）

    // AI 响应用户请求
    await this.askAI2Answer(msg);
  }

  _lastMsg?: UserMessage;
  _tempMsgs: UserMessage[] = [];
  async fetchNextMessage(): Promise<UserMessage | undefined> {
    if (!this._lastMsg) {
      await this._fetchFirstMessage();
      // 第一条消息仅用作初始化消息游标，不响应
      return;
    }
    return this._fetchNextMessage();
  }

  private async _fetchFirstMessage() {
    const msgs = await this.getConversations({
      limit: 1,
      filterUnanswered: false,
    });
    this._lastMsg = msgs[0];
  }

  private _fetchNextTempMessage() {
    const nextMsg = this._tempMsgs.pop();
    this._lastMsg = nextMsg;
    return nextMsg;
  }

  private async _fetchNextMessage(
    maxPage = 3
  ): Promise<UserMessage | undefined> {
    if (this._tempMsgs.length > 0) {
      // 当前有暂存的新消息（从新到旧），依次处理之
      return this._fetchNextTempMessage();
    }
    // 拉取最新的 2 条 msg（用于和上一条消息比对是否连续）
    const nextMsg = await this._fetchNext2Messages();
    if (nextMsg !== "continue") {
      return nextMsg;
    }
    // 继续向上拉取其他新消息
    return this._fetchNextRemainingMessages()
  }

  private async _fetchNext2Messages() {
    // 拉取最新的 2 条 msg（用于和上一条消息比对是否连续）
    let msgs = await this.getConversations({ limit: 2 });
    if (
      msgs.length < 2 ||
      firstOf(msgs)!.timestamp <= this._lastMsg!.timestamp
    ) {
      // 没有拉到新消息
      return;
    }
    if (
      firstOf(msgs)!.timestamp > this._lastMsg!.timestamp &&
      lastOf(msgs)!.timestamp <= this._lastMsg!.timestamp
    ) {
      // 刚好收到一条新消息
      this._lastMsg = firstOf(msgs);
      return this._lastMsg;
    }
    // 还有其他新消息，暂存当前的新消息
    for (const msg of msgs) {
      if (msg.timestamp > this._lastMsg!.timestamp) {
        this._tempMsgs.push(msg);
      }
    }
    return "continue";
  }

  private async _fetchNextRemainingMessages(maxPage = 3) {
    // 继续向上拉取其他新消息
    let currentPage = 0;
    while (true) {
      currentPage++;
      if (currentPage > maxPage) {
        // 拉取新消息超长，取消拉取
        return this._fetchNextTempMessage();
      }
      const nextTimestamp = lastOf(this._tempMsgs)?.timestamp;
      const msgs = await this.getConversations({
        limit: 10,
        timestamp: nextTimestamp,
      });
      for (const msg of msgs) {
        if (msg.timestamp === nextTimestamp) {
          // 忽略上一页的游标消息
          continue;
        } else if (msg.timestamp > this._lastMsg!.timestamp) {
          // 继续添加新消息
          this._tempMsgs.push(msg);
        } else {
          // 拉取到历史消息处
          return this._fetchNextTempMessage();
        }
      }
    }
  }

  async getConversations(options?: {
    limit?: number;
    timestamp?: number;
    filterUnanswered?: boolean;
  }): Promise<UserMessage[]> {
    const filterUnanswered = options?.filterUnanswered ?? true;
    const conversation = await this.MiNA!.getConversations(options);
    let records = conversation?.records ?? [];
    if (filterUnanswered) {
      // 过滤未应答的用户消息
      records = records.filter((e) => e.answers.length > 0);
    }
    return records.map((e) => {
      const ttsAnswer = e.answers.find((e) => e.type === "TTS") as any;
      return {
        text: e.query,
        answer: ttsAnswer?.tts?.text,
        timestamp: e.time,
      };
    });
  }
}
