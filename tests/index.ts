import { assert } from "console";
import { getMiIOT, getMiNA } from "../src/index";

import dotenv from "dotenv";
import { MiNA } from "../src/mi/mina";
import { MiIOT } from "../src/mi/miot";
import { sleep } from "../src/utils/base";

dotenv.config();

async function main() {
  const config = {
    userId: process.env.MI_USER!,
    password: process.env.MI_PASS!,
    did: process.env.MI_DID,
  };
  const miServices = await getMiServices(config);
  // await testGetDevices(miServices);
  // await testSpeakerStatus(miServices);
  await testPlayPause(miServices);
}

main();

interface MiServices {
  MiNA: MiNA;
  MiIOT: MiIOT;
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

async function getMiServices(config: any): Promise<MiServices> {
  const MiNA = await getMiNA(config);
  const MiIOT = await getMiIOT(config);
  assert(MiNA != undefined, "❌ getMiNA failed");
  assert(MiIOT != undefined, "❌ getMiIOT failed");
  return { MiNA, MiIOT } as any;
}
