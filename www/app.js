// ======================================================
// 🛠️ OUTILS GÉNÉRAUX
// ======================================================

function calculerProgression(valeurActuelle, objectif) {
  if (!Number.isFinite(objectif) || objectif <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(Math.round((valeurActuelle / objectif) * 100), 0),
    100,
  );
}

function creerTexteProgression(pourcentage) {
  return "Progression : " + pourcentage + " %";
}

function mettreAJourBarre(element, pourcentage) {
  if (element !== null) {
    element.style.width = pourcentage + "%";
  }
}

function obtenirDateLocale(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
}

function ajouterJours(date, nombreJours) {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + nombreJours);
  return copie;
}

function lireJSON(cle, valeurParDefaut) {
  try {
    const valeur = localStorage.getItem(cle);

    if (valeur === null) {
      return valeurParDefaut;
    }

    return JSON.parse(valeur);
  } catch (erreur) {
    return valeurParDefaut;
  }
}

function sauvegarderJSON(cle, valeur) {
  localStorage.setItem(cle, JSON.stringify(valeur));
}


// ======================================================
// 👥 SYSTÈME MULTI-COMPTES
// ======================================================

const CLE_APPLICATION = "wellnessAppComptes";

const recompensesParDefaut = [
  "💆 Tu as gagné un massage",
  "🎬 C’est toi qui choisis le film ce soir",
  "🍽️ Tu choisis le repas de ce soir",
  "☕ Petite pause plaisir bien méritée",
  "🎮 30 minutes de jeu ou de loisir en plus",
  "🍰 Tu as droit à ton petit plaisir préféré",
  "🛋️ Soirée détente sans culpabiliser",
  "📱 30 minutes rien que pour toi",
  "🎵 Tu choisis la musique de la soirée",
  "🛁 Bain ou douche détente ce soir",
  "❤️ Tu choisis l’activité à faire en couple ce soir",
  "🍿 Soirée film avec ton snack préféré",
];

function creerCompteParDefaut(nomCompte = "Mon profil") {
  return {
    nomCompte,
    prenom: "",
    age: "",
    objectifEau: 8,
    objectifPas: 10000,
    taille: "",
    poidsActuel: "",
    poidsObjectif: "",
    formuleMetabolique: "",
    niveauActivite: "modere",
    objectifCalories: null,
    caloriesMaintien: null,
    typeObjectifCalories: "",
    caloriesConsommees: 0,
    journalCalories: [],
    dateDonneesJour: obtenirDateLocale(),
    verresEau: 0,
    pasEffectues: 0,
    repas: {
      "Petit-déjeuner": false,
      "Déjeuner": false,
      "Dîner": false,
    },
    favoris: {},
    historique: {},
    badgesDebloques: [],
    streak: 0,
    dernierJourStreak: null,
    recompenses: [...recompensesParDefaut],
    dateDerniereRoue: null,
    derniereRecompense: null,
  };
}

function creerEtatInitial() {
  const id = "compte-" + Date.now();

  return {
    compteActif: id,
    comptes: {
      [id]: creerCompteParDefaut("Mon profil"),
    },
  };
}

function migrerAnciennesDonneesSiNecessaire(etat) {
  if (localStorage.getItem("migrationMultiComptesFaite") === "true") {
    return etat;
  }

  const compteActif = etat.comptes[etat.compteActif];

  const ancienPrenom = localStorage.getItem("prenom");
  const ancienAge = localStorage.getItem("age");
  const ancienObjectifEau = localStorage.getItem("objectifEau");
  const ancienObjectifPas = localStorage.getItem("objectifPas");
  const anciensVerresEau = localStorage.getItem("verresEau");
  const anciensPas = localStorage.getItem("pasEffectues");

  if (ancienPrenom !== null) {
    compteActif.prenom = ancienPrenom;
    compteActif.nomCompte = ancienPrenom || "Mon profil";
  }

  if (ancienAge !== null) {
    compteActif.age = ancienAge;
  }

  if (ancienObjectifEau !== null) {
    compteActif.objectifEau = Number(ancienObjectifEau) || 8;
  }

  if (ancienObjectifPas !== null) {
    compteActif.objectifPas = Number(ancienObjectifPas) || 10000;
  }

  if (anciensVerresEau !== null) {
    compteActif.verresEau = Number(anciensVerresEau) || 0;
  }

  if (anciensPas !== null) {
    compteActif.pasEffectues = Number(anciensPas) || 0;
  }

  ["Petit-déjeuner", "Déjeuner", "Dîner"].forEach((nomRepas) => {
    const nouvelleCle = localStorage.getItem("repas-" + nomRepas);
    const ancienneCle = localStorage.getItem(nomRepas);
    const valeur = nouvelleCle !== null ? nouvelleCle : ancienneCle;

    if (valeur !== null) {
      compteActif.repas[nomRepas] = valeur === "true";
    }
  });

  const ancienHistorique = lireJSON("historiqueSuivi", null);

  if (ancienHistorique && typeof ancienHistorique === "object") {
    compteActif.historique = ancienHistorique;
  }

  const anciensBadges = lireJSON("badgesDebloques", null);

  if (Array.isArray(anciensBadges)) {
    compteActif.badgesDebloques = anciensBadges;
  }

  const ancienStreak = localStorage.getItem("streak");
  const ancienDernierJourStreak = localStorage.getItem("dernierJourStreak");

  if (ancienStreak !== null) {
    compteActif.streak = Number(ancienStreak) || 0;
  }

  if (ancienDernierJourStreak !== null) {
    compteActif.dernierJourStreak = ancienDernierJourStreak;
  }

  const anciennesRecompenses = lireJSON("recompensesPersonnalisees", null);

  if (Array.isArray(anciennesRecompenses) && anciennesRecompenses.length > 0) {
    compteActif.recompenses = anciennesRecompenses;
  }

  const ancienneDateRoue = localStorage.getItem("dateDerniereRoue");
  const ancienneRecompense = localStorage.getItem("derniereRecompense");

  if (ancienneDateRoue !== null) {
    compteActif.dateDerniereRoue = ancienneDateRoue;
  }

  if (ancienneRecompense !== null) {
    compteActif.derniereRecompense = ancienneRecompense;
  }

  localStorage.setItem("migrationMultiComptesFaite", "true");

  return etat;
}

let etatApplication = lireJSON(CLE_APPLICATION, null);

if (
  !etatApplication ||
  typeof etatApplication !== "object" ||
  !etatApplication.comptes ||
  !etatApplication.compteActif
) {
  etatApplication = creerEtatInitial();
}

etatApplication = migrerAnciennesDonneesSiNecessaire(etatApplication);

function normaliserCompte(compte) {
  const valeursParDefaut = {
    taille: "",
    poidsActuel: "",
    poidsObjectif: "",
    formuleMetabolique: "",
    niveauActivite: "modere",
    objectifCalories: null,
    caloriesMaintien: null,
    typeObjectifCalories: "",
    caloriesConsommees: 0,
    journalCalories: [],
    dateDonneesJour: obtenirDateLocale(),
  };

  Object.entries(valeursParDefaut).forEach(([cle, valeur]) => {
    if (!(cle in compte)) {
      compte[cle] = Array.isArray(valeur) ? [...valeur] : valeur;
    }
  });

  if (!Array.isArray(compte.journalCalories)) {
    compte.journalCalories = [];
  }

  if (!compte.repas || typeof compte.repas !== "object") {
    compte.repas = {
      "Petit-déjeuner": false,
      "Déjeuner": false,
      "Dîner": false,
    };
  }
}

Object.values(etatApplication.comptes).forEach(normaliserCompte);

function sauvegarderEtatApplication() {
  sauvegarderJSON(CLE_APPLICATION, etatApplication);
}

function obtenirCompteActif() {
  return etatApplication.comptes[etatApplication.compteActif];
}

function creerIdCompte() {
  return "compte-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
}

sauvegarderEtatApplication();


// ======================================================
// 🔎 RÉFÉRENCES DOM
// ======================================================

// Eau
const compteurEau = document.getElementById("compteur-eau");
const progressionEauElement = document.getElementById("progression-eau");
const barreEau = document.getElementById("barre-eau");
const boutonEau = document.getElementById("ajouter-eau");
const boutonRetirerEau = document.getElementById("retirer-eau");
const messageEau = document.getElementById("message-eau");

// Pas
const compteurPas = document.getElementById("compteur-pas");
const progressionPasElement = document.getElementById("progression-pas");
const barrePas = document.getElementById("barre-pas");
const inputPas = document.getElementById("input-pas");
const boutonPas = document.getElementById("enregistrer-pas");
const messagePas = document.getElementById("message-pas");

const boutonOuvrirModalPas =
  document.getElementById("ouvrir-modal-pas");
const modalPasOverlay =
  document.getElementById("modal-pas-overlay");
const boutonFermerModalPas =
  document.getElementById("fermer-modal-pas");
const boutonAnnulerModalPas =
  document.getElementById("annuler-modal-pas");
const raccourcisPas =
  document.querySelectorAll(".raccourci-pas");

// Repas
const compteurRepas = document.getElementById("compteur-repas");
const progressionRepasElement = document.getElementById("progression-repas");
const barreRepas = document.getElementById("barre-repas");
const messageRepas = document.getElementById("message-repas");

const boutonOuvrirModalRepas =
  document.getElementById("ouvrir-modal-repas");
const modalRepasOverlay =
  document.getElementById("modal-repas-overlay");
const boutonFermerModalRepas =
  document.getElementById("fermer-modal-repas");
const boutonValiderModalRepas =
  document.getElementById("valider-modal-repas");

// Calories
const compteurCalories = document.getElementById("compteur-calories");
const progressionCaloriesElement = document.getElementById("progression-calories");
const barreCalories = document.getElementById("barre-calories");
const resteCalories = document.getElementById("reste-calories");
const boutonOuvrirModalCalories = document.getElementById("ouvrir-modal-calories");
const modalCaloriesOverlay = document.getElementById("modal-calories-overlay");
const boutonFermerModalCalories = document.getElementById("fermer-modal-calories");
const boutonTerminerModalCalories = document.getElementById("terminer-modal-calories");
const inputNomAliment = document.getElementById("nom-aliment");
const inputCalories = document.getElementById("input-calories");
const boutonEnregistrerCalories = document.getElementById("enregistrer-calories");
const raccourcisCalories = document.querySelectorAll(".raccourci-calories");
const journalCaloriesElement = document.getElementById("journal-calories");
const compteurJournalCalories = document.getElementById("compteur-journal-calories");
const modalCaloriesConsommees = document.getElementById("modal-calories-consommees");
const modalCaloriesCible = document.getElementById("modal-calories-cible");
const modalCaloriesRestantes = document.getElementById("modal-calories-restantes");

const boutonsRepas = {
  "Petit-déjeuner": document.getElementById("petit-dejeuner"),
  "Déjeuner": document.getElementById("dejeuner"),
  "Dîner": document.getElementById("diner"),
};

// Motivation
const messageMotivation = document.getElementById("message-motivation");
const scoreJour = document.getElementById("score-jour");
const badgeJour = document.getElementById("badge-jour");
const heroScore = document.getElementById("hero-score");

// Streak
const streakJour = document.getElementById("streak-jour");
const messageStreak = document.getElementById("message-streak");

// Suivi
const suiviEau = document.getElementById("suivi-eau");
const suiviPas = document.getElementById("suivi-pas");
const suiviRepas = document.getElementById("suivi-repas");
const progressionSuiviEau = document.getElementById("progression-suivi-eau");
const progressionSuiviPas = document.getElementById("progression-suivi-pas");
const progressionSuiviRepas = document.getElementById("progression-suivi-repas");
const barreSuiviEau = document.getElementById("barre-suivi-eau");
const barreSuiviPas = document.getElementById("barre-suivi-pas");
const barreSuiviRepas = document.getElementById("barre-suivi-repas");
const suiviCalories = document.getElementById("suivi-calories");
const progressionSuiviCalories = document.getElementById("progression-suivi-calories");
const barreSuiviCalories = document.getElementById("barre-suivi-calories");
const detailCaloriesSuivi = document.getElementById("detail-calories-suivi");
const scoreGlobal = document.getElementById("score-global");
const messageScoreGlobal = document.getElementById("message-score-global");
const resumeObjectifsAtteints = document.getElementById("resume-objectifs-atteints");
const resumeEncouragement = document.getElementById("resume-encouragement");

// Historique
const graphiqueSemaine = document.getElementById("graphique-semaine");
const moyenneSemaine = document.getElementById("moyenne-semaine");

// Badges
const badgesGrid = document.getElementById("badges-grid");
const compteurBadges = document.getElementById("compteur-badges");

// Roue
const roueRecompense = document.getElementById("roue-recompense");
const boutonTournerRoue = document.getElementById("tourner-roue");
const messageRoue = document.getElementById("message-roue");
const recompenseGagnee = document.getElementById("recompense-gagnee");
const etatRoue = document.getElementById("etat-roue");

// Profil
const inputPrenom = document.getElementById("profil-prenom");
const inputAge = document.getElementById("profil-age");
const inputObjectifEau = document.getElementById("profil-objectif-eau");
const inputObjectifPas = document.getElementById("profil-objectif-pas");
const btnEnregistrer = document.getElementById("enregistrer-profil");
const messageProfil = document.getElementById("message-profil");
const nomProfil = document.getElementById("nom");

// Nutrition / objectif poids
const selectFormuleMetabolique = document.getElementById("profil-formule-metabolique");
const inputTaille = document.getElementById("profil-taille");
const inputPoidsActuel = document.getElementById("profil-poids-actuel");
const inputPoidsObjectif = document.getElementById("profil-poids-objectif");
const selectActivite = document.getElementById("profil-activite");
const boutonCalculerObjectifCalories = document.getElementById("calculer-objectif-calories");
const objectifCaloriesResultat = document.getElementById("objectif-calories-resultat");
const maintienCaloriesResultat = document.getElementById("maintien-calories-resultat");
const typeObjectifResultat = document.getElementById("type-objectif-resultat");
const etatObjectifCalories = document.getElementById("etat-objectif-calories");
const messageCalculCalories = document.getElementById("message-calcul-calories");

// Apparence
const CLE_THEME = "wellnessTheme";
const boutonsTheme = document.querySelectorAll("[data-theme-mode]");
const themeEtat = document.getElementById("theme-etat");
const messageTheme = document.getElementById("message-theme");
const mediaThemeSombre = window.matchMedia("(prefers-color-scheme: dark)");

// Comptes
const selectCompte = document.getElementById("select-compte");
const boutonNouveauCompte = document.getElementById("nouveau-compte");
const boutonRenommerCompte = document.getElementById("renommer-compte");
const compteurComptes = document.getElementById("compteur-comptes");
const messageCompte = document.getElementById("message-compte");
const boutonReinitialiserCompte = document.getElementById("reinitialiser-compte");
const boutonSupprimerCompte = document.getElementById("supprimer-compte");
const messageDanger = document.getElementById("message-danger");

// Récompenses personnalisées
const inputNouvelleRecompense = document.getElementById("nouvelle-recompense");
const boutonAjouterRecompense = document.getElementById("ajouter-recompense");
const listeRecompensesProfil = document.getElementById("liste-recompenses-profil");
const compteurRecompenses = document.getElementById("compteur-recompenses");
const messageRecompense = document.getElementById("message-recompense");
const boutonRestaurerRecompenses = document.getElementById("restaurer-recompenses");

// Navigation
const boutonsNavigation = document.querySelectorAll(".nav-bouton");
const pages = document.querySelectorAll(".page");

// Recettes
const listeRecettes = document.getElementById("liste-recettes");
const detailRecette = document.getElementById("detail-recette");
const listeFavoris = document.getElementById("liste-favoris");
const rechercheRecette = document.getElementById("recherche-recette");
const filtreCategorie = document.getElementById("filtre-categorie");
const triRecettes = document.getElementById("tri-recettes");
const nombreRecettes = document.getElementById("nombre-recettes");

