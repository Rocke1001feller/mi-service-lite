import { getMiIOT, getMiNA } from "../src/index";

import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("hello world!", process.env.MI_USER);
  const config = {
    userId: process.env.MI_USER!,
    password: process.env.MI_PASS!,
    did: process.env.MI_DID,
  };
  const MiNA = await getMiNA(config);
  const MiIOT = await getMiIOT(config);
  console.log("MiNA devices", await MiNA?.getDevices());
  console.log("MiIOT devices", await MiIOT?.getDevices());
}

main();
