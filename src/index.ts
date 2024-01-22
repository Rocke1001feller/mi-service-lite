import { getMiService } from "./mi/index";

export async function getMiIOT(opt: { username: string; password: string }) {
  return getMiService({ service: "miiot", ...opt });
}

export async function getMiNA(opt: { username: string; password: string }) {
  return getMiService({ service: "mina", ...opt });
}