const boutonOuvrirFiltres =
  document.getElementById("ouvrir-filtres-recettes");
const boutonFermerFiltres =
  document.getElementById("fermer-filtres-recettes");
const modalFiltresOverlay =
  document.getElementById("modal-filtres-overlay");
const boutonAppliquerFiltres =
  document.getElementById("appliquer-filtres-modal");
const boutonReinitialiserFiltres =
  document.getElementById("reinitialiser-filtres-modal");
const boutonEffacerFiltresRapide =
  document.getElementById("effacer-filtres-rapide");
const badgeFiltresActifs =
  document.getElementById("badge-filtres-actifs");

const filtreTempsMax =
  document.getElementById("filtre-temps-max");
const filtreCaloriesMax =
  document.getElementById("filtre-calories-max");
const filtreProteinesMin =
  document.getElementById("filtre-proteines-min");

const radiosTypeRepas =
  document.querySelectorAll('input[name="type-repas-modal"]');

let typeRepasActif = "Tous";


// ======================================================
// 📊 CALCULS
// ======================================================

const objectifRepas = 3;

const facteursActivite = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
};

function caloriesConfigurees(compte = obtenirCompteActif()) {
  return (
    Number.isFinite(Number(compte.objectifCalories)) &&
    Number(compte.objectifCalories) > 0
  );
}

function calculerCibleCalories({
  age,
  taille,
  poidsActuel,
  poidsObjectif,
  formuleMetabolique,
  niveauActivite,
}) {
  if (
    !Number.isFinite(age) ||
    age < 18 ||
    !Number.isFinite(taille) ||
    taille <= 0 ||
    !Number.isFinite(poidsActuel) ||
    poidsActuel <= 0 ||
    !Number.isFinite(poidsObjectif) ||
    poidsObjectif <= 0 ||
    !["homme", "femme"].includes(formuleMetabolique) ||
    !(niveauActivite in facteursActivite)
  ) {
    return null;
  }

  const constante =
    formuleMetabolique === "homme"
      ? 5
      : -161;

  const metabolismeBase =
    10 * poidsActuel +
    6.25 * taille -
    5 * age +
    constante;

  const maintien =
    metabolismeBase * facteursActivite[niveauActivite];

  const differencePoids =
    poidsObjectif - poidsActuel;

  let multiplicateur = 1;
  let typeObjectif = "Maintien";

  if (differencePoids < -0.5) {
    multiplicateur = 0.85;
    typeObjectif = "Perte de poids";
  } else if (differencePoids > 0.5) {
    multiplicateur = 1.10;
    typeObjectif = "Prise de poids";
  }

  return {
    metabolismeBase: Math.round(metabolismeBase),
    maintien: Math.round(maintien / 10) * 10,
    objectif: Math.round((maintien * multiplicateur) / 10) * 10,
    typeObjectif,
  };
}

function calculerProgressionCalories(compte = obtenirCompteActif()) {
  if (!caloriesConfigurees(compte)) {
    return 0;
  }

  return calculerProgression(
    Number(compte.caloriesConsommees) || 0,
    Number(compte.objectifCalories),
  );
}

function sauvegarderDonneesAvantNouveauJour(compte) {
  if (!compte.dateDonneesJour) {
    return;
  }

  const eau = calculerProgression(compte.verresEau, compte.objectifEau);
  const pas = calculerProgression(compte.pasEffectues, compte.objectifPas);
  const repasPris = Object.values(compte.repas).filter(Boolean).length;
  const repas = calculerProgression(repasPris, objectifRepas);
  const calories = calculerProgressionCalories(compte);

  compte.historique[compte.dateDonneesJour] = {
    eau,
    pas,
    repas,
    calories,
    caloriesConsommees: Number(compte.caloriesConsommees) || 0,
    objectifCalories: Number(compte.objectifCalories) || 0,
    score: Math.round((eau + pas + repas) / 3),
  };
}

function verifierNouveauJour() {
  const compte = obtenirCompteActif();
  normaliserCompte(compte);

  const aujourdHui = obtenirDateLocale();

  if (!compte.dateDonneesJour) {
    compte.dateDonneesJour = aujourdHui;
    return;
  }

  if (compte.dateDonneesJour === aujourdHui) {
    return;
  }

  sauvegarderDonneesAvantNouveauJour(compte);

  compte.verresEau = 0;
  compte.pasEffectues = 0;
  compte.repas = {
    "Petit-déjeuner": false,
    "Déjeuner": false,
    "Dîner": false,
  };
  compte.caloriesConsommees = 0;
  compte.journalCalories = [];
  compte.dateDonneesJour = aujourdHui;
}

function compterRepasPris() {
  const compte = obtenirCompteActif();

  return Object.values(compte.repas).filter(Boolean).length;
}

function obtenirProgressions() {
  const compte = obtenirCompteActif();

  const eau = calculerProgression(compte.verresEau, compte.objectifEau);
  const pas = calculerProgression(compte.pasEffectues, compte.objectifPas);
  const repas = calculerProgression(compterRepasPris(), objectifRepas);

  return {
    eau,
    pas,
    repas,
    score: Math.round((eau + pas + repas) / 3),
  };
}

function compterObjectifsAtteints() {
  const compte = obtenirCompteActif();
  let total = 0;

  if (compte.verresEau >= compte.objectifEau) {
    total += 1;
  }

  if (compte.pasEffectues >= compte.objectifPas) {
    total += 1;
  }

  if (compterRepasPris() >= objectifRepas) {
    total += 1;
  }

  return total;
}

function objectifsComplets() {
  return compterObjectifsAtteints() === 3;
}


// ======================================================
// 🖥️ AFFICHAGE DU PROFIL ACTIF
// ======================================================

function afficherProfilActif() {
  const compte = obtenirCompteActif();

  nomProfil.textContent =
    compte.prenom.trim() !== ""
      ? "Bonjour " + compte.prenom + " 👋"
      : "Bonjour 👋";

  inputPrenom.value = compte.prenom;
  inputAge.value = compte.age;
  inputObjectifEau.value = compte.objectifEau;
  inputObjectifPas.value = compte.objectifPas;

  selectFormuleMetabolique.value = compte.formuleMetabolique || "";
  inputTaille.value = compte.taille || "";
  inputPoidsActuel.value = compte.poidsActuel || "";
  inputPoidsObjectif.value = compte.poidsObjectif || "";
  selectActivite.value = compte.niveauActivite || "modere";

  afficherResumeObjectifCalories();
}

function afficherResumeObjectifCalories() {
  const compte = obtenirCompteActif();

  if (!caloriesConfigurees(compte)) {
    objectifCaloriesResultat.textContent = "-- kcal";
    maintienCaloriesResultat.textContent = "-- kcal";
    typeObjectifResultat.textContent = "--";
    etatObjectifCalories.textContent = "À configurer";
    return;
  }

  objectifCaloriesResultat.textContent =
    Math.round(compte.objectifCalories) + " kcal";

  maintienCaloriesResultat.textContent =
    Math.round(compte.caloriesMaintien || 0) + " kcal";

  typeObjectifResultat.textContent =
    compte.typeObjectifCalories || "Maintien";

  etatObjectifCalories.textContent =
    Math.round(compte.objectifCalories) + " kcal / jour";
}

function afficherListeComptes() {
  selectCompte.innerHTML = "";

  Object.entries(etatApplication.comptes).forEach(([id, compte]) => {
    const option = document.createElement("option");

    option.value = id;
    option.textContent = compte.nomCompte;

    if (id === etatApplication.compteActif) {
      option.selected = true;
    }

    selectCompte.appendChild(option);
  });

  const nombreComptes = Object.keys(etatApplication.comptes).length;

  compteurComptes.textContent =
    nombreComptes +
    " compte" +
    (nombreComptes > 1 ? "s" : "");
}


// ======================================================
// 💧 👟 🍽️ AFFICHAGE PRINCIPAL
// ======================================================

function afficherEau() {
  const compte = obtenirCompteActif();
  const { eau } = obtenirProgressions();

  compteurEau.textContent = compte.verresEau + " / " + compte.objectifEau;
  progressionEauElement.textContent = eau + " %";
  mettreAJourBarre(barreEau, eau);

  messageEau.textContent =
    compte.verresEau >= compte.objectifEau
      ? "🎉 Objectif hydratation atteint !"
      : "";
}

function afficherPas() {
  const compte = obtenirCompteActif();
  const { pas } = obtenirProgressions();

  compteurPas.textContent = compte.pasEffectues + " / " + compte.objectifPas;
  progressionPasElement.textContent = pas + " %";
  mettreAJourBarre(barrePas, pas);

  messagePas.textContent =
    compte.pasEffectues >= compte.objectifPas
      ? "🎉 Objectif atteint !"
      : "";
}

function afficherRepas() {
  const compte = obtenirCompteActif();
  const { repas } = obtenirProgressions();
  const nombreRepasPris = compterRepasPris();

  compteurRepas.textContent = nombreRepasPris + " / " + objectifRepas;
  progressionRepasElement.textContent = repas + " %";
  mettreAJourBarre(barreRepas, repas);

  Object.entries(boutonsRepas).forEach(([nomRepas, bouton]) => {
    bouton.textContent = compte.repas[nomRepas] ? "✓" : "+";
  });

  messageRepas.textContent =
    nombreRepasPris >= objectifRepas
      ? "🎉 Tous les repas sont complétés"
      : "";
}

function afficherCalories() {
  const compte = obtenirCompteActif();
  const calories = Number(compte.caloriesConsommees) || 0;

  if (!caloriesConfigurees(compte)) {
    compteurCalories.textContent = calories + " kcal";
    progressionCaloriesElement.textContent = "À configurer";
    resteCalories.textContent = "Configure ta cible dans Profil.";
    mettreAJourBarre(barreCalories, 0);
    return;
  }

  const objectif = Number(compte.objectifCalories);
  const progression = calculerProgressionCalories(compte);
  const difference = objectif - calories;

  compteurCalories.textContent =
    calories + " / " + Math.round(objectif) + " kcal";

  progressionCaloriesElement.textContent =
    progression + " %";

  mettreAJourBarre(barreCalories, progression);

  if (difference > 0) {
    resteCalories.textContent =
      Math.round(difference) + " kcal restantes sur ta cible estimée.";
  } else if (difference < 0) {
    resteCalories.textContent =
      Math.abs(Math.round(difference)) +
      " kcal au-dessus de la cible estimée.";
  } else {
    resteCalories.textContent =
      "Tu es exactement sur ta cible estimée aujourd'hui.";
  }
}

function recalculerCaloriesJournal(compte = obtenirCompteActif()) {
  compte.caloriesConsommees = (compte.journalCalories || []).reduce(
    (total, element) => total + Number(element.calories || 0),
    0,
  );

  return compte.caloriesConsommees;
}

function trouverEntreeJournal(id, compte = obtenirCompteActif()) {
  return (compte.journalCalories || []).find((entree) => entree.id === id) || null;
}

function modifierEntreeJournal(id, modifications = {}) {
  const compte = obtenirCompteActif();
  const entree = trouverEntreeJournal(id, compte);

  if (!entree) {
    return false;
  }

  const calories = Number(modifications.calories ?? entree.calories);

  if (!Number.isFinite(calories) || calories <= 0) {
    return false;
  }

  const nom = String(modifications.nom ?? entree.nom ?? "Ajout manuel").trim();

  Object.assign(entree, modifications, {
    nom: nom || "Ajout manuel",
    calories: Math.round(calories),
  });

  ["proteines", "glucides", "lipides"].forEach((cle) => {
    if (cle in entree) {
      const valeur = Number(entree[cle]);
      entree[cle] = Number.isFinite(valeur) && valeur >= 0
        ? Math.round(valeur * 10) / 10
        : 0;
    }
  });

  recalculerCaloriesJournal(compte);
  sauvegarderEtatApplication();
  rafraichirApplication();
  return true;
}

function supprimerEntreeJournal(id) {
  const compte = obtenirCompteActif();
  const longueurInitiale = (compte.journalCalories || []).length;

  compte.journalCalories = (compte.journalCalories || []).filter(
    (entree) => entree.id !== id,
  );

  if (compte.journalCalories.length === longueurInitiale) {
    return false;
  }

  recalculerCaloriesJournal(compte);
  sauvegarderEtatApplication();
  rafraichirApplication();
  return true;
}

function afficherJournalCalories() {
  const compte = obtenirCompteActif();

  if (
    journalCaloriesElement === null ||
    compteurJournalCalories === null
  ) {
    return;
  }

  journalCaloriesElement.innerHTML = "";

  const journal = Array.isArray(compte.journalCalories)
    ? compte.journalCalories
    : [];

  compteurJournalCalories.textContent =
    journal.length +
    " ajout" +
    (journal.length > 1 ? "s" : "");

  if (journal.length === 0) {
    const vide = document.createElement("p");
    vide.classList.add("journal-calories-vide");
    vide.textContent = "Aucun aliment ajouté aujourd'hui.";
    journalCaloriesElement.appendChild(vide);
  } else {
    [...journal].reverse().forEach((entree) => {
      const item = document.createElement("div");
      item.classList.add("journal-calories-item");

      const infos = document.createElement("div");

      const nom = document.createElement("strong");
      nom.textContent = entree.nom || "Ajout manuel";

      const details = document.createElement("span");
      details.textContent =
        Math.round(entree.calories) +
        " kcal" +
        (entree.source === "recette" ? " • Recette" : "");

      infos.appendChild(nom);
      infos.appendChild(details);

      const actions = document.createElement("div");
      actions.classList.add("journal-calories-actions");

      const boutonModifier = document.createElement("button");
      boutonModifier.classList.add("bouton-modifier-calories");
      boutonModifier.setAttribute("aria-label", "Modifier cet ajout");
      boutonModifier.textContent = "✎";
      boutonModifier.addEventListener("click", () => {
        if (typeof window.megaOpenJournalEditor === "function") {
          window.megaOpenJournalEditor(entree.id);
        }
      });

      const boutonSupprimer = document.createElement("button");
      boutonSupprimer.classList.add("bouton-supprimer-calories");
      boutonSupprimer.setAttribute("aria-label", "Supprimer cet ajout");
      boutonSupprimer.textContent = "✕";
      boutonSupprimer.addEventListener("click", () => {
        supprimerEntreeJournal(entree.id);
      });

      actions.append(boutonModifier, boutonSupprimer);
      item.appendChild(infos);
      item.appendChild(actions);

      journalCaloriesElement.appendChild(item);
    });
  }

  const cible = caloriesConfigurees(compte)
    ? Math.round(compte.objectifCalories)
    : null;

  const consommees = Math.round(Number(compte.caloriesConsommees) || 0);

  modalCaloriesConsommees.textContent =
    consommees + " kcal";

  modalCaloriesCible.textContent =
    cible !== null ? cible + " kcal" : "-- kcal";

  if (cible === null) {
    modalCaloriesRestantes.textContent = "-- kcal";
  } else {
    const reste = cible - consommees;

    modalCaloriesRestantes.textContent =
      reste >= 0
        ? Math.round(reste) + " kcal"
        : "+" + Math.abs(Math.round(reste)) + " kcal";
  }
}

function ajouterCaloriesAuJournal(nom, calories, source = "manuel") {
  const compte = obtenirCompteActif();
  const valeur = Number(calories);

  if (!Number.isFinite(valeur) || valeur <= 0) {
    return false;
  }

  const entree = {
    id:
      "cal-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 7),
    nom:
      String(nom || "").trim() !== ""
        ? String(nom).trim()
        : "Ajout manuel",
    calories: Math.round(valeur),
    source,
    date: obtenirDateLocale(),
  };

  compte.journalCalories.push(entree);
  recalculerCaloriesJournal(compte);

  sauvegarderEtatApplication();

  return true;
}

