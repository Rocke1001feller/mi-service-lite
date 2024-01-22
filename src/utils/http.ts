import axios from "axios";

export const Http = axios.create({
  timeout: 10 * 1000,
  headers: {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate",
  },
});
