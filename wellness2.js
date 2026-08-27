"use strict";

// ======================================================
// WELLNESS 2.0 — extension produit
// Coach, base alimentaire, code-barres, sommeil, sport,
// prévisions, préférences, cloud, backup et quick-add.
// ======================================================

const W2_VERSION = "4.3.1";
const W2_CORE = window.WellnessCore;
const W2_FOODS = window.WELLNESS_FOODS || [];
let w2SelectedFood = null;
let w2BarcodeStream = null;
let w2BarcodeLoop = 0;
let w2MoodValue = 0;
let w2EnergyValue = 0;
let w2SwipeStart = null;

function w2Today() { return obtenirDateLocale(); }
function w2Clone(value) { return JSON.parse(JSON.stringify(value)); }
function w2Id(prefix = "w2") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function w2Text(value) { return String(value ?? ""); }
function w2Escape(value) { const d=document.createElement("div"); d.textContent=w2Text(value); return d.innerHTML; }

function w2DefaultState() {
  return {
    version: W2_VERSION,
    goalMode: "loss",
    preferences: {
      diet: "omnivore",
      noPork: false,
      allergies: [],
      disliked: [],
    },
    settings: {
      units: "kg",
      language: "fr",
      haptics: true,
      gestures: true,
      photoAiEndpoint: "",
      photoAiToken: "",
    },
    dailyMetrics: {},
    activities: [],
    notifications: [],
    xpAwards: {},
    weeklyMissionAwards: {},
  };
}

function w2NormalizeAccount(account = obtenirCompteActif()) {
  if (!account.w2 || typeof account.w2 !== "object") account.w2 = w2DefaultState();
  const defaults = w2DefaultState();
  Object.entries(defaults).forEach(([key,value]) => {
    if (!(key in account.w2)) account.w2[key] = w2Clone(value);
  });
  account.w2.preferences = { ...defaults.preferences, ...(account.w2.preferences || {}) };
  account.w2.settings = { ...defaults.settings, ...(account.w2.settings || {}) };
  if (!Array.isArray(account.w2.preferences.allergies)) account.w2.preferences.allergies = [];
  if (!Array.isArray(account.w2.preferences.disliked)) account.w2.preferences.disliked = [];
  if (!Array.isArray(account.w2.activities)) account.w2.activities = [];
  if (!Array.isArray(account.w2.notifications)) account.w2.notifications = [];
  if (!account.w2.dailyMetrics || typeof account.w2.dailyMetrics !== "object") account.w2.dailyMetrics = {};
  if (!account.w2.xpAwards || typeof account.w2.xpAwards !== "object") account.w2.xpAwards = {};
  if (!account.w2.weeklyMissionAwards || typeof account.w2.weeklyMissionAwards !== "object") account.w2.weeklyMissionAwards = {};
  return account;
}

function w2NormalizeAll() {
  Object.values(etatApplication.comptes).forEach(w2NormalizeAccount);
  sauvegarderEtatApplication();
}

function w2Haptic(ms = 15) {
  const account = w2NormalizeAccount();
  if (account.w2.settings.haptics && navigator.vibrate) navigator.vibrate(ms);
}

// ======================================================
// OBJECTIFS AVANCÉS + MACROS
// ======================================================

const W2_GOALS = {
  loss: { label:"Perte de poids", calorieMultiplier:.85, protein:1.8 },
  muscle: { label:"Prise de muscle", calorieMultiplier:1.10, protein:1.8 },
  maintain: { label:"Maintien", calorieMultiplier:1, protein:1.5 },
  recomp: { label:"Recomposition", calorieMultiplier:.96, protein:2.0 },
  eatbetter: { label:"Mieux manger", calorieMultiplier:1, protein:1.5 },
  activity: { label:"Plus actif", calorieMultiplier:1, protein:1.5 },
};

const w2OriginalMacroTargets = megaCalculateMacroTargets;
megaCalculateMacroTargets = function w2MacroTargets(account = obtenirCompteActif()) {
  const targets = w2OriginalMacroTargets(account);
  w2NormalizeAccount(account);
  const goal = W2_GOALS[account.w2.goalMode] || W2_GOALS.maintain;
  const calories = Number(account.objectifCalories) || 0;
  const weight = Number(account.poidsActuel) || 0;
  if (calories <= 0 || weight <= 0) return targets;
  const protein = Math.round((weight * goal.protein) / 5) * 5;
  const fatFloor = account.w2.goalMode === "recomp" ? .75 : .7;
  const fat = Math.max(Math.round((weight * fatFloor) / 5) * 5, Math.round(((calories*.22)/9)/5)*5);
  const carbs = Math.max(0, Math.round(((calories - protein*4 - fat*9)/4)/5)*5);
  account.macroTargets = { protein, carbs, fat };
  return account.macroTargets;
};

function w2ApplyGoalToCalories(account = obtenirCompteActif()) {
  w2NormalizeAccount(account);
  const mode = account.w2.goalMode;
  const goal = W2_GOALS[mode] || W2_GOALS.maintain;
  let maintenance = Number(account.caloriesMaintien) || 0;
  if (!maintenance && Number(account.age)>=18 && Number(account.taille)>0 && Number(account.poidsActuel)>0 && account.formuleMetabolique) {
    const calc = calculerCibleCalories({
      age:Number(account.age), taille:Number(account.taille), poidsActuel:Number(account.poidsActuel), poidsObjectif:Number(account.poidsActuel),
      formuleMetabolique:account.formuleMetabolique, niveauActivite:account.niveauActivite || "modere"
    });
    maintenance = Number(calc?.maintien)||0;
    if (maintenance) account.caloriesMaintien = maintenance;
  }
  if (maintenance) {
    account.objectifCalories = Math.round((maintenance * goal.calorieMultiplier) / 10) * 10;
    account.typeObjectifCalories = goal.label;
  }
  megaCalculateMacroTargets(account);
}

function w2LoadGoalPreferences() {
  const a = w2NormalizeAccount();
  document.querySelectorAll("#w2-goal-grid [data-goal]").forEach(btn => btn.classList.toggle("active", btn.dataset.goal === a.w2.goalMode));
  const badge=document.getElementById("w2-goal-badge"); if(badge) badge.textContent=(W2_GOALS[a.w2.goalMode]||W2_GOALS.maintain).label;
  const diet=document.getElementById("w2-diet"); if(diet) diet.value=a.w2.preferences.diet;
  const pork=document.getElementById("w2-no-pork"); if(pork) pork.checked=!!a.w2.preferences.noPork;
  document.querySelectorAll("#w2-allergy-grid input").forEach(input => input.checked=a.w2.preferences.allergies.includes(input.value));
  const disliked=document.getElementById("w2-disliked"); if(disliked) disliked.value=a.w2.preferences.disliked.join(", ");
}