function afficherMotivation() {
  const objectifsAtteints = compterObjectifsAtteints();

  scoreJour.textContent = objectifsAtteints + " / 3 objectifs atteints";

  if (objectifsAtteints === 0) {
    messageMotivation.textContent =
      "C’est le moment de te lancer. Chaque petit effort compte 💪";
    badgeJour.textContent = "Départ du jour 🚀";
  } else if (objectifsAtteints === 1) {
    messageMotivation.textContent =
      "Bravo, tu as déjà commencé. Continue comme ça 👏";
    badgeJour.textContent = "Bon élan 🌱";
  } else if (objectifsAtteints === 2) {
    messageMotivation.textContent =
      "Très belle progression aujourd’hui, tu es presque au top 🔥";
    badgeJour.textContent = "Super forme ⚡";
  } else {
    messageMotivation.textContent =
      "Incroyable, tous tes objectifs sont atteints aujourd’hui 🏆";
    badgeJour.textContent = "Champion du jour 👑";
  }
}

function afficherSuivi() {
  const compte = obtenirCompteActif();
  const progressions = obtenirProgressions();
  const objectifsAtteints = compterObjectifsAtteints();

  suiviEau.textContent =
    compte.verresEau + " / " + compte.objectifEau + " verres";

  suiviPas.textContent =
    compte.pasEffectues + " / " + compte.objectifPas + " pas";

  suiviRepas.textContent =
    compterRepasPris() + " / " + objectifRepas + " repas";

  progressionSuiviEau.textContent = creerTexteProgression(progressions.eau);
  progressionSuiviPas.textContent = creerTexteProgression(progressions.pas);
  progressionSuiviRepas.textContent = creerTexteProgression(progressions.repas);

  mettreAJourBarre(barreSuiviEau, progressions.eau);
  mettreAJourBarre(barreSuiviPas, progressions.pas);
  mettreAJourBarre(barreSuiviRepas, progressions.repas);

  const caloriesConsommees =
    Math.round(Number(compte.caloriesConsommees) || 0);

  if (caloriesConfigurees(compte)) {
    const objectifCalories =
      Math.round(Number(compte.objectifCalories));

    const progressionCalories =
      calculerProgressionCalories(compte);

    suiviCalories.textContent =
      caloriesConsommees +
      " / " +
      objectifCalories +
      " kcal";

    progressionSuiviCalories.textContent =
      creerTexteProgression(progressionCalories);

    mettreAJourBarre(
      barreSuiviCalories,
      progressionCalories,
    );

    const difference =
      objectifCalories - caloriesConsommees;

    detailCaloriesSuivi.textContent =
      difference >= 0
        ? difference + " kcal restantes"
        : Math.abs(difference) + " kcal au-dessus de la cible";
  } else {
    suiviCalories.textContent =
      caloriesConsommees + " kcal";

    progressionSuiviCalories.textContent =
      "Objectif à configurer";

    detailCaloriesSuivi.textContent =
      "Configure ta cible dans Profil.";

    mettreAJourBarre(barreSuiviCalories, 0);
  }

  scoreGlobal.textContent = progressions.score + " %";
  heroScore.textContent = progressions.score + " %";

  if (progressions.score < 30) {
    messageScoreGlobal.textContent = "Ta journée commence ici 💪";
  } else if (progressions.score < 70) {
    messageScoreGlobal.textContent = "Belle progression, continue comme ça 🔥";
  } else if (progressions.score < 100) {
    messageScoreGlobal.textContent =
      "Tu es tout proche d’une journée parfaite ⚡";
  } else {
    messageScoreGlobal.textContent = "Journée parfaite, bravo 🏆";
  }

  resumeObjectifsAtteints.textContent =
    objectifsAtteints + " / 3 objectifs atteints";

  if (objectifsAtteints === 3) {
    resumeEncouragement.textContent =
      "Tous tes objectifs sont validés. Magnifique journée 👑";
  } else {
    const restants = 3 - objectifsAtteints;

    resumeEncouragement.textContent =
      "Encore " +
      restants +
      " objectif" +
      (restants > 1 ? "s" : "") +
      " à valider aujourd’hui.";
  }
}


// ======================================================
// 🔥 STREAK
// ======================================================

function mettreAJourStreak() {
  const compte = obtenirCompteActif();
  const aujourdHui = obtenirDateLocale();
  const hier = obtenirDateLocale(ajouterJours(new Date(), -1));

  if (objectifsComplets()) {
    if (compte.dernierJourStreak !== aujourdHui) {
      compte.streak =
        compte.dernierJourStreak === hier
          ? compte.streak + 1
          : 1;

      compte.dernierJourStreak = aujourdHui;
    }
  } else if (
    compte.dernierJourStreak !== null &&
    compte.dernierJourStreak !== aujourdHui &&
    compte.dernierJourStreak !== hier
  ) {
    compte.streak = 0;
  }

  streakJour.textContent =
    compte.streak +
    (compte.streak > 1 ? " jours 🔥" : " jour 🔥");

  if (compte.streak === 0) {
    messageStreak.textContent =
      "Atteins tes 3 objectifs pour commencer ta série 💪";
  } else if (compte.streak < 3) {
    messageStreak.textContent =
      "Ta série commence bien. Continue demain 🚀";
  } else if (compte.streak < 7) {
    messageStreak.textContent =
      "Très belle régularité, continue comme ça ⚡";
  } else {
    messageStreak.textContent =
      "Incroyable régularité, tu es lancé 🔥";
  }
}


// ======================================================
// 📈 HISTORIQUE
// ======================================================

function sauvegarderProgressionDuJour() {
  const compte = obtenirCompteActif();
  const aujourdHui = obtenirDateLocale();
  const progressions = obtenirProgressions();

  compte.historique[aujourdHui] = {
    eau: progressions.eau,
    pas: progressions.pas,
    repas: progressions.repas,
    calories: calculerProgressionCalories(compte),
    caloriesConsommees: Number(compte.caloriesConsommees) || 0,
    objectifCalories: Number(compte.objectifCalories) || 0,
    score: progressions.score,
  };

  const dates = Object.keys(compte.historique).sort();

  while (dates.length > 60) {
    const plusAncienneDate = dates.shift();
    delete compte.historique[plusAncienneDate];
  }
}

function obtenirSeptDerniersJours() {
  const jours = [];

  for (let i = -6; i <= 0; i += 1) {
    const date = ajouterJours(new Date(), i);

    jours.push({
      cle: obtenirDateLocale(date),
      label: date
        .toLocaleDateString("fr-FR", { weekday: "short" })
        .replace(".", "")
        .slice(0, 3),
    });
  }

  return jours;
}

function afficherGraphiqueSemaine() {
  const compte = obtenirCompteActif();
  const jours = obtenirSeptDerniersJours();

  graphiqueSemaine.innerHTML = "";

  let totalScore = 0;

  jours.forEach((jour) => {
    const donnees = compte.historique[jour.cle] || {
      eau: 0,
      pas: 0,
      repas: 0,
      score: 0,
    };

    totalScore += donnees.score;

    const conteneurJour = document.createElement("div");
    conteneurJour.classList.add("jour-graphique");

    const score = document.createElement("span");
    score.classList.add("jour-score");
    score.textContent = donnees.score + "%";

    const barresJour = document.createElement("div");
    barresJour.classList.add("barres-jour");

    ["eau", "pas", "repas"].forEach((type) => {
      const barre = document.createElement("div");

      barre.classList.add("barre-jour", type);
      barre.style.height = Math.max(donnees[type], 2) + "%";

      barresJour.appendChild(barre);
    });

    const label = document.createElement("span");
    label.classList.add("jour-label");
    label.textContent = jour.label;

    conteneurJour.appendChild(score);
    conteneurJour.appendChild(barresJour);
    conteneurJour.appendChild(label);

    graphiqueSemaine.appendChild(conteneurJour);
  });

  moyenneSemaine.textContent =
    "Moyenne : " + Math.round(totalScore / jours.length) + " %";
}


// ======================================================
// 🏅 BADGES
// ======================================================

const definitionsBadges = [
  {
    id: "premier-verre",
    icone: "💧",
    titre: "Premier verre",
    description: "Ajoute au moins un verre d’eau.",
    condition: () => obtenirCompteActif().verresEau >= 1,
  },
  {
    id: "hydratation",
    icone: "🌊",
    titre: "Hydratation parfaite",
    description: "Atteins ton objectif d’eau.",
    condition: () =>
      obtenirCompteActif().verresEau >= obtenirCompteActif().objectifEau,
  },
  {
    id: "marcheur",
    icone: "👟",
    titre: "En mouvement",
    description: "Atteins ton objectif de pas.",
    condition: () =>
      obtenirCompteActif().pasEffectues >= obtenirCompteActif().objectifPas,
  },
  {
    id: "nutrition",
    icone: "🥗",
    titre: "Journée équilibrée",
    description: "Valide tes 3 repas.",
    condition: () => compterRepasPris() >= objectifRepas,
  },
  {
    id: "journee-parfaite",
    icone: "🏆",
    titre: "Journée parfaite",
    description: "Atteins les 3 objectifs le même jour.",
    condition: () => objectifsComplets(),
  },
  {
    id: "streak-3",
    icone: "🔥",
    titre: "3 jours de feu",
    description: "Atteins une série de 3 jours.",
    condition: () => obtenirCompteActif().streak >= 3,
  },
  {
    id: "streak-7",
    icone: "⚡",
    titre: "Semaine solide",
    description: "Atteins une série de 7 jours.",
    condition: () => obtenirCompteActif().streak >= 7,
  },
  {
    id: "roue",
    icone: "🎡",
    titre: "Chance du jour",
    description: "Gagne une récompense à la roue.",
    condition: () => obtenirCompteActif().derniereRecompense !== null,
  },
];

function mettreAJourBadges() {
  const compte = obtenirCompteActif();

  definitionsBadges.forEach((badge) => {
    if (
      badge.condition() &&
      !compte.badgesDebloques.includes(badge.id)
    ) {
      compte.badgesDebloques.push(badge.id);
    }
  });

  badgesGrid.innerHTML = "";

  definitionsBadges.forEach((badge) => {
    const carte = document.createElement("div");
    carte.classList.add("badge-card");

    const estDebloque = compte.badgesDebloques.includes(badge.id);

    if (!estDebloque) {
      carte.classList.add("verrouille");
    }

    const icone = document.createElement("span");
    icone.classList.add("badge-icone");
    icone.textContent = estDebloque ? badge.icone : "🔒";

    const titre = document.createElement("h3");
    titre.textContent = badge.titre;

    const description = document.createElement("p");
    description.textContent = badge.description;

    carte.appendChild(icone);
    carte.appendChild(titre);
    carte.appendChild(description);

    badgesGrid.appendChild(carte);
  });

  compteurBadges.textContent =
    compte.badgesDebloques.length +
    " débloqué" +
    (compte.badgesDebloques.length > 1 ? "s" : "");
}


// ======================================================
// 🎡 ROUE DE RÉCOMPENSE
// ======================================================

let rotationRoue = 0;
let roueEnCours = false;

function roueDejaUtiliseeAujourdhui() {
  return obtenirCompteActif().dateDerniereRoue === obtenirDateLocale();
}

function mettreAJourRoue() {
  const compte = obtenirCompteActif();

  if (roueEnCours) {
    return;
  }

  if (roueDejaUtiliseeAujourdhui()) {
    boutonTournerRoue.disabled = true;
    etatRoue.textContent = "Déjà jouée";
    messageRoue.textContent =
      "Ta roue du jour a déjà été utilisée. Reviens demain 🎁";

    recompenseGagnee.textContent =
      compte.derniereRecompense !== null
        ? "Récompense du jour : " + compte.derniereRecompense
        : "Aucune récompense gagnée aujourd’hui.";

    return;
  }

  recompenseGagnee.textContent = "Aucune récompense gagnée aujourd’hui.";

  if (objectifsComplets()) {
    boutonTournerRoue.disabled = false;
    etatRoue.textContent = "Débloquée ✨";
    messageRoue.textContent =
      "Tes 3 objectifs sont atteints : ta récompense est prête !";
  } else {
    boutonTournerRoue.disabled = true;
    etatRoue.textContent = "À débloquer";
    messageRoue.textContent =
      "Atteins tes 3 objectifs pour débloquer la roue de récompense.";
  }
}

boutonTournerRoue.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  if (
    roueEnCours ||
    !objectifsComplets() ||
    roueDejaUtiliseeAujourdhui() ||
    compte.recompenses.length === 0
  ) {
    return;
  }

  roueEnCours = true;
  boutonTournerRoue.disabled = true;

  const indexGagnant =
    Math.floor(Math.random() * compte.recompenses.length);

  const angleParSegment = 360 / Math.max(compte.recompenses.length, 1);
  const tours = 5 + Math.floor(Math.random() * 3);
  const angleSegment = indexGagnant * angleParSegment + angleParSegment / 2;

  rotationRoue += tours * 360 + (360 - angleSegment);

  roueRecompense.style.transform = `rotate(${rotationRoue}deg)`;

  setTimeout(() => {
    const recompense = compte.recompenses[indexGagnant];

    compte.dateDerniereRoue = obtenirDateLocale();
    compte.derniereRecompense = recompense;

    recompenseGagnee.textContent = "🎁 Tu as gagné : " + recompense;

    roueEnCours = false;

    sauvegarderEtatApplication();
    mettreAJourRoue();
    mettreAJourBadges();
  }, 3700);
});


// ======================================================
// 🎁 RÉCOMPENSES PERSONNALISÉES
// ======================================================

function afficherRecompensesProfil() {
  const compte = obtenirCompteActif();

  listeRecompensesProfil.innerHTML = "";

  compteurRecompenses.textContent =
    compte.recompenses.length +
    " récompense" +
    (compte.recompenses.length > 1 ? "s" : "");

  compte.recompenses.forEach((recompense, index) => {
    const item = document.createElement("div");
    item.classList.add("recompense-profil-item");

    const texte = document.createElement("span");
    texte.textContent = recompense;

    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.textContent = "Supprimer";

    boutonSupprimer.addEventListener("click", () => {
      if (compte.recompenses.length <= 1) {
        messageRecompense.textContent =
          "⚠️ Garde au moins une récompense pour la roue.";
        return;
      }

      compte.recompenses.splice(index, 1);

      sauvegarderEtatApplication();

      messageRecompense.textContent = "✅ Récompense supprimée.";
      afficherRecompensesProfil();
    });

    item.appendChild(texte);
    item.appendChild(boutonSupprimer);

    listeRecompensesProfil.appendChild(item);
  });
}

boutonAjouterRecompense.addEventListener("click", () => {
  const compte = obtenirCompteActif();
  const nouvelleRecompense = inputNouvelleRecompense.value.trim();

  if (nouvelleRecompense === "") {
    messageRecompense.textContent =
      "⚠️ Écris une récompense avant de l’ajouter.";
    return;
  }

  const existeDeja = compte.recompenses.some(
    (recompense) =>
      recompense.toLowerCase() === nouvelleRecompense.toLowerCase(),
  );

  if (existeDeja) {
    messageRecompense.textContent =
      "⚠️ Cette récompense est déjà dans ta liste.";
    return;
  }

  compte.recompenses.push(nouvelleRecompense);

  inputNouvelleRecompense.value = "";
  messageRecompense.textContent = "✅ Récompense ajoutée.";

  sauvegarderEtatApplication();
  afficherRecompensesProfil();
});

inputNouvelleRecompense.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    boutonAjouterRecompense.click();
  }
});

boutonRestaurerRecompenses.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  compte.recompenses = [...recompensesParDefaut];

  sauvegarderEtatApplication();

  messageRecompense.textContent =
    "✅ Récompenses par défaut restaurées.";

  afficherRecompensesProfil();
});


