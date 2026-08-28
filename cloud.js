"use strict";

window.WellnessCloud = (() => {
  const CONFIG_KEY = "wellnessSupabaseConfig";
  const SESSION_KEY = "wellnessSupabaseSession";
  const SUPABASE_HOST_SUFFIX = ".supabase.co";
  const FORBIDDEN_SUPABASE_ROLES = new Set(["service_role", "supabase_admin"]);

  function emptyConfig() {
    return { url: "", anonKey: "" };
  }

  function decodeBase64Url(value) {
    const normalized = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    try {
      if (typeof atob === "function") {
        return atob(padded);
      }
    } catch {}

    return "";
  }

  function getJwtRole(key) {
    const parts = String(key || "").split(".");
    if (parts.length !== 3) return "";

    try {
      const payload = JSON.parse(decodeBase64Url(parts[1]) || "{}");
      return String(payload?.role || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function isForbiddenSupabaseKey(key) {
    const value = String(key || "").trim();
    if (!value) return false;

    if (/^sb_secret_/i.test(value)) return true;

    const role = getJwtRole(value);
    return FORBIDDEN_SUPABASE_ROLES.has(role);
  }

  function normalizeSupabaseUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      throw new Error("Configure d'abord l'URL Supabase.");
    }

    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("L'URL Supabase est invalide.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("L'URL Supabase doit utiliser HTTPS.");
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith(SUPABASE_HOST_SUFFIX)) {
      throw new Error(
        "L'URL Supabase doit utiliser un domaine officiel *.supabase.co.",
      );
    }

    if (parsed.username || parsed.password) {
      throw new Error("L'URL Supabase ne doit pas contenir d'identifiants.");
    }

    return parsed.origin;
  }

  function validateAnonKey(key) {
    const value = String(key || "").trim();
    if (!value) {
      throw new Error("Configure d'abord la clé anon/publishable Supabase.");
    }

    if (isForbiddenSupabaseKey(value)) {
      throw new Error(
        "Clé Supabase refusée : utilise uniquement une clé anon/publishable, jamais une clé service-role/secret.",
      );
    }

    return value;
  }

  function normalizeConfig(config = {}) {
    return {
      url: normalizeSupabaseUrl(config.url),
      anonKey: validateAnonKey(config.anonKey),
    };
  }

  function getConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY)) || emptyConfig();
      const value = {
        url: String(parsed?.url || "").trim(),
        anonKey: String(parsed?.anonKey || "").trim(),
      };

      if (isForbiddenSupabaseKey(value.anonKey)) {
        localStorage.removeItem(CONFIG_KEY);
        return emptyConfig();
      }

      return value;
    } catch {
      return emptyConfig();
    }
  }

  function setConfig(config) {
    const value = normalizeConfig(config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
    return value;
  }

  let sessionCache = null;
  let memoryOnlySession = false;

  function getStorage(name) {
    try {
      return window[name] || null;
    } catch {
      return null;
    }
  }

  function readStoredSession(storage) {
    try {
      return JSON.parse(storage?.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearStoredSessions() {
    try {
      getStorage("localStorage")?.removeItem(SESSION_KEY);
    } catch {}
    try {
      getStorage("sessionStorage")?.removeItem(SESSION_KEY);
    } catch {}
  }

  function migrateLegacySession() {
    const temporary = readStoredSession(getStorage("sessionStorage"));
    const legacy = readStoredSession(getStorage("localStorage"));

    sessionCache = temporary || legacy || null;

    if (legacy && !temporary) {
      try {
        getStorage("sessionStorage")?.setItem(
          SESSION_KEY,
          JSON.stringify(legacy),
        );
      } catch {}
    }

    // Une ancienne session persistante est supprimée automatiquement.
    try {
      getStorage("localStorage")?.removeItem(SESSION_KEY);
    } catch {}
  }

  migrateLegacySession();

  function getSession() {
    return sessionCache;
  }

  function setSession(session) {
    sessionCache = session || null;

    if (memoryOnlySession) {
      clearStoredSessions();
      return;
    }

    const storage = getStorage("sessionStorage");

    try {
      if (sessionCache) {
        storage?.setItem(SESSION_KEY, JSON.stringify(sessionCache));
      } else {
        storage?.removeItem(SESSION_KEY);
      }
    } catch {}

    // Ne jamais laisser revenir la session dans localStorage.
    try {
      getStorage("localStorage")?.removeItem(SESSION_KEY);
    } catch {}
  }

  function useMemorySession(session = sessionCache) {
    memoryOnlySession = true;
    sessionCache = session || null;
    clearStoredSessions();
    return sessionCache;
  }

  function requireConfig() {
    const config = getConfig();

    if (!config.url || !config.anonKey) {
      throw new Error(
        "Configure d'abord l'URL Supabase et la clé anon/publishable.",
      );
    }

    return normalizeConfig(config);
  }

  async function request(path, options = {}, token = null) {
    const config = requireConfig();
    const response = await fetch(config.url + path, {
      ...options,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message =
        data?.msg ||
        data?.message ||
        data?.error_description ||
        data?.error ||
        `Erreur HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function signUp(email, password) {
    const data = await request("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (data?.access_token) setSession(data);
    return data;
  }

  async function signIn(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(data);
    return data;
  }

  async function signOut() {
    const session = getSession();
    let revokeError = null;

    try {
      if (session?.access_token) {
        await request(
          "/auth/v1/logout",
          {
            method: "POST",
          },
          session.access_token,
        );
      }
    } catch (error) {
      revokeError = error;
    } finally {
      // La déconnexion locale doit toujours réussir,
      // même si Supabase est temporairement indisponible.
      setSession(null);
    }

    if (revokeError) {
      throw revokeError;
    }

    return true;
  }

  async function refreshSession() {
    const session = getSession();
    if (!session?.refresh_token) return null;
    const data = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    setSession(data);
    return data;
  }

  async function validSession() {
    let session = getSession();
    if (!session) return null;
    const expiresAt = Number(session.expires_at || 0) * 1000;
    if (expiresAt && Date.now() > expiresAt - 60000) {
      try {
        session = await refreshSession();
      } catch {
        setSession(null);
        return null;
      }
    }
    return session;
  }

  async function push(payload) {
    const session = await validSession();
    if (!session?.access_token || !session?.user?.id)
      throw new Error("Connecte-toi au cloud d'abord.");
    const row = {
      user_id: session.user.id,
      payload,
      updated_at: new Date().toISOString(),
    };
    await request(
      "/rest/v1/wellness_sync?on_conflict=user_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([row]),
      },
      session.access_token,
    );
    return row.updated_at;
  }

  async function pull() {
    const session = await validSession();
    if (!session?.access_token || !session?.user?.id)
      throw new Error("Connecte-toi au cloud d'abord.");
    const rows = await request(
      `/rest/v1/wellness_sync?user_id=eq.${encodeURIComponent(session.user.id)}&select=payload,updated_at&limit=1`,
      { method: "GET" },
      session.access_token,
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function deleteRemoteData() {
    const session = await validSession();

    if (!session?.access_token || !session?.user?.id) {
      throw new Error("Connecte-toi au cloud d'abord.");
    }

    await request(
      `/rest/v1/wellness_sync?user_id=eq.${encodeURIComponent(session.user.id)}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal",
        },
      },
      session.access_token,
    );

    return true;
  }

  return {
    getConfig,
    setConfig,
    getSession,
    useMemorySession,
    signUp,
    signIn,
    signOut,
    push,
    pull,
    validSession,
    deleteRemoteData,
  };
})();