document.querySelectorAll("#w2-goal-grid [data-goal]").forEach(btn => btn.addEventListener("click",()=>{
  const a=w2NormalizeAccount(); a.w2.goalMode=btn.dataset.goal; w2LoadGoalPreferences(); sauvegarderEtatApplication(); w2Haptic();
}));
document.getElementById("w2-apply-goal")?.addEventListener("click",()=>{
  const a=w2NormalizeAccount(); w2ApplyGoalToCalories(a); sauvegarderEtatApplication();
  document.getElementById("w2-goal-message").textContent = a.objectifCalories ? `✅ ${W2_GOALS[a.w2.goalMode].label} : cible estimée ${Math.round(a.objectifCalories)} kcal / jour.` : "⚠️ Configure d'abord ton profil nutritionnel (âge, taille, poids).";
  rafraichirApplication(); w2Haptic(25);
});
document.getElementById("w2-save-preferences")?.addEventListener("click",()=>{
  const a=w2NormalizeAccount();
  a.w2.preferences.diet=document.getElementById("w2-diet").value;
  a.w2.preferences.noPork=document.getElementById("w2-no-pork").checked;
  a.w2.preferences.allergies=[...document.querySelectorAll("#w2-allergy-grid input:checked")].map(x=>x.value);
  a.w2.preferences.disliked=document.getElementById("w2-disliked").value.split(",").map(x=>x.trim()).filter(Boolean);
  sauvegarderEtatApplication(); rafraichirApplication(); w2Haptic();
});

// Apply dietary preferences consistently to the main recipe search/filter list.
// The original app filters by meal type/time/kcal/protein/search; this adds the
// user's diet, allergies, no-pork and disliked ingredients on top.
const w2OriginalFilteredRecipes = obtenirRecettesFiltrees;
obtenirRecettesFiltrees = function w2FilteredRecipes() {
  const account = w2NormalizeAccount();
  return w2OriginalFilteredRecipes().filter(recipe =>
    W2_CORE.recipeAllowed(recipe, account.w2.preferences)
  );
};

// ======================================================
// ALIMENTS + PORTIONS
// ======================================================

function w2SearchFoods(query="") {
  const q=String(query).trim().toLowerCase();
  return W2_FOODS.filter(food => !q || `${food.name} ${food.category}`.toLowerCase().includes(q)).slice(0,20);
}

function w2RenderFoodCards(container, foods) {
  if (!container) return;
  container.innerHTML="";
  if (!foods.length) { container.innerHTML='<p class="message-vide">Aucun aliment trouvé.</p>'; return; }
  foods.forEach(food=>{
    const card=document.createElement("button"); card.type="button"; card.className="w2-food-card";
    card.innerHTML=`<span class="w2-food-category">${w2Escape(food.category)}</span><strong>${w2Escape(food.name)}</strong><span class="w2-food-kcal">${Math.round(food.kcal)} kcal</span><small>P ${W2_CORE.round1(food.protein)} g · G ${W2_CORE.round1(food.carbs)} g · L ${W2_CORE.round1(food.fat)} g</small>`;
    card.addEventListener("click",()=>w2OpenPortion(food)); container.appendChild(card);
  });
}

function w2RenderFoodHub() {
  const q=document.getElementById("w2-food-query")?.value||"";
  w2RenderFoodCards(document.getElementById("w2-food-grid"),w2SearchFoods(q));
  const modalQ=document.getElementById("w2-modal-food-query")?.value||"";
  w2RenderFoodCards(document.getElementById("w2-modal-food-results"),w2SearchFoods(modalQ));
}

function w2OpenPortion(food) {
  w2SelectedFood=food;
  document.getElementById("w2-portion-title").textContent=food.name;
  document.getElementById("w2-portion-grams").value="100";
  w2UpdatePortionPreview();
  megaOpenOverlay(document.getElementById("w2-portion-overlay"));
  w2Haptic();
}
function w2UpdatePortionPreview() {
  if(!w2SelectedFood)return;
  const grams=Number(document.getElementById("w2-portion-grams").value)||100;
  const n=W2_CORE.scaleFood(w2SelectedFood,grams);
  document.getElementById("w2-portion-preview").innerHTML=`<strong>${w2Escape(w2SelectedFood.name)} · ${n.grams} g</strong><span>${n.calories} kcal · P ${n.protein} g · G ${n.carbs} g · L ${n.fat} g${n.fiber?` · Fibres ${n.fiber} g`:""}</span>`;
}
function w2AddSelectedFood() {
  if(!w2SelectedFood)return;
  const grams=Number(document.getElementById("w2-portion-grams").value)||100;
  const meal=document.getElementById("w2-portion-meal").value;
  const n=W2_CORE.scaleFood(w2SelectedFood,grams);
  const ok=ajouterCaloriesAuJournal(`${w2SelectedFood.name} (${n.grams} g)`,n.calories,"aliment",{proteines:n.protein,glucides:n.carbs,lipides:n.fat,repasSlot:meal,portions:grams/100});
  if(ok){ megaCloseOverlay(document.getElementById("w2-portion-overlay")); w2AwardXpOnce(`food|${w2Today()}|${Date.now()}`,2); rafraichirApplication(); w2Haptic(25); }
}

document.getElementById("w2-food-query")?.addEventListener("input",w2RenderFoodHub);
document.getElementById("w2-food-search-button")?.addEventListener("click",w2RenderFoodHub);
document.getElementById("w2-modal-food-query")?.addEventListener("input",w2RenderFoodHub);
document.getElementById("w2-open-food-search")?.addEventListener("click",()=>megaOpenOverlay(document.getElementById("w2-food-overlay")));
document.getElementById("w2-close-food")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-food-overlay")));
document.getElementById("w2-close-portion")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-portion-overlay")));
document.getElementById("w2-cancel-portion")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-portion-overlay")));
document.getElementById("w2-add-portion")?.addEventListener("click",w2AddSelectedFood);
document.getElementById("w2-portion-grams")?.addEventListener("input",w2UpdatePortionPreview);
document.querySelectorAll("[data-grams]").forEach(btn=>btn.addEventListener("click",()=>{document.getElementById("w2-portion-grams").value=btn.dataset.grams;w2UpdatePortionPreview();}));

// ======================================================
// CODE-BARRES — BarcodeDetector + Open Food Facts
// ======================================================