// ======================================================
// 🥗 RECETTES & FAVORIS
// ======================================================

const recettes = [
  {
    nom: "Porridge banane cannelle",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 10,
    calories: 390,
    proteines: 15,
    ingredients: [
      "60 g de flocons d’avoine",
      "250 ml de lait",
      "1 banane",
      "1 c. à café de cannelle",
      "10 g d’amandes",
    ],
    preparation: [
      "Faire chauffer le lait avec les flocons.",
      "Cuire 5 minutes en remuant.",
      "Ajouter la banane en rondelles.",
      "Saupoudrer de cannelle et d’amandes.",
    ],
  },
  {
    nom: "Porridge pomme amande",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 12,
    calories: 405,
    proteines: 14,
    ingredients: [
      "60 g de flocons d’avoine",
      "250 ml de lait",
      "1 pomme",
      "15 g de purée d’amande",
      "Cannelle",
    ],
    preparation: [
      "Cuire les flocons dans le lait.",
      "Couper la pomme en dés.",
      "Ajouter la pomme et la cannelle.",
      "Terminer avec la purée d’amande.",
    ],
  },
  {
    nom: "Overnight oats fruits rouges",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 5,
    calories: 380,
    proteines: 18,
    ingredients: [
      "55 g de flocons d’avoine",
      "150 g de skyr",
      "100 ml de lait",
      "100 g de fruits rouges",
      "1 c. à café de miel",
    ],
    preparation: [
      "Mélanger avoine, skyr et lait.",
      "Ajouter les fruits rouges.",
      "Réserver une nuit au frais.",
      "Ajouter le miel au moment de servir.",
    ],
  },
  {
    nom: "Pancakes banane protéinés",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 15,
    calories: 420,
    proteines: 28,
    ingredients: [
      "1 banane",
      "2 œufs",
      "50 g de flocons d’avoine mixés",
      "80 g de skyr",
      "1 pincée de levure",
    ],
    preparation: [
      "Écraser la banane.",
      "Mélanger avec les œufs et l’avoine.",
      "Cuire de petits pancakes à la poêle.",
      "Servir avec le skyr.",
    ],
  },
  {
    nom: "Pancakes myrtilles skyr",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 18,
    calories: 430,
    proteines: 27,
    ingredients: [
      "60 g de farine d’avoine",
      "1 œuf",
      "100 g de skyr",
      "80 g de myrtilles",
      "1 c. à café de levure",
    ],
    preparation: [
      "Mélanger les ingrédients sauf les myrtilles.",
      "Ajouter les myrtilles.",
      "Cuire à feu moyen.",
      "Servir chaud.",
    ],
  },
  {
    nom: "Tartines avocat œufs",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 12,
    calories: 430,
    proteines: 22,
    ingredients: [
      "2 tranches de pain complet",
      "1/2 avocat",
      "2 œufs",
      "Jus de citron",
      "Poivre",
    ],
    preparation: [
      "Faire griller le pain.",
      "Écraser l’avocat avec le citron.",
      "Cuire les œufs.",
      "Déposer les œufs sur les tartines.",
    ],
  },
  {
    nom: "Omelette épinards feta",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 12,
    calories: 350,
    proteines: 27,
    ingredients: [
      "3 œufs",
      "60 g d’épinards",
      "35 g de feta",
      "Tomates cerises",
      "Poivre",
    ],
    preparation: [
      "Faire tomber les épinards.",
      "Battre les œufs.",
      "Ajouter la feta et les tomates.",
      "Cuire l’omelette à feu doux.",
    ],
  },
  {
    nom: "Omelette champignons fromage",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 15,
    calories: 370,
    proteines: 30,
    ingredients: [
      "3 œufs",
      "100 g de champignons",
      "40 g de fromage léger",
      "Persil",
      "Poivre",
    ],
    preparation: [
      "Faire revenir les champignons.",
      "Ajouter les œufs battus.",
      "Parsemer de fromage.",
      "Plier puis servir.",
    ],
  },
  {
    nom: "Bowl skyr granola fruits",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 5,
    calories: 360,
    proteines: 25,
    ingredients: [
      "200 g de skyr",
      "35 g de granola",
      "1 kiwi",
      "1/2 banane",
      "10 g de graines de chia",
    ],
    preparation: [
      "Verser le skyr dans un bol.",
      "Ajouter les fruits coupés.",
      "Ajouter le granola.",
      "Parsemer de chia.",
    ],
  },
  {
    nom: "Chia pudding mangue coco",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 5,
    calories: 340,
    proteines: 12,
    ingredients: [
      "30 g de graines de chia",
      "220 ml de lait",
      "120 g de mangue",
      "10 g de noix de coco râpée",
      "Vanille",
    ],
    preparation: [
      "Mélanger chia, lait et vanille.",
      "Réserver au frais au moins 3 heures.",
      "Ajouter la mangue.",
      "Parsemer de coco.",
    ],
  },
  {
    nom: "French toast léger",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 15,
    calories: 410,
    proteines: 24,
    ingredients: [
      "2 grandes tranches de pain complet",
      "2 œufs",
      "80 ml de lait",
      "Cannelle",
      "100 g de fruits rouges",
    ],
    preparation: [
      "Battre œufs, lait et cannelle.",
      "Tremper le pain.",
      "Dorer à la poêle.",
      "Servir avec les fruits rouges.",
    ],
  },
  {
    nom: "Breakfast burrito œufs haricots",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 20,
    calories: 510,
    proteines: 29,
    ingredients: [
      "1 tortilla complète",
      "2 œufs",
      "80 g de haricots rouges",
      "40 g de maïs",
      "30 g de fromage râpé",
      "Salsa",
    ],
    preparation: [
      "Brouiller les œufs.",
      "Réchauffer haricots et maïs.",
      "Garnir la tortilla.",
      "Rouler et faire dorer rapidement.",
    ],
  },
  {
    nom: "Toast ricotta miel poire",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 8,
    calories: 355,
    proteines: 17,
    ingredients: [
      "2 tranches de pain complet",
      "80 g de ricotta",
      "1 petite poire",
      "1 c. à café de miel",
      "Cannelle",
    ],
    preparation: [
      "Griller le pain.",
      "Tartiner de ricotta.",
      "Ajouter la poire en lamelles.",
      "Finir avec miel et cannelle.",
    ],
  },
  {
    nom: "Smoothie bowl banane cacao",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 8,
    calories: 400,
    proteines: 20,
    ingredients: [
      "1 banane congelée",
      "150 g de skyr",
      "1 c. à soupe de cacao",
      "25 g de flocons d’avoine",
      "10 g de noisettes",
    ],
    preparation: [
      "Mixer banane, skyr et cacao.",
      "Verser dans un bol.",
      "Ajouter l’avoine.",
      "Parsemer de noisettes.",
    ],
  },
  {
    nom: "Muesli maison yaourt pomme",
    categorie: "Petit-déjeuner",
    typeRepas: "Petit-déjeuner",
    temps: 5,
    calories: 385,
    proteines: 19,
    ingredients: [
      "50 g de muesli sans sucre",
      "180 g de yaourt grec léger",
      "1 pomme",
      "10 g de noix",
      "Cannelle",
    ],
    preparation: [
      "Mettre le yaourt dans un bol.",
      "Ajouter le muesli.",
      "Ajouter la pomme en dés.",
      "Finir avec noix et cannelle.",
    ],
  },
  {
    nom: "Salade poulet avocat",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 20,
    calories: 450,
    proteines: 35,
    ingredients: [
      "150 g de poulet",
      "1/2 avocat",
      "100 g de salade",
      "1 tomate",
      "1 c. à soupe d’huile d’olive",
    ],
    preparation: [
      "Cuire le poulet.",
      "Couper l’avocat et la tomate.",
      "Assembler avec la salade.",
      "Assaisonner avec l’huile d’olive.",
    ],
  },
  {
    nom: "Bowl poulet quinoa",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 30,
    calories: 485,
    proteines: 39,
    ingredients: [
      "150 g de poulet",
      "80 g de quinoa",
      "1/2 concombre",
      "Tomates cerises",
      "1 c. à café d’huile d’olive",
    ],
    preparation: [
      "Cuire le quinoa.",
      "Cuire puis couper le poulet.",
      "Couper les légumes.",
      "Assembler et assaisonner.",
    ],
  },
  {
    nom: "Poulet curry coco léger",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 30,
    calories: 520,
    proteines: 42,
    ingredients: [
      "160 g de poulet",
      "100 ml de lait de coco léger",
      "100 g de riz cuit",
      "Curry",
      "Courgette",
      "Oignon",
    ],
    preparation: [
      "Faire revenir l’oignon et le poulet.",
      "Ajouter curry et courgette.",
      "Verser le lait de coco.",
      "Servir avec le riz.",
    ],
  },
  {
    nom: "Poulet citron herbes et boulgour",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 28,
    calories: 470,
    proteines: 41,
    ingredients: [
      "160 g de poulet",
      "80 g de boulgour",
      "1 citron",
      "Herbes de Provence",
      "Courgette",
    ],
    preparation: [
      "Cuire le boulgour.",
      "Assaisonner le poulet au citron et aux herbes.",
      "Cuire le poulet et la courgette.",
      "Servir ensemble.",
    ],
  },
  {
    nom: "Poulet paprika patate douce",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 35,
    calories: 510,
    proteines: 40,
    ingredients: [
      "160 g de poulet",
      "250 g de patate douce",
      "Paprika",
      "Brocoli",
      "1 c. à café d’huile",
    ],
    preparation: [
      "Couper la patate douce.",
      "Cuire au four avec paprika.",
      "Cuire le poulet et le brocoli.",
      "Assembler.",
    ],
  },
  {
    nom: "Wrap poulet crudités",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 15,
    calories: 430,
    proteines: 36,
    ingredients: [
      "1 grande tortilla complète",
      "140 g de poulet",
      "Salade",
      "Tomate",
      "Concombre",
      "Sauce yaourt",
    ],
    preparation: [
      "Cuire et émincer le poulet.",
      "Préparer les crudités.",
      "Garnir la tortilla.",
      "Ajouter la sauce puis rouler.",
    ],
  },
  {
    nom: "Poulet teriyaki maison",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 500,
    proteines: 41,
    ingredients: [
      "160 g de poulet",
      "100 g de riz cuit",
      "Brocoli",
      "1 c. à soupe de sauce soja",
      "1 c. à café de miel",
      "Gingembre",
    ],
    preparation: [
      "Cuire le riz.",
      "Saisir le poulet.",
      "Ajouter soja, miel et gingembre.",
      "Servir avec le brocoli et le riz.",
    ],
  },
  {
    nom: "Dinde tomate mozzarella",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 440,
    proteines: 46,
    ingredients: [
      "160 g d’escalope de dinde",
      "1 tomate",
      "60 g de mozzarella légère",
      "Basilic",
      "Haricots verts",
    ],
    preparation: [
      "Cuire la dinde.",
      "Ajouter tomate et mozzarella.",
      "Couvrir quelques minutes.",
      "Servir avec les haricots verts.",
    ],
  },
  {
    nom: "Boulettes de dinde sauce tomate",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 35,
    calories: 490,
    proteines: 43,
    ingredients: [
      "170 g de dinde hachée",
      "200 g de sauce tomate",
      "80 g de pâtes complètes",
      "Ail",
      "Persil",
    ],
    preparation: [
      "Former les boulettes.",
      "Les faire dorer.",
      "Ajouter la sauce tomate.",
      "Servir avec les pâtes.",
    ],
  },
  {
    nom: "Poulet fajitas",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 530,
    proteines: 40,
    ingredients: [
      "150 g de poulet",
      "2 petites tortillas",
      "Poivron",
      "Oignon",
      "Épices fajitas",
      "Salsa",
    ],
    preparation: [
      "Émincer poulet et légumes.",
      "Faire revenir avec les épices.",
      "Réchauffer les tortillas.",
      "Garnir avec salsa.",
    ],
  },
  {
    nom: "Poulet tikka express",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 30,
    calories: 505,
    proteines: 44,
    ingredients: [
      "160 g de poulet",
      "100 g de yaourt nature",
      "Épices tikka",
      "100 g de riz basmati cuit",
      "Tomate concassée",
    ],
    preparation: [
      "Mariner rapidement le poulet dans le yaourt et les épices.",
      "Saisir le poulet.",
      "Ajouter la tomate.",
      "Servir avec le riz.",
    ],
  },
  {
    nom: "Salade César légère",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 20,
    calories: 430,
    proteines: 39,
    ingredients: [
      "150 g de poulet",
      "Salade romaine",
      "20 g de parmesan",
      "30 g de croûtons",
      "Sauce au yaourt",
      "Citron",
    ],
    preparation: [
      "Cuire le poulet.",
      "Couper la salade.",
      "Assembler avec parmesan et croûtons.",
      "Ajouter la sauce légère.",
    ],
  },
  {
    nom: "Poulet moutarde champignons",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 460,
    proteines: 43,
    ingredients: [
      "160 g de poulet",
      "120 g de champignons",
      "1 c. à soupe de moutarde",
      "60 ml de crème légère",
      "120 g de pommes de terre",
    ],
    preparation: [
      "Cuire les pommes de terre.",
      "Saisir le poulet et les champignons.",
      "Ajouter moutarde et crème.",
      "Servir ensemble.",
    ],
  },
  {
    nom: "Dinde courgette semoule",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 455,
    proteines: 40,
    ingredients: [
      "160 g de dinde",
      "80 g de semoule",
      "1 courgette",
      "Cumin",
      "Citron",
    ],
    preparation: [
      "Préparer la semoule.",
      "Cuire la dinde avec le cumin.",
      "Ajouter la courgette.",
      "Servir avec un filet de citron.",
    ],
  },
  {
    nom: "Poulet pesto tomates",
    categorie: "Poulet & dinde",
    typeRepas: "Plat",
    temps: 25,
    calories: 480,
    proteines: 42,
    ingredients: [
      "160 g de poulet",
      "1 c. à soupe de pesto",
      "Tomates cerises",
      "80 g de pâtes complètes",
      "Roquette",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Saisir le poulet.",
      "Ajouter pesto et tomates.",
      "Mélanger avec les pâtes et la roquette.",
    ],
  },
  {
    nom: "Pâtes au saumon",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 25,
    calories: 520,
    proteines: 32,
    ingredients: [
      "100 g de pâtes",
      "120 g de saumon",
      "50 ml de crème légère",
      "Épinards",
      "Poivre",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Cuire le saumon.",
      "Ajouter épinards et crème.",
      "Mélanger avec les pâtes.",
    ],
  },
  {
    nom: "Saumon four brocoli riz",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 30,
    calories: 540,
    proteines: 40,
    ingredients: [
      "150 g de saumon",
      "100 g de riz cuit",
      "150 g de brocoli",
      "Citron",
      "Aneth",
    ],
    preparation: [
      "Cuire le saumon au four avec citron et aneth.",
      "Cuire le riz.",
      "Cuire le brocoli vapeur.",
      "Servir ensemble.",
    ],
  },
  {
    nom: "Cabillaud tomate olives",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 30,
    calories: 430,
    proteines: 39,
    ingredients: [
      "170 g de cabillaud",
      "200 g de tomates concassées",
      "30 g d’olives",
      "Courgette",
      "Herbes",
    ],
    preparation: [
      "Déposer le poisson dans un plat.",
      "Ajouter tomate, olives et courgette.",
      "Assaisonner.",
      "Cuire au four.",
    ],
  },
  {
    nom: "Tacos poisson sauce yaourt",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 25,
    calories: 480,
    proteines: 35,
    ingredients: [
      "150 g de poisson blanc",
      "2 petites tortillas",
      "Chou rouge",
      "Tomate",
      "Sauce yaourt citron",
      "Paprika",
    ],
    preparation: [
      "Assaisonner et cuire le poisson.",
      "Préparer le chou et la tomate.",
      "Garnir les tortillas.",
      "Ajouter la sauce.",
    ],
  },
  {
    nom: "Crevettes ail citron quinoa",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 20,
    calories: 450,
    proteines: 35,
    ingredients: [
      "160 g de crevettes",
      "80 g de quinoa",
      "Ail",
      "Citron",
      "Courgette",
    ],
    preparation: [
      "Cuire le quinoa.",
      "Sauter les crevettes avec l’ail.",
      "Ajouter la courgette.",
      "Finir au citron.",
    ],
  },
  {
    nom: "Bowl thon riz avocat",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 15,
    calories: 510,
    proteines: 36,
    ingredients: [
      "120 g de thon au naturel",
      "100 g de riz cuit",
      "1/2 avocat",
      "Concombre",
      "Carotte",
      "Sauce soja",
    ],
    preparation: [
      "Mettre le riz dans un bol.",
      "Ajouter thon et légumes.",
      "Ajouter l’avocat.",
      "Assaisonner avec un peu de soja.",
    ],
  },
  {
    nom: "Salade thon haricots blancs",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 12,
    calories: 410,
    proteines: 34,
    ingredients: [
      "120 g de thon",
      "120 g de haricots blancs",
      "Tomate",
      "Oignon rouge",
      "Persil",
      "Citron",
    ],
    preparation: [
      "Égoutter thon et haricots.",
      "Couper les légumes.",
      "Mélanger.",
      "Assaisonner au citron.",
    ],
  },
  {
    nom: "Saumon teriyaki légumes",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 25,
    calories: 530,
    proteines: 38,
    ingredients: [
      "150 g de saumon",
      "Brocoli",
      "Carotte",
      "100 g de riz cuit",
      "Sauce soja",
      "1 c. à café de miel",
    ],
    preparation: [
      "Cuire le saumon.",
      "Ajouter soja et miel.",
      "Sauter les légumes.",
      "Servir avec le riz.",
    ],
  },
  {
    nom: "Colin citron pommes de terre",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 30,
    calories: 440,
    proteines: 38,
    ingredients: [
      "170 g de colin",
      "220 g de pommes de terre",
      "Haricots verts",
      "Citron",
      "Persil",
    ],
    preparation: [
      "Cuire les pommes de terre.",
      "Cuire le colin à la poêle.",
      "Cuire les haricots verts.",
      "Servir avec citron et persil.",
    ],
  },
  {
    nom: "Curry de crevettes léger",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 25,
    calories: 490,
    proteines: 34,
    ingredients: [
      "160 g de crevettes",
      "100 ml de lait de coco léger",
      "100 g de riz cuit",
      "Curry",
      "Épinards",
    ],
    preparation: [
      "Cuire le riz.",
      "Faire revenir les crevettes.",
      "Ajouter curry, coco et épinards.",
      "Servir avec le riz.",
    ],
  },
  {
    nom: "Papillote saumon courgettes",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 30,
    calories: 460,
    proteines: 39,
    ingredients: [
      "150 g de saumon",
      "1 courgette",
      "Tomates cerises",
      "Citron",
      "Herbes",
    ],
    preparation: [
      "Déposer le saumon sur du papier cuisson.",
      "Ajouter légumes et citron.",
      "Fermer la papillote.",
      "Cuire au four.",
    ],
  },
  {
    nom: "Poke bowl crevettes mangue",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 20,
    calories: 500,
    proteines: 31,
    ingredients: [
      "150 g de crevettes",
      "100 g de riz cuit",
      "100 g de mangue",
      "Concombre",
      "Edamame",
      "Citron vert",
    ],
    preparation: [
      "Cuire ou réchauffer le riz.",
      "Cuire les crevettes.",
      "Couper mangue et concombre.",
      "Assembler avec edamame et citron vert.",
    ],
  },
  {
    nom: "Rillettes de thon légères",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 10,
    calories: 330,
    proteines: 32,
    ingredients: [
      "120 g de thon",
      "100 g de fromage blanc",
      "Citron",
      "Ciboulette",
      "2 tranches de pain complet",
    ],
    preparation: [
      "Égoutter le thon.",
      "Mélanger avec fromage blanc.",
      "Ajouter citron et ciboulette.",
      "Servir sur le pain grillé.",
    ],
  },
  {
    nom: "Sardines tomate pain complet",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 10,
    calories: 420,
    proteines: 29,
    ingredients: [
      "1 boîte de sardines au naturel",
      "2 tranches de pain complet",
      "Tomate",
      "Roquette",
      "Citron",
    ],
    preparation: [
      "Griller le pain.",
      "Ajouter tomate et roquette.",
      "Déposer les sardines.",
      "Arroser de citron.",
    ],
  },
  {
    nom: "Nouilles crevettes légumes",
    categorie: "Poisson",
    typeRepas: "Plat",
    temps: 25,
    calories: 510,
    proteines: 33,
    ingredients: [
      "160 g de crevettes",
      "90 g de nouilles",
      "Poivron",
      "Carotte",
      "Sauce soja",
      "Gingembre",
    ],
    preparation: [
      "Cuire les nouilles.",
      "Sauter crevettes et légumes.",
      "Ajouter soja et gingembre.",
      "Mélanger avec les nouilles.",
    ],
  },
  {
    nom: "Omelette protéinée",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 15,
    calories: 360,
    proteines: 31,
    ingredients: [
      "3 œufs",
      "50 g d’épinards",
      "40 g de fromage léger",
      "Tomates",
      "Poivre",
    ],
    preparation: [
      "Battre les œufs.",
      "Faire revenir les épinards.",
      "Ajouter les œufs.",
      "Ajouter fromage et tomates puis cuire.",
    ],
  },
  {
    nom: "Curry pois chiches épinards",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 25,
    calories: 470,
    proteines: 20,
    ingredients: [
      "160 g de pois chiches",
      "100 g d’épinards",
      "200 g de tomates concassées",
      "Curry",
      "100 ml de lait de coco léger",
    ],
    preparation: [
      "Faire revenir les épices.",
      "Ajouter tomate et pois chiches.",
      "Ajouter lait de coco.",
      "Finir avec les épinards.",
    ],
  },
  {
    nom: "Dahl lentilles corail",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 30,
    calories: 450,
    proteines: 22,
    ingredients: [
      "100 g de lentilles corail",
      "200 g de tomates concassées",
      "Oignon",
      "Curry",
      "Épinards",
    ],
    preparation: [
      "Faire revenir l’oignon.",
      "Ajouter lentilles, tomate et épices.",
      "Ajouter de l’eau et mijoter.",
      "Ajouter les épinards.",
    ],
  },
  {
    nom: "Buddha bowl tofu quinoa",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 30,
    calories: 500,
    proteines: 28,
    ingredients: [
      "150 g de tofu",
      "80 g de quinoa",
      "Carotte",
      "Concombre",
      "Brocoli",
      "Sauce soja",
    ],
    preparation: [
      "Cuire le quinoa.",
      "Faire dorer le tofu.",
      "Cuire le brocoli.",
      "Assembler avec les crudités et la sauce soja.",
    ],
  },
  {
    nom: "Tofu sauté légumes",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 20,
    calories: 420,
    proteines: 27,
    ingredients: [
      "160 g de tofu",
      "Poivron",
      "Courgette",
      "Carotte",
      "Sauce soja",
      "Gingembre",
    ],
    preparation: [
      "Couper le tofu et les légumes.",
      "Faire dorer le tofu.",
      "Ajouter les légumes.",
      "Assaisonner avec soja et gingembre.",
    ],
  },
  {
    nom: "Chili sin carne",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 35,
    calories: 490,
    proteines: 24,
    ingredients: [
      "150 g de haricots rouges",
      "100 g de maïs",
      "200 g de tomates",
      "Poivron",
      "Oignon",
      "Cumin",
    ],
    preparation: [
      "Faire revenir oignon et poivron.",
      "Ajouter tomate, haricots et maïs.",
      "Assaisonner.",
      "Mijoter 20 minutes.",
    ],
  },
  {
    nom: "Lasagnes courgette ricotta",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 45,
    calories: 520,
    proteines: 28,
    ingredients: [
      "Feuilles de lasagnes",
      "1 courgette",
      "150 g de ricotta",
      "Sauce tomate",
      "30 g de parmesan",
    ],
    preparation: [
      "Couper la courgette.",
      "Alterner lasagnes, sauce, courgette et ricotta.",
      "Ajouter parmesan.",
      "Cuire au four.",
    ],
  },
  {
    nom: "Quiche épinards feta légère",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 40,
    calories: 430,
    proteines: 25,
    ingredients: [
      "1 pâte légère",
      "3 œufs",
      "150 g d’épinards",
      "80 g de feta",
      "100 ml de lait",
    ],
    preparation: [
      "Faire tomber les épinards.",
      "Battre œufs et lait.",
      "Ajouter feta et épinards.",
      "Verser sur la pâte puis cuire.",
    ],
  },
  {
    nom: "Galettes lentilles carottes",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 30,
    calories: 410,
    proteines: 21,
    ingredients: [
      "160 g de lentilles cuites",
      "1 carotte",
      "1 œuf",
      "30 g de flocons d’avoine",
      "Cumin",
    ],
    preparation: [
      "Écraser les lentilles.",
      "Ajouter carotte râpée, œuf et avoine.",
      "Former des galettes.",
      "Cuire à la poêle.",
    ],
  },
  {
    nom: "Falafels au four",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 35,
    calories: 440,
    proteines: 19,
    ingredients: [
      "180 g de pois chiches",
      "Ail",
      "Persil",
      "Cumin",
      "1 c. à soupe de farine",
      "Sauce yaourt",
    ],
    preparation: [
      "Mixer pois chiches et aromates.",
      "Former des boules.",
      "Cuire au four.",
      "Servir avec sauce yaourt.",
    ],
  },
  {
    nom: "Wrap houmous légumes grillés",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 20,
    calories: 420,
    proteines: 15,
    ingredients: [
      "1 tortilla complète",
      "60 g de houmous",
      "Courgette",
      "Poivron",
      "Roquette",
    ],
    preparation: [
      "Griller les légumes.",
      "Tartiner la tortilla de houmous.",
      "Ajouter légumes et roquette.",
      "Rouler.",
    ],
  },
  {
    nom: "Poivrons farcis quinoa feta",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 40,
    calories: 455,
    proteines: 20,
    ingredients: [
      "2 demi-poivrons",
      "80 g de quinoa",
      "70 g de feta",
      "Tomate",
      "Herbes",
    ],
    preparation: [
      "Cuire le quinoa.",
      "Mélanger avec tomate et feta.",
      "Farcir les poivrons.",
      "Cuire au four.",
    ],
  },
  {
    nom: "Aubergine rôtie pois chiches",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 35,
    calories: 430,
    proteines: 18,
    ingredients: [
      "1 aubergine",
      "140 g de pois chiches",
      "Tomates cerises",
      "Tahini",
      "Citron",
    ],
    preparation: [
      "Rôtir l’aubergine.",
      "Faire dorer les pois chiches.",
      "Ajouter les tomates.",
      "Servir avec tahini citronné.",
    ],
  },
  {
    nom: "Risotto champignons léger",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 35,
    calories: 480,
    proteines: 16,
    ingredients: [
      "90 g de riz arborio",
      "150 g de champignons",
      "Bouillon",
      "30 g de parmesan",
      "Oignon",
    ],
    preparation: [
      "Faire revenir oignon et riz.",
      "Ajouter le bouillon progressivement.",
      "Ajouter les champignons.",
      "Terminer avec le parmesan.",
    ],
  },
  {
    nom: "Gnocchis tomate mozzarella",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 25,
    calories: 530,
    proteines: 22,
    ingredients: [
      "180 g de gnocchis",
      "180 g de sauce tomate",
      "60 g de mozzarella légère",
      "Basilic",
      "Épinards",
    ],
    preparation: [
      "Cuire les gnocchis.",
      "Ajouter la sauce tomate.",
      "Ajouter épinards et mozzarella.",
      "Laisser fondre puis servir.",
    ],
  },
  {
    nom: "Shakshuka",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 25,
    calories: 390,
    proteines: 24,
    ingredients: [
      "3 œufs",
      "250 g de tomates concassées",
      "Poivron",
      "Oignon",
      "Cumin",
      "Paprika",
    ],
    preparation: [
      "Faire revenir oignon et poivron.",
      "Ajouter tomate et épices.",
      "Former trois creux.",
      "Casser les œufs et cuire à couvert.",
    ],
  },
  {
    nom: "Salade lentilles feta",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 15,
    calories: 430,
    proteines: 22,
    ingredients: [
      "160 g de lentilles cuites",
      "60 g de feta",
      "Concombre",
      "Tomates cerises",
      "Persil",
      "Citron",
    ],
    preparation: [
      "Égoutter les lentilles.",
      "Couper les légumes.",
      "Ajouter feta et persil.",
      "Assaisonner au citron.",
    ],
  },
  {
    nom: "Bowl œufs patate douce",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 30,
    calories: 460,
    proteines: 23,
    ingredients: [
      "2 œufs",
      "220 g de patate douce",
      "Épinards",
      "1/2 avocat",
      "Paprika",
    ],
    preparation: [
      "Rôtir la patate douce.",
      "Cuire les œufs.",
      "Faire tomber les épinards.",
      "Assembler avec l’avocat.",
    ],
  },
  {
    nom: "Croque végétarien mozzarella tomate",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 15,
    calories: 420,
    proteines: 24,
    ingredients: [
      "4 petites tranches de pain complet",
      "80 g de mozzarella légère",
      "1 tomate",
      "Épinards",
      "Moutarde",
    ],
    preparation: [
      "Tartiner légèrement de moutarde.",
      "Ajouter tomate, mozzarella et épinards.",
      "Refermer.",
      "Faire griller.",
    ],
  },
  {
    nom: "Nouilles tofu cacahuète",
    categorie: "Végétarien",
    typeRepas: "Plat",
    temps: 25,
    calories: 520,
    proteines: 29,
    ingredients: [
      "150 g de tofu",
      "90 g de nouilles",
      "Carotte",
      "Concombre",
      "15 g de beurre de cacahuète",
      "Sauce soja",
    ],
    preparation: [
      "Cuire les nouilles.",
      "Faire dorer le tofu.",
      "Mélanger cacahuète et soja avec un peu d’eau.",
      "Assembler avec les légumes.",
    ],
  },
  {
    nom: "Bœuf sauté brocoli",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 20,
    calories: 490,
    proteines: 42,
    ingredients: [
      "150 g de bœuf maigre",
      "180 g de brocoli",
      "100 g de riz cuit",
      "Sauce soja",
      "Gingembre",
    ],
    preparation: [
      "Cuire le riz.",
      "Saisir le bœuf.",
      "Ajouter brocoli et gingembre.",
      "Ajouter un peu de sauce soja.",
    ],
  },
  {
    nom: "Chili con carne léger",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 35,
    calories: 520,
    proteines: 40,
    ingredients: [
      "150 g de bœuf maigre haché",
      "120 g de haricots rouges",
      "200 g de tomates",
      "Maïs",
      "Cumin",
    ],
    preparation: [
      "Faire revenir le bœuf.",
      "Ajouter tomate et épices.",
      "Ajouter haricots et maïs.",
      "Mijoter.",
    ],
  },
  {
    nom: "Boulettes bœuf tomate",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 35,
    calories: 510,
    proteines: 39,
    ingredients: [
      "160 g de bœuf maigre",
      "200 g de sauce tomate",
      "80 g de spaghetti complets",
      "Ail",
      "Persil",
    ],
    preparation: [
      "Former des boulettes.",
      "Les faire dorer.",
      "Ajouter la sauce.",
      "Servir avec les spaghetti.",
    ],
  },
  {
    nom: "Steak patate douce haricots verts",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 30,
    calories: 500,
    proteines: 43,
    ingredients: [
      "160 g de steak maigre",
      "220 g de patate douce",
      "150 g de haricots verts",
      "Paprika",
    ],
    preparation: [
      "Rôtir la patate douce.",
      "Cuire les haricots.",
      "Cuire le steak selon la cuisson désirée.",
      "Servir ensemble.",
    ],
  },
  {
    nom: "Bœuf fajitas",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 25,
    calories: 540,
    proteines: 39,
    ingredients: [
      "150 g de bœuf émincé",
      "2 petites tortillas",
      "Poivron",
      "Oignon",
      "Épices mexicaines",
    ],
    preparation: [
      "Faire revenir bœuf, poivron et oignon.",
      "Ajouter les épices.",
      "Réchauffer les tortillas.",
      "Garnir.",
    ],
  },
  {
    nom: "Porc miel moutarde léger",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 30,
    calories: 500,
    proteines: 42,
    ingredients: [
      "160 g de filet mignon",
      "1 c. à café de miel",
      "1 c. à soupe de moutarde",
      "Carottes",
      "120 g de pommes de terre",
    ],
    preparation: [
      "Cuire les pommes de terre.",
      "Saisir le porc.",
      "Ajouter miel et moutarde.",
      "Servir avec les carottes.",
    ],
  },
  {
    nom: "Bowl bœuf mexicain",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 25,
    calories: 520,
    proteines: 40,
    ingredients: [
      "150 g de bœuf haché maigre",
      "100 g de riz cuit",
      "Haricots rouges",
      "Maïs",
      "Tomate",
      "Salsa",
    ],
    preparation: [
      "Cuire le bœuf avec des épices.",
      "Préparer riz et légumes.",
      "Assembler dans un bol.",
      "Ajouter la salsa.",
    ],
  },
  {
    nom: "Burger maison léger",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 25,
    calories: 560,
    proteines: 42,
    ingredients: [
      "1 pain burger complet",
      "150 g de steak haché 5 %",
      "Tomate",
      "Salade",
      "Oignon",
      "30 g de fromage léger",
    ],
    preparation: [
      "Cuire le steak.",
      "Griller légèrement le pain.",
      "Ajouter salade, tomate et oignon.",
      "Assembler avec le fromage.",
    ],
  },
  {
    nom: "Bœuf carottes façon wok",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 25,
    calories: 470,
    proteines: 40,
    ingredients: [
      "150 g de bœuf émincé",
      "2 carottes",
      "Courgette",
      "80 g de nouilles",
      "Sauce soja",
    ],
    preparation: [
      "Cuire les nouilles.",
      "Saisir le bœuf.",
      "Ajouter les légumes.",
      "Mélanger avec les nouilles et la sauce soja.",
    ],
  },
  {
    nom: "Porc paprika courgettes",
    categorie: "Viande",
    typeRepas: "Plat",
    temps: 25,
    calories: 455,
    proteines: 41,
    ingredients: [
      "160 g de filet de porc",
      "1 courgette",
      "80 g de semoule",
      "Paprika",
      "Citron",
    ],
    preparation: [
      "Préparer la semoule.",
      "Saisir le porc avec paprika.",
      "Ajouter la courgette.",
      "Servir avec citron.",
    ],
  },
  {
    nom: "Pâtes poulet tomates épinards",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 25,
    calories: 520,
    proteines: 40,
    ingredients: [
      "90 g de pâtes complètes",
      "140 g de poulet",
      "Tomates cerises",
      "Épinards",
      "Ail",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Cuire le poulet.",
      "Ajouter tomates et épinards.",
      "Mélanger avec les pâtes.",
    ],
  },
  {
    nom: "Pâtes pesto courgette",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 20,
    calories: 480,
    proteines: 18,
    ingredients: [
      "90 g de pâtes",
      "1 courgette",
      "1 c. à soupe de pesto",
      "20 g de parmesan",
      "Roquette",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Sauter la courgette.",
      "Ajouter pesto.",
      "Mélanger et finir avec parmesan.",
    ],
  },
  {
    nom: "Pâtes thon tomate",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 20,
    calories: 490,
    proteines: 35,
    ingredients: [
      "90 g de pâtes complètes",
      "120 g de thon",
      "180 g de sauce tomate",
      "Olives",
      "Basilic",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Chauffer la sauce tomate.",
      "Ajouter thon et olives.",
      "Mélanger avec les pâtes.",
    ],
  },
  {
    nom: "Riz cantonais léger",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 20,
    calories: 470,
    proteines: 26,
    ingredients: [
      "120 g de riz cuit",
      "2 œufs",
      "80 g de petits pois",
      "60 g de jambon",
      "Carotte",
      "Sauce soja",
    ],
    preparation: [
      "Cuire les œufs brouillés.",
      "Ajouter riz et légumes.",
      "Ajouter le jambon.",
      "Assaisonner légèrement au soja.",
    ],
  },
  {
    nom: "Riz poulet curry légumes",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 25,
    calories: 510,
    proteines: 39,
    ingredients: [
      "100 g de riz cuit",
      "150 g de poulet",
      "Courgette",
      "Carotte",
      "Curry",
      "Yaourt nature",
    ],
    preparation: [
      "Cuire le poulet.",
      "Ajouter légumes et curry.",
      "Ajouter une cuillère de yaourt.",
      "Servir avec le riz.",
    ],
  },
  {
    nom: "Riz saumon épinards",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 25,
    calories: 525,
    proteines: 37,
    ingredients: [
      "100 g de riz cuit",
      "140 g de saumon",
      "100 g d’épinards",
      "Citron",
      "Poivre",
    ],
    preparation: [
      "Cuire le saumon.",
      "Faire tomber les épinards.",
      "Réchauffer le riz.",
      "Assembler avec citron.",
    ],
  },
  {
    nom: "Orzo tomate feta",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 25,
    calories: 470,
    proteines: 20,
    ingredients: [
      "90 g d’orzo",
      "180 g de tomates",
      "60 g de feta",
      "Épinards",
      "Basilic",
    ],
    preparation: [
      "Cuire l’orzo.",
      "Faire compoter les tomates.",
      "Ajouter épinards et feta.",
      "Mélanger avec l’orzo.",
    ],
  },
  {
    nom: "Pâtes bolognaise légère",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 30,
    calories: 540,
    proteines: 41,
    ingredients: [
      "90 g de spaghetti complets",
      "150 g de bœuf 5 %",
      "200 g de sauce tomate",
      "Carotte",
      "Oignon",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Faire revenir bœuf, carotte et oignon.",
      "Ajouter la tomate.",
      "Servir avec les spaghetti.",
    ],
  },
  {
    nom: "Riz œufs légumes sauce soja",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 18,
    calories: 440,
    proteines: 22,
    ingredients: [
      "120 g de riz cuit",
      "2 œufs",
      "Brocoli",
      "Carotte",
      "Petits pois",
      "Sauce soja",
    ],
    preparation: [
      "Cuire les légumes.",
      "Ajouter le riz.",
      "Ajouter les œufs battus.",
      "Assaisonner légèrement.",
    ],
  },
  {
    nom: "Pâtes ricotta épinards",
    categorie: "Pâtes & riz",
    typeRepas: "Plat",
    temps: 20,
    calories: 460,
    proteines: 23,
    ingredients: [
      "90 g de pâtes",
      "100 g de ricotta",
      "120 g d’épinards",
      "Citron",
      "Poivre",
    ],
    preparation: [
      "Cuire les pâtes.",
      "Faire tomber les épinards.",
      "Mélanger ricotta et citron.",
      "Ajouter les pâtes.",
    ],
  },
  {
    nom: "Salade grecque protéinée",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 15,
    calories: 410,
    proteines: 26,
    ingredients: [
      "100 g de pois chiches",
      "70 g de feta",
      "Concombre",
      "Tomate",
      "Olives",
      "Oignon rouge",
    ],
    preparation: [
      "Égoutter les pois chiches.",
      "Couper les légumes.",
      "Ajouter feta et olives.",
      "Assaisonner.",
    ],
  },
  {
    nom: "Salade quinoa saumon",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 20,
    calories: 480,
    proteines: 35,
    ingredients: [
      "80 g de quinoa",
      "120 g de saumon cuit",
      "Concombre",
      "Roquette",
      "Citron",
    ],
    preparation: [
      "Cuire le quinoa.",
      "Cuire ou utiliser le saumon froid.",
      "Ajouter les légumes.",
      "Assaisonner au citron.",
    ],
  },
  {
    nom: "Salade poulet mangue",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 20,
    calories: 450,
    proteines: 37,
    ingredients: [
      "150 g de poulet",
      "100 g de mangue",
      "Salade",
      "Concombre",
      "Citron vert",
    ],
    preparation: [
      "Cuire le poulet.",
      "Couper la mangue et le concombre.",
      "Assembler avec la salade.",
      "Ajouter citron vert.",
    ],
  },
  {
    nom: "Salade pâtes méditerranéenne",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 20,
    calories: 470,
    proteines: 21,
    ingredients: [
      "80 g de pâtes",
      "Tomates cerises",
      "Concombre",
      "60 g de feta",
      "Olives",
      "Basilic",
    ],
    preparation: [
      "Cuire puis refroidir les pâtes.",
      "Couper les légumes.",
      "Ajouter feta et olives.",
      "Mélanger avec le basilic.",
    ],
  },
  {
    nom: "Soupe lentilles légumes",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 35,
    calories: 390,
    proteines: 23,
    ingredients: [
      "100 g de lentilles",
      "Carotte",
      "Poireau",
      "Tomate",
      "Bouillon",
      "Thym",
    ],
    preparation: [
      "Couper les légumes.",
      "Mettre tous les ingrédients dans une casserole.",
      "Mijoter jusqu’à cuisson des lentilles.",
      "Rectifier l’assaisonnement.",
    ],
  },
  {
    nom: "Velouté courgette fromage frais",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 25,
    calories: 280,
    proteines: 15,
    ingredients: [
      "2 courgettes",
      "1 pomme de terre",
      "Bouillon",
      "50 g de fromage frais léger",
      "Poivre",
    ],
    preparation: [
      "Cuire courgettes et pomme de terre dans le bouillon.",
      "Mixer.",
      "Ajouter le fromage frais.",
      "Poivrer.",
    ],
  },
  {
    nom: "Soupe tomate pois chiches",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 30,
    calories: 360,
    proteines: 18,
    ingredients: [
      "250 g de tomates concassées",
      "120 g de pois chiches",
      "Oignon",
      "Bouillon",
      "Basilic",
    ],
    preparation: [
      "Faire revenir l’oignon.",
      "Ajouter tomates et bouillon.",
      "Ajouter les pois chiches.",
      "Mijoter puis servir.",
    ],
  },
  {
    nom: "Salade œufs avocat",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 15,
    calories: 420,
    proteines: 23,
    ingredients: [
      "2 œufs",
      "1/2 avocat",
      "Salade",
      "Tomate",
      "Concombre",
      "Citron",
    ],
    preparation: [
      "Cuire les œufs.",
      "Couper avocat et légumes.",
      "Assembler.",
      "Assaisonner au citron.",
    ],
  },
  {
    nom: "Salade crevettes agrumes",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 15,
    calories: 350,
    proteines: 30,
    ingredients: [
      "150 g de crevettes",
      "Salade",
      "1 orange",
      "1/2 pamplemousse",
      "Concombre",
      "Citron",
    ],
    preparation: [
      "Décortiquer les crevettes.",
      "Préparer les agrumes.",
      "Assembler avec salade et concombre.",
      "Assaisonner.",
    ],
  },
  {
    nom: "Minestrone express",
    categorie: "Salades & soupes",
    typeRepas: "Entrée",
    temps: 30,
    calories: 380,
    proteines: 17,
    ingredients: [
      "Courgette",
      "Carotte",
      "Haricots blancs",
      "Tomates concassées",
      "50 g de petites pâtes",
      "Bouillon",
    ],
    preparation: [
      "Couper les légumes.",
      "Ajouter tomate et bouillon.",
      "Ajouter haricots et pâtes.",
      "Mijoter jusqu’à cuisson.",
    ],
  },
  {
    nom: "Skyr fruits rouges amandes",
    categorie: "Collation & dessert",
    typeRepas: "Collation",
    temps: 5,
    calories: 230,
    proteines: 20,
    ingredients: [
      "180 g de skyr",
      "100 g de fruits rouges",
      "10 g d’amandes",
      "1 c. à café de miel",
    ],
    preparation: [
      "Mettre le skyr dans un bol.",
      "Ajouter les fruits rouges.",
      "Ajouter les amandes.",
      "Finir avec le miel.",
    ],
  },
  {
    nom: "Mousse chocolat skyr",
    categorie: "Collation & dessert",
    typeRepas: "Dessert",
    temps: 8,
    calories: 250,
    proteines: 22,
    ingredients: [
      "180 g de skyr",
      "15 g de cacao non sucré",
      "1 c. à café de miel",
      "Quelques copeaux de chocolat noir",
    ],
    preparation: [
      "Mélanger skyr et cacao.",
      "Ajouter le miel.",
      "Réserver au frais.",
      "Ajouter quelques copeaux avant de servir.",
    ],
  },
  {
    nom: "Pomme au four cannelle",
    categorie: "Collation & dessert",
    typeRepas: "Dessert",
    temps: 25,
    calories: 210,
    proteines: 4,
    ingredients: [
      "1 grosse pomme",
      "Cannelle",
      "10 g de noix",
      "1 c. à café de miel",
    ],
    preparation: [
      "Évider la pomme.",
      "Ajouter cannelle et noix.",
      "Cuire au four.",
      "Ajouter un filet de miel.",
    ],
  },
  {
    nom: "Energy balls cacao avoine",
    categorie: "Collation & dessert",
    typeRepas: "Collation",
    temps: 10,
    calories: 280,
    proteines: 9,
    ingredients: [
      "50 g de flocons d’avoine",
      "30 g de beurre de cacahuète",
      "1 c. à soupe de cacao",
      "1 c. à café de miel",
      "Un peu d’eau",
    ],
    preparation: [
      "Mélanger tous les ingrédients.",
      "Former de petites boules.",
      "Réserver au frais.",
      "Servir froid.",
    ],
  },
  {
    nom: "Banane yaourt cacahuète",
    categorie: "Collation & dessert",
    typeRepas: "Collation",
    temps: 5,
    calories: 300,
    proteines: 16,
    ingredients: [
      "1 banane",
      "150 g de yaourt grec léger",
      "15 g de beurre de cacahuète",
      "Cannelle",
    ],
    preparation: [
      "Couper la banane.",
      "Ajouter le yaourt.",
      "Ajouter le beurre de cacahuète.",
      "Saupoudrer de cannelle.",
    ],
  }
];

