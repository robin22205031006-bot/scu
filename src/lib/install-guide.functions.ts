import { createServerFn } from "@tanstack/react-start";

export type InstallGuideInput = {
  device: string;
  browser: string;
  goal: string;
  notes: string;
};

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export const getInstallGuide = createServerFn({ method: "POST" })
  .inputValidator((input: InstallGuideInput): InstallGuideInput => ({
    device: clip(input?.device, 60),
    browser: clip(input?.browser, 60),
    goal: clip(input?.goal, 80),
    notes: clip(input?.notes, 500),
  }))
  .handler(async ({ data }): Promise<{ steps: string; error?: string }> => {
    if (!data.device) return { steps: "", error: "Please choose your device." };
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const site = "https://sentinels-cinematic-universe.lovable.app";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          `You help visitors install the Sentinels Cinematic Universe lore archive, a web app at ${site}. ` +
          `It supports "Add to Home Screen"/"Install app" from the browser (it has a web app manifest and icons), ` +
          `and an Android package can be made with PWABuilder (pwabuilder.com → enter the URL → Package for stores → Android). ` +
          `There is no App Store or Play Store listing yet. Give short, numbered, device-specific steps in plain language, ` +
          `then one line of troubleshooting tips. No more than 10 steps. Plain text only, no markdown symbols like ** or #. Never invent features.`,
        input: `Device: ${data.device}\nBrowser: ${data.browser || "unknown"}\nWhat they want: ${data.goal || "install on home screen"}\nExtra notes: ${data.notes || "none"}`,
        max_output_tokens: 900,
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") text += c.text;
        }
      }
      return text.trim() ? { steps: text.trim() } : { steps: "", error: "No guide was returned. Please try again." };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("install guide gateway error", e.code, e.ids);
        if (e.code === "rate_limited") return { steps: "", error: "Too many requests right now — please wait a moment." };
      } else console.error("install guide error", e);
      return { steps: "", error: "The guide is unavailable right now. Please try again later." };
    }
  });
