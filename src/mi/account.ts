import { md5, sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery, parseLoginResponse } from "../utils/codec";
import { MiNA } from "./mina";
import { MiAccount } from "./types";

const kLoginAPI = "https://account.xiaomi.com/pass";

export async function getAccount(
  account: MiAccount
): Promise<MiAccount | undefined> {
  let res = await Http.get(
    `${kLoginAPI}/serviceLogin`,
    { sid: account.sid, _json: true, _locale: "zh_CN" },
    { cookies: _getLoginCookies(account) }
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
      sid: account.sid,
      _sign: resp._sign,
      callback: resp.callback,
      cc: "+86",
      user: account.userId,
      hash: md5(account.password).toUpperCase(),
    };
    res = await Http.post(`${kLoginAPI}/serviceLoginAuth2`, encodeQuery(data), {
      cookies: _getLoginCookies(account),
    });
    if (res.isError) {
      console.error("serviceLoginAuth2 failed", res);
      return undefined;
    }
    resp = parseLoginResponse(res);
  }
  if (!resp.location || !resp.nonce) {
    console.error("login failed", res);
    return undefined;
  }
  const serviceToken = await _getServiceToken(
    resp.location,
    resp.nonce,
    resp.ssecurity!
  );
  if (!serviceToken) {
    return undefined;
  }
  account = {
    ...account,
    passToken: resp.passToken,
    ssecurity: resp.ssecurity,
    serviceToken: serviceToken,
  };
  if (!account.device?.deviceSNProfile) {
    account.device = await MiNA.getDevice(account);
  }
  return account;
}

function _getLoginCookies(account: MiAccount) {
  return {
    userId: account.userId,
    passToken: account.passToken,
    deviceId: account.deviceId,
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
