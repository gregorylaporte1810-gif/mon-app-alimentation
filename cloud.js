"use strict";

window.WellnessCloud = (() => {
  const CONFIG_KEY = "wellnessSupabaseConfig";
  const SESSION_KEY = "wellnessSupabaseSession";

  function cleanUrl(url) { return String(url || "").trim().replace(/\/+$/, ""); }
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { url: "", anonKey: "" }; }
    catch { return { url: "", anonKey: "" }; }
  }
  function setConfig(config) {
    const value = { url: cleanUrl(config.url), anonKey: String(config.anonKey || "").trim() };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
    return value;
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  }
  function setSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }
  function requireConfig() {
    const config = getConfig();
    if (!config.url || !config.anonKey) throw new Error("Configure d'abord l'URL Supabase et la clé anon.");
    return config;
  }
  async function request(path, options = {}, token = null) {
    const config = requireConfig();
    const response = await fetch(config.url + path, {
      ...options,
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || `Erreur HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }
  async function signUp(email, password) {
    const data = await request("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
    if (data?.access_token) setSession(data);
    return data;
  }
  async function signIn(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
    setSession(data);
    return data;
  }
  function signOut() { setSession(null); }
  async function refreshSession() {
    const session = getSession();
    if (!session?.refresh_token) return null;
    const data = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) });
    setSession(data);
    return data;
  }
  async function validSession() {
    let session = getSession();
    if (!session) return null;
    const expiresAt = Number(session.expires_at || 0) * 1000;
    if (expiresAt && Date.now() > expiresAt - 60000) {
      try { session = await refreshSession(); } catch { setSession(null); return null; }
    }
    return session;
  }
  async function push(payload) {
    const session = await validSession();
    if (!session?.access_token || !session?.user?.id) throw new Error("Connecte-toi au cloud d'abord.");
    const row = { user_id: session.user.id, payload, updated_at: new Date().toISOString() };
    await request("/rest/v1/wellness_sync?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([row]),
    }, session.access_token);
    return row.updated_at;
  }
  async function pull() {
    const session = await validSession();
    if (!session?.access_token || !session?.user?.id) throw new Error("Connecte-toi au cloud d'abord.");
    const rows = await request(`/rest/v1/wellness_sync?user_id=eq.${encodeURIComponent(session.user.id)}&select=payload,updated_at&limit=1`, { method: "GET" }, session.access_token);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  return { getConfig, setConfig, getSession, signUp, signIn, signOut, push, pull, validSession };
})();
