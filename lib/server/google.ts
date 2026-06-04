import "server-only";

// "Entrar con Google" (OAuth 2.0) con fetch, sin dependencias.

export function authUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

export async function exchangeCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string; id_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      "Google rechazó el intercambio de código: " + (data.error_description || res.status),
    );
  return data;
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("No se pudo leer el perfil de Google: " + res.status);
  return {
    googleId: data.sub,
    email: data.email,
    emailVerified: !!data.email_verified,
    name: data.name || null,
    picture: data.picture || null,
  };
}
