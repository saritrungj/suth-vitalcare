type LineProfile = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LINE_PROFILE_URL = "https://api.line.me/v2/profile";

function liffChannelId(): string {
  return String(process.env.VITE_LIFF_ID || "").split("-")[0];
}

export async function verifyLineAccessToken(value: unknown): Promise<LineProfile> {
  const accessToken = typeof value === "string" ? value.trim() : "";
  const clientId = liffChannelId();
  if (!accessToken || accessToken.length > 4096 || !clientId) {
    throw new Error("Invalid LINE credentials");
  }

  const verifyUrl = new URL(LINE_VERIFY_URL);
  verifyUrl.searchParams.set("access_token", accessToken);
  const verification = await fetch(verifyUrl, { signal: AbortSignal.timeout(8_000) });
  if (!verification.ok) throw new Error("LINE access token verification failed");
  const verificationResult = (await verification.json()) as {
    client_id?: string;
    expires_in?: number;
  };
  if (
    verificationResult.client_id !== clientId ||
    !Number.isFinite(verificationResult.expires_in) ||
    Number(verificationResult.expires_in) <= 0
  ) {
    throw new Error("LINE access token belongs to a different channel or is expired");
  }

  const profileResponse = await fetch(LINE_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!profileResponse.ok) throw new Error("LINE profile verification failed");
  const profile = (await profileResponse.json()) as LineProfile;
  if (!profile.userId || typeof profile.userId !== "string") {
    throw new Error("LINE profile did not include a user ID");
  }
  return profile;
}
