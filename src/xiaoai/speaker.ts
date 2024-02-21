import { UserMessage } from "../mi/types";
import { firstOf, lastOf, sleep } from "../utils/base";
import { BaseSpeaker, BaseSpeakerConfig } from "./base";

export interface SpeakerCommand {
  match: (msg: UserMessage) => boolean;
  /**
   * 命中后执行的操作，返回值非空时会自动回复给用户
   */
  run: (msg: UserMessage) => Promise<string | undefined | void>;
}

export type SpeakerConfig = BaseSpeakerConfig & {
  /**
   * 拉取消息心跳间隔，默认1秒，单位毫秒
   */
  heartbeat?: number;
  /**
   * 自定义的消息指令
   */
  commands?: SpeakerCommand[];
};

export class Speaker extends BaseSpeaker {
  heartbeat = 1000;
  currentMsg?: UserMessage;

  constructor(config: SpeakerConfig) {
    super(config);
    this.heartbeat = config.heartbeat ?? 1000;
    this._commands = config.commands ?? [];
  }

  private _status: "running" | "stopped" = "running";

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

  _commands: SpeakerCommand[] = [];
  get commands() {
    return this._commands;
  }

  addCommand(command: SpeakerCommand) {
    this.commands.push(command);
  }

  async onMessage(msg: UserMessage) {
    for (const command of this.commands) {
      if (command.match(msg)) {
        // 关闭小爱的回复
        await this.MiNA!.pause();
        // 执行命令
        const answer = await command.run(msg);
        // 回复用户
        if (answer) {
          await this.response(answer, {
            keepAlive: this.keepAlive,
          });
        }
        break;
      }
    }
  }

  /**
   * 是否保持设备响应状态
   */
  keepAlive = false;

  async enterKeepAlive() {
    // 唤醒
    this.keepAlive = true;
  }

  async exitKeepAlive() {
    // 退出唤醒状态
    this.keepAlive = false;
  }

  async wakeUp() {
    const res = await super.wakeUp();
    // 1 分钟内没有收到新的用户消息，自动退出唤醒状态
    const lastMsg = this.currentMsg?.timestamp;
    setTimeout(async () => {
      if (this.keepAlive && lastMsg === this.currentMsg?.timestamp) {
        await this.exitKeepAlive();
      }
    }, 60 * 1000);
    return res;
  }

  private _tempMsgs: UserMessage[] = [];
  async fetchNextMessage(): Promise<UserMessage | undefined> {
    if (!this.currentMsg) {
      await this._fetchFirstMessage();
      // 第一条消息仅用作初始化消息游标，不响应
      return;
    }
    return this._fetchNextMessage();
  }

  private async _fetchFirstMessage() {
    const msgs = await this.getMessages({
      limit: 1,
      filterTTS: false,
    });
    this.currentMsg = msgs[0];
  }

  private async _fetchNextMessage(): Promise<UserMessage | undefined> {
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
    let msgs = await this.getMessages({ limit: 2 });
    if (
      msgs.length < 1 ||
      firstOf(msgs)!.timestamp <= this.currentMsg!.timestamp
    ) {
      // 没有拉到新消息
      return;
    }
    if (
      firstOf(msgs)!.timestamp > this.currentMsg!.timestamp &&
      (msgs.length === 1 ||
        lastOf(msgs)!.timestamp <= this.currentMsg!.timestamp)
    ) {
      // 刚好收到一条新消息
      this.currentMsg = firstOf(msgs);
      return this.currentMsg;
    }
    // 还有其他新消息，暂存当前的新消息
    for (const msg of msgs) {
      if (msg.timestamp > this.currentMsg!.timestamp) {
        this._tempMsgs.push(msg);
      }
    }
    return "continue";
  }

  private _fetchNextTempMessage() {
    const nextMsg = this._tempMsgs.pop();
    this.currentMsg = nextMsg;
    return nextMsg;
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
      const nextTimestamp = lastOf(this._tempMsgs)!.timestamp;
      const msgs = await this.getMessages({
        limit: 10,
        timestamp: nextTimestamp,
      });
      for (const msg of msgs) {
        if (msg.timestamp >= nextTimestamp) {
          // 忽略上一页的消息
          continue;
        } else if (msg.timestamp > this.currentMsg!.timestamp) {
          // 继续添加新消息
          this._tempMsgs.push(msg);
        } else {
          // 拉取到历史消息处
          return this._fetchNextTempMessage();
        }
      }
    }
  }

  async getMessages(options?: {
    limit?: number;
    timestamp?: number;
    filterTTS?: boolean;
  }): Promise<UserMessage[]> {
    const filterTTS = options?.filterTTS ?? true;
    const conversation = await this.MiNA!.getConversations(options);
    let records = conversation?.records ?? [];
    if (filterTTS) {
      // 过滤有小爱回答的消息
      records = records.filter(
        (e) => e.answers.length > 0 && e.answers.some((e) => e.type === "TTS")
      );
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
