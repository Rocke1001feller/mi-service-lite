# MiService

XiaoMi Cloud Service for mi.com
This is a fork from https://github.com/Yonsm/MiService implemented in TypeScript.

## Install

```bash
npm install mi-service
```

## Usage

```javascript
const {getService} = require("mi-service");
async function main() {
	const mina = await getService("mina");
	// 获取音响设备列表
	let list = await mina.device_list();
	console.log(list);
}
main().catch((e) => {
	console.error(e);
});
```
