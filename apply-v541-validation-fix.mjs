import fs from "node:fs";

const file = "hardening-core.js";
let s = fs.readFileSync(file, "utf8");

const oldJournal = `    (account.journalCalories || []).forEach((entry, index) => {`;
const newJournal = `    const journalEntries = Array.isArray(account.journalCalories) ? account.journalCalories : [];
    journalEntries.forEach((entry, index) => {`;

const oldWeight = `    (account.weightHistory || []).forEach((entry, index) => {`;
const newWeight = `    const weightEntries = Array.isArray(account.weightHistory) ? account.weightHistory : [];
    weightEntries.forEach((entry, index) => {`;

if (!s.includes(oldJournal)) throw new Error("Motif journal introuvable ou déjà corrigé.");
if (!s.includes(oldWeight)) throw new Error("Motif historique poids introuvable ou déjà corrigé.");

s = s.replace(oldJournal, newJournal);
s = s.replace(oldWeight, newWeight);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Validation des journaux/historiques non-tableaux corrigée.");
console.log("➡️ Lance maintenant : npm run verify");
