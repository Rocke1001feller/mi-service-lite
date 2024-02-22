import { UserMessage } from "../mi/types";
import { firstOf, lastOf, sleep } from "../utils/base";
import { formatDuration, removePunctuationAndSpaces } from "../utils/string";
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
  /**
   * 没有新的用户请求之后，多久自动退出唤醒模式（单位秒，默认10秒）
   */
  exitKeepAliveAfter?: number;
};

export class Speaker extends BaseSpeaker {
  heartbeat = 1000;
  exitKeepAliveAfter = 10;
  currentMsg?: UserMessage;
  currentQueryMsg?: UserMessage;

  constructor(config: SpeakerConfig) {
    super(config);
    this._commands = config.commands ?? [];
    this.heartbeat = config.heartbeat ?? this.heartbeat;
    this.exitKeepAliveAfter =
      config.exitKeepAliveAfter ?? this.exitKeepAliveAfter;
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
        if (this.preResponse.startsWith(nextMsg.text)) {
          // 有时会把上一次的 TTS 响应识别成用户指令
          console.log("🚗 " + nextMsg.text);
          setTimeout(async () => {
            await this.MiNA!.pause();
            if (this.keepAlive) {
              await this.wakeUp({ fromQuery: false });
            }
          });
        } else {
          console.log("🔥 " + nextMsg.text);
          // 异步处理消息，不阻塞正常消息拉取
          this.currentQueryMsg = nextMsg;
          this.onMessage(nextMsg);
        }
      }
      await sleep(this.heartbeat);
    }
  }

  preResponse = "";
  async response(
    text: string,
    options?: {
      speaker?: string;
      keepAlive?: boolean;
    }
  ) {
    this.preResponse = removePunctuationAndSpaces(text);
    console.log("✅ " + text);
    const start = Date.now();
    const res = await super.response(text, options);
    console.log("🕙 " + formatDuration(start, Date.now()));
    return res;
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
          if (msg.timestamp === this.currentQueryMsg?.timestamp) {
            await this.response(answer, {
              keepAlive: this.keepAlive,
            });
          }
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

  async wakeUp(options?: { fromQuery?: boolean }) {
    const { fromQuery = true } = options ?? {};
    const res = await super.wakeUp();
    if (fromQuery) {
      // 一段时间没有收到新的用户请求消息时，自动退出唤醒状态
      const lastMsg = this.currentQueryMsg?.timestamp;
      setTimeout(async () => {
        if (this.keepAlive && lastMsg === this.currentQueryMsg?.timestamp) {
          await this.exitKeepAlive();
        }
      }, this.exitKeepAliveAfter * 1000);
    }
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