function estFavori(nomRecette) {
  return obtenirCompteActif().favoris[nomRecette] === true;
}

function mettreAJourTexteFavori(bouton, favori) {
  bouton.textContent = favori
    ? "❤️ Ajouté aux favoris"
    : "🤍 Ajouter aux favoris";
}

function afficherDetailRecette(uneRecette) {
  listeRecettes.style.display = "none";
  detailRecette.innerHTML = "";

  const titreDetail = document.createElement("h2");
  titreDetail.textContent = uneRecette.nom;

  const infos = document.createElement("p");
  infos.textContent =
    "🍽️ " +
    uneRecette.typeRepas +
    " • 🏷️ " +
    uneRecette.categorie +
    " • 🔥 " +
    uneRecette.calories +
    " kcal • ⏱️ " +
    uneRecette.temps +
    " min • 💪 " +
    uneRecette.proteines +
    " g de protéines";

  const titreIngredients = document.createElement("h3");
  titreIngredients.textContent = "Ingrédients";

  const listeIngredients = document.createElement("ul");

  uneRecette.ingredients.forEach((ingredient) => {
    const item = document.createElement("li");
    item.textContent = ingredient;
    listeIngredients.appendChild(item);
  });

  const titrePreparation = document.createElement("h3");
  titrePreparation.textContent = "Préparation";

  const listePreparation = document.createElement("ol");

  uneRecette.preparation.forEach((etape) => {
    const item = document.createElement("li");
    item.textContent = etape;
    listePreparation.appendChild(item);
  });

  const actionsDetail = document.createElement("div");
  actionsDetail.classList.add("actions-detail-recette");

  const boutonAjouterCaloriesRecette = document.createElement("button");
  boutonAjouterCaloriesRecette.classList.add("bouton-ajouter-recette-journal");
  boutonAjouterCaloriesRecette.textContent =
    "🔥 Ajouter à aujourd'hui (+" +
    uneRecette.calories +
    " kcal)";

  boutonAjouterCaloriesRecette.addEventListener("click", () => {
    const ajoute = ajouterCaloriesAuJournal(
      uneRecette.nom,
      uneRecette.calories,
      "recette",
    );

    if (!ajoute) {
      return;
    }

    boutonAjouterCaloriesRecette.textContent =
      "✓ Ajouté au journal aujourd'hui";

    rafraichirApplication();
  });

  const boutonRetour = document.createElement("button");
  boutonRetour.classList.add("bouton-secondaire");
  boutonRetour.textContent = "← Retour aux recettes";

  boutonRetour.addEventListener("click", () => {
    detailRecette.innerHTML = "";
    listeRecettes.style.display = "";
  });

  detailRecette.appendChild(titreDetail);
  detailRecette.appendChild(infos);
  detailRecette.appendChild(titreIngredients);
  detailRecette.appendChild(listeIngredients);
  detailRecette.appendChild(titrePreparation);
  detailRecette.appendChild(listePreparation);

  actionsDetail.appendChild(boutonAjouterCaloriesRecette);
  actionsDetail.appendChild(boutonRetour);

  detailRecette.appendChild(actionsDetail);
}

