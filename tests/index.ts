import { getMiNA } from "../src/index";

import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("hello world!", process.env.MI_USER);
  const MiIOT = await getMiNA({
    username: process.env.MI_USER!,
    password: process.env.MI_PASS!,
  });
  const devices = await MiIOT?.getDevices();
  console.log("devices", devices);
}

main();