async function w2LookupBarcode(code) {
  const value=String(code||"").trim();
  const result=document.getElementById("w2-barcode-result");
  if(!value){result.innerHTML='<p class="mega-inline-message">Saisis un code-barres.</p>';return;}
  result.innerHTML='<p class="mega-help">Recherche du produit…</p>';
  try {
    const response=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(value)}.json?fields=product_name,nutriments,serving_size,brands`);
    const data=await response.json();
    if(!data?.product){result.innerHTML='<p class="mega-inline-message">Produit non trouvé dans Open Food Facts.</p>';return;}
    const p=data.product, n=p.nutriments||{};
    const food={ id:`off-${value}`, name:p.product_name||`Produit ${value}`, category:p.brands||"Open Food Facts", kcal:Number(n["energy-kcal_100g"])||0, protein:Number(n.proteins_100g)||0, carbs:Number(n.carbohydrates_100g)||0, fat:Number(n.fat_100g)||0, fiber:Number(n.fiber_100g)||0, source:"Open Food Facts" };
    result.innerHTML=`<div class="w2-barcode-product"><h3>${w2Escape(food.name)}</h3><p>${w2Escape(food.category)} · ${Math.round(food.kcal)} kcal / 100 g · P ${W2_CORE.round1(food.protein)} · G ${W2_CORE.round1(food.carbs)} · L ${W2_CORE.round1(food.fat)}</p><button id="w2-add-barcode-product">Choisir la portion</button></div>`;
    document.getElementById("w2-add-barcode-product").addEventListener("click",()=>{w2OpenPortion(food);w2StopBarcodeCamera();});
    w2AwardXpOnce(`barcode|${w2Today()}|${value}`,4); w2Haptic(25);
  } catch(err) { result.innerHTML=`<p class="mega-inline-message">Impossible d'interroger la base en ligne. Vérifie ta connexion. (${w2Escape(err.message)})</p>`; }
}
async function w2StartBarcodeCamera() {
  const help=document.getElementById("w2-barcode-help"), video=document.getElementById("w2-barcode-video");
  if(!navigator.mediaDevices?.getUserMedia){help.textContent="Caméra non disponible dans ce navigateur.";return;}
  try {
    w2BarcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}); video.srcObject=w2BarcodeStream; await video.play();
    if(!("BarcodeDetector" in window)){help.textContent="La caméra est active mais la détection automatique n'est pas disponible ici. Saisis le code manuellement.";return;}
    const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128"]}); help.textContent="Place le code-barres au centre de l'image.";
    const loop=async()=>{if(!w2BarcodeStream)return;try{const codes=await detector.detect(video);if(codes[0]?.rawValue){document.getElementById("w2-barcode-input").value=codes[0].rawValue;w2StopBarcodeCamera();await w2LookupBarcode(codes[0].rawValue);return;}}catch{}w2BarcodeLoop=requestAnimationFrame(loop);}; loop();
  } catch(err){help.textContent=`Caméra refusée ou indisponible : ${err.message}`;}
}
function w2StopBarcodeCamera(){ if(w2BarcodeLoop)cancelAnimationFrame(w2BarcodeLoop);w2BarcodeLoop=0;if(w2BarcodeStream){w2BarcodeStream.getTracks().forEach(t=>t.stop());w2BarcodeStream=null;}const v=document.getElementById("w2-barcode-video");if(v)v.srcObject=null; }
function w2OpenBarcode(){megaOpenOverlay(document.getElementById("w2-barcode-overlay"));}
document.getElementById("w2-open-barcode")?.addEventListener("click",w2OpenBarcode);
document.getElementById("w2-barcode-from-food")?.addEventListener("click",w2OpenBarcode);
document.getElementById("w2-close-barcode")?.addEventListener("click",()=>{w2StopBarcodeCamera();megaCloseOverlay(document.getElementById("w2-barcode-overlay"));});
document.getElementById("w2-start-barcode-camera")?.addEventListener("click",w2StartBarcodeCamera);
document.getElementById("w2-stop-barcode-camera")?.addEventListener("click",w2StopBarcodeCamera);
document.getElementById("w2-lookup-barcode")?.addEventListener("click",()=>w2LookupBarcode(document.getElementById("w2-barcode-input").value));

// ======================================================
// PHOTO REPAS — capture + analyse endpoint optionnelle
// ======================================================

