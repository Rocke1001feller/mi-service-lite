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
  private _askAI2AnswerSteps: AnswerStep[] = [];

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
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 关闭小爱的回复
      await this.MiNA!.stop();
    });
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 思考中
      await this.response(pickOne(this.onAIAsking)!, {
        keepAlive: this.keepAlive,
      });
    });
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 调用 LLM 获取回复
      const answer = await this.askAI(msg);
      return { data: { answer } };
    });
    this._askAI2AnswerSteps.push(async (msg, data) => {
      if (!data.answer) {
        // 回复失败
        await this.response(pickOne(this.onAIError)!, {
          keepAlive: this.keepAlive,
        });
        return { stop: true };
      }
    });
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 回复用户
      await this.response(data.answer, {
        keepAlive: this.keepAlive,
      });
    });
  }

  async askAI2Answer(msg: UserMessage) {
    let data = {};
    const oldMsg = this.currentMsg?.timestamp;
    for (const action of this._askAI2AnswerSteps) {
      if (this.currentMsg?.timestamp !== oldMsg) {
        // 收到新的用户请求消息，终止旧消息的响应继续向下运行
        break;
      }
      const res = await action(msg, data);
      if (res?.data) {
        data = { ...data, ...res.data };
      }
      if (res?.stop) {
        break;
      }
    }
    return data;
  }
}
