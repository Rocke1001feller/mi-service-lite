import { sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery, parseLoginResponse } from "../utils/codec";
import { jsonDecode } from "../utils/json";

export interface GetAccountOption {
  username: string;
  password: string;
  sid: "xiaomiio" | "micoapi";
  deviceId: string;
}

export interface MiAccount {
  userId: number;
  passToken: string;
  ssecurity: string;
  serviceToken: string;
  deviceId: string;
}

export async function getAccount(
  opt: GetAccountOption
): Promise<MiAccount | undefined> {
  let res = await Http.get(
    `https://account.xiaomi.com/pass/serviceLogin?sid=${opt.sid}&_json=true`,
    {
      headers: {
        "User-Agent":
          "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
        Cookie: `deviceId=${opt.deviceId}; sdkVersion=3.9`,
      },
    }
  );
  if (res.isError) {
    console.error("login failed", res);
    return undefined;
  }
  let resp = parseLoginResponse(res);
  if (resp.code !== 0) {
    let data = {
      _json: "true",
      qs: resp.qs,
      sid: resp.sid,
      _sign: resp._sign,
      callback: resp.callback,
      cc: "+86",
      user: opt.username,
      hash: opt.password,
    };
    res = await Http.post(
      "https://account.xiaomi.com/pass/serviceLoginAuth2",
      encodeQuery(data),
      {
        headers: {
          "User-Agent":
            "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
          Cookie: `deviceId=${opt.deviceId}; pass_ua=web; sdkVersion=3.9; uLocale=zh_CN`,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      }
    );
    if (res.isError) {
      console.error("login failed", res);
      return undefined;
    }
    resp = parseLoginResponse(res);
  }
  if (!resp.location) {
    console.error("login failed", res);
    return undefined;
  }
  const serviceToken = await _securityTokenService(
    resp.location,
    resp.nonce,
    resp.ssecurity
  );
  if (!serviceToken) {
    return undefined;
  }
  return {
    userId: resp.userId,
    passToken: resp.passToken,
    ssecurity: resp.ssecurity,
    serviceToken: serviceToken,
    deviceId: opt.deviceId,
  };
}

async function _securityTokenService(
  location: string,
  nonce: string,
  ssecurity: string
) {
  const nsec = `nonce=${nonce}&${ssecurity}`;
  const clientSign = sha1(nsec);
  const res = await Http.get(
    `${location}&clientSign=${encodeURIComponent(clientSign)}`,
    { rawResponse: true }
  );
  let cookies = res.headers["set-cookie"] ?? [];
  for (let cookie of cookies) {
    if (cookie.includes("serviceToken")) {
      return cookie.split(";")[0].split("=").slice(1).join("=");
    }
  }
  console.error("_securityTokenService failed", res);
  return undefined;
}
