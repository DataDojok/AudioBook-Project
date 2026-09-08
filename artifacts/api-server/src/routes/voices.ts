import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const connectors = new ReplitConnectors();

const DEFAULT_ENTITLEMENT = "enhanced_voices";
const VOICE_CACHE_MS = 10 * 60 * 1000;

type ElevenLabsVoice = {
  voice_id?: unknown;
  name?: unknown;
  labels?: Record<string, unknown>;
};

type Voice = {
  id: string;
  name: string;
  language: string;
  accent: string;
  gender: string;
  description: string;
};

let voiceCache: { expiresAt: number; voices: Voice[] } | null = null;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function textLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function mapVoice(voice: ElevenLabsVoice): Voice | null {
  const id = typeof voice.voice_id === "string" ? voice.voice_id : "";
  if (!id) return null;
  const labels = voice.labels ?? {};
  const language = textLabel(labels.language, "en");
  const accent = textLabel(labels.accent, "natural");
  const gender = textLabel(labels.gender, "neutral");
  const name = textLabel(voice.name, "Enhanced narrator");
  const useCase = textLabel(labels.use_case, "narrative_story")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { id, name, language, accent, gender, description: useCase };
}

async function getVoices(): Promise<Voice[]> {
  if (voiceCache && voiceCache.expiresAt > Date.now()) return voiceCache.voices;
  const response = await connectors.proxy("elevenlabs", "/v1/voices");
  if (!response.ok) {
    throw new Error(`ElevenLabs voice catalog returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { voices?: ElevenLabsVoice[] };
  const voices = (payload.voices ?? [])
    .map(mapVoice)
    .filter((voice): voice is Voice => voice !== null)
    .filter((voice) => voice.language.toLowerCase().startsWith("en") || voice.language.toLowerCase().startsWith("es"))
    .slice(0, 24);
  voiceCache = { expiresAt: Date.now() + VOICE_CACHE_MS, voices };
  return voices;
}

async function hasEnhancedEntitlement(appUserId: string): Promise<boolean> {
  const projectId = env("REVENUECAT_PROJECT_ID");
  if (!projectId) throw new Error("RevenueCat is not configured: set REVENUECAT_PROJECT_ID");
  const response = await connectors.proxy(
    "revenuecat",
    `/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}/active_entitlements`,
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`RevenueCat entitlement check returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    items?: Array<{ entitlement_id?: string; id?: string }>;
  };
  const entitlementId = env("REVENUECAT_ENTITLEMENT_ID") ?? DEFAULT_ENTITLEMENT;
  return (payload.items ?? []).some((item) => (item.entitlement_id ?? item.id) === entitlementId);
}

function sendError(response: Response, status: number, message: string) {
  response.status(status).json({ message });
}

router.get("/voices", async (_request: Request, response: Response) => {
  try {
    response.json({ voices: await getVoices() });
  } catch (error) {
    response.status(503).json({
      message: error instanceof Error ? error.message : "The enhanced voice catalog is unavailable.",
    });
  }
});

router.get("/entitlements/:appUserId", async (request: Request, response: Response) => {
  const rawAppUserId = request.params.appUserId;
  const appUserId = typeof rawAppUserId === "string" ? rawAppUserId.trim() : "";
  if (!appUserId || appUserId.length > 200) {
    sendError(response, 400, "A valid app user id is required.");
    return;
  }
  try {
    const isPremium = await hasEnhancedEntitlement(appUserId);
    response.json({
      appUserId,
      isPremium,
      ...(isPremium ? { entitlementId: env("REVENUECAT_ENTITLEMENT_ID") ?? DEFAULT_ENTITLEMENT } : {}),
    });
  } catch (error) {
    response.status(503).json({
      message: error instanceof Error ? error.message : "Subscription status is unavailable.",
    });
  }
});

router.post("/tts", async (request: Request, response: Response) => {
  const { text, voiceId, appUserId, preview } = request.body as {
    text?: unknown;
    voiceId?: unknown;
    appUserId?: unknown;
    preview?: unknown;
  };
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 5000) {
    sendError(response, 400, "Narration text must be between 1 and 5,000 characters.");
    return;
  }
  if (typeof voiceId !== "string" || voiceId.trim().length === 0 || voiceId.length > 200) {
    sendError(response, 400, "A valid enhanced voice id is required.");
    return;
  }
  if (typeof appUserId !== "string" || appUserId.trim().length === 0 || appUserId.length > 200) {
    sendError(response, 400, "A valid app user id is required.");
    return;
  }

  try {
    const voices = await getVoices();
    if (!voices.some((voice) => voice.id === voiceId)) {
      sendError(response, 400, "That enhanced voice is not available.");
      return;
    }
    const isDevelopmentPreview = process.env.NODE_ENV === "development" && preview === true;
    if (!isDevelopmentPreview && !(await hasEnhancedEntitlement(appUserId))) {
      sendError(response, 403, "An Enhanced Voices subscription is required.");
      return;
    }
    const elevenResponse = await connectors.proxy(
      "elevenlabs",
      `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!elevenResponse.ok) {
      sendError(response, 502, `ElevenLabs narration returned HTTP ${elevenResponse.status}.`);
      return;
    }
    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.send(Buffer.from(await elevenResponse.arrayBuffer()));
  } catch (error) {
    response.status(503).json({
      message: error instanceof Error ? error.message : "Enhanced narration is unavailable.",
    });
  }
});

export default router;