import { randomNoice, signNonce } from "./hash";
import { RC4, rc4Hash } from "./rc4";
import * as pako from "pako";
import { jsonDecode, jsonEncode } from "./json";

export function parseLoginResponse(res: string) {
  try {
    return (
      jsonDecode(
        res.replace("&&&START&&&", "").replace(/:(\d{16,})/g, ':"$1"')
      ) ?? {}
    );
  } catch {
    return {};
  }
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

export function decodeMiIOT(
  ssecurity: string,
  nonce: string,
  data: string,
  gzip?: boolean
): Promise<string | undefined> {
  let key = Buffer.from(signNonce(ssecurity, nonce), "base64");
  let rc4 = new RC4(key);
  rc4.update(Buffer.alloc(1024));
  let decrypted = rc4.update(Buffer.from(data, "base64"));
  if (gzip) {
    try {
      return Promise.resolve(pako.ungzip(decrypted, { to: "string" }));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  return Promise.resolve(decrypted.toString());
}

export function encodeQuery(data: { [key: string]: any }, limit = 0): string {
  var ss: string[] = [];
  for (var k in data) {
    var v = data[k];
    if (v == null || typeof v === "function") {
      continue;
    }
    if (typeof v === "object") {
      v = jsonEncode(v);
    } else {
      v = v.toString();
    }
    if (v.length > limit) {
      continue;
    }
    ss.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  }
  return ss.join("&");
}

export function encodeMiIOT(
  method: string,
  uri: string,
  data: any,
  ssecurity: string
) {
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
