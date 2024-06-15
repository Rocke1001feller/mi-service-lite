import { randomNoice, signNonce } from "./hash";
import { RC4, rc4Hash } from "./rc4";
import * as pako from "pako";
import { jsonDecode, jsonEncode } from "./json";
import { MiPass } from "../mi/types";

export function encodeBase64(text: string) {
  return Buffer.from(text).toString("base64");
}

export function decodeBase64(base64Encoded: string) {
  return Buffer.from(base64Encoded, "base64").toString();
}

export function parseAuthPass(res: string): {
  code?: number;
  description?: string;
  captchaUrl?: string;
  notificationUrl?: string;
} & MiPass {
  try {
    return (
      jsonDecode(
        res
          .replace("&&&START&&&", "") // 去除前缀
          .replace(/:(\d{9,})/g, ':"$1"') // 把 userId 和 nonce 转成 string
      ) ?? {}
    );
  } catch {
    return {};
  }
}

export function encodeQuery(
  data: Record<string, string | number | boolean | undefined>
): string {
  return Object.entries(data)
    .map(
      ([key, value]) =>
        encodeURIComponent(key) +
        "=" +
        encodeURIComponent(value == null ? "" : value.toString())
    )
    .join("&");
}

export function decodeQuery(str: string) {
  var data: any = {};
  if (!str) {
    return data;
  }
  var ss = str.split("&");
  for (var i = 0; i < ss.length; i++) {
    var s = ss[i].split("=");
    if (s.length != 2) {
      continue;
    }
    var k = decodeURIComponent(s[0]);
    var v = decodeURIComponent(s[1]);
    if (/^\[{/.test(v))
      try {
        v = jsonDecode(v);
      } catch (e) {}
    data[k] = v;
  }
  return data;
}

interface MiIOTRequest {
  data: string;
  rc4_hash__: string;
  signature: string;
  _nonce: string;
  ssecurity: string;
}

export function encodeMiIOT(
  method: string,
  uri: string,
  data: any,
  ssecurity: string
): MiIOTRequest {
  let nonce = randomNoice();
  const snonce = signNonce(ssecurity, nonce);
  let key = Buffer.from(snonce, "base64");
  let rc4 = new RC4(key);
  rc4.update(Buffer.alloc(1024));
  let json = jsonEncode(data);
  let map: any = { data: json };
  map.rc4_hash__ = rc4Hash(method, uri, map, snonce);
  for (let k in map) {
    let v = map[k];
    map[k] = rc4.update(Buffer.from(v)).toString("base64");
  }
  map.signature = rc4Hash(method, uri, map, snonce);
  map._nonce = nonce;
  map.ssecurity = ssecurity;
  return map;
}

export function decodeMiIOT(
  ssecurity: string,
  nonce: string,
  data: string,
  gzip?: boolean
): Promise<any | undefined> {
  let key = Buffer.from(signNonce(ssecurity, nonce), "base64");
  let rc4 = new RC4(key);
  rc4.update(Buffer.alloc(1024));
  let decrypted: any = rc4.update(Buffer.from(data, "base64"));
  let error = undefined;
  if (gzip) {
    try {
      decrypted = pako.ungzip(decrypted, { to: "string" });
    } catch (err) {
      error = err;
    }
  }
  const res = jsonDecode(decrypted.toString());
  if (!res) {
    console.error("❌ decodeMiIOT failed", error);
  }
  return Promise.resolve(res);
}
