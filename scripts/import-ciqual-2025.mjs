import { writeFile, mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";

const SOURCE_URL =
  "https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/RPWYZD";
const OUTPUT = "data-foods-ciqual.js";

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[°º]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 0;
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "-" || raw.includes("trace")) return 0;
  const numeric = raw.replace(",", ".").match(/[0-9]+(?:\.[0-9]+)?/);
  if (!numeric) return 0;
  const n = Number(numeric[0]);
  if (!Number.isFinite(n)) return 0;
  return raw.trim().startsWith("<") ? n / 2 : n;
}

function findColumn(headers, predicate) {
  const index = headers.findIndex((header) => predicate(normalize(header)));
  return index >= 0 ? index + 1 : null;
}

function densityFor(name, category) {
  const text = normalize(`${name} ${category}`);
  if (/huile/.test(text)) return 0.92;
  if (/miel/.test(text)) return 1.42;
  if (/sirop/.test(text)) return 1.33;
  if (/lait|boisson lactee/.test(text)) return 1.03;
  if (/jus|nectar|smoothie/.test(text)) return 1.04;
  if (/soda|cola|limonade|boisson gazeuse/.test(text)) return 1.01;
  if (/vin|biere|cidre|alcool|spiritueux/.test(text)) return 0.98;
  if (/soupe|potage|bouillon/.test(text)) return 1.02;
  return 1;
}

function isLiquid(name, category) {
  const text = normalize(`${name} ${category}`);
  return /boisson|eau|mineral|jus|nectar|smoothie|soda|cola|limonade|lait|cafe|the|infusion|vin|biere|cidre|alcool|spiritueux|soupe|potage|bouillon|huile|sirop/.test(text);
}

function pieceWeightFor(name) {
  const text = normalize(name);
  const rules = [
    [/oeuf/, 60],
    [/banane/, 120],
    [/pomme(?! de terre)/, 150],
    [/poire/, 160],
    [/orange/, 160],
    [/kiwi/, 80],
    [/mandarine|clementine/, 80],
    [/avocat/, 150],
    [/yaourt|skyr|fromage blanc/, 125],
    [/galette de riz/, 9],
  ];
  const match = rules.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
}

console.log("Téléchargement de la Table Ciqual 2025 officielle (ANSES)...");
const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "Wellness/4.2 food database importer" },
});
if (!response.ok) throw new Error(`Téléchargement Ciqual impossible : HTTP ${response.status}`);

const buffer = Buffer.from(await response.arrayBuffer());
console.log(`Fichier reçu : ${(buffer.length / 1024 / 1024).toFixed(1)} Mo`);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);
const sheet = workbook.worksheets[0];
if (!sheet) throw new Error("Aucune feuille trouvée dans le fichier Ciqual.");

let headerRow = null;
for (let r = 1; r <= Math.min(25, sheet.rowCount); r += 1) {
  const values = sheet.getRow(r).values.slice(1).map((v) => v?.text ?? v ?? "");
  const normalized = values.map(normalize);
  if (normalized.some((v) => v.includes("alim code")) &&
      normalized.some((v) => v.includes("alim nom fr"))) {
    headerRow = r;
    break;
  }
}
if (!headerRow) throw new Error("En-tête Ciqual introuvable.");

const headers = sheet.getRow(headerRow).values.slice(1).map((v) => v?.text ?? v ?? "");

const cols = {
  code: findColumn(headers, (h) => h.includes("alim code")),
  name: findColumn(headers, (h) => h.includes("alim nom fr")),
  category: findColumn(headers, (h) => h.includes("alim grp nom fr")),
  subcategory: findColumn(headers, (h) => h.includes("alim ssgrp nom fr")),
  kcal: findColumn(headers, (h) => h.includes("energie") && h.includes("kcal")),
  proteinJones: findColumn(headers, (h) => h.includes("proteines") && h.includes("jones")),
  proteinAny: findColumn(headers, (h) => h.startsWith("proteines") && h.includes("g 100 g")),
  carbs: findColumn(headers, (h) => h.startsWith("glucides") && h.includes("g 100 g")),
  fat: findColumn(headers, (h) => h.startsWith("lipides") && h.includes("g 100 g")),
  fiber: findColumn(headers, (h) => h.includes("fibres alimentaires")),
  sugars: findColumn(headers, (h) => h.startsWith("sucres") && h.includes("g 100 g")),
  saturatedFat: findColumn(headers, (h) => h.includes("ag satures")),
  salt: findColumn(headers, (h) => h.includes("sel chlorure") || (h.startsWith("sel") && h.includes("g 100 g"))),
};

for (const required of ["code", "name", "kcal", "carbs", "fat"]) {
  if (!cols[required]) throw new Error(`Colonne Ciqual introuvable : ${required}`);
}

const foods = [];
for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
  const row = sheet.getRow(r);
  const get = (col) => col ? row.getCell(col).value?.text ?? row.getCell(col).value ?? "" : "";
  const name = String(get(cols.name)).trim();
  const code = String(get(cols.code)).trim();
  if (!name || !code) continue;

  const category = String(get(cols.category)).trim() || "Ciqual";
  const subcategory = String(get(cols.subcategory)).trim();
  const protein = parseValue(get(cols.proteinJones || cols.proteinAny));
  const food = {
    id: `ciqual-${code}`,
    ciqualCode: code,
    name,
    category,
    subcategory,
    kcal: Math.round(parseValue(get(cols.kcal)) * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(parseValue(get(cols.carbs)) * 10) / 10,
    fat: Math.round(parseValue(get(cols.fat)) * 10) / 10,
    fiber: Math.round(parseValue(get(cols.fiber)) * 10) / 10,
    sugars: Math.round(parseValue(get(cols.sugars)) * 10) / 10,
    saturatedFat: Math.round(parseValue(get(cols.saturatedFat)) * 10) / 10,
    salt: Math.round(parseValue(get(cols.salt)) * 100) / 100,
    basisQuantity: 100,
    basisUnit: "g",
    liquid: isLiquid(name, category),
    density: densityFor(name, category),
    pieceWeight: pieceWeightFor(name),
    source: "Anses. 2025. Table de composition nutritionnelle des aliments Ciqual",
    sourceDatabase: "Ciqual 2025",
  };
  foods.push(food);
}

if (foods.length < 3000) {
  throw new Error(`Import incomplet : seulement ${foods.length} aliments trouvés.`);
}

const js = `"use strict";\n\n` +
  `// Source : Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.\n` +
  `// DOI : 10.57745/RDMHWY - Licence Ouverte Etalab 2.0.\n` +
  `window.CIQUAL_FOODS = ${JSON.stringify(foods)};\n` +
  `(() => {\n` +
  `  const base = window.WELLNESS_FOODS || [];\n` +
  `  const key = (food) => String(food.name || "").normalize("NFD").replace(/[\\\\u0300-\\\\u036f]/g, "").toLowerCase().trim();\n` +
  `  const seen = new Set(base.map(key));\n` +
  `  window.WELLNESS_FOODS = [...base, ...window.CIQUAL_FOODS.filter((food) => !seen.has(key(food)))];\n` +
  `})();\n`;

await writeFile(OUTPUT, js, "utf8");
console.log(`✅ ${foods.length.toLocaleString("fr-FR")} aliments Ciqual importés dans ${OUTPUT}.`);
