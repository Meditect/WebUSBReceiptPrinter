import { defineConfig } from "vite";

// si tu as React, active le plugin :
// import react from "@vitejs/plugin-react-swc";

export default defineConfig({
    build: {
        lib: {
            entry: "src/main.ts",              // ton fichier principal
            name: "WebUSBReceiptPrinter",      // nom global en UMD/IIFE
            formats: ["es", "umd"],            // formats de sortie
            fileName: (format) =>
                format === "es"
                    ? "webusb-receipt-printer.esm.js"
                    : "webusb-receipt-printer.umd.js"
        },
        rollupOptions: {
            // si ta lib a des dépendances externes, les mettre ici
            external: [],
        },
        sourcemap: true,
        target: "es2020"
    }
});
