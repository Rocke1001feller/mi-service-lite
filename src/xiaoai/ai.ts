import { UserMessage } from "../mi/types";
import { pickOne } from "../utils/base";
import { Speaker, SpeakerCommand, SpeakerConfig } from "./speaker";

export type AISpeakerConfig = SpeakerConfig & {
  askAI?: (msg: UserMessage) => Promise<string>;
  /**
   * AI 开始回答时的提示语
   *
   * 比如：请稍等，让我想想
   */
  onAIAsking?: string[];
  /**
   * AI 回答异常时的提示语
   *
   * 比如：出错了，请稍后再试吧！
   */
  onAIError?: string[];
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

type AnswerStep = (
  msg: any,
  data: any
) => Promise<{ stop?: boolean; data?: any } | void>;

export class AISpeaker extends Speaker {
  askAI: AISpeakerConfig["askAI"];
  onAIError: string[];
  onAIAsking: string[];
  name: string;
  callAIKeyWords: string[];
  wakeUpKeyWords: string[];
  exitKeywords: string[];
  onEnterAI: string[];
  onExitAI: string[];

  constructor(config: AISpeakerConfig) {
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
    this.askAI = config.askAI;
    this.onAIError = config.onAIError ?? ["啊哦，出错了，稍后再试吧！"];
    this.onAIAsking = config.onAIAsking ?? ["让我想想", "请稍等"];
    this._askAIForAnswerSteps.push(async (msg, data) => {
      // 思考中
      await this.response(pickOne(this.onAIAsking)!, {
        keepAlive: this.keepAlive,
      });
    });
    this._askAIForAnswerSteps.push(async (msg, data) => {
      // 调用 LLM 获取回复
      let answer = await this.askAI?.(msg);
      answer = answer ?? pickOne(this.onAIError);
      return { data: { answer } };
    });
  }

  private _askAIForAnswerSteps: AnswerStep[] = [];
  async askAIForAnswer(msg: UserMessage) {
    let data: any = {};
    const oldMsg = this.currentMsg?.timestamp;
    for (const action of this._askAIForAnswerSteps) {
      const res = await action(msg, data);
      if (this.currentMsg?.timestamp !== oldMsg) {
        // 收到新的用户请求消息，终止后续操作和响应
        return;
      }
      if (res?.data) {
        data = { ...data, ...res.data };
      }
      if (res?.stop) {
        break;
      }
    }
    return data.answer;
  }

  get commands() {
    return [
      {
        match: (msg) => this.wakeUpKeyWords.some((e) => msg.text.includes(e)),
        run: async (msg) => {
          await this.enterKeepAlive();
        },
      },
      {
        match: (msg) => this.exitKeywords.some((e) => msg.text.includes(e)),
        run: async (msg) => {
          await this.exitKeepAlive();
        },
      },
      ...this._commands,
      {
        match: (msg) =>
          this.keepAlive ||
          this.callAIKeyWords.some((e) => msg.text.includes(e)),
        run: (msg) => this.askAIForAnswer(msg),
      },
    ] as SpeakerCommand[];
  }

  async enterKeepAlive() {
    // 唤醒
    await super.enterKeepAlive();
    // 回应
    await this.response(pickOne(this.onEnterAI)!, {
      keepAlive: true,
    });
  }

  async exitKeepAlive() {
    // 退出唤醒状态
    await super.exitKeepAlive();
    // 回应
    await this.response(pickOne(this.onExitAI)!, {
      keepAlive: false,
    });
  }
}
