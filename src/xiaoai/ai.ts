import { UserMessage } from "../mi/types";
import { pickOne } from "../utils/base";
import { BaseSpeaker, BaseSpeakerConfig } from "./base";

type AnswerStep = (
  msg: any,
  data: any
) => Promise<{ stop?: boolean; data?: any } | void>;

export type AISpeakerConfig = BaseSpeakerConfig & {
  askAI: (msg: UserMessage) => Promise<string>;
};

export class AISpeaker extends BaseSpeaker {
  private _currentMsgId = 0;
  private _askAI2AnswerSteps: AnswerStep[] = [];

  /**
   * 是否保持设备响应状态
   */
  keepAlive = false;

  askAI: AISpeakerConfig["askAI"];

  constructor(config: AISpeakerConfig) {
    super(config);
    this.askAI = config.askAI;
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 暂停当前的响应
      await this.MiNA!.pause();
    });
    this._askAI2AnswerSteps.push(async (msg, data) => {
      // 思考中
      await this.response(pickOne(["让我想想", "请稍等"])!, {
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
        await this.response(pickOne(["啊哦，出错了，稍后再试吧！"])!, {
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
    this._currentMsgId++;
    const msgId = this._currentMsgId;
    let data = {};
    for (const action of this._askAI2AnswerSteps) {
      if (this._currentMsgId !== msgId) {
        // 收到新消息，终止旧消息的响应继续向下运行
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
