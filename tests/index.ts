import { assert } from "console";
import { MiServiceConfig, getMiIOT, getMiNA } from "../src/index";

import { MiNA } from "../src/mi/mina";
import { MiIOT } from "../src/mi/miot";
import { sleep } from "../src/utils/base";

async function main() {
  const miServices = await getMiServices({
    userId: process.env.MI_USER!,
    password: process.env.MI_PASS!,
    did: process.env.MI_DID,
  });
  // await testGetDevices(miServices);
  // await testSpeakerStatus(miServices);
  // await testPlayPause(miServices);
  // await testVolume(miServices);
  // await testPlayAudio(miServices);
  await testGetMessages(miServices);
}

main();

interface MiServices {
  MiNA: MiNA;
  MiIOT: MiIOT;
}

async function testPlayAudio(miServices: MiServices) {
  const { MiNA, MiIOT } = miServices;
  await MiNA.play({
    url: "https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/tts/BV406_V5_%E9%80%9A%E7%94%A8.wav",
  });
  let status = await MiNA.getStatus();
  console.log("playURL", status);
  await sleep(5 * 1000);
  await MiNA.play({ tts: "Hello world! 很高兴认识你！" });
  status = await MiNA.getStatus();
  console.log("playTTS", status);
}

async function testVolume(miServices: MiServices) {
  const { MiNA, MiIOT } = miServices;
  let volume = await MiNA.getVolume();
  console.log("Volume", volume);
  const res = await MiNA.setVolume(50);
  console.log("setVolume", res);
  volume = await MiNA.getVolume();
  console.log("Volume", volume);
}

async function testPlayPause(miServices: MiServices) {
  const { MiNA, MiIOT } = miServices;
  await MiNA.play();
  let status = await MiNA.getStatus();
  console.log("Speaker Status: set play", status);
  await sleep(5 * 1000);
  await MiNA.pause();
  status = await MiNA.getStatus();
  console.log("Speaker Status: set pause", status);
}

async function testSpeakerStatus(miServices: MiServices) {
  const { MiNA, MiIOT } = miServices;
  let status = await MiNA.getStatus();
  console.log("Speaker Status", status);
}

async function testGetDevices(miServices: MiServices) {
  const { MiNA, MiIOT } = miServices;
  console.log("MiNA devices", await MiNA.getDevices());
  console.log("MiIOT devices", await MiIOT.getDevices());
}

async function getMiServices(config: MiServiceConfig): Promise<MiServices> {
  const MiNA = await getMiNA(config);
  const MiIOT = await getMiIOT(config);
  assert(MiNA != undefined, "❌ getMiNA failed");
  assert(MiIOT != undefined, "❌ getMiIOT failed");
  return { MiNA, MiIOT } as any;
}

async function testGetMessages(miServices: MiServices) {
  const { MiNA } = miServices;
  for (let i = 0; i < 3; i++) {
    if (i === 1) {
      // 测试自动刷新 token
      MiNA.account.serviceToken = "666";
    }
    let messages = await MiNA?.getConversations();
    console.log(messages);
  }
  console.log("✅ Finished!");
}
