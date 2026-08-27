(() => {
  "use strict";

  const cap = window.Capacitor;
  const VERSION = "5.0.0";
  const READ_TYPES = [
    "steps", "distance", "calories", "weight", "sleep",
    "restingHeartRate", "heartRateVariability", "vo2Max", "workouts"
  ];

  const esc = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  function isIosNative() {
    if (!cap) return false;
    const platform = cap.getPlatform?.();
    return (typeof cap.isNativePlatform === "function" ? cap.isNativePlatform() : platform === "ios") && platform === "ios";
  }

  function plugin() {
    return cap?.Plugins?.Health || null;
  }

  function account() {
    try { return obtenirCompteActif(); } catch { return null; }
  }

  function today() {
    try { return obtenirDateLocale(); } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
  }

  function ensureState(a = account()) {
    if (!a) return null;
    if (!a.v5 || typeof a.v5 !== "object") a.v5 = {};
    if (!a.v5.health || typeof a.v5.health !== "object") a.v5.health = {};
    const h = a.v5.health;
    if (typeof h.autoSync !== "boolean") h.autoSync = false;
    if (!h.last || typeof h.last !== "object") h.last = {};
    if (!Array.isArray(h.importedWeightIds)) h.importedWeightIds = [];
    if (!Array.isArray(h.importedWorkoutIds)) h.importedWorkoutIds = [];
    return h;
  }

  function save() {
    try { sauvegarderEtatApplication(); } catch {}
  }

  function setStatus(text, kind = "") {
    const el = document.getElementById("v5-health-status");
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function dayRange() {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  function daysAgoRange(days = 7) {
    return {
      startDate: new Date(Date.now() - days * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    };
  }

  async function available() {
    const Health = plugin();
    if (!isIosNative() || !Health) return { available: false, reason: "HealthKit n'est disponible que dans la nouvelle IPA iPhone." };
    try { return await Health.isAvailable(); }
    catch (error) { return { available: false, reason: error?.message || "HealthKit indisponible." }; }
  }

  async function authorize() {
    const Health = plugin();
    if (!Health) return false;
    setStatus("Ouverture des autorisations Apple Santé…");
    try {
      const result = await Health.requestAuthorization({ read: READ_TYPES, write: ["weight"] });
      const h = ensureState();
      h.authorizedAt = new Date().toISOString();
      h.authorization = result;
      save();
      setStatus("✅ Autorisations demandées. Tu peux maintenant synchroniser.", "success");
      render();
      return true;
    } catch (error) {
      setStatus(`⚠️ ${error?.message || "Autorisation impossible."}`, "error");
      return false;
    }
  }

  async function aggregate(dataType, range, aggregation = "sum") {
    const Health = plugin();
    try {
      const result = await Health.queryAggregated({
        dataType,
        startDate: range.startDate,
        endDate: range.endDate,
        bucket: "day",
        aggregation,
      });
      return (result?.samples || []).reduce((sum, sample) => sum + (Number(sample?.value) || 0), 0);
    } catch {
      return 0;
    }
  }

  async function readLatest(dataType, days = 30) {
    const Health = plugin();
    try {
      const result = await Health.readSamples({ dataType, ...daysAgoRange(days), limit: 100 });
      return (result?.samples || [])
        .filter((sample) => Number.isFinite(Number(sample?.value)))
        .sort((a, b) => Date.parse(b.endDate || b.startDate || 0) - Date.parse(a.endDate || a.startDate || 0))[0] || null;
    } catch {
      return null;
    }
  }

  async function readSleep() {
    const Health = plugin();
    try {
      const result = await Health.readSamples({ dataType: "sleep", ...daysAgoRange(2), limit: 200 });
      const samples = result?.samples || [];
      const sleepLike = samples.filter((sample) => {
        const state = String(sample?.sleepState || "").toLowerCase();
        return !state || state.includes("asleep") || state.includes("core") || state.includes("deep") || state.includes("rem");
      });
      const source = sleepLike.length ? sleepLike : samples;
      return source.reduce((sum, sample) => sum + Math.max(0, Number(sample?.value) || 0), 0);
    } catch {
      return 0;
    }
  }

  function importWeight(sample, a, h) {
    if (!sample || !Number.isFinite(Number(sample.value))) return;
    const dateIso = sample.endDate || sample.startDate || new Date().toISOString();
    const key = `${dateIso}|${Number(sample.value).toFixed(3)}`;
    if (h.importedWeightIds.includes(key)) return;
    if (!Array.isArray(a.weightHistory)) a.weightHistory = [];
    a.weightHistory.push({
      id: `health-weight-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      date: dateIso.slice(0,10),
      weight: Number(sample.value),
      createdAt: dateIso,
      source: "Apple Santé",
      healthId: key,
    });
    a.weightHistory = a.weightHistory.slice(-365);
    h.importedWeightIds.push(key);
    h.importedWeightIds = h.importedWeightIds.slice(-120);
    a.poidsActuel = Number(sample.value);
  }

  async function importWorkouts(a, h) {
    const Health = plugin();
    try {
      const result = await Health.queryWorkouts({ ...daysAgoRange(7), limit: 100 });
      const workouts = result?.workouts || [];
      if (!a.w2 || typeof a.w2 !== "object") return;
      if (!Array.isArray(a.w2.activities)) a.w2.activities = [];
      workouts.forEach((workout) => {
        const key = String(workout.platformId || workout.id || workout.uuid || `${workout.startDate}|${workout.workoutType || workout.activityType || "Workout"}`);
        if (h.importedWorkoutIds.includes(key)) return;
        const start = workout.startDate || new Date().toISOString();
        const durationSeconds = Number(workout.duration) || Number(workout.durationSeconds) || 0;
        const durationMinutes = Math.max(1, Math.round(durationSeconds > 300 ? durationSeconds / 60 : durationSeconds || Number(workout.durationMinutes) || 1));
        a.w2.activities.push({
          id: `health-workout-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          date: start.slice(0,10),
          type: workout.workoutType || workout.activityType || workout.name || "Apple Santé",
          duration: durationMinutes,
          source: "Apple Santé",
          healthId: key,
        });
        h.importedWorkoutIds.push(key);
      });
      a.w2.activities = a.w2.activities.slice(-360);
      h.importedWorkoutIds = h.importedWorkoutIds.slice(-200);
      return workouts.length;
    } catch {
      return 0;
    }
  }

  async function sync({ silent = false } = {}) {
    const Health = plugin();
    const a = account();
    const h = ensureState(a);
    if (!Health || !a || !h) return false;
    if (!silent) setStatus("Synchronisation Apple Santé…");

    try {
      const availability = await available();
      if (!availability.available) throw new Error(availability.reason || "HealthKit indisponible.");

      const range = dayRange();
      const [steps, distance, activeCalories, sleepMinutes, weight, restingHR, hrv, vo2] = await Promise.all([
        aggregate("steps", range, "sum"),
        aggregate("distance", range, "sum"),
        aggregate("calories", range, "sum"),
        readSleep(),
        readLatest("weight", 60),
        readLatest("restingHeartRate", 14),
        readLatest("heartRateVariability", 14),
        readLatest("vo2Max", 60),
      ]);

      if (steps > 0) a.pasEffectues = Math.round(steps);
      if (!a.w2 || typeof a.w2 !== "object") a.w2 = {};
      if (!a.w2.dailyMetrics || typeof a.w2.dailyMetrics !== "object") a.w2.dailyMetrics = {};
      const currentMetric = a.w2.dailyMetrics[today()] || { sleepHours: 0, sleepQuality: 0, mood: 0, energy: 0 };
      if (sleepMinutes > 0) currentMetric.sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;
      a.w2.dailyMetrics[today()] = currentMetric;

      importWeight(weight, a, h);
      const workouts = await importWorkouts(a, h);

      h.last = {
        syncedAt: new Date().toISOString(),
        steps: Math.round(steps || 0),
        distanceMeters: Math.round(distance || 0),
        activeCalories: Math.round(activeCalories || 0),
        sleepHours: sleepMinutes > 0 ? Math.round((sleepMinutes / 60) * 10) / 10 : 0,
        weight: weight ? Number(weight.value) : null,
        restingHeartRate: restingHR ? Number(restingHR.value) : null,
        heartRateVariability: hrv ? Number(hrv.value) : null,
        vo2Max: vo2 ? Number(vo2.value) : null,
        workouts,
      };
      save();
      try { rafraichirApplication(); } catch {}
      window.WellnessV44?.refresh?.();
      if (!silent) setStatus("✅ Apple Santé synchronisée.", "success");
      render();
      return true;
    } catch (error) {
      if (!silent) setStatus(`⚠️ ${error?.message || "Synchronisation impossible."}`, "error");
      return false;
    }
  }

  async function writeLatestWeight() {
    const Health = plugin();
    const a = account();
    if (!Health || !a) return;
    const weight = Number(a.poidsActuel);
    if (!(weight > 0)) return setStatus("Ajoute d'abord un poids dans Wellness.", "error");
    if (!confirm(`Envoyer ${weight} kg à Apple Santé ?`)) return;
    try {
      await Health.saveSample({ dataType: "weight", value: weight, startDate: new Date().toISOString() });
      setStatus("✅ Poids envoyé à Apple Santé.", "success");
    } catch (error) {
      setStatus(`⚠️ ${error?.message || "Envoi impossible."}`, "error");
    }
  }

  function ensureCard() {
    const screen = document.querySelector("#page-profil .px-screen") || document.getElementById("page-profil");
    if (!screen || document.getElementById("v5-health-card")) return;
    const card = document.createElement("section");
    card.id = "v5-health-card";
    card.className = "v5-health-card px-card";
    screen.insertAdjacentElement("afterbegin", card);
  }

  async function render() {
    ensureCard();
    const box = document.getElementById("v5-health-card");
    const h = ensureState();
    if (!box || !h) return;

    const availability = await available();
    const last = h.last || {};
    box.innerHTML = `
      <div class="v5-health-head"><div><span class="v5-health-logo">♥</span><div><small>APPLE SANTÉ</small><strong>Synchronisation iPhone</strong></div></div><em>${availability.available ? "Disponible" : "Indisponible"}</em></div>
      <p>${availability.available ? "Importe automatiquement tes pas, sommeil, poids, activité et quelques mesures depuis Apple Santé avec ton autorisation." : esc(availability.reason || "Cette IPA n'inclut pas HealthKit.")}</p>
      <div class="v5-health-kpis">
        <div><span>👟 Pas</span><strong>${last.steps ? Number(last.steps).toLocaleString("fr-FR") : "--"}</strong></div>
        <div><span>🌙 Sommeil</span><strong>${last.sleepHours ? `${last.sleepHours} h` : "--"}</strong></div>
        <div><span>⚖️ Poids</span><strong>${last.weight ? `${Math.round(last.weight*10)/10} kg` : "--"}</strong></div>
        <div><span>❤️ Repos</span><strong>${last.restingHeartRate ? `${Math.round(last.restingHeartRate)} bpm` : "--"}</strong></div>
        <div><span>⚡ Actif</span><strong>${last.activeCalories ? `${last.activeCalories} kcal` : "--"}</strong></div>
        <div><span>🏃 Activités</span><strong>${last.workouts ?? "--"}</strong></div>
      </div>
      <div class="v5-health-actions">
        <button type="button" id="v5-health-authorize">Autoriser Apple Santé</button>
        <button type="button" id="v5-health-sync">Synchroniser</button>
        <button type="button" id="v5-health-write-weight" class="bouton-secondaire">Envoyer mon poids</button>
      </div>
      <label class="v5-health-auto"><span><strong>Synchroniser au démarrage</strong><small>Aucun écran d'autorisation n'est déclenché automatiquement.</small></span><input id="v5-health-auto" type="checkbox" ${h.autoSync ? "checked" : ""}></label>
      <p id="v5-health-status" class="v5-health-status">${h.last?.syncedAt ? `Dernière synchro : ${new Date(h.last.syncedAt).toLocaleString("fr-FR")}` : ""}</p>`;

    document.getElementById("v5-health-authorize")?.addEventListener("click", authorize);
    document.getElementById("v5-health-sync")?.addEventListener("click", () => sync());
    document.getElementById("v5-health-write-weight")?.addEventListener("click", writeLatestWeight);
    document.getElementById("v5-health-auto")?.addEventListener("change", (event) => {
      h.autoSync = !!event.target.checked;
      save();
    });
  }

  async function autoSync() {
    const h = ensureState();
    if (!h?.autoSync || !isIosNative() || !plugin()) return;
    const last = Date.parse(h.last?.syncedAt || 0);
    if (Date.now() - last < 15 * 60 * 1000) return;
    try {
      const auth = await plugin().checkAuthorization({ read: READ_TYPES, write: ["weight"] });
      if ((auth?.readAuthorized || []).length) await sync({ silent: true });
    } catch {}
  }

  render().then(autoSync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") autoSync();
  });

  window.WellnessHealthV5 = { version: VERSION, sync, authorize, render };
})();
