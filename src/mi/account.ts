import { md5, sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery, parseLoginResponse } from "../utils/codec";

export interface GetAccountOption {
  username: string;
  password: string;
  sid: "xiaomiio" | "micoapi";
  deviceId: string;
  passToken?: string;
}

export interface MiAccount {
  userId: string;
  passToken: string;
  ssecurity: string;
  serviceToken: string;
  deviceId: string;
}

const kLoginAPI = "https://account.xiaomi.com/pass";

export async function getAccount(
  opt: GetAccountOption
): Promise<MiAccount | undefined> {
  let res = await Http.get(
    `${kLoginAPI}/serviceLogin`,
    { sid: opt.sid, _json: true, _locale: "zh_CN" },
    { cookies: _getLoginCookies(opt) }
  );
  if (res.isError) {
    console.error("serviceLogin failed", res);
    return undefined;
  }
  let resp = parseLoginResponse(res);
  if (resp.code !== 0) {
    // 登陆态失效，重新登录
    let data = {
      _json: "true",
      qs: resp.qs,
      sid: opt.sid,
      _sign: resp._sign,
      callback: resp.callback,
      cc: "+86",
      user: opt.username,
      hash: md5(opt.password).toUpperCase(),
    };
    res = await Http.post(`${kLoginAPI}/serviceLoginAuth2`, encodeQuery(data), {
      cookies: _getLoginCookies(opt),
    });
    if (res.isError) {
      console.error("serviceLoginAuth2 failed", res);
      return undefined;
    }
    resp = parseLoginResponse(res);
  }
  if (!resp.location) {
    console.error("login failed", res);
    return undefined;
  }
  const serviceToken = await _getServiceToken(
    resp.location,
    resp.nonce!,
    resp.ssecurity!
  );
  if (!serviceToken) {
    return undefined;
  }
  return {
    userId: resp.userId!,
    passToken: resp.passToken!,
    ssecurity: resp.ssecurity!,
    serviceToken: serviceToken,
    deviceId: opt.deviceId,
  };
}

function _getLoginCookies(opt: GetAccountOption) {
  return {
    userId: opt.username,
    passToken: opt.passToken,
    // 此处我们直接取音响的 deviceId 作为登陆设备的 deviceId
    deviceId: "an_" + opt.deviceId.replaceAll("-", ""),
    sdkVersion: "accountsdk-2020.01.09",
  };
}

async function _getServiceToken(
  location: string,
  nonce: string,
  ssecurity: string
): Promise<string | undefined> {
  const res = await Http.get(
    location,
    {
      _userIdNeedEncrypt: true,
      clientSign: sha1(`nonce=${nonce}&${ssecurity}`),
    },
    { rawResponse: true }
  );

  let cookies = res.headers["set-cookie"] ?? [];
  for (let cookie of cookies) {
    if (cookie.includes("serviceToken")) {
      return cookie.split(";")[0].replace("serviceToken=", "");
    }
  }
  console.error("_getServiceToken failed", res);
  return undefined;
}
