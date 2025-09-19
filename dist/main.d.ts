type PrinterLanguage = "esc-pos" | "star-prnt" | "star-graphics" | "star-line";
type CodepageMapping = "default" | "zjiang" | "mpt" | "bixolon" | "star" | "epson" | "citizen" | "hp" | "xprinter";
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
    connected: [ConnectedEventPayload];
    disconnected: [];
    data: [DataView];
};
export default class WebUSBReceiptPrinter {
    private emitter;
    private device;
    private profile;
    private endpoints;
    constructor();
    connect(): Promise<void>;
    reconnect(previousDevice: {
        serialNumber?: string;
        vendorId: number;
        productId: number;
    }): Promise<void>;
    private open;
    private evaluate;
    listen(): Promise<boolean | void>;
    private read;
    disconnect(): Promise<void>;
    print(command: BufferSource): Promise<void>;
    addEventListener<K extends keyof PrinterEvents>(name: K, fn: (...args: PrinterEvents[K]) => void): void;
}
export {};
