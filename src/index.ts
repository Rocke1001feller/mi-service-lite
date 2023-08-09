import * as fs from "fs";
import * as os from "os";
import {randomString} from "./common";
import {MiAccount, getAccount} from "./miaccount";
import {MiIOService} from "./MiIOService";
import {MiNAService} from "./MiNAService";
import * as dotenv from "dotenv";
dotenv.config();

interface Store {
	deviceId: string;
	userId: number;
	passToken: string;
	xiaomiio?: string[];
	micoapi?: string[];
}

function readJSON(filename: string) {
	return new Promise<any>((resolve, reject) => {
		fs.readFile(filename, "utf8", function (err, data) {
			try {
				if (!err) {
					resolve(JSON.parse(data));
					return;
				}
			} catch (error) {}
			resolve(null);
		});
	});
}

export function getService(name: "miio"): Promise<MiIOService>;
export function getService(name: "mina"): Promise<MiNAService>;
export async function getService(name: "miio" | "mina"): Promise<MiIOService | MiNAService> {
	let store: Store = await readJSON(os.homedir() + "/.mi.token").then((x) => ({
		deviceId: randomString(16).toUpperCase(),
		userId: 0,
		passToken: "",
		...x,
	}));
	let account: MiAccount;
	let sid: "xiaomiio" | "micoapi" = name == "miio" ? "xiaomiio" : "micoapi";
	if (!store[sid]) {
		account = await getAccount({
			deviceId: store.deviceId,
			username: process.env.MI_USER,
			password: process.env.MI_PASS,
			sid: sid,
		});
		store.userId = account.userId;
		store.passToken = account.passToken;
		store[sid] = [account.ssecurity, account.serviceToken];
		fs.writeFile(os.homedir() + "/.mi.token", JSON.stringify(store), function (err) {});
	} else {
		account = {
			deviceId: store.deviceId,
			userId: store.userId,
			passToken: store.passToken,
			ssecurity: store[sid][0],
			serviceToken: store[sid][1],
		};
	}
	return name == "miio" ? new MiIOService(account) : new MiNAService(account);
}

if (require.main === module) {
	async function main() {
		let ret;
		let miio = await getService("miio");
		let mina = await getService("mina");

		// ret = await miio.device_list();
		// console.log(ret);
	}
	main().catch((e) => {
		console.error("error", e);
	});
}
