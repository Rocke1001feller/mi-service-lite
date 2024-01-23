export interface MiDevice {
  deviceId: string;
  deviceID: string;
  serialNumber: string;
  name: string;
  alias: string;
  presence: "offline" | "online";
  miotDID: string;
  hardware: string;
  deviceSNProfile: string;
  deviceProfile: string;
  brokerEndpoint: string;
  brokerIndex: number;
  mac: string;
  ssid: string;
}

export interface MiAccount {
  sid: "xiaomiio" | "micoapi";
  deviceId: string;
  userId: string;
  password: string;
  // 登录凭证
  passToken?: string;
  ssecurity?: string;
  serviceToken?: string;
  // 音响设备信息
  did?: string; // 音响设备 id 或 name
  device?: MiDevice; // 根据 did 查找到的 deviceInfo
}

// TTS 文本回应
interface AnswerTTS {
  bitSet: [number, number, number, number];
  type: "TTS";
  tts: {
    bitSet: [number, number];
    text: string;
  };
}

// 音乐播放列表
interface AnswerAudio {
  bitSet: [number, number, number, number];
  type: "AUDIO";
  audio: {
    bitSet: [number, number];
    audioInfoList: {
      bitSet: [number, number, number, number];
      title: string;
      artist: string;
      cpName: string;
    }[];
  };
}

type Answer = AnswerTTS | AnswerAudio;

/**
 * 已经执行了的动作（比如调节音量等），answer 为空
 */
export interface MiConversations {
  bitSet: [number, number, number];
  records: {
    bitSet: [number, number, number, number, number];
    answers: Answer[];
    time: number; // 毫秒
    query: string; // 请求指令
    requestId: string;
  }[];
  nextEndTime: number;
}
