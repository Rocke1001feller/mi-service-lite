import { md5, sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery, parseAuthPass } from "../utils/codec";
import { MiNA } from "./mina";
import { MiAccount, MiPass } from "./types";

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
  let pass = parseAuthPass(res);
  if (pass.code !== 0) {
    // 登陆态失效，重新登录
    let data = {
      _json: "true",
      qs: pass.qs,
      sid: account.sid,
      _sign: pass._sign,
      callback: pass.callback,
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
    pass = parseAuthPass(res);
  }
  if (!pass.location || !pass.nonce || !pass.passToken) {
    console.error("login failed", res);
    return undefined;
  }
  const serviceToken = await _getServiceToken(pass);
  if (!serviceToken) {
    return undefined;
  }
  account = { ...account, pass, serviceToken };
  if (!account.device?.deviceSNProfile) {
    account.device = await MiNA.getDevice(account);
  }
  return account;
}

function _getLoginCookies(account: MiAccount) {
  return {
    userId: account.userId,
    deviceId: account.deviceId,
    passToken: account.pass?.passToken,
  };
}

async function _getServiceToken(pass: MiPass): Promise<string | undefined> {
  const { location, nonce, ssecurity } = pass ?? {};
  const res = await Http.get(
    location!,
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