function creerCarteRecette(uneRecette) {
  const carte = document.createElement("div");
  carte.classList.add("carte");

  const titre = document.createElement("h2");
  titre.textContent = uneRecette.nom;

  const infos = document.createElement("div");
  infos.classList.add("infos-recette");

  const calories = document.createElement("span");
  calories.classList.add("info-recette-pill");
  calories.textContent = "🔥 " + uneRecette.calories + " kcal";

  const temps = document.createElement("span");
  temps.classList.add("info-recette-pill");
  temps.textContent = "⏱️ " + uneRecette.temps + " min";

  const proteines = document.createElement("span");
  proteines.classList.add("info-recette-pill");
  proteines.textContent = "💪 " + uneRecette.proteines + " g";

  infos.appendChild(calories);
  infos.appendChild(temps);
  infos.appendChild(proteines);

  const boutonDetails = document.createElement("button");
  boutonDetails.textContent = "Voir la recette";

  const boutonFavori = document.createElement("button");

  mettreAJourTexteFavori(boutonFavori, estFavori(uneRecette.nom));

  boutonDetails.addEventListener("click", () => {
    afficherDetailRecette(uneRecette);
  });

  boutonFavori.addEventListener("click", () => {
    const compte = obtenirCompteActif();

    compte.favoris[uneRecette.nom] = !estFavori(uneRecette.nom);

    sauvegarderEtatApplication();

    mettreAJourTexteFavori(
      boutonFavori,
      estFavori(uneRecette.nom),
    );

    mettreAJourFavoris();
  });

  carte.appendChild(titre);
  carte.appendChild(infos);
  carte.appendChild(boutonDetails);
  carte.appendChild(boutonFavori);

  return carte;
}

