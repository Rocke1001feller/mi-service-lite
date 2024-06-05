import axios, { AxiosRequestConfig, CreateAxiosDefaults } from "axios";
import { isNotEmpty } from "./is";

const _baseConfig: CreateAxiosDefaults = {
  proxy: false,
  timeout: 10 * 1000,
  decompress: true,
  headers: {
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 10; RMX2111 Build/QP1A.190711.020) APP/xiaomi.mico APPV/2004040 MK/Uk1YMjExMQ== PassportSDK/3.8.3 passport-ui/3.8.3",
  },
};

const _http = axios.create(_baseConfig);

interface HttpError {
  isError: true;
  error: any;
  code: string;
  message: string;
}

type RequestConfig = AxiosRequestConfig<any> & {
  rawResponse?: boolean;
  cookies?: Record<string, string | number | boolean | undefined>;
};

_http.interceptors.request.use((req) => {
  req.url = (process.env.MI_PROXY ?? "") + req.url;
  return req;
});

_http.interceptors.response.use(
  (res) => {
    const config: any = res.config;
    if (config.rawResponse) {
      return res;
    }
    return res.data;
  },
  (err) => {
    // todo auto re-login（maxRetry=3）
    const error = err.response?.data?.error ?? err.response?.data ?? err;
    const apiError: HttpError = {
      error: err,
      isError: true,
      code: error.code ?? "UNKNOWN CODE",
      message: error.message ?? "UNKNOWN ERROR",
    };
    console.error(
      "❌ Network request failed:",
      apiError.code,
      apiError.message,
      error
    );
    return apiError;
  }
);

class HTTPClient {
  async get<T = any>(
    url: string,
    query?:
      | Record<string, string | number | boolean | undefined>
      | RequestConfig,
    config?: RequestConfig
  ): Promise<T | HttpError> {
    if (config === undefined) {
      config = query;
      query = undefined;
    }
    return _http.get<T>(
      HTTPClient._buildURL(url, query),
      HTTPClient._buildConfig(config)
    ) as any;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T | HttpError> {
    return _http.post<T>(url, data, HTTPClient._buildConfig(config)) as any;
  }

  private static _buildURL = (url: string, query?: Record<string, any>) => {
    const _url = new URL(url);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (isNotEmpty(value)) {
        _url.searchParams.append(key, value.toString());
      }
    }
    return _url.href;
  };

  private static _buildConfig = (config?: RequestConfig) => {
    if (config?.cookies) {
      config.headers = {
        ...config.headers,
        Cookie: Object.entries(config.cookies)
          .map(
            ([key, value]) => `${key}=${value == null ? "" : value.toString()};`
          )
          .join(" "),
      };
    }
    return config;
  };
}

export const Http = new HTTPClient();
