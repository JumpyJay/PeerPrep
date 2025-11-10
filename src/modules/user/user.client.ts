// src/modules/user/user.client.ts
import { z } from "zod";

const ENV = {
  BASE: process.env.USER_SVC_BASE_URL ?? "http://localhost:3000",
  TOKEN: process.env.MATCHING_SVC_TOKEN ?? "",
  TIMEOUT: Number(process.env.HTTP_TIMEOUT_MS ?? 3000),
  BYPASS: (process.env.BYPASS_USER_SERVICE ?? "false").toLowerCase() === "true",
};

const ProfileSchema = z.object({
  username: z.string().optional(),
  email: z.string().email(),
  created_at: z.union([z.string(), z.date()]).optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`UserService timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(id); resolve(v); }, e => { clearTimeout(id); reject(e); });
  });
}

async function httpGet(fullUrl: string) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ENV.TIMEOUT);
  try {
    console.log("[UserClient] GET", fullUrl);

    const res = await fetch(fullUrl, {
      headers: {
        "Accept": "application/json",
        ...(ENV.TOKEN ? { "Authorization": `Bearer ${ENV.TOKEN}` } : {}),
      },
      cache: "no-store",
      signal: ctl.signal,
    });

    console.log("[UserClient] status", res.status);

    if (res.status === 404) return { notFound: true as const };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`UserService ${res.status} ${text.slice(0, 200)}`);
    }

    const json = await res.json().catch(() => ({}));
    console.log("[UserClient] body preview", JSON.stringify(json).slice(0, 200));
    return { json };
  } finally {
    clearTimeout(timer);
  }
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  if (ENV.BYPASS) {
    const dummy: Profile = { email, username: email.split("@")[0] };
    console.log("[UserClient] BYPASS=true → returning", dummy);
    return dummy;
  }

  // USE PATH PARAM (matches your /api/v1/user/[email] route)
  const url = `${ENV.BASE}/api/v1/user/${encodeURIComponent(email)}`;

  const { json, notFound } = await withTimeout(httpGet(url), ENV.TIMEOUT).catch((e) => {
    console.error("[UserClient] fetch failed:", e);
    throw e;
  }) as { json?: unknown; notFound?: true };

  if (notFound) return null;
  return ProfileSchema.parse(json);
}
