export type MiPass = Partial<{
  qs: string;
  _sign: string;
  callback: string;
  location: string;
  ssecurity: string;
  passToken: string;
  nonce: string;
  userId: string;
  cUserId: string;
  psecurity: string;
}>;

export interface MiIOTDevice {
  did: string;
  token: string;
  name: string;
  localip: string;
  mac: string;
  ssid: string;
  bssid: string;
  model: string;
  isOnline: boolean;
  desc: string;
  uid: number;
  pd_id: number;
  rssi: number;
}

export interface MinaDevice {
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
  pass?: MiPass;
  serviceToken?: string;
  // 音响设备信息
  did?: string; // 音响设备 id 或 name
  device?: MinaDevice | MiIOTDevice; // 根据 did 查找到的 deviceInfo
}

// LLM 文本回应
interface AnswerLLM {
  bitSet: [number, number, number, number];
  type: "LLM";
  llm: {
    bitSet: [number, number];
    text: string;
  };
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

type Answer = AnswerLLM | AnswerTTS | AnswerAudio;

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
