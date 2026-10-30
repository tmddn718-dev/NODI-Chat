import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
});
const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => path.relative(root, file);

describe("PostHog is gone and Amplitude is the only analytics tool", () => {
  const manifest = JSON.parse(read(path.join(root, "package.json"))) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const all = { ...manifest.dependencies, ...manifest.devDependencies };

  it("has no PostHog package, and no Session Replay or second analytics package", () => {
    expect(Object.keys(all).filter((name) => /posthog|session-replay|mixpanel|segment|gtag|google-analytics/i.test(name))).toEqual([]);
    expect(manifest.dependencies["@amplitude/analytics-browser"]).toMatch(/^\d+\.\d+\.\d+$/); // 정확한 버전으로 고정
  });

  it("has no PostHog initialization, event code, host, environment variable or Amplitude secret key in source, server, config or deploy files", () => {
    const targets = [...files(path.join(root, "src")), ...files(path.join(root, "server")), ...files(path.join(root, "scripts")), ...["vite.config.ts", "render.public.yaml", "render.yaml", ".env.example"].map((name) => path.join(root, name))]
      .filter((file) => /\.(ts|tsx|yaml|yml|sh|example)$/.test(file) && !/replacement\.test\.ts$|check-secrets\.sh$/.test(file)); // 점검 스크립트는 금지 패턴을 적어 둔 파일이라 제외해요
    const offenders: string[] = [];
    for (const file of targets) {
      const text = read(file);
      if (/posthog\.com|posthog-js|VITE_POSTHOG|POSTHOG_|posthog\.(init|capture|identify|opt_)|\/capture\/|\$process_person_profile/i.test(text)) offenders.push(rel(file));
      if (/AMPLITUDE_SECRET|VITE_AMPLITUDE_SECRET|amplitude.*secret.*key/i.test(text) && !/check-secrets\.sh$/.test(file)) offenders.push(`${rel(file)} (secret)`);
    }
    expect(offenders).toEqual([]);
  });

  it("does not install Session Replay, autocapture plugins by name, or user identification calls", () => {
    const source = files(path.join(root, "src")).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file)).map(read).join("\n");
    expect(source).not.toMatch(/session-replay|sessionReplay|plugin-autocapture|setUserId|\.identify\(|new Identify|setGroup|groupIdentify/);
  });

  it("keeps the browser-side environment variables to public build settings only", () => {
    const example = read(path.join(root, ".env.example"));
    const clientVars = [...example.matchAll(/^(VITE_[A-Z_]+)=/gm)].map((match) => match[1]);
    expect(clientVars).toEqual(expect.arrayContaining(["VITE_AMPLITUDE_API_KEY", "VITE_AMPLITUDE_SERVER_ZONE", "VITE_ANALYTICS_ENVIRONMENT", "VITE_APP_VERSION", "VITE_FLOW_VERSION", "VITE_EXPERIMENT_ID", "VITE_PRIVACY_CONTACT", "VITE_DATA_RETENTION_DAYS"]));
    expect(clientVars.filter((name) => /SECRET|SERVICE|GROQ|TOKEN|PRIVATE|PASSWORD/.test(name))).toEqual([]);
    for (const line of example.split("\n").filter((l) => /^[A-Z_]+=/.test(l))) expect(line.split("=")[1]).toBe(""); // 값은 비워 둬요
  });
});
