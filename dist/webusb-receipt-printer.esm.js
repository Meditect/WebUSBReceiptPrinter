class d {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  on(e, t) {
    const n = this.events.get(e) ?? /* @__PURE__ */ new Set();
    n.add(t), this.events.set(
      e,
      n
    );
  }
  emit(e, ...t) {
    const n = this.events.get(e);
    if (n)
      for (const i of n) setTimeout(() => i(...t), 0);
  }
}
const c = [
  /* POS-8022 and similar printers */
  {
    filters: [{ vendorId: 1155, productId: 22339 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "default"
  },
  /* POS-5805, POS-8360 and similar printers */
  {
    filters: [{ vendorId: 1046, productId: 20497 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "zjiang"
  },
  /* MPT-II and similar printers */
  {
    filters: [{ vendorId: 1155, productId: 22592 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "mpt"
  },
  /* Samsung SRP (Bixolon) */
  {
    filters: [{ vendorId: 1049 }, { vendorId: 5380 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "bixolon"
  },
  /* Star */
  {
    filters: [{ vendorId: 1305 }],
    configuration: 1,
    interface: 0,
    language: (s) => {
      let e = "star-line", t = s.productName ?? "";
      switch (t = t.replace(/^Star\s+/i, ""), t = t.replace(
        /^TSP(1|4|6|7|8|10)(13|43)(.*)?$/,
        (n, i, o, a) => "TSP" + i + "00" + (a || "")
      ), t = t.replace(
        /^TSP(55|65)(1|4)(.*)?$/,
        (n, i, o, a) => "TSP" + i + "0" + (a || "")
      ), t = t.replace(
        /^TSP([0-9]+)(II|III|IV|V|VI)?(.*)?$/,
        (n, i, o) => "TSP" + i + (o || "")
      ), t) {
        case "TSP100IV":
        case "mPOP":
        case "mC-Label3":
        case "mC-Print3":
        case "mC-Print2":
          e = "star-prnt";
          break;
        case "TSP100":
        case "TSP100II":
        case "TSP100III":
          e = "star-graphics";
          break;
        case "BSC10":
        case "BSC10BR":
        case "BSC10II":
          e = "esc-pos";
          break;
      }
      return e;
    },
    codepageMapping: "star"
  },
  /* Epson */
  {
    filters: [{ vendorId: 1208 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "epson"
  },
  /* Citizen */
  {
    filters: [{ vendorId: 7568 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "citizen"
  },
  /* HP */
  {
    filters: [{ vendorId: 1497 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "hp"
  },
  /* Fujitsu */
  {
    filters: [{ vendorId: 1221 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "epson"
  },
  /* Dtronic */
  {
    filters: [{ vendorId: 4070, productId: 33054 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "epson"
  },
  /* Xprinter */
  {
    filters: [{ vendorId: 8137, productId: 8214 }],
    configuration: 1,
    interface: 0,
    language: "esc-pos",
    codepageMapping: "xprinter"
  }
];
class p {
  constructor() {
    this.device = null, this.profile = null, this.endpoints = { input: null, output: null }, this.emitter = new d(), navigator.usb.addEventListener(
      "disconnect",
      (e) => {
        this.device === e.device && this.emitter.emit("disconnected");
      }
    );
  }
  async connect() {
    try {
      const e = c.flatMap((n) => n.filters), t = await navigator.usb.requestDevice({ filters: e });
      t && await this.open(t);
    } catch (e) {
      throw console.log(`Could not connect! ${e}`), e;
    }
  }
  async reconnect(e) {
    const t = await navigator.usb.getDevices(), n = t.find((i) => i.serialNumber === e.serialNumber) ?? t.find(
      (i) => i.vendorId === e.vendorId && i.productId === e.productId
    );
    n && await this.open(n);
  }
  async open(e) {
    if (this.device = e, this.profile = c.find(
      (a) => a.filters.some(
        (r) => r.productId != null ? r.vendorId === e.vendorId && r.productId === e.productId : r.vendorId === e.vendorId
      )
    ) ?? null, !this.profile)
      throw new Error("No matching device profile found.");
    await e.open(), await e.selectConfiguration(this.profile.configuration), await e.claimInterface(this.profile.interface);
    const t = e.configuration?.interfaces.find(
      (a) => a.interfaceNumber === this.profile.interface
    );
    if (!t)
      throw new Error("USB interface not found on device.");
    const n = t.alternate ?? t.alternates?.[0];
    if (!n)
      throw new Error("USB alternate interface not available.");
    this.endpoints.output = n.endpoints.find((a) => a.direction === "out") ?? null, this.endpoints.input = n.endpoints.find((a) => a.direction === "in") ?? null;
    try {
      await e.reset();
    } catch (a) {
      console.log(a);
    }
    const i = await this.evaluate(this.profile.language), o = await this.evaluate(this.profile.codepageMapping);
    this.emitter.emit("connected", {
      type: "usb",
      manufacturerName: e.manufacturerName ?? void 0,
      productName: e.productName ?? void 0,
      serialNumber: e.serialNumber ?? void 0,
      vendorId: e.vendorId,
      productId: e.productId,
      language: i,
      codepageMapping: o
    });
  }
  async evaluate(e) {
    return typeof e == "function" ? e(this.device) : e;
  }
  async listen() {
    if (this.endpoints.input)
      return await this.read(), !0;
  }
  async read() {
    if (!this.device || !this.endpoints.input)
      return;
    const e = await this.device.transferIn(
      this.endpoints.input.endpointNumber,
      64
    );
    e?.data?.byteLength && this.emitter.emit("data", e.data), await this.read();
  }
  async disconnect() {
    if (this.device)
      try {
        await this.device.close();
      } finally {
        this.device = null, this.profile = null, this.endpoints = { input: null, output: null }, this.emitter.emit("disconnected");
      }
  }
  async print(e) {
    if (this.device && this.endpoints.output)
      try {
        await this.device.transferOut(
          this.endpoints.output.endpointNumber,
          e
        );
      } catch (t) {
        throw console.log(t), t;
      }
    else
      throw new Error("No device/output endpoint available.");
  }
  addEventListener(e, t) {
    this.emitter.on(e, t);
  }
}
export {
  p as default
};
//# sourceMappingURL=webusb-receipt-printer.esm.js.map