function initialiserFiltresRecettes() {
  if (filtreCategorie === null) {
    return;
  }

  const categories = [...new Set(recettes.map((recette) => recette.categorie))]
    .sort((a, b) => a.localeCompare(b, "fr"));

  filtreCategorie.innerHTML =
    '<option value="Toutes">Toutes les familles</option>';

  categories.forEach((categorie) => {
    const option = document.createElement("option");
    option.value = categorie;
    option.textContent = categorie;
    filtreCategorie.appendChild(option);
  });
}

function obtenirRecettesFiltrees() {
  const recherche =
    rechercheRecette !== null
      ? rechercheRecette.value.trim().toLowerCase()
      : "";

  const categorie =
    filtreCategorie !== null
      ? filtreCategorie.value
      : "Toutes";

  const tri =
    triRecettes !== null
      ? triRecettes.value
      : "default";

  const tempsMax =
    filtreTempsMax !== null
      ? Number(filtreTempsMax.value) || 0
      : 0;

  const caloriesMax =
    filtreCaloriesMax !== null
      ? Number(filtreCaloriesMax.value) || 0
      : 0;

  const proteinesMin =
    filtreProteinesMin !== null
      ? Number(filtreProteinesMin.value) || 0
      : 0;

  const resultats = recettes.filter((recette) => {
    const correspondType =
      typeRepasActif === "Tous" ||
      recette.typeRepas === typeRepasActif;

    const correspondCategorie =
      categorie === "Toutes" ||
      recette.categorie === categorie;

    const correspondTemps =
      tempsMax === 0 ||
      recette.temps <= tempsMax;

    const correspondCalories =
      caloriesMax === 0 ||
      recette.calories <= caloriesMax;

    const correspondProteines =
      proteinesMin === 0 ||
      recette.proteines >= proteinesMin;

    const texteRecherche = [
      recette.nom,
      recette.typeRepas,
      recette.categorie,
      ...recette.ingredients,
    ]
      .join(" ")
      .toLowerCase();

    const correspondRecherche =
      recherche === "" ||
      texteRecherche.includes(recherche);

    return (
      correspondType &&
      correspondCategorie &&
      correspondTemps &&
      correspondCalories &&
      correspondProteines &&
      correspondRecherche
    );
  });

  if (tri === "temps") {
    resultats.sort((a, b) => a.temps - b.temps);
  } else if (tri === "calories") {
    resultats.sort((a, b) => a.calories - b.calories);
  } else if (tri === "proteines") {
    resultats.sort((a, b) => b.proteines - a.proteines);
  }

  return resultats;
}

function afficherRecettes() {
  listeRecettes.innerHTML = "";

  const recettesFiltrees = obtenirRecettesFiltrees();

  if (nombreRecettes !== null) {
    nombreRecettes.textContent =
      recettesFiltrees.length +
      " recette" +
      (recettesFiltrees.length > 1 ? "s" : "");
  }

  if (recettesFiltrees.length === 0) {
    const message = document.createElement("p");
    message.classList.add("message-vide");
    message.textContent =
      "Aucune recette ne correspond à ta recherche 🔎";
    listeRecettes.appendChild(message);
    return;
  }

  recettesFiltrees.forEach((uneRecette) => {
    listeRecettes.appendChild(creerCarteRecette(uneRecette));
  });
}

function mettreAJourFavoris() {
  listeFavoris.innerHTML = "";

  const favorites = recettes.filter((recette) => estFavori(recette.nom));

  if (favorites.length === 0) {
    const message = document.createElement("p");

    message.classList.add("message-vide");
    message.textContent =
      "Tu n’as encore aucune recette favorite ❤️";

    listeFavoris.appendChild(message);

    return;
  }

  favorites.forEach((uneRecette) => {
    const carte = document.createElement("div");
    carte.classList.add("carte");

    const titre = document.createElement("h2");
    titre.textContent = uneRecette.nom;

    const infos = document.createElement("p");
    infos.textContent =
      "🔥 " +
      uneRecette.calories +
      " kcal • ⏱️ " +
      uneRecette.temps +
      " min";

    const boutonDetails = document.createElement("button");
    boutonDetails.textContent = "Voir la recette";

    const boutonRetirer = document.createElement("button");
    boutonRetirer.textContent = "💔 Retirer";

    boutonDetails.addEventListener("click", () => {
      window.WellnessUX?.showTab("nutrition", "recipes");
      afficherPage("recettes");
      afficherDetailRecette(uneRecette);
    });

    boutonRetirer.addEventListener("click", () => {
      obtenirCompteActif().favoris[uneRecette.nom] = false;

      sauvegarderEtatApplication();

      afficherRecettes();
      mettreAJourFavoris();
    });

    carte.appendChild(titre);
    carte.appendChild(infos);
    carte.appendChild(boutonDetails);
    carte.appendChild(boutonRetirer);

    listeFavoris.appendChild(carte);
  });
}



// ======================================================
// 🔎 RECHERCHE & MODALE DE FILTRES RECETTES
// ======================================================

function ouvrirModalFiltres() {
  if (modalFiltresOverlay === null) {
    return;
  }

  modalFiltresOverlay.classList.add("ouverte");
  modalFiltresOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-ouverte");
}

function fermerModalFiltres() {
  if (modalFiltresOverlay === null) {
    return;
  }

  modalFiltresOverlay.classList.remove("ouverte");
  modalFiltresOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-ouverte");
}

function recupererTypeRepasSelectionne() {
  const selectionne =
    document.querySelector('input[name="type-repas-modal"]:checked');

  return selectionne !== null
    ? selectionne.value
    : "Tous";
}

function compterFiltresActifs() {
  let total = 0;

  if (typeRepasActif !== "Tous") {
    total += 1;
  }

  if (
    filtreCategorie !== null &&
    filtreCategorie.value !== "Toutes"
  ) {
    total += 1;
  }

  if (
    filtreTempsMax !== null &&
    Number(filtreTempsMax.value) > 0
  ) {
    total += 1;
  }

  if (
    filtreCaloriesMax !== null &&
    Number(filtreCaloriesMax.value) > 0
  ) {
    total += 1;
  }

  if (
    filtreProteinesMin !== null &&
    Number(filtreProteinesMin.value) > 0
  ) {
    total += 1;
  }

  if (
    triRecettes !== null &&
    triRecettes.value !== "default"
  ) {
    total += 1;
  }

  return total;
}

function mettreAJourEtatFiltres() {
  const total = compterFiltresActifs();

  if (badgeFiltresActifs !== null) {
    badgeFiltresActifs.textContent = total;
  }

  if (boutonEffacerFiltresRapide !== null) {
    boutonEffacerFiltresRapide.classList.toggle(
      "visible",
      total > 0,
    );
  }
}

function reinitialiserFiltresRecettes() {
  typeRepasActif = "Tous";

  const radioTous =
    document.querySelector(
      'input[name="type-repas-modal"][value="Tous"]',
    );

  if (radioTous !== null) {
    radioTous.checked = true;
  }

  if (filtreCategorie !== null) {
    filtreCategorie.value = "Toutes";
  }

  if (filtreTempsMax !== null) {
    filtreTempsMax.value = "0";
  }

  if (filtreCaloriesMax !== null) {
    filtreCaloriesMax.value = "0";
  }

  if (filtreProteinesMin !== null) {
    filtreProteinesMin.value = "0";
  }

  if (triRecettes !== null) {
    triRecettes.value = "default";
  }

  mettreAJourEtatFiltres();
  afficherRecettes();
}

if (rechercheRecette !== null) {
  rechercheRecette.addEventListener("input", () => {
    afficherRecettes();
  });
}

if (boutonOuvrirFiltres !== null) {
  boutonOuvrirFiltres.addEventListener("click", () => {
    ouvrirModalFiltres();
  });
}

if (boutonFermerFiltres !== null) {
  boutonFermerFiltres.addEventListener("click", () => {
    fermerModalFiltres();
  });
}

if (modalFiltresOverlay !== null) {
  modalFiltresOverlay.addEventListener("click", (event) => {
    if (event.target === modalFiltresOverlay) {
      fermerModalFiltres();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    modalFiltresOverlay !== null &&
    modalFiltresOverlay.classList.contains("ouverte")
  ) {
    fermerModalFiltres();
  }
});

if (boutonAppliquerFiltres !== null) {
  boutonAppliquerFiltres.addEventListener("click", () => {
    typeRepasActif = recupererTypeRepasSelectionne();

    mettreAJourEtatFiltres();
    afficherRecettes();
    fermerModalFiltres();
  });
}

if (boutonReinitialiserFiltres !== null) {
  boutonReinitialiserFiltres.addEventListener("click", () => {
    reinitialiserFiltresRecettes();
  });
}

if (boutonEffacerFiltresRapide !== null) {
  boutonEffacerFiltresRapide.addEventListener("click", () => {
    reinitialiserFiltresRecettes();
  });
}


// ======================================================
// 🎨 APPARENCE / THÈME
// ======================================================

function obtenirModeTheme() {
  const mode = localStorage.getItem(CLE_THEME);

  if (["dark", "light", "system"].includes(mode)) {
    return mode;
  }

  return "dark";
}

function obtenirThemeEffectif(mode) {
  if (mode === "system") {
    return mediaThemeSombre.matches ? "dark" : "light";
  }

  return mode;
}

function libelleModeTheme(mode) {
  if (mode === "system") {
    return "Automatique";
  }

  if (mode === "light") {
    return "Clair doux";
  }

  return "Sombre";
}

function appliquerTheme(mode, enregistrer = true) {
  const themeEffectif = obtenirThemeEffectif(mode);

  document.documentElement.dataset.theme = themeEffectif;
  document.documentElement.dataset.themeMode = mode;

  if (enregistrer) {
    localStorage.setItem(CLE_THEME, mode);
  }

  boutonsTheme.forEach((bouton) => {
    const actif = bouton.dataset.themeMode === mode;

    bouton.classList.toggle("active", actif);
    bouton.setAttribute("aria-pressed", String(actif));
  });

  if (themeEtat !== null) {
    themeEtat.textContent = libelleModeTheme(mode);
  }

  if (messageTheme !== null) {
    messageTheme.textContent =
      mode === "system"
        ? "Le thème s'adapte automatiquement à ton appareil."
        : mode === "dark"
          ? "Mode sombre activé pour une interface plus reposante."
          : "Mode clair doux activé, sans blanc pur agressif.";
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  if (metaThemeColor !== null) {
    metaThemeColor.setAttribute(
      "content",
      themeEffectif === "dark" ? "#08111f" : "#e9eef5",
    );
  }
}

boutonsTheme.forEach((bouton) => {
  bouton.addEventListener("click", () => {
    appliquerTheme(bouton.dataset.themeMode);
  });
});

const gererChangementThemeSysteme = () => {
  if (obtenirModeTheme() === "system") {
    appliquerTheme("system", false);
  }
};

if (typeof mediaThemeSombre.addEventListener === "function") {
  mediaThemeSombre.addEventListener("change", gererChangementThemeSysteme);
} else if (typeof mediaThemeSombre.addListener === "function") {
  mediaThemeSombre.addListener(gererChangementThemeSysteme);
}

// ======================================================
// 🧭 NAVIGATION
// ======================================================

let transitionPageEnCours = false;

function afficherPage(nomPage) {
  const pageCible = document.getElementById("page-" + nomPage);
  const boutonCible = document.querySelector(`[data-page="${nomPage}"]`);
  const pageActuelle = document.querySelector(".page.active");

  if (
    pageCible === null ||
    transitionPageEnCours ||
    pageCible === pageActuelle
  ) {
    return;
  }

  const mouvementReduit =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  transitionPageEnCours = true;

  boutonsNavigation.forEach((bouton) => {
    bouton.classList.remove("active");
  });

  if (boutonCible !== null) {
    boutonCible.classList.add("active");
  }

  const finaliserTransition = () => {
    pages.forEach((page) => {
      page.classList.remove("active", "page-sortie");
    });

    pageCible.classList.add("active");

    window.scrollTo({
      top: 0,
      behavior: mouvementReduit ? "auto" : "smooth",
    });

    setTimeout(() => {
      transitionPageEnCours = false;
    }, mouvementReduit ? 0 : 90);
  };

  if (pageActuelle !== null && !mouvementReduit) {
    pageActuelle.classList.add("page-sortie");

    setTimeout(finaliserTransition, 130);
  } else {
    finaliserTransition();
  }
}

boutonsNavigation.forEach((bouton) => {
  bouton.addEventListener("click", () => {
    afficherPage(bouton.dataset.page);
  });
});


// ======================================================
// 👥 ÉVÉNEMENTS COMPTES
// ======================================================

selectCompte.addEventListener("change", () => {
  etatApplication.compteActif = selectCompte.value;

  sauvegarderEtatApplication();

  messageCompte.textContent =
    "✅ Compte changé : " + obtenirCompteActif().nomCompte;

  rafraichirApplication();
});

boutonNouveauCompte.addEventListener("click", () => {
  const nom = window.prompt("Nom du nouveau compte :", "Nouveau profil");

  if (nom === null) {
    return;
  }

  const nomNettoye = nom.trim();

  if (nomNettoye === "") {
    messageCompte.textContent = "⚠️ Le nom du compte ne peut pas être vide.";
    return;
  }

  const id = creerIdCompte();

  etatApplication.comptes[id] = creerCompteParDefaut(nomNettoye);
  etatApplication.compteActif = id;

  sauvegarderEtatApplication();

  messageCompte.textContent = "✅ Nouveau compte créé.";

  rafraichirApplication();
});

boutonRenommerCompte.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  const nouveauNom = window.prompt(
    "Nouveau nom du compte :",
    compte.nomCompte,
  );

  if (nouveauNom === null) {
    return;
  }

  const nomNettoye = nouveauNom.trim();

  if (nomNettoye === "") {
    messageCompte.textContent = "⚠️ Le nom du compte ne peut pas être vide.";
    return;
  }

  compte.nomCompte = nomNettoye;

  sauvegarderEtatApplication();

  messageCompte.textContent = "✅ Compte renommé.";

  afficherListeComptes();
});

