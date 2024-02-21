import { UserMessage } from "../mi/types";
import { firstOf, lastOf, pickOne, sleep } from "../utils/base";
import { AISpeaker, AISpeakerConfig } from "./ai";

export type XiaoAiSpeakerConfig = AISpeakerConfig & {
  /**
   * 拉取消息心跳间隔，默认1秒，单位毫秒
   */
  heartbeat?: number;
  /**
   * 设备名称，用来唤醒/退出对话模式等
   *
   * 建议使用常见词语，避免使用多音字和容易混淆读音的词语
   */
  name?: string;
  /**
   * 召唤关键词
   *
   * 当消息中包含召唤关键词时，会调用 AI 来响应用户消息
   *
   * 比如：打开/进入/召唤豆包
   */
  callAIKeyWords?: string[];
  /**
   * 唤醒关键词
   *
   * 当消息中包含唤醒关键词时，会进入 AI 唤醒状态
   *
   * 比如：关闭/退出/再见豆包
   */
  wakeUpKeyWords?: string[];
  /**
   * 退出关键词
   *
   * 当消息中包含退出关键词时，会退出 AI 唤醒状态
   */
  exitKeywords?: string[];
  /**
   * 进入 AI 模式的欢迎语
   *
   * 比如：你好，我是豆包，请问有什么能够帮你的吗？
   */
  onEnterAI?: string[];
  /**
   * 退出 AI 模式的提示语
   *
   * 比如：豆包已退出
   */
  onExitAI?: string[];
};

export class XiaoAiSpeaker extends AISpeaker {
  heartbeat = 1000;

  name: string;
  callAIKeyWords: string[];
  wakeUpKeyWords: string[];
  exitKeywords: string[];
  onEnterAI: string[];
  onExitAI: string[];

  constructor(config: XiaoAiSpeakerConfig) {
    super(config);
    this.heartbeat = config.heartbeat ?? 1000;
    this.name = config.name ?? "豆包";
    this.callAIKeyWords = config.callAIKeyWords ?? [this.name];
    this.wakeUpKeyWords =
      config.wakeUpKeyWords ??
      ["打开", "进入", "召唤"].map((e) => e + this.name);
    this.exitKeywords =
      config.exitKeywords ?? ["关闭", "退出", "再见"].map((e) => e + this.name);
    this.onEnterAI = config.onEnterAI ?? [
      `你好，我是${this.name}，很高兴为你服务！`,
    ];
    this.onExitAI = config.onExitAI ?? [`${this.name}已关闭！`];
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

  async enterKeepAlive(): Promise<void> {
    // 关闭小爱的回复
    await this.MiNA!.stop();
    // 唤醒
    await this.wakeUp();
    this.keepAlive = true;
    // 回应
    await this.response(pickOne(this.onEnterAI)!, {
      keepAlive: true,
    });
  }

  async exitKeepAlive(): Promise<void> {
    // 关闭小爱的回复
    await this.MiNA!.stop();
    // 退出唤醒状态
    this.keepAlive = false;
    // 回应
    await this.response(pickOne(this.onExitAI)!, {
      keepAlive: false,
    });
  }

  async wakeUp() {
    const res = await super.wakeUp();
    // 1 分钟内没有收到新的用户消息，自动退出唤醒状态
    const lastMsg = this._lastMsg?.timestamp;
    setTimeout(async () => {
      if (this.keepAlive && lastMsg === this._lastMsg?.timestamp) {
        await this.exitKeepAlive();
      }
    }, 60 * 1000);
    return res;
  }

  async onMessage(msg: UserMessage) {
    if (this.wakeUpKeyWords.some((e) => msg.text.includes(e))) {
      return this.enterKeepAlive();
    }
    if (this.exitKeywords.some((e) => msg.text.includes(e))) {
      return this.exitKeepAlive();
    }
    if (
      this.keepAlive ||
      this.callAIKeyWords.some((e) => msg.text.includes(e))
    ) {
      await this.askAI2Answer(msg);
    }
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
    return this._fetchNextRemainingMessages();
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
