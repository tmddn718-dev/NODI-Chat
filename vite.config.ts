import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 앱 버전: package.json 버전 + 배포 커밋 해시(Render가 RENDER_GIT_COMMIT을 빌드에 넣어요). 빌드 시점에 고정돼요.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const commit = (process.env.RENDER_GIT_COMMIT ?? "").slice(0, 7);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(commit ? `${pkg.version}+${commit}` : pkg.version) },
  server: {
    port: 5173,
    proxy: { "/api": `http://localhost:${process.env.PORT ?? 3001}` },
  },
});
