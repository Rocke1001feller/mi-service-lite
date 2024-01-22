import { md5, sha1 } from "../utils/hash";
import { Http } from "../utils/http";
import { encodeQuery } from "../utils/codec";
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
  let ret = await Http.get(
    `https://account.xiaomi.com/pass/serviceLogin?sid=${opt.sid}&_json=true`,
    {
      headers: {
        "User-Agent":
          "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
        Cookie: `deviceId=${opt.deviceId}; sdkVersion=3.9`,
      },
    }
  ).catch((e) => {
    console.error("getAccount failed", e);
    return undefined;
  });
  if (!ret) {
    return undefined;
  }
  let resp = jsonDecode(ret.data.slice(11));
  if (resp.code !== 0) {
    let data = {
      _json: "true",
      qs: resp.qs,
      sid: resp.sid,
      _sign: resp._sign,
      callback: resp.callback,
      user: opt.username,
      hash: md5(opt.password).toUpperCase(),
    };
    let ret = await Http.post(
      "https://account.xiaomi.com/pass/serviceLoginAuth2",
      encodeQuery(data),
      {
        headers: {
          "User-Agent":
            "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
          Cookie: `deviceId=${opt.deviceId}; pass_ua=web; sdkVersion=3.9; uLocale=zh_CN`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    resp = jsonDecode(ret.data.slice(11).replace(/:(\d{16,})/g, ':"$1"'));
    if (resp.code != 0) {
      console.error("getAccount failed", resp);
      return undefined;
    }
  }
  const serviceToken = await _securityTokenService(
    resp.location,
    resp.nonce,
    resp.ssecurity
  );
  return serviceToken
    ? {
        userId: resp.userId,
        passToken: resp.passToken,
        ssecurity: resp.ssecurity,
        serviceToken: serviceToken,
        deviceId: opt.deviceId,
      }
    : undefined;
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
    { headers: {} }
  );
  let cookies = res.headers["set-cookie"];
  if (!cookies) {
    return undefined;
  }
  for (let cookie of cookies) {
    if (cookie.startsWith("serviceToken")) {
      return cookie.split(";")[0].split("=").slice(1).join("=");
    }
  }
}
