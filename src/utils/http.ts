import axios, { AxiosRequestConfig, CreateAxiosDefaults } from "axios";
import { isNotEmpty } from "./is";
import { type } from "os";

const _baseConfig: CreateAxiosDefaults = {
  timeout: 10 * 1000,
  headers: {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate",
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
};

_http.interceptors.response.use(
  (res) => {
    const config: any = res.config;
    if (config.rawResponse) {
      return res;
    }
    return res.data;
  },
  (err) => {
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
      return _http.get<T>(url, query) as any;
    }
    return _http.get<T>(HTTPClient._buildURL(url, query), config) as any;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T | HttpError> {
    return _http.post<T>(url, data, config) as any;
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
}

export const Http = new HTTPClient();
