"use strict";
const results=[];
function test(name,fn){try{fn();results.push([name,true,""]);}catch(e){results.push([name,false,e.message]);}}
function equal(a,b,msg=""){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(msg||`${JSON.stringify(a)} !== ${JSON.stringify(b)}`);}
function near(a,b,t=.2){if(Math.abs(a-b)>t)throw new Error(`${a} n'est pas proche de ${b}`);}

test("scaleFood 150g",()=>{const n=WellnessCore.scaleFood({kcal:100,protein:10,carbs:20,fat:5,fiber:2},150);equal(n.calories,150);equal(n.protein,15);equal(n.carbs,30);});
test("kg/lb conversion",()=>{near(WellnessCore.kgToLb(10),22,0.2);near(WellnessCore.lbToKg(22),10,0.1);});
test("calorie adherence",()=>{equal(WellnessCore.calorieAdherence(2000,2000),100);if(WellnessCore.calorieAdherence(1000,2000)>=100)throw new Error("Le score doit baisser loin de la cible");});
test("recipe preferences",()=>{const r={nom:"Poulet au riz",ingredients:["150 g poulet"]};equal(WellnessCore.recipeAllowed(r,{diet:"vegetarian",allergies:[]}),false);});
test("health score bounds",()=>{const s=WellnessCore.healthScore({waterPct:100,stepsPct:100,mealsPct:100,calories:2000,calorieTarget:2000,protein:120,proteinTarget:120,sleepHours:8,mood:5});if(s<95||s>100)throw new Error(`Score inattendu ${s}`);});

document.getElementById("results").innerHTML=results.map(([n,ok,m])=>`<li class="${ok?"ok":"fail"}">${ok?"✓":"✕"} ${n}${m?` — ${m}`:""}</li>`).join("");
document.getElementById("summary").textContent=`${results.filter(r=>r[1]).length} / ${results.length} tests réussis`;
