# MiService

XiaoMi Cloud Service for mi.com

## ⚡️ Installation

```
npm install mi-service-lite

# or
yarn add mi-service-lite

# or
pnpm install mi-service-lite
```

## 🔥 Usage

```typescript
import { getMiIOT, getMiNA } from "mi-service-lite";

async function main() {
  console.log("hello world!", process.env.MI_USER);
  const config = {
    userId: process.env.MI_USER!, // Xiaomi Account
    password: process.env.MI_PASS!, // Account Password
    did: process.env.MI_DID, // Device ID or Name (optional - fill in after retrieving from the device list)
  };
  const MiNA = await getMiNA(config);
  const MiIOT = await getMiIOT(config);
  console.log("MiNA devices", await MiNA?.getDevices());
  console.log("MiIOT devices", await MiIOT?.getDevices());
}

main();
```

## ❤️ Acknowledgement

- https://github.com/inu1255/mi-service
- https://github.com/Yonsm/MiService
- https://github.com/yihong0618/xiaogpt
