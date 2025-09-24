import { EventEmitter } from "./event-emitter";

type PrinterLanguage = "esc-pos" | "star-prnt" | "star-graphics" | "star-line";
type CodepageMapping =
	| "default"
	| "zjiang"
	| "mpt"
	| "bixolon"
	| "star"
	| "epson"
	| "citizen"
	| "hp"
	| "xprinter";

type ConnectedEventPayload = {
	type: "usb";
	manufacturerName?: string;
	productName?: string;
	serialNumber?: string;
	vendorId: number;
	productId: number;
	language: PrinterLanguage;
	codepageMapping: CodepageMapping;
};

export type PrinterEvents = {
	connected: [ConnectedEventPayload]; // 1 argument
	disconnected: []; // aucun argument
	data: [DataView]; // 1 argument
};

type MaybeAsync<T> = T | Promise<T>;

type DeviceProfile = {
	filters: USBDeviceFilter[];
	configuration: number;
	interface: number;
	language:
		| PrinterLanguage
		| ((device: USBDevice) => MaybeAsync<PrinterLanguage>);
	codepageMapping:
		| CodepageMapping
		| ((device: USBDevice) => MaybeAsync<CodepageMapping>);
};

const DeviceProfiles: DeviceProfile[] = [
	/* POS-8022 and similar printers */
	{
		filters: [{ vendorId: 0x0483, productId: 0x5743 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "default",
	},

	/* POS-5805, POS-8360 and similar printers */
	{
		filters: [{ vendorId: 0x0416, productId: 0x5011 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "zjiang",
	},

	/* MPT-II and similar printers */
	{
		filters: [{ vendorId: 0x0483, productId: 0x5840 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "mpt",
	},

	/* Samsung SRP (Bixolon) */
	{
		filters: [{ vendorId: 0x0419 }, { vendorId: 0x1504 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "bixolon",
	},

	/* Star */
	{
		filters: [{ vendorId: 0x0519 }],
		configuration: 1,
		interface: 0,

		language: (device: USBDevice): PrinterLanguage => {
			let language: PrinterLanguage = "star-line";
			let name = device.productName ?? "";

			// Normalisation des noms
			name = name.replace(/^Star\s+/i, "");
			name = name.replace(
				/^TSP(1|4|6|7|8|10)(13|43)(.*)?$/,
				(_m, p1, _p2, p3) => "TSP" + p1 + "00" + (p3 || ""),
			);
			name = name.replace(
				/^TSP(55|65)(1|4)(.*)?$/,
				(_m, p1, _p2, p3) => "TSP" + p1 + "0" + (p3 || ""),
			);
			name = name.replace(
				/^TSP([0-9]+)(II|III|IV|V|VI)?(.*)?$/,
				(_m, p1, p2) => "TSP" + p1 + (p2 || ""),
			);

			switch (name) {
				case "TSP100IV":
				case "mPOP":
				case "mC-Label3":
				case "mC-Print3":
				case "mC-Print2":
					language = "star-prnt";
					break;

				case "TSP100":
				case "TSP100II":
				case "TSP100III":
					language = "star-graphics";
					break;

				case "BSC10":
				case "BSC10BR":
				case "BSC10II":
					language = "esc-pos";
					break;
			}

			return language;
		},

		codepageMapping: "star",
	},

	/* Epson */
	{
		filters: [{ vendorId: 0x04b8 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "epson",
	},

	/* Citizen */
	{
		filters: [{ vendorId: 0x1d90 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "citizen",
	},

	/* HP */
	{
		filters: [{ vendorId: 0x05d9 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "hp",
	},

	/* Fujitsu */
	{
		filters: [{ vendorId: 0x04c5 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "epson",
	},

	/* Dtronic */
	{
		filters: [{ vendorId: 0x0fe6, productId: 0x811e }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "epson",
	},

	/* Xprinter */
	{
		filters: [{ vendorId: 0x1fc9, productId: 0x2016 }],
		configuration: 1,
		interface: 0,
		language: "esc-pos",
		codepageMapping: "xprinter",
	},
];

export default class WebUSBReceiptPrinter {
	private emitter: EventEmitter<PrinterEvents>;
	private device: USBDevice | null = null;
	private profile: DeviceProfile | null = null;
	private endpoints: {
		input: USBEndpoint | null;
		output: USBEndpoint | null;
	} = { input: null, output: null };

	constructor() {
		this.emitter = new EventEmitter<PrinterEvents>();

		// Déconnexion physique du device
		navigator.usb.addEventListener(
			"disconnect",
			(event: USBConnectionEvent) => {
				if (this.device === event.device) {
					this.emitter.emit("disconnected");
				}
			},
		);
	}

	async connect(): Promise<void> {
		try {
			const filters = DeviceProfiles.flatMap((p) => p.filters);
			const device = await navigator.usb.requestDevice({ filters });

			if (device) {
				await this.open(device);
			}
		} catch (error) {
			console.log(`Could not connect! ${error}`);
			throw error;
		}
	}

	async reconnect(previousDevice: {
		serialNumber?: string;
		vendorId: number;
		productId: number;
	}): Promise<void> {
		const devices = await navigator.usb.getDevices();

		const device =
			devices.find((d) => d.serialNumber === previousDevice.serialNumber) ??
			devices.find(
				(d) =>
					d.vendorId === previousDevice.vendorId &&
					d.productId === previousDevice.productId,
			);

		if (device) {
			await this.open(device);
		}
	}

	private async initializeUsbDevice(
		device: USBDevice,
		options: {
			configuration: number;
			intf: number;
			fallbackConfiguration: number;
			fallbackIntf: number;
		},
	): Promise<void> {
		try {
			await device.open();
			await device.selectConfiguration(options.configuration);
			await device.claimInterface(options.intf);
		} catch (e) {
			console.log(e);
			// Retry with conservative defaults
			await device.open();
			await device.selectConfiguration(options.fallbackConfiguration);
			await device.claimInterface(options.fallbackIntf);
		}
	}

	private async open(device: USBDevice): Promise<void> {
		this.device = device;

		this.profile =
			DeviceProfiles.find((item) =>
				item.filters.some((filter) =>
					filter.productId != null
						? filter.vendorId === device.vendorId &&
							filter.productId === device.productId
						: filter.vendorId === device.vendorId,
				),
			) ?? null;

		if (!this.profile) {
			throw new Error("No matching device profile found.");
		}

		const primaryConfig = this.profile.configuration;
		const primaryInterface = this.profile.interface;
		const fallbackConfig = 1;
		const fallbackInterface = 0;

		await this.initializeUsbDevice(device, {
			configuration: primaryConfig,
			intf: primaryInterface,
			fallbackConfiguration: fallbackConfig,
			fallbackIntf: fallbackInterface,
		});

		const iface = device.configuration?.interfaces.find(
			(i) => i.interfaceNumber === this.profile!.interface,
		);
		if (!iface) {
			throw new Error("USB interface not found on device.");
		}

		// `alternate` est l’alternate courant, défini par le navigateur
		const alt = iface.alternate ?? iface.alternates?.[0];
		if (!alt) {
			throw new Error("USB alternate interface not available.");
		}

		this.endpoints.output =
			alt.endpoints.find((e) => e.direction === "out") ?? null;
		this.endpoints.input =
			alt.endpoints.find((e) => e.direction === "in") ?? null;

		try {
			// Certains drivers n’aiment pas reset -> on encapsule
			await device.reset();
		} catch (e) {
			console.log(e);
		}

		const language = await this.evaluate(this.profile.language);
		const codepageMapping = await this.evaluate(this.profile.codepageMapping);

		this.emitter.emit("connected", {
			type: "usb",
			manufacturerName: device.manufacturerName ?? undefined,
			productName: device.productName ?? undefined,
			serialNumber: device.serialNumber ?? undefined,
			vendorId: device.vendorId,
			productId: device.productId,
			language,
			codepageMapping,
		});
	}

	private async evaluate<T>(
		expression: T | ((device: USBDevice) => MaybeAsync<T>),
	): Promise<T> {
		if (typeof expression === "function") {
			const fn = expression as (d: USBDevice) => MaybeAsync<T>;
			return fn(this.device as USBDevice);
		}
		return expression as T;
	}

	async listen(): Promise<boolean | void> {
		if (this.endpoints.input) {
			await this.read();
			return true;
		}
	}

	private async read(): Promise<void> {
		if (!this.device || !this.endpoints.input) {
			return;
		}

		const result = await this.device.transferIn(
			this.endpoints.input.endpointNumber,
			64,
		);
		if (result?.data?.byteLength) {
			this.emitter.emit("data", result.data);
		}
		// boucle
		await this.read();
	}

	async disconnect(): Promise<void> {
		if (!this.device) return;

		try {
			await this.device.close();
		} finally {
			this.device = null;
			this.profile = null;
			this.endpoints = { input: null, output: null };
			this.emitter.emit("disconnected");
		}
	}

	async print(command: BufferSource): Promise<void> {
		if (this.device && this.endpoints.output) {
			try {
				await this.device.transferOut(
					this.endpoints.output.endpointNumber,
					command,
				);
			} catch (e) {
				console.log(e);
				throw e;
			}
		} else {
			throw new Error("No device/output endpoint available.");
		}
	}

	addEventListener<K extends keyof PrinterEvents>(
		name: K,
		fn: (...args: PrinterEvents[K]) => void,
	): void {
		this.emitter.on(name, fn);
	}
}
