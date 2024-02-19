type OnMessageAction = (
  msg: any,
  data: any
) => Promise<{ stop?: boolean; data?: any } | void>;

export class OnMessagePipe {
  private _currentMsgId = 0;
  private _actions: OnMessageAction[] = [];

  add(action: OnMessageAction) {
    this._actions.push(action);
  }

  async run(msg: any) {
    this._currentMsgId++;
    const msgId = this._currentMsgId;
    let data = {};
    for (const action of this._actions) {
      if (this._currentMsgId !== msgId) {
        // 收到新消息，终止旧消息的响应向下运行
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
