import { UserMessage } from "../mi/types";
import { pickOne } from "../utils/base";
import { BaseSpeaker, BaseSpeakerConfig } from "./base";

type AnswerStep = (
  msg: any,
  data: any
) => Promise<{ stop?: boolean; data?: any } | void>;

export type AISpeakerConfig = BaseSpeakerConfig & {
  askAI: (msg: UserMessage) => Promise<string>;
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
};

export class AISpeaker extends BaseSpeaker {
  currentMsg?: UserMessage;
  private _askAIForAnswerSteps: AnswerStep[] = [];

  /**
   * 是否保持设备响应状态
   */
  keepAlive = false;

  askAI: AISpeakerConfig["askAI"];

  onAIError: string[];
  onAIAsking: string[];
  constructor(config: AISpeakerConfig) {
    super(config);
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
      let answer = await this.askAI(msg);
      answer = answer ?? pickOne(this.onAIError);
      return { data: { answer } };
    });
  }

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
}