boutonReinitialiserCompte.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  const confirmation = window.confirm(
    "Réinitialiser le profil « " +
      compte.nomCompte +
      " » ?\n\n" +
      "Cela effacera sa progression, son historique, ses badges, ses favoris, " +
      "ses récompenses personnalisées, son journal alimentaire et ses données du jour.",
  );

  if (!confirmation) {
    return;
  }

  const nomCompte = compte.nomCompte;
  const prenom = compte.prenom;
  const age = compte.age;
  const taille = compte.taille;
  const poidsActuel = compte.poidsActuel;
  const poidsObjectif = compte.poidsObjectif;
  const formuleMetabolique = compte.formuleMetabolique;
  const niveauActivite = compte.niveauActivite;
  const objectifCalories = compte.objectifCalories;
  const caloriesMaintien = compte.caloriesMaintien;
  const typeObjectifCalories = compte.typeObjectifCalories;

  etatApplication.comptes[etatApplication.compteActif] =
    creerCompteParDefaut(nomCompte);

  const nouveauCompte = obtenirCompteActif();

  nouveauCompte.prenom = prenom;
  nouveauCompte.age = age;
  nouveauCompte.taille = taille;
  nouveauCompte.poidsActuel = poidsActuel;
  nouveauCompte.poidsObjectif = poidsObjectif;
  nouveauCompte.formuleMetabolique = formuleMetabolique;
  nouveauCompte.niveauActivite = niveauActivite;
  nouveauCompte.objectifCalories = objectifCalories;
  nouveauCompte.caloriesMaintien = caloriesMaintien;
  nouveauCompte.typeObjectifCalories = typeObjectifCalories;

  sauvegarderEtatApplication();

  messageDanger.textContent = "✅ Profil réinitialisé.";

  rafraichirApplication();
});

boutonSupprimerCompte.addEventListener("click", () => {
  const ids = Object.keys(etatApplication.comptes);

  if (ids.length <= 1) {
    messageDanger.textContent =
      "⚠️ Impossible de supprimer le dernier compte. Crée-en un autre d’abord.";
    return;
  }

  const compte = obtenirCompteActif();

  const confirmation = window.confirm(
    "Supprimer définitivement le profil « " +
      compte.nomCompte +
      " » ? Cette action est irréversible.",
  );

  if (!confirmation) {
    return;
  }

  delete etatApplication.comptes[etatApplication.compteActif];

  etatApplication.compteActif = Object.keys(etatApplication.comptes)[0];

  sauvegarderEtatApplication();

  messageDanger.textContent = "✅ Profil supprimé.";

  rafraichirApplication();
});


// ======================================================
// 👤 ÉVÉNEMENTS PROFIL
// ======================================================

btnEnregistrer.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  const prenom = inputPrenom.value.trim();
  const age = Number(inputAge.value);
  const nouvelObjectifEau = Number(inputObjectifEau.value);
  const nouvelObjectifPas = Number(inputObjectifPas.value);

  const profilValide =
    prenom !== "" &&
    Number.isFinite(age) &&
    age > 0 &&
    Number.isFinite(nouvelObjectifEau) &&
    nouvelObjectifEau > 0 &&
    Number.isFinite(nouvelObjectifPas) &&
    nouvelObjectifPas > 0;

  if (!profilValide) {
    messageProfil.textContent = "⚠️ Profil invalide";
    return;
  }

  compte.prenom = prenom;
  compte.age = age;
  compte.objectifEau = nouvelObjectifEau;
  compte.objectifPas = nouvelObjectifPas;

  if (compte.nomCompte === "Mon profil") {
    compte.nomCompte = prenom;
  }

  sauvegarderEtatApplication();

  messageProfil.textContent = "✅ Profil enregistré !";

  rafraichirApplication();
});


// ======================================================
// 🔥 OBJECTIF CALORIES / POIDS
// ======================================================

boutonCalculerObjectifCalories.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  const age = Number(inputAge.value || compte.age);
  const taille = Number(inputTaille.value);
  const poidsActuel = Number(inputPoidsActuel.value);
  const poidsObjectif = Number(inputPoidsObjectif.value);
  const formuleMetabolique = selectFormuleMetabolique.value;
  const niveauActivite = selectActivite.value;

  if (Number.isFinite(age) && age > 0 && age < 18) {
    messageCalculCalories.textContent =
      "⚠️ Ce calculateur est prévu pour les adultes. Pour un mineur, mieux vaut demander un avis professionnel.";
    return;
  }

  const resultat = calculerCibleCalories({
    age,
    taille,
    poidsActuel,
    poidsObjectif,
    formuleMetabolique,
    niveauActivite,
  });

  if (resultat === null) {
    messageCalculCalories.textContent =
      "⚠️ Complète ton âge, ta taille, tes poids, la formule et ton niveau d'activité.";
    return;
  }

  compte.age = age;
  compte.taille = taille;
  compte.poidsActuel = poidsActuel;
  compte.poidsObjectif = poidsObjectif;
  compte.formuleMetabolique = formuleMetabolique;
  compte.niveauActivite = niveauActivite;
  compte.objectifCalories = resultat.objectif;
  compte.caloriesMaintien = resultat.maintien;
  compte.typeObjectifCalories = resultat.typeObjectif;

  sauvegarderEtatApplication();

  messageCalculCalories.textContent =
    "✅ Cible estimée enregistrée : " +
    resultat.objectif +
    " kcal / jour.";

  rafraichirApplication();
});


// ======================================================
// 🪟 MODALES ACCUEIL : PAS, REPAS & CALORIES
// ======================================================

function ouvrirModalSimple(overlay) {
  if (overlay === null) {
    return;
  }

  overlay.classList.add("ouverte");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-ouverte");
}

function fermerModalSimple(overlay) {
  if (overlay === null) {
    return;
  }

  overlay.classList.remove("ouverte");
  overlay.setAttribute("aria-hidden", "true");

  const uneModaleEncoreOuverte =
    document.querySelector(".modal-simple-overlay.ouverte") !== null ||
    document.querySelector(".modal-filtres-overlay.ouverte") !== null;

  if (!uneModaleEncoreOuverte) {
    document.body.classList.remove("modal-ouverte");
  }
}

if (boutonOuvrirModalPas !== null) {
  boutonOuvrirModalPas.addEventListener("click", () => {
    inputPas.value = "";
    ouvrirModalSimple(modalPasOverlay);

    setTimeout(() => {
      inputPas.focus();
    }, 100);
  });
}

if (boutonFermerModalPas !== null) {
  boutonFermerModalPas.addEventListener("click", () => {
    fermerModalSimple(modalPasOverlay);
  });
}

if (boutonAnnulerModalPas !== null) {
  boutonAnnulerModalPas.addEventListener("click", () => {
    fermerModalSimple(modalPasOverlay);
  });
}

raccourcisPas.forEach((bouton) => {
  bouton.addEventListener("click", () => {
    inputPas.value = bouton.dataset.pas;
  });
});

if (inputPas !== null) {
  inputPas.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      boutonPas.click();
    }
  });
}

if (boutonOuvrirModalRepas !== null) {
  boutonOuvrirModalRepas.addEventListener("click", () => {
    ouvrirModalSimple(modalRepasOverlay);
  });
}

if (boutonOuvrirModalCalories !== null) {
  boutonOuvrirModalCalories.addEventListener("click", () => {
    afficherJournalCalories();
    ouvrirModalSimple(modalCaloriesOverlay);

    setTimeout(() => {
      if (inputCalories !== null) {
        inputCalories.focus();
      }
    }, 100);
  });
}

if (boutonFermerModalCalories !== null) {
  boutonFermerModalCalories.addEventListener("click", () => {
    fermerModalSimple(modalCaloriesOverlay);
  });
}

if (boutonTerminerModalCalories !== null) {
  boutonTerminerModalCalories.addEventListener("click", () => {
    fermerModalSimple(modalCaloriesOverlay);
  });
}

raccourcisCalories.forEach((bouton) => {
  bouton.addEventListener("click", () => {
    inputCalories.value = bouton.dataset.calories;
  });
});

if (boutonEnregistrerCalories !== null) {
  boutonEnregistrerCalories.addEventListener("click", () => {
    const calories = Number(inputCalories.value);

    if (!Number.isFinite(calories) || calories <= 0) {
      inputCalories.focus();
      return;
    }

    ajouterCaloriesAuJournal(
      inputNomAliment.value,
      calories,
      "manuel",
    );

    inputNomAliment.value = "";
    inputCalories.value = "";

    rafraichirApplication();
    afficherJournalCalories();
  });
}

if (inputCalories !== null) {
  inputCalories.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      boutonEnregistrerCalories.click();
    }
  });
}

if (boutonFermerModalRepas !== null) {
  boutonFermerModalRepas.addEventListener("click", () => {
    fermerModalSimple(modalRepasOverlay);
  });
}

if (boutonValiderModalRepas !== null) {
  boutonValiderModalRepas.addEventListener("click", () => {
    fermerModalSimple(modalRepasOverlay);
  });
}

[modalPasOverlay, modalRepasOverlay, modalCaloriesOverlay].forEach((overlay) => {
  if (overlay === null) {
    return;
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      fermerModalSimple(overlay);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (
    modalPasOverlay !== null &&
    modalPasOverlay.classList.contains("ouverte")
  ) {
    fermerModalSimple(modalPasOverlay);
  }

  if (
    modalRepasOverlay !== null &&
    modalRepasOverlay.classList.contains("ouverte")
  ) {
    fermerModalSimple(modalRepasOverlay);
  }

  if (
    modalCaloriesOverlay !== null &&
    modalCaloriesOverlay.classList.contains("ouverte")
  ) {
    fermerModalSimple(modalCaloriesOverlay);
  }
});

// ======================================================
// 🎛️ ÉVÉNEMENTS PRINCIPAUX
// ======================================================

boutonEau.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  if (compte.verresEau < compte.objectifEau) {
    compte.verresEau += 1;
  }

  sauvegarderEtatApplication();

  rafraichirApplication();
});

boutonRetirerEau.addEventListener("click", () => {
  const compte = obtenirCompteActif();

  if (compte.verresEau > 0) {
    compte.verresEau -= 1;
  }

  sauvegarderEtatApplication();

  rafraichirApplication();
});

boutonPas.addEventListener("click", () => {
  const compte = obtenirCompteActif();
  const nouveauxPas = Number(inputPas.value);

  const valeurValide =
    inputPas.value.trim() !== "" &&
    Number.isFinite(nouveauxPas) &&
    nouveauxPas >= 0;

  if (!valeurValide) {
    messagePas.textContent = "⚠️ Entre un nombre de pas valide";
    return;
  }

  compte.pasEffectues += nouveauxPas;

  inputPas.value = "";

  sauvegarderEtatApplication();

  rafraichirApplication();
  fermerModalSimple(modalPasOverlay);
});

Object.entries(boutonsRepas).forEach(([nomRepas, bouton]) => {
  bouton.addEventListener("click", () => {
    const compte = obtenirCompteActif();

    compte.repas[nomRepas] = !compte.repas[nomRepas];

    sauvegarderEtatApplication();

    rafraichirApplication();
  });
});


// ======================================================
// ✨ MICRO-ANIMATIONS
// ======================================================

function relancerAnimationValeur(element) {
  if (element === null) {
    return;
  }

  element.classList.remove("valeur-change");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add("valeur-change");
    });
  });
}

const elementsValeursAnimees = document.querySelectorAll(
  ".compteur, #hero-score, #score-global, #streak-jour, #score-jour",
);

const observateurValeurs = new MutationObserver((mutations) => {
  const elements = new Set();

  mutations.forEach((mutation) => {
    const cible =
      mutation.target.nodeType === Node.TEXT_NODE
        ? mutation.target.parentElement
        : mutation.target;

    if (cible instanceof Element) {
      elements.add(cible);
    }
  });

  elements.forEach((element) => {
    relancerAnimationValeur(element);
  });
});

elementsValeursAnimees.forEach((element) => {
  observateurValeurs.observe(element, {
    childList: true,
    characterData: true,
    subtree: true,
  });
});

function animerNouveauxElements(conteneur) {
  if (conteneur === null) {
    return;
  }

  const appliquerAnimation = () => {
    const elements = conteneur.querySelectorAll(
      ".carte:not(.carte-entree), .badge-card:not(.badge-entree)",
    );

    elements.forEach((element, index) => {
      const classe =
        element.classList.contains("badge-card")
          ? "badge-entree"
          : "carte-entree";

      element.style.setProperty(
        "--entree-delay",
        Math.min(index, 7) * 28 + "ms",
      );

      element.classList.add(classe);
    });
  };

  const observateur = new MutationObserver(appliquerAnimation);

  observateur.observe(conteneur, {
    childList: true,
    subtree: false,
  });

  appliquerAnimation();
}

animerNouveauxElements(listeRecettes);
animerNouveauxElements(listeFavoris);
animerNouveauxElements(badgesGrid);

// ======================================================
// 🔄 RAFRAÎCHISSEMENT CENTRAL
// ======================================================

function rafraichirApplication() {
  verifierNouveauJour();

  afficherListeComptes();
  afficherProfilActif();

  afficherEau();
  afficherPas();
  afficherRepas();
  afficherCalories();

  afficherMotivation();
  afficherSuivi();

  mettreAJourStreak();
  sauvegarderProgressionDuJour();
  afficherGraphiqueSemaine();

  mettreAJourRoue();
  mettreAJourBadges();

  afficherRecettes();
  mettreAJourFavoris();
  afficherRecompensesProfil();
  afficherJournalCalories();

  sauvegarderEtatApplication();
}


// ======================================================
// 🚀 INITIALISATION
// ======================================================

appliquerTheme(obtenirModeTheme(), false);
initialiserFiltresRecettes();
mettreAJourEtatFiltres();
rafraichirApplication();
