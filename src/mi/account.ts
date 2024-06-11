import { md5, sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery, parseAuthPass } from "../utils/codec";
import { MiNA } from "./mina";
import { MiAccount, MiPass } from "./types";
import { MiIOT } from "./miot";
import { Debugger } from "../utils/debug";
import { jsonEncode } from "../utils/json";

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
    console.error("登录失败", res);
    return undefined;
  }
  let pass = parseAuthPass(res);
  if (pass.code !== 0) {
    // 登录态失效，重新登录
    let data = {
      _json: "true",
      qs: pass.qs,
      sid: account.sid,
      _sign: pass._sign,
      callback: pass.callback,
      user: account.userId,
      hash: md5(account.password).toUpperCase(),
    };
    res = await Http.post(`${kLoginAPI}/serviceLoginAuth2`, encodeQuery(data), {
      cookies: _getLoginCookies(account),
    });
    if (res.isError) {
      console.error("小米账号 OAuth2 登录失败", res);
      return undefined;
    }
    pass = parseAuthPass(res);
  }
  if (!pass.location || !pass.nonce || !pass.passToken) {
    if (pass.notificationUrl || pass.captchaUrl) {
      console.log(
        "触发小米账号异地登录安全验证机制，请在浏览器打开以下链接，并按照网页提示授权验证账号："
      );
      console.log(pass.notificationUrl || pass.captchaUrl);
      console.log(
        "注意：授权成功后，大约需要等待 30 分钟左右账号信息才会更新，请在更新后再尝试重新登录。"
      );
    }
    console.error("小米账号登录失败", res);

    return undefined;
  }
  // 刷新登录态
  const serviceToken = await _getServiceToken(pass);
  if (!serviceToken) {
    return undefined;
  }
  account = { ...account, pass, serviceToken };
  if (Debugger.enableTrace) {
    console.log("小米账号: ", jsonEncode(account, { prettier: true }));
  }
  account = await MiNA.getDevice(account as any);
  if (Debugger.enableTrace) {
    console.log("MiNA 账号: ", jsonEncode(account, { prettier: true }));
  }
  account = await MiIOT.getDevice(account as any);
  if (Debugger.enableTrace) {
    console.log("MiIOT 账号: ", jsonEncode(account, { prettier: true }));
  }
  if (account.did && !account.device) {
    console.error("找不到设备：" + account.did);
    console.log("请检查你的设备名称是否正确，注意错别字、字母大小写和空格。");
    return undefined;
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
    if (cookie?.includes("serviceToken")) {
      return cookie.split(";")[0].replace("serviceToken=", "");
    }
  }
  console.error("获取 Mi Service Token 失败", res);
  return undefined;
}
