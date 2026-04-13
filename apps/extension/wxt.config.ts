import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "Webchain",
    description: "Browser-side bridge for the Webchain runtime.",
    permissions: ["storage", "tabs", "activeTab"],
    host_permissions: ["http://127.0.0.1/*", "http://localhost/*"],
  },
});