function w2OpenPhoto(){megaOpenOverlay(document.getElementById("w2-photo-overlay"));}
document.getElementById("w2-open-meal-photo")?.addEventListener("click",w2OpenPhoto);
document.getElementById("w2-close-photo")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-photo-overlay")));
document.getElementById("w2-photo-file")?.addEventListener("change",async event=>{
  const file=event.target.files?.[0], preview=document.getElementById("w2-photo-preview"); if(!file)return;
  const url=URL.createObjectURL(file); preview.src=url; preview.hidden=false; preview.onload=()=>URL.revokeObjectURL(url);
});
function w2PhotoDescriptionSearch(){
  const text=document.getElementById("w2-photo-description").value.toLowerCase(); const tokens=text.split(/[,; ]+/).filter(x=>x.length>2);
  let foods=W2_FOODS.filter(f=>tokens.some(t=>f.name.toLowerCase().includes(t)||t.includes(f.name.toLowerCase().split(" ")[0]))).slice(0,12);
  if(!foods.length&&text.trim())foods=w2SearchFoods(text).slice(0,12);
  w2RenderFoodCards(document.getElementById("w2-photo-results"),foods);
}
document.getElementById("w2-photo-manual-search")?.addEventListener("click",w2PhotoDescriptionSearch);
async function w2FileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
document.getElementById("w2-analyse-photo")?.addEventListener("click",async()=>{
  const a=w2NormalizeAccount(), file=document.getElementById("w2-photo-file").files?.[0], message=document.getElementById("w2-photo-message");
  if(!file){message.textContent="⚠️ Ajoute d'abord une photo.";return;}
  const endpoint=a.w2.settings.photoAiEndpoint;
  if(!endpoint){message.textContent="Aucun endpoint IA configuré : j'utilise ta description pour proposer des aliments locaux.";w2PhotoDescriptionSearch();return;}
  message.textContent="Analyse en cours…";
  try{
    const image=await w2FileToDataUrl(file); const headers={"Content-Type":"application/json"}; if(a.w2.settings.photoAiToken)headers.Authorization=`Bearer ${a.w2.settings.photoAiToken}`;
    const response=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify({image,description:document.getElementById("w2-photo-description").value,locale:"fr-FR"})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`); const data=await response.json(); const foods=Array.isArray(data.foods)?data.foods:[];
    if(!foods.length){message.textContent="L'analyse n'a renvoyé aucun aliment. Tu peux utiliser la recherche manuelle.";return;}
    const normalized=foods.map((f,i)=>({id:`ai-${i}-${Date.now()}`,name:f.name||"Aliment détecté",category:"Analyse photo",kcal:Number(f.kcal100||f.kcal||0),protein:Number(f.protein100||f.protein||0),carbs:Number(f.carbs100||f.carbs||0),fat:Number(f.fat100||f.fat||0),fiber:Number(f.fiber100||0),source:"Analyse IA"}));
    w2RenderFoodCards(document.getElementById("w2-photo-results"),normalized);message.textContent="✅ Suggestions reçues. Vérifie les aliments et les quantités avant de les ajouter.";w2AwardXpOnce(`photo|${w2Today()}`,5);
  }catch(err){message.textContent=`Analyse indisponible : ${err.message}. Utilise la recherche manuelle.`;}
});

// ======================================================
// SOMMEIL / HUMEUR / ACTIVITÉS
// ======================================================

function w2TodayMetrics(account=w2NormalizeAccount()) {
  return account.w2.dailyMetrics[w2Today()] || {sleepHours:0,sleepQuality:0,mood:0,energy:0};
}
function w2LoadWellnessForm(){
  const m=w2TodayMetrics();
  const sh=document.getElementById("w2-sleep-hours"), sq=document.getElementById("w2-sleep-quality");
  if(sh)sh.value=m.sleepHours||""; if(sq)sq.value=String(m.sleepQuality||0); w2MoodValue=Number(m.mood)||0;w2EnergyValue=Number(m.energy)||0;
  w2UpdateRatings();
}
function w2UpdateRatings(){
  document.querySelectorAll("#w2-mood-rating button").forEach(b=>b.classList.toggle("active",Number(b.dataset.value)===w2MoodValue));
  document.querySelectorAll("#w2-energy-rating button").forEach(b=>b.classList.toggle("active",Number(b.dataset.value)===w2EnergyValue));
}
document.querySelectorAll("#w2-mood-rating button").forEach(b=>b.addEventListener("click",()=>{w2MoodValue=Number(b.dataset.value);w2UpdateRatings();w2Haptic();}));
document.querySelectorAll("#w2-energy-rating button").forEach(b=>b.addEventListener("click",()=>{w2EnergyValue=Number(b.dataset.value);w2UpdateRatings();w2Haptic();}));
document.getElementById("w2-save-wellness")?.addEventListener("click",()=>{
  const a=w2NormalizeAccount(); const sleep=Number(document.getElementById("w2-sleep-hours").value)||0; const quality=Number(document.getElementById("w2-sleep-quality").value)||0;
  a.w2.dailyMetrics[w2Today()]={sleepHours:sleep,sleepQuality:quality,mood:w2MoodValue,energy:w2EnergyValue};
  sauvegarderEtatApplication(); w2AwardXpOnce(`wellness|${w2Today()}`,8); rafraichirApplication(); w2Haptic(25);
});
document.getElementById("w2-add-activity")?.addEventListener("click",()=>{
  const a=w2NormalizeAccount(); const type=document.getElementById("w2-activity-type").value; const duration=Number(document.getElementById("w2-activity-duration").value);
  if(!Number.isFinite(duration)||duration<=0)return;
  a.w2.activities.push({id:w2Id("act"),date:w2Today(),type,duration:Math.round(duration)}); if(a.w2.activities.length>180)a.w2.activities=a.w2.activities.slice(-180);
  document.getElementById("w2-activity-duration").value=""; sauvegarderEtatApplication(); w2AwardXpOnce(`activity|${w2Today()}|${a.w2.activities.length}`,6); rafraichirApplication(); w2Haptic(25);
});
function w2RenderActivities(){
  const list=document.getElementById("w2-activity-list");if(!list)return;const a=w2NormalizeAccount();const items=a.w2.activities.filter(x=>x.date===w2Today()).slice().reverse();list.innerHTML="";
  if(!items.length){list.innerHTML='<p class="mega-help">Aucune activité ajoutée aujourd\'hui.</p>';return;}
  items.forEach(item=>{const row=document.createElement("div");row.className="w2-activity-row";row.innerHTML=`<span>${w2Escape(item.type)} · ${item.duration} min</span><button aria-label="Supprimer">✕</button>`;row.querySelector("button").addEventListener("click",()=>{a.w2.activities=a.w2.activities.filter(x=>x.id!==item.id);sauvegarderEtatApplication();rafraichirApplication();});list.appendChild(row);});
}

// ======================================================
// SCORE BIEN-ÊTRE + COACH INTELLIGENT
// ======================================================

function w2CurrentMetrics(){
  const a=w2NormalizeAccount(); const progress=obtenirProgressions(); const totals=megaJournalTotals(a); const m=w2TodayMetrics(a);
  return {account:a,progress,totals,m,waterPct:progress.eau,stepsPct:progress.pas,mealsPct:progress.repas,calories:totals.calories,calorieTarget:Number(a.objectifCalories)||0,protein:totals.protein,proteinTarget:Number(a.macroTargets?.protein)||0,sleepHours:Number(m.sleepHours)||0,mood:Number(m.mood)||0};
}
function w2CoachTips(metrics=w2CurrentMetrics()){
  const {account:a,totals,m}=metrics; const tips=[]; const now=new Date().getHours();
  const waterRemain=Math.max(0,(Number(a.objectifEau)||8)-(Number(a.verresEau)||0));
  const stepsRemain=Math.max(0,(Number(a.objectifPas)||10000)-(Number(a.pasEffectues)||0));
  const calRemain=Number(a.objectifCalories)>0?Math.round(Number(a.objectifCalories)-totals.calories):null;
  const proteinRemain=Math.max(0,Math.round((Number(a.macroTargets?.protein)||0)-totals.protein));
  if(waterRemain>0)tips.push({title:"💧 Hydratation",text:`Encore ${waterRemain} verre${waterRemain>1?"s":""} pour ta cible.`});
  if(stepsRemain>1500)tips.push({title:"👟 Mouvement",text:`Une marche peut t'aider à réduire les ${stepsRemain.toLocaleString("fr-FR")} pas restants.`});
  if(calRemain!==null&&calRemain>250)tips.push({title:"🔥 Énergie",text:`Il te reste environ ${calRemain} kcal dans ta cible estimée.`});
  if(proteinRemain>15)tips.push({title:"💪 Protéines",text:`Il te reste environ ${proteinRemain} g de protéines à viser.`});
  if(Number(m.sleepHours)>0&&Number(m.sleepHours)<7)tips.push({title:"🌙 Récupération",text:`Tu as noté ${m.sleepHours} h de sommeil. Une soirée plus calme peut aider à récupérer.`});
  if(!Number(m.sleepHours)&&now>=14)tips.push({title:"😴 Suivi",text:"Ajoute ton sommeil pour enrichir ton score bien-être."});
  if(!a.w2.activities.some(x=>x.date===w2Today())&&now>=16)tips.push({title:"🏃 Activité",text:"Aucune activité sportive enregistrée aujourd'hui. Même 20 minutes comptent."});
  if(a.w2.goalMode==="recomp")tips.push({title:"🔥 Recomposition",text:"Priorité à la régularité, aux protéines et à la progression en entraînement."});
  if(a.w2.goalMode==="eatbetter")tips.push({title:"🥗 Équilibre",text:"Cherche surtout une journée cohérente plutôt qu'une perfection calorie par calorie."});
  return tips.slice(0,6);
}
function w2RenderCoach(){
  const metrics=w2CurrentMetrics(); const score=W2_CORE.healthScore(metrics); const scoreEl=document.getElementById("w2-health-score");if(scoreEl)scoreEl.textContent=score||"--";
  const tips=w2CoachTips(metrics), container=document.getElementById("w2-coach-recommendations"); if(container){container.innerHTML="";tips.slice(0,3).forEach(t=>{const d=document.createElement("div");d.className="w2-coach-tip";d.innerHTML=`<strong>${w2Escape(t.title)}</strong><span>${w2Escape(t.text)}</span>`;container.appendChild(d);});}
  const summary=document.getElementById("w2-coach-summary");if(summary){const a=metrics.account;if(score>=85)summary.textContent="Très belle journée : tes habitudes sont bien alignées.";else if(score>=65)summary.textContent="Bonne base. Quelques ajustements peuvent encore améliorer ta journée.";else if(score>0)summary.textContent="On construit la journée petit à petit : concentre-toi sur une action simple maintenant.";else summary.textContent="Commence à suivre eau, activité, nutrition et sommeil pour obtenir un coaching personnalisé.";}
  w2GenerateNotifications(metrics,tips);
}

// ======================================================
// POUR TOI — recommandations recettes + préférences
// ======================================================

function w2RecommendedRecipes(){
  const a=w2NormalizeAccount(), totals=megaJournalTotals(a), remaining=Number(a.objectifCalories)>0?Number(a.objectifCalories)-totals.calories:null, proteinRemain=Math.max(0,(Number(a.macroTargets?.protein)||0)-totals.protein);
  return recettes.filter(r=>W2_CORE.recipeAllowed(r,a.w2.preferences)).map(r=>({r,score:W2_CORE.recommendationScore(r,{remainingCalories:remaining,proteinRemaining:proteinRemain,goalMode:a.w2.goalMode})})).sort((x,y)=>y.score-x.score).slice(0,6).map(x=>x.r);
}
function w2RenderForYou(){
  const grid=document.getElementById("w2-for-you-grid");if(!grid)return;const a=w2NormalizeAccount(), totals=megaJournalTotals(a), remaining=Number(a.objectifCalories)>0?Math.max(0,Math.round(Number(a.objectifCalories)-totals.calories)):null;grid.innerHTML="";
  const recipesList=w2RecommendedRecipes();if(!recipesList.length){grid.innerHTML='<p class="message-vide">Aucune recette ne correspond à tes préférences actuelles.</p>';return;}
  recipesList.forEach(r=>{const card=document.createElement("div");card.className="w2-recommendation-card";const pct=remaining?Math.round(r.calories/remaining*100):null;card.innerHTML=`<span class="w2-fit">${pct!==null?`${pct}% des kcal restantes`:"Suggestion"}</span><h3>${w2Escape(r.nom)}</h3><p>${r.calories} kcal · ${r.proteines} g protéines · ${r.temps} min</p><button>Voir la recette</button>`;card.querySelector("button").addEventListener("click",()=>{window.WellnessUX?.showTab("nutrition","recipes");afficherDetailRecette(r);afficherPage("recettes");setTimeout(()=>document.getElementById("detail-recette")?.scrollIntoView({behavior:"smooth",block:"start"}),180);});grid.appendChild(card);});
  const label=document.getElementById("w2-for-you-label");if(label)label.textContent=remaining!==null?`${remaining} kcal restantes`:"Selon tes préférences";
}

// ======================================================
// PRÉVISIONS DE POIDS + COMPARAISON 7 JOURS
// ======================================================

function w2FormatWeight(value,a=w2NormalizeAccount()) { const unit=a.w2.settings.units;return unit==="lb"?`${W2_CORE.kgToLb(value)} lb`:`${W2_CORE.round1(value)} kg`; }
function w2RenderForecast(){
  const a=w2NormalizeAccount(); const el=document.getElementById("w2-weight-forecast");if(!el)return;const forecast=W2_CORE.weightForecast(a.weightHistory,Number(a.poidsObjectif),a.w2.goalMode);
  if(!forecast){el.innerHTML="Ajoute un poids objectif et des pesées pour obtenir une projection.";return;}
  if(!forecast.date){el.innerHTML=`Tendance actuelle : ${w2FormatWeight(forecast.current,a)} → objectif ${w2FormatWeight(forecast.target,a)}.<small>Pas assez de tendance exploitable pour estimer une date.</small>`;return;}
  el.innerHTML=`Objectif estimé vers <strong>${forecast.date.toLocaleDateString(a.w2.settings.language==="en"?"en-GB":"fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</strong><small>${forecast.source} · environ ${forecast.days} jours si la tendance se poursuit.</small>`;
}
function w2DateDaysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return obtenirDateLocale(d);}
function w2AggregatePeriod(startAgo,endAgo){
  const a=w2NormalizeAccount();const rows=[];for(let i=startAgo;i>=endAgo;i--){const date=w2DateDaysAgo(i);if(date===w2Today()){const p=obtenirProgressions();rows.push({eau:p.eau,pas:p.pas,caloriesConsommees:a.caloriesConsommees,objectifCalories:a.objectifCalories});}else if(a.historique[date])rows.push(a.historique[date]);}
  const avg=key=>{const vals=rows.map(r=>Number(r[key])).filter(Number.isFinite);return vals.length?vals.reduce((s,n)=>s+n,0)/vals.length:0;};
  const inTarget=rows.filter(r=>Number(r.objectifCalories)>0&&Math.abs(Number(r.caloriesConsommees)-Number(r.objectifCalories))/Number(r.objectifCalories)<=.1).length;
  const sleep=[];for(let i=startAgo;i>=endAgo;i--){const m=a.w2.dailyMetrics[w2DateDaysAgo(i)];if(Number(m?.sleepHours)>0)sleep.push(Number(m.sleepHours));}
  return {days:rows.length,calories:avg("caloriesConsommees"),waterPct:avg("eau"),stepsPct:avg("pas"),targetDays:inTarget,sleep:sleep.length?sleep.reduce((s,n)=>s+n,0)/sleep.length:0};
}
function w2RenderComparison(){
  const current=w2AggregatePeriod(6,0), previous=w2AggregatePeriod(13,7), container=document.getElementById("w2-week-comparison");if(!container)return;container.innerHTML="";
  const items=[
    ["Calories moy.",current.calories,previous.calories," kcal",false],
    ["Hydratation",current.waterPct,previous.waterPct," %",true],
    ["Pas",current.stepsPct,previous.stepsPct," %",true],
    ["Sommeil",current.sleep,previous.sleep," h",true],
    ["Jours dans la cible",current.targetDays,previous.targetDays," / 7",true],
  ];
  items.forEach(([label,cur,prev,suffix,higherGood])=>{const delta=W2_CORE.percentDelta(cur,prev);let cls="w2-neutral",txt="—";if(delta!==null&&Math.abs(delta)>=.5){const positive=delta>0;cls=(positive===higherGood)?"w2-positive":"w2-negative";txt=`${delta>0?"+":""}${delta}%`;}const row=document.createElement("div");row.className="w2-comparison-row";row.innerHTML=`<span>${label}<br><small>${cur?W2_CORE.round1(cur)+suffix:"--"}</small></span><strong class="${cls}">${txt}</strong>`;container.appendChild(row);});
}

// ======================================================
// GAMIFICATION — MISSIONS HEBDOMADAIRES
// ======================================================

function w2WeekKey(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return obtenirDateLocale(d);}
function w2AwardXpOnce(key,xp){const a=w2NormalizeAccount();if(a.w2.xpAwards[key])return false;a.w2.xpAwards[key]=true;a.xp=(Number(a.xp)||0)+Number(xp||0);sauvegarderEtatApplication();return true;}
function w2WeeklyMissionStats(){
  const a=w2NormalizeAccount();let waterDays=0,nutritionDays=0,steps=0;for(let i=0;i<7;i++){const date=w2DateDaysAgo(i),r=date===w2Today()?{eau:calculerProgression(a.verresEau,a.objectifEau),pas:calculerProgression(a.pasEffectues,a.objectifPas),caloriesConsommees:a.caloriesConsommees}:a.historique[date];if(!r)continue;if(Number(r.eau)>=100)waterDays++;if(Number(r.caloriesConsommees)>0)nutritionDays++;steps+=Math.round((Number(r.pas)||0)/100*(Number(a.objectifPas)||10000));}const activities=a.w2.activities.filter(x=>{const t=new Date(x.date+"T12:00:00");return (Date.now()-t.getTime())<=7*86400000;}).length;return{waterDays,nutritionDays,steps,activities};
}
function w2RenderWeeklyMissions(){
  const a=w2NormalizeAccount(),stats=w2WeeklyMissionStats(),week=w2WeekKey(), missions=[
    {id:"water5",label:"5 jours hydratation complète",value:stats.waterDays,target:5,xp:30},
    {id:"nutrition5",label:"Suivre la nutrition 5 jours",value:stats.nutritionDays,target:5,xp:30},
    {id:"steps50k",label:"50 000 pas cette semaine",value:stats.steps,target:50000,xp:45},
    {id:"sport3",label:"3 activités sportives",value:stats.activities,target:3,xp:35},
  ];const list=document.getElementById("w2-weekly-missions");if(!list)return;list.innerHTML="";
  missions.forEach(m=>{const done=m.value>=m.target,key=`${week}|${m.id}`;if(done&&!a.w2.weeklyMissionAwards[key]){a.w2.weeklyMissionAwards[key]=true;a.xp=(Number(a.xp)||0)+m.xp;megaConfetti(22);}const row=document.createElement("div");row.className=`w2-mission-row${done?" done":""}`;row.innerHTML=`<span>${done?"✓":"○"} ${m.label}</span><strong>${Math.min(m.value,m.target).toLocaleString("fr-FR")} / ${m.target.toLocaleString("fr-FR")} · +${m.xp} XP</strong>`;list.appendChild(row);});sauvegarderEtatApplication();
}

// ======================================================
// NOTIFICATION CENTER
// ======================================================

function w2NotifyInApp(id,title,text,priority="normal"){
  const a=w2NormalizeAccount();const fullId=`${w2Today()}|${id}`;if(a.w2.notifications.some(n=>n.id===fullId))return;
  a.w2.notifications.unshift({id:fullId,title,text,priority,read:false,time:new Date().toISOString()});a.w2.notifications=a.w2.notifications.slice(0,60);sauvegarderEtatApplication();
}
function w2GenerateNotifications(metrics,tips){
  const a=metrics.account,h=new Date().getHours(),totals=metrics.totals;
  if(h>=14&&metrics.waterPct<50)w2NotifyInApp("water-low","💧 Hydratation","Tu es encore sous 50 % de ton objectif d'eau.","high");
  if(h>=18&&metrics.proteinTarget>0&&metrics.protein<metrics.proteinTarget*.65)w2NotifyInApp("protein-low","💪 Protéines",`Il te manque encore environ ${Math.max(0,Math.round(metrics.proteinTarget-metrics.protein))} g de protéines.`);
  if(h>=19&&metrics.calorieTarget>0&&totals.calories<metrics.calorieTarget*.55)w2NotifyInApp("cal-low","🔥 Énergie","Ta consommation suivie est nettement sous ta cible estimée. Vérifie que ton journal est complet.");
  if(Number(metrics.m.sleepHours)>0&&Number(metrics.m.sleepHours)<6)w2NotifyInApp("sleep-short","🌙 Sommeil","Tu as enregistré moins de 6 h de sommeil. Priorise la récupération aujourd'hui.");
  if(a.w2.activities.filter(x=>x.date===w2Today()).reduce((s,x)=>s+Number(x.duration||0),0)>=45)w2NotifyInApp("activity-win","🏆 Activité","45 minutes d'activité ou plus enregistrées aujourd'hui. Belle régularité !");
}
function w2RenderNotifications(){
  const a=w2NormalizeAccount(),list=document.getElementById("w2-notification-list"),count=document.getElementById("w2-notification-count");const unread=a.w2.notifications.filter(n=>!n.read).length;if(count){count.textContent=unread;count.style.display=unread?"grid":"none";}if(!list)return;list.innerHTML="";
  if(!a.w2.notifications.length){list.innerHTML='<p class="message-vide">Aucune notification pour le moment.</p>';return;}
  a.w2.notifications.forEach(n=>{const item=document.createElement("div");item.className=`w2-notification-item${n.read?"":" unread"}`;item.innerHTML=`<strong>${w2Escape(n.title)}</strong><span>${w2Escape(n.text)}</span>`;item.addEventListener("click",()=>{n.read=true;sauvegarderEtatApplication();w2RenderNotifications();});list.appendChild(item);});
}
document.getElementById("w2-notification-button")?.addEventListener("click",()=>{megaOpenOverlay(document.getElementById("w2-notification-overlay"));w2RenderNotifications();});
document.getElementById("w2-close-notifications")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-notification-overlay")));
document.getElementById("w2-mark-notifications")?.addEventListener("click",()=>{const a=w2NormalizeAccount();a.w2.notifications.forEach(n=>n.read=true);sauvegarderEtatApplication();w2RenderNotifications();});
document.getElementById("w2-clear-notifications")?.addEventListener("click",()=>{const a=w2NormalizeAccount();a.w2.notifications=[];sauvegarderEtatApplication();w2RenderNotifications();});

// ======================================================
// QUICK ADD + GESTES + HAPTICS
// ======================================================

function w2OpenQuick(){megaOpenOverlay(document.getElementById("w2-quick-overlay"));w2Haptic();}
document.getElementById("w2-fab")?.addEventListener("click",w2OpenQuick);
document.getElementById("w2-close-quick")?.addEventListener("click",()=>megaCloseOverlay(document.getElementById("w2-quick-overlay")));
document.querySelectorAll("[data-w2-quick]").forEach(btn=>btn.addEventListener("click",()=>{
  const action=btn.dataset.w2Quick;megaCloseOverlay(document.getElementById("w2-quick-overlay"));w2Haptic();
  if(action==="water")document.getElementById("ajouter-eau")?.click();
  if(action==="steps")document.getElementById("ouvrir-modal-pas")?.click();
  if(action==="food")megaOpenOverlay(document.getElementById("w2-food-overlay"));
  if(action==="barcode")w2OpenBarcode();
  if(action==="photo")w2OpenPhoto();
  if(action==="weight"){window.WellnessUX?.showTab("progress","body");afficherPage("suivi");setTimeout(()=>document.getElementById("mega-weight-input")?.focus(),220);}
  if(action==="activity"){window.WellnessUX?.showTab("progress","today");afficherPage("suivi");setTimeout(()=>document.getElementById("w2-activity-duration")?.focus(),220);}
  if(action==="wellness"){window.WellnessUX?.showTab("progress","today");afficherPage("suivi");setTimeout(()=>document.getElementById("w2-sleep-hours")?.focus(),220);}
}));

document.addEventListener("pointerup",event=>{if(event.target.closest("button")||event.target.closest(".w2-file-button"))w2Haptic(8);},{passive:true});
document.addEventListener("touchstart",event=>{
  w2SwipeStart=null;
  if(!w2NormalizeAccount().w2.settings.gestures)return;
  if(event.touches.length!==1)return;

  const target=event.target;

  // Ne jamais déclencher le changement de page depuis une zone qui se
  // fait défiler horizontalement, notamment le planning des repas.
  if(target.closest("input,textarea,select,.modal-simple,.modal-filtres,.meal-plan-grid,.ux-segmented-tabs,.smart-filter-row,[data-horizontal-scroll],[data-ux-scroll]"))return;

  w2SwipeStart={
    x:event.touches[0].clientX,
    y:event.touches[0].clientY,
    time:Date.now()
  };
},{passive:true});
document.addEventListener("touchend",event=>{const a=w2NormalizeAccount();if(!a.w2.settings.gestures||!w2SwipeStart||!event.changedTouches[0])return;const dx=event.changedTouches[0].clientX-w2SwipeStart.x,dy=event.changedTouches[0].clientY-w2SwipeStart.y,dt=Date.now()-w2SwipeStart.time;w2SwipeStart=null;if(dt>600||Math.abs(dx)<90||Math.abs(dx)<Math.abs(dy)*1.35)return;const names=[...document.querySelectorAll(".navigation-principale [data-page]")].map(b=>b.dataset.page);const active=document.querySelector(".navigation-principale .nav-bouton.active")?.dataset.page;const i=names.indexOf(active);const next=dx<0?i+1:i-1;if(next>=0&&next<names.length)afficherPage(names[next]);},{passive:true});

// ======================================================
// PARAMÈTRES : UNITÉS / LANGUE / IA PHOTO
// ======================================================

const W2_TRANSLATIONS = {
  fr:{nav:["Aujourd’hui","Nutrition","Plan","Progrès","Moi"],coach:"Ton coach du jour",forYou:"Pour toi"},
  en:{nav:["Today","Nutrition","Plan","Progress","Me"],coach:"Your daily coach",forYou:"For you"}
};
function w2LoadSettings(){
  const a=w2NormalizeAccount(),s=a.w2.settings;const units=document.getElementById("w2-units"),lang=document.getElementById("w2-language"),hap=document.getElementById("w2-haptics"),gest=document.getElementById("w2-gestures");if(units)units.value=s.units;if(lang)lang.value=s.language;if(hap)hap.checked=!!s.haptics;if(gest)gest.checked=!!s.gestures;
  const ep=document.getElementById("w2-photo-ai-endpoint"),tok=document.getElementById("w2-photo-ai-token");if(ep)ep.value=s.photoAiEndpoint||"";if(tok)tok.value=s.photoAiToken||"";
}
function w2ApplyLanguage(){
  const a=w2NormalizeAccount(),t=W2_TRANSLATIONS[a.w2.settings.language]||W2_TRANSLATIONS.fr;document.querySelectorAll(".navigation-principale [data-page] small").forEach((el,i)=>{if(t.nav[i])el.textContent=t.nav[i];});
  const coach=document.querySelector(".w2-coach-panel h2");if(coach)coach.textContent=`🧠 ${t.coach}`;const fy=document.querySelector(".w2-for-you-section h2");if(fy)fy.textContent=`❤️ ${t.forYou}`;
}
document.getElementById("w2-save-settings")?.addEventListener("click",()=>{const a=w2NormalizeAccount();a.w2.settings.units=document.getElementById("w2-units").value;a.w2.settings.language=document.getElementById("w2-language").value;a.w2.settings.haptics=document.getElementById("w2-haptics").checked;a.w2.settings.gestures=document.getElementById("w2-gestures").checked;sauvegarderEtatApplication();w2ApplyLanguage();rafraichirApplication();});
document.getElementById("w2-save-photo-ai")?.addEventListener("click",()=>{const a=w2NormalizeAccount();a.w2.settings.photoAiEndpoint=document.getElementById("w2-photo-ai-endpoint").value.trim();a.w2.settings.photoAiToken=document.getElementById("w2-photo-ai-token").value.trim();sauvegarderEtatApplication();w2Haptic(20);});

// Weight tracking in lb while storage remains kg.
const megaWeightButton=document.getElementById("mega-add-weight");
megaWeightButton?.addEventListener("click",()=>{const a=w2NormalizeAccount(),input=document.getElementById("mega-weight-input");if(a.w2.settings.units==="lb"&&input&&input.value){input.value=String(W2_CORE.lbToKg(Number(input.value)));}},{capture:true});
function w2ApplyUnitUi(){
  const a=w2NormalizeAccount(),lb=a.w2.settings.units==="lb",input=document.getElementById("mega-weight-input");if(input){input.placeholder=lb?"Poids du jour (lb)":"Poids du jour (kg)";}
  const summary=document.getElementById("mega-weight-summary");if(lb&&summary){summary.querySelectorAll(".weight-pill").forEach(el=>{el.textContent=el.textContent.replace(/(-?\d+(?:[.,]\d+)?)\s*kg/g,(m,n)=>`${W2_CORE.kgToLb(Number(n.replace(",",".")))} lb`);});}
}

// ======================================================
// CLOUD SUPABASE
// ======================================================

function w2LoadCloudConfig(){const cfg=WellnessCloud.getConfig();document.getElementById("w2-supabase-url").value=cfg.url||"";document.getElementById("w2-supabase-key").value=cfg.anonKey||"";w2RenderCloudStatus();}
async function w2RenderCloudStatus(){const status=document.getElementById("w2-cloud-status");if(!status)return;const session=await WellnessCloud.validSession().catch(()=>null);status.textContent=session?.user?.email?`Connecté · ${session.user.email}`:"Local uniquement";}
function w2CloudMessage(text){const el=document.getElementById("w2-cloud-message");if(el)el.textContent=text;}
document.getElementById("w2-save-cloud-config")?.addEventListener("click",()=>{WellnessCloud.setConfig({url:document.getElementById("w2-supabase-url").value,anonKey:document.getElementById("w2-supabase-key").value});w2CloudMessage("✅ Configuration enregistrée. Exécute SUPABASE_SETUP.sql une fois dans ton projet.");});
document.getElementById("w2-cloud-login")?.addEventListener("click",async()=>{try{w2CloudMessage("Connexion…");await WellnessCloud.signIn(document.getElementById("w2-cloud-email").value.trim(),document.getElementById("w2-cloud-password").value);w2CloudMessage("✅ Connecté. Tu peux synchroniser tes données.");w2RenderCloudStatus();}catch(e){w2CloudMessage(`⚠️ ${e.message}`);}});
document.getElementById("w2-cloud-signup")?.addEventListener("click",async()=>{try{w2CloudMessage("Création…");const data=await WellnessCloud.signUp(document.getElementById("w2-cloud-email").value.trim(),document.getElementById("w2-cloud-password").value);w2CloudMessage(data?.access_token?"✅ Compte créé et connecté.":"✅ Compte créé. Vérifie ton email si la confirmation est activée dans Supabase.");w2RenderCloudStatus();}catch(e){w2CloudMessage(`⚠️ ${e.message}`);}});
document.getElementById("w2-cloud-logout")?.addEventListener("click",()=>{WellnessCloud.signOut();w2CloudMessage("Déconnecté du cloud.");w2RenderCloudStatus();});
document.getElementById("w2-cloud-push")?.addEventListener("click",async()=>{try{w2CloudMessage("Envoi…");const at=await WellnessCloud.push(etatApplication);w2CloudMessage(`✅ Données envoyées au cloud (${new Date(at).toLocaleString("fr-FR")}).`);}catch(e){w2CloudMessage(`⚠️ ${e.message}`);}});
document.getElementById("w2-cloud-pull")?.addEventListener("click",async()=>{try{w2CloudMessage("Récupération…");const row=await WellnessCloud.pull();if(!row?.payload){w2CloudMessage("Aucune sauvegarde cloud trouvée.");return;}if(!confirm("Remplacer les données locales par la sauvegarde cloud ?"))return;localStorage.setItem(CLE_APPLICATION,JSON.stringify(row.payload));location.reload();}catch(e){w2CloudMessage(`⚠️ ${e.message}`);}});

// ======================================================
// BACKUP / RESTORE
// ======================================================

async function w2Download(filename,text,type="application/json"){
  const result=await WellnessFiles.shareOrDownload(filename,text,type);
  const message=document.getElementById("w2-backup-message");
  if(message){
    if(result.ok) message.textContent=result.method==="share"?"✅ Sauvegarde prête à enregistrer ou partager.":"✅ Sauvegarde téléchargée.";
    else if(!result.cancelled) message.textContent="⚠️ Impossible d’exporter le fichier sur cet appareil.";
  }
  return result;
}
document.getElementById("w2-backup-export")?.addEventListener("click",()=>{const payload={format:"wellness-backup",version:W2_VERSION,createdAt:new Date().toISOString(),app:etatApplication,theme:localStorage.getItem("wellnessTheme")||"dark"};w2Download(`wellness-backup-${w2Today()}.json`,JSON.stringify(payload,null,2));});
document.getElementById("w2-backup-file")?.addEventListener("change",async event=>{
  const file=event.target.files?.[0],message=document.getElementById("w2-backup-message");
  if(!file)return;
  try{
    if(message)message.textContent="Lecture de la sauvegarde…";
    const raw=await file.text();
    const data=JSON.parse(raw);
    if(data?.format!=="wellness-backup"||!data?.app?.comptes)throw new Error("Format de sauvegarde non reconnu.");
    if(!confirm("Restaurer cette sauvegarde ? Les données actuelles seront remplacées."))return;
    localStorage.setItem(CLE_APPLICATION,JSON.stringify(data.app));
    if(data.theme)localStorage.setItem("wellnessTheme",data.theme);
    if(message)message.textContent="✅ Sauvegarde restaurée. Rechargement…";
    setTimeout(()=>location.reload(),450);
  }catch(e){
    if(message)message.textContent=`⚠️ ${e.message}`;
  }finally{
    event.target.value="";
  }
});

// ======================================================
// PLANNING / SHOPPING — préférences + fusion d'unités
// ======================================================

const w2OriginalRecipesForSlot = megaRecipesForSlot;
megaRecipesForSlot = function w2RecipesForSlot(slot) {
  const a=w2NormalizeAccount();
  return w2OriginalRecipesForSlot(slot).filter(r=>W2_CORE.recipeAllowed(r,a.w2.preferences));
};

function w2NormalizeShoppingIngredient(ingredient, portions=1){
  const scaled=megaScaleIngredient(ingredient,portions);const m=scaled.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|l)?\s+(.+)$/i);
  if(!m)return{key:scaled.toLowerCase(),label:scaled,amount:null,unit:"",count:1};
  let amount=Number(m[1].replace(",",".")),unit=(m[2]||"").toLowerCase(),label=m[3].trim();
  if(unit==="kg"){amount*=1000;unit="g";} if(unit==="l"){amount*=1000;unit="ml";} if(unit==="cl"){amount*=10;unit="ml";}
  const clean=label.toLowerCase().replace(/\b(de|du|des|d')\b/g," ").replace(/\s+/g," ").trim();
  return{key:`${unit}|${clean}`,label,amount,unit,count:1};
}
megaBuildShopping = function w2BuildShopping(){
  const account=megaNormalizeAccount(),map=new Map();megaWeekDays(megaPlanWeekOffset).forEach(date=>["Petit-déjeuner","Déjeuner","Dîner"].forEach(slot=>{const plan=account.mealPlan[megaPlanKey(date,slot)];if(!plan?.recipeName)return;const recipe=megaFindRecipe(plan.recipeName);if(!recipe)return;(recipe.ingredients||[]).forEach(ing=>{const p=w2NormalizeShoppingIngredient(ing,Number(plan.portions)||1);if(map.has(p.key)){const old=map.get(p.key);if(old.amount!==null&&p.amount!==null)old.amount+=p.amount;else old.count=(old.count||1)+1;}else map.set(p.key,{...p});});}));
  return[...map.values()].map(item=>{let text;if(item.amount!==null){let amount=item.amount,unit=item.unit;if(unit==="g"&&amount>=1000){amount/=1000;unit="kg";}if(unit==="ml"&&amount>=1000){amount/=1000;unit="l";}text=`${megaPrettyNumber(amount)} ${unit} ${item.label}`.replace(/\s+/g," ").trim();}else{text=(item.count>1?`${item.count} × `:"")+item.label;}return{id:item.key,text};});
};

// ======================================================
// OVERLAYS — fermeture backdrop / Escape
// ======================================================

["w2-quick-overlay","w2-food-overlay","w2-portion-overlay","w2-barcode-overlay","w2-photo-overlay","w2-notification-overlay"].forEach(id=>{
  const overlay=document.getElementById(id);overlay?.addEventListener("click",e=>{if(e.target===overlay){if(id==="w2-barcode-overlay")w2StopBarcodeCamera();megaCloseOverlay(overlay);}});
});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;["w2-quick-overlay","w2-food-overlay","w2-portion-overlay","w2-barcode-overlay","w2-photo-overlay","w2-notification-overlay"].forEach(id=>{const o=document.getElementById(id);if(o?.classList.contains("ouverte")){if(id==="w2-barcode-overlay")w2StopBarcodeCamera();megaCloseOverlay(o);}});});

// ======================================================
// REFRESH GLOBAL
// ======================================================

function w2RenderAll(){
  w2NormalizeAccount();
  w2LoadGoalPreferences();
  w2LoadWellnessForm();
  w2RenderActivities();
  w2RenderCoach();
  w2RenderFoodHub();
  w2RenderForYou();
  w2RenderForecast();
  w2RenderComparison();
  w2RenderWeeklyMissions();
  w2RenderNotifications();
  w2LoadSettings();
  w2ApplyLanguage();
  w2ApplyUnitUi();
  w2LoadCloudConfig();
}

const w2OriginalRefresh = rafraichirApplication;
rafraichirApplication = function w2Refresh(){
  w2NormalizeAccount();
  w2OriginalRefresh();
  w2RenderAll();
  sauvegarderEtatApplication();
};

// ======================================================
// INITIALISATION
// ======================================================

w2NormalizeAll();
w2RenderFoodHub();
rafraichirApplication();
