/* NutriDuo — Duolingo-style nutrition drills (client-only) */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------- State & Storage ----------------
const STORAGE_KEYS = {
  xp: "nd_xp",
  totalXp: "nd_total_xp",
  streak: "nd_streak",
  bestStreak: "nd_best_streak",
  lastPlayed: "nd_last_played",
  prefs: "nd_prefs",
  foods: "nd_foods",
  review: "nd_review" // stores incorrect questions for extra practice
};
let FOODS = [];
let session = {
  mode: "daily", // daily | practice
  skill: null,
  qIndex: 0,
  hearts: 3,
  leniencyPct: 10,
  goal: 10,
  questions: [],
  correct: 0,
  wrong: 0,
  xpEarned: 0,
  reviewItems: []
};

// ---------------- Utilities ----------------
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function loadPrefs() {
  const defaults = { dailyGoal: 10, leniency: 10 };
  const raw = localStorage.getItem(STORAGE_KEYS.prefs);
  if (!raw) return defaults;
  try { 
    const p = JSON.parse(raw);
    return {...defaults, ...p};
  } catch { return defaults; }
}
function savePrefs(p) {
  localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(p));
}
function loadFoods() {
  const raw = localStorage.getItem(STORAGE_KEYS.foods);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fallthrough */ }
  }
  return null;
}
function saveFoods(list) {
  localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify(list));
}
function incXP(amount) {
  const current = parseInt(localStorage.getItem(STORAGE_KEYS.xp) || "0", 10);
  const total = parseInt(localStorage.getItem(STORAGE_KEYS.totalXp) || "0", 10);
  localStorage.setItem(STORAGE_KEYS.xp, String(current + amount));
  localStorage.setItem(STORAGE_KEYS.totalXp, String(total + amount));
}
function getXP(){ return parseInt(localStorage.getItem(STORAGE_KEYS.xp)||"0",10); }
function getTotalXP(){ return parseInt(localStorage.getItem(STORAGE_KEYS.totalXp)||"0",10); }

function updateStreak() {
  const last = localStorage.getItem(STORAGE_KEYS.lastPlayed);
  const today = todayISO();
  const streak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || "0", 10);
  let newStreak = streak;
  if (!last) {
    newStreak = 1;
  } else {
    const lastDate = new Date(last);
    const diffDays = Math.floor((new Date(today) - lastDate) / (1000*60*60*24));
    if (diffDays === 0) {
      newStreak = streak; // already played today
    } else if (diffDays === 1) {
      newStreak = streak + 1;
    } else if (diffDays > 1) {
      newStreak = 1; // reset
    }
  }
  localStorage.setItem(STORAGE_KEYS.streak, String(newStreak));
  localStorage.setItem(STORAGE_KEYS.lastPlayed, today);
  const best = parseInt(localStorage.getItem(STORAGE_KEYS.bestStreak) || "0", 10);
  if (newStreak > best) localStorage.setItem(STORAGE_KEYS.bestStreak, String(newStreak));
}
function getStreak(){ return parseInt(localStorage.getItem(STORAGE_KEYS.streak)||"0",10); }
function getBestStreak(){ return parseInt(localStorage.getItem(STORAGE_KEYS.bestStreak)||"0",10); }

function sample(arr, n=1){
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random()*copy.length);
    out.push(copy.splice(idx,1)[0]);
  }
  return n===1 ? out[0] : out;
}

function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }

// ---------------- Question generation ----------------
const SKILLS = ["calories","protein","fiber","carbs","fat","compare","truefalse"];

function makeNumericQuestion(food, nutrient, label){
  const value = Number(food[nutrient]);
  const q = {
    type: "numeric",
    text: `About how many ${label} are in ${food.name} — ${food.serving}?`,
    correct: value,
    foodRef: food,
    nutrient: nutrient,
    label: label,
  };
  return q;
}

function makeCompareQuestion(a,b, nutrient, label){
  const correct = a[nutrient] === b[nutrient] ? "equal" : (a[nutrient] > b[nutrient] ? a.name : b.name);
  const options = shuffle([a.name, b.name, "equal"]);
  return {
    type: "multi",
    text: `Which has more ${label} per serving?`,
    details: `${a.name} (${a.serving}) vs ${b.name} (${b.serving})`,
    options,
    correct,
    a, b, nutrient, label
  };
}

function makeTrueFalseQuestion(a,b, nutrient, label){
  // Randomly assert that A > B or vice versa
  const statementIsAgtB = Math.random() < 0.5;
  const statement = statementIsAgtB 
    ? `${a.name} has more ${label} per serving than ${b.name}.`
    : `${b.name} has more ${label} per serving than ${a.name}.`;
  const truth = statementIsAgtB ? (a[nutrient] > b[nutrient]) : (b[nutrient] > a[nutrient]);
  return {
    type: "tf",
    text: statement,
    correct: truth ? "True" : "False",
    a,b,nutrient,label
  };
}

function buildLesson(skill, count){
  const pool = shuffle(FOODS);
  const qs = [];
  while (qs.length < count) {
    if (skill === "calories"){
      qs.push(makeNumericQuestion(sample(pool), "calories", "calories"));
    } else if (skill === "protein"){
      qs.push(makeNumericQuestion(sample(pool), "protein", "grams of protein"));
    } else if (skill === "fiber"){
      qs.push(makeNumericQuestion(sample(pool), "fiber", "grams of fiber"));
    } else if (skill === "carbs"){
      qs.push(makeNumericQuestion(sample(pool), "carbs", "grams of carbs"));
    } else if (skill === "fat"){
      qs.push(makeNumericQuestion(sample(pool), "fat", "grams of fat"));
    } else if (skill === "compare"){
      const [a,b] = sample(pool,2);
      const nutrient = sample(["calories","protein","fiber","carbs","fat"]);
      const labels = {calories:"calories", protein:"protein (g)", fiber:"fiber (g)", carbs:"carbs (g)", fat:"fat (g)"};
      qs.push(makeCompareQuestion(a,b,nutrient,labels[nutrient]));
    } else if (skill === "truefalse"){
      const [a,b] = sample(pool,2);
      const nutrient = sample(["calories","protein","fiber","carbs","fat"]);
      const labels = {calories:"calories", protein:"protein", fiber:"fiber", carbs:"carbs", fat:"fat"};
      qs.push(makeTrueFalseQuestion(a,b,nutrient,labels[nutrient]));
    } else { // mixed
      const skills = ["calories","protein","fiber","compare","truefalse"];
      skill = sample(skills);
    }
  }
  return qs;
}

// ---------------- Rendering ----------------
function setScreen(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  $(id).classList.add("active");
}

function renderTop(){
  $("#xp").textContent = String(getXP());
  $("#streak").textContent = String(getStreak());
  $("#bestStreak").textContent = String(getBestStreak());
  $("#totalXp").textContent = String(getTotalXP());
  $("#goalProgress").textContent = String(Math.min(session.qIndex, session.goal));
  $("#hearts").textContent = "❤️".repeat(session.hearts) + "🖤".repeat(Math.max(0,3-session.hearts));
}

function renderQuestion(){
  const q = session.questions[session.qIndex];
  if (!q){ return; }
  $("#progressBar").style.width = `${(session.qIndex/session.goal)*100}%`;
  const area = $("#questionArea");
  area.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  const text = document.createElement("div");
  text.className = "qtext";
  text.textContent = q.text;
  card.appendChild(text);

  if (q.details){
    const small = document.createElement("div");
    small.className = "muted";
    small.textContent = q.details;
    card.appendChild(small);
  }

  if (q.type === "numeric"){
    const row = document.createElement("div");
    row.className = "input-row";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.id = "answerInput";
    input.placeholder = "Enter a number";
    const unit = document.createElement("span");
    unit.className = "muted";
    unit.textContent = q.label.includes("calories") ? "kcal" : "g";
    row.appendChild(input);
    row.appendChild(unit);
    card.appendChild(row);
  } else if (q.type === "multi"){
    const wrap = document.createElement("div");
    wrap.className = "options";
    q.options.forEach(opt=>{
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = opt;
      btn.addEventListener("click", ()=>{
        $$(".option").forEach(o=>o.classList.remove("selected"));
        btn.classList.add("selected");
        btn.dataset.selected = "true";
      });
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);
  } else if (q.type === "tf"){
    const wrap = document.createElement("div");
    wrap.className = "options";
    ["True","False"].forEach(opt=>{
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = opt;
      btn.addEventListener("click", ()=>{
        $$(".option").forEach(o=>o.classList.remove("selected"));
        btn.classList.add("selected");
        btn.dataset.selected = "true";
      });
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);
  }

  area.appendChild(card);
  $("#feedback").innerHTML = "";
  renderTop();
}

function withinLeniency(input, correct, pct){
  if (isNaN(input)) return false;

  // Always accept if rounded values match
  if (Math.round(input) === Math.round(correct)) return true;

  // For small numbers (<20), rounding match is the only leniency
  if (correct < 20) return false;

  // For larger numbers, fall back to percentage-based leniency
  const diff = Math.abs(input - correct);
  const allowed = (pct/100) * Math.max(1, correct);
  return diff <= allowed;
}

function currentAnswer(){
  const q = session.questions[session.qIndex];
  if (q.type === "numeric"){
    const val = parseFloat($("#answerInput").value);
    return isNaN(val) ? null : val;
  } else {
    const sel = $(".option.selected");
    return sel ? sel.textContent : null;
  }
}

function showFeedback(ok, explain){
  const el = $("#feedback");
  el.className = ok ? "feedback" : "feedback";
  el.style.borderLeftColor = ok ? "var(--primary)" : "var(--danger)";
  el.style.background = ok ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.12)";
  el.textContent = explain;
}

function recordReview(q, userAns, correctText){
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.review) || "[]");
  const item = {
    when: new Date().toISOString(),
    question: q.text + (q.details ? " " + q.details : ""),
    yourAnswer: userAns,
    correct: correctText
  };
  list.unshift(item);
  localStorage.setItem(STORAGE_KEYS.review, JSON.stringify(list.slice(0,100)));
}

function submitAnswer(){
  const q = session.questions[session.qIndex];
  const ans = currentAnswer();
  if (ans === null){
    showFeedback(false, "Choose or enter an answer.");
    return;
  }
  let ok = false;
  let correctText = "";
  if (q.type === "numeric"){
    ok = withinLeniency(parseFloat(ans), q.correct, session.leniencyPct);
    correctText = `${q.correct} ${q.label.includes("calories") ? "kcal" : "g"}`;
  } else {
    ok = String(ans) === String(q.correct);
    correctText = q.correct;
  }

  if (ok){
    session.correct += 1;
    session.xpEarned += 10;
    incXP(10);
    showFeedback(true, "Correct! +" + 10 + " XP");
  } else {
    session.wrong += 1;
    session.hearts -= 1;
    recordReview(q, ans, correctText);
    showFeedback(false, `Not quite. Correct: ${correctText}`);
  }

  renderTop();

  // Advance or end
  setTimeout(()=>{
    session.qIndex += 1;
    if (session.hearts <= 0 || session.qIndex >= session.goal){
      finishLesson();
    } else {
      renderQuestion();
    }
  }, 500);
}

function finishLesson(){
  // streak logic for daily mode
  if (session.mode === "daily"){
    updateStreak();
  }
  $("#resultSummary").textContent = `You got ${session.correct}/${session.goal} right and earned ${session.xpEarned} XP.`;
  const review = JSON.parse(localStorage.getItem(STORAGE_KEYS.review) || "[]").slice(0,10);
  const list = $("#reviewList");
  list.innerHTML = "";
  review.forEach(item=>{
    const div = document.createElement("div");
    div.className = "review-item";
    div.innerHTML = `<div class="muted">${new Date(item.when).toLocaleString()}</div>
    <div class="qtext">${item.question}</div>
    <div>Your answer: <b>${item.yourAnswer}</b></div>
    <div>Correct: <b>${item.correct}</b></div>`;
    list.appendChild(div);
  });
  setScreen("#screen-result");
  renderTop();
}

// ---------------- Editor & Settings ----------------
function openSettings(){
  $("#settingsModal").classList.add("show");
}
function closeSettings(){
  $("#settingsModal").classList.remove("show");
}
function switchTab(tab){
  $$(".tab").forEach(t=>t.classList.remove("active"));
  $$(".tab-panel").forEach(p=>p.classList.remove("active"));
  $(`.tab[data-tab="${tab}"]`).classList.add("active");
  $(`#tab-${tab}`).classList.add("active");
}
function bindSettings(){
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", closeSettings);
  $$(".tab").forEach(t=>t.addEventListener("click", ()=>switchTab(t.dataset.tab)));
  $("#savePrefs").addEventListener("click", ()=>{
    const goal = parseInt($("#dailyGoal").value,10);
    const len = parseInt($("#leniency").value,10);
    savePrefs({dailyGoal: goal, leniency: len});
    session.goal = goal;
    session.leniencyPct = len;
    closeSettings();
  });
  $("#resetAll").addEventListener("click", ()=>{
    if (confirm("Reset all progress (XP, streak, review)? This will not delete foods.")){
      [STORAGE_KEYS.xp, STORAGE_KEYS.totalXp, STORAGE_KEYS.streak, STORAGE_KEYS.bestStreak, STORAGE_KEYS.lastPlayed, STORAGE_KEYS.review]
      .forEach(k=>localStorage.removeItem(k));
      renderTop();
      alert("Progress reset.");
    }
  });
  // Editor add
  $("#addFoodBtn").addEventListener("click", ()=>{
    const obj = {
      name: $("#fName").value.trim(),
      serving: $("#fServing").value.trim(),
      calories: parseFloat($("#fCalories").value),
      protein: parseFloat($("#fProtein").value),
      carbs: parseFloat($("#fCarbs").value),
      fat: parseFloat($("#fFat").value),
      fiber: parseFloat($("#fFiber").value),
      category: $("#fCategory").value.trim() || "misc",
      notes: $("#fNotes").value.trim()
    };
    if (!obj.name || !obj.serving || [obj.calories,obj.protein,obj.carbs,obj.fat,obj.fiber].some(v=>isNaN(v))){
      $("#editorMsg").textContent = "Fill all numeric fields and name/serving.";
      return;
    }
    FOODS.push(obj);
    saveFoods(FOODS);
    $("#editorMsg").textContent = "Added! You can now get questions with this food.";
    ["#fName","#fServing","#fCalories","#fProtein","#fCarbs","#fFat","#fFiber","#fCategory","#fNotes"].forEach(id=>$(id).value="");
  });
  // Export / Import
  $("#exportData").addEventListener("click", ()=>{
    const blob = {
      foods: FOODS,
      progress: {
        xp: getXP(),
        totalXp: getTotalXP(),
        streak: getStreak(),
        bestStreak: getBestStreak(),
        lastPlayed: localStorage.getItem(STORAGE_KEYS.lastPlayed),
        review: JSON.parse(localStorage.getItem(STORAGE_KEYS.review) || "[]"),
        prefs: loadPrefs()
      }
    };
    $("#exportOutput").textContent = JSON.stringify(blob, null, 2);
  });
  $("#importFile").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try {
        const blob = JSON.parse(ev.target.result);
        if (Array.isArray(blob.foods)){
          FOODS = blob.foods;
          saveFoods(FOODS);
        }
        if (blob.progress){
          if (blob.progress.xp!=null) localStorage.setItem(STORAGE_KEYS.xp, String(blob.progress.xp));
          if (blob.progress.totalXp!=null) localStorage.setItem(STORAGE_KEYS.totalXp, String(blob.progress.totalXp));
          if (blob.progress.streak!=null) localStorage.setItem(STORAGE_KEYS.streak, String(blob.progress.streak));
          if (blob.progress.bestStreak!=null) localStorage.setItem(STORAGE_KEYS.bestStreak, String(blob.progress.bestStreak));
          if (blob.progress.lastPlayed!=null) localStorage.setItem(STORAGE_KEYS.lastPlayed, blob.progress.lastPlayed);
          if (Array.isArray(blob.progress.review)) localStorage.setItem(STORAGE_KEYS.review, JSON.stringify(blob.progress.review));
          if (blob.progress.prefs) savePrefs(blob.progress.prefs);
        }
        alert("Import complete.");
      } catch (err){
        alert("Invalid JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

// ---------------- Lesson Flow ----------------
function beginLesson(mode, skill){
  const prefs = loadPrefs();
  session = {
    mode,
    skill,
    qIndex: 0,
    hearts: 3,
    leniencyPct: prefs.leniency,
    goal: prefs.dailyGoal,
    questions: buildLesson(skill, prefs.dailyGoal),
    correct: 0,
    wrong: 0,
    xpEarned: 0,
    reviewItems: []
  };
  setScreen("#screen-lesson");
  renderQuestion();
}

function bindHome(){
  $("#startDailyBtn").addEventListener("click", ()=>beginLesson("daily","calories"));
  $("#practiceBtn").addEventListener("click", ()=>beginLesson("practice","calories"));
  $$(".skill").forEach(btn => {
    btn.addEventListener("click", ()=>{
      beginLesson("practice", btn.dataset.skill);
    });
  });
}

function bindLessonControls(){
  $("#submitBtn").addEventListener("click", submitAnswer);
  $("#skipBtn").addEventListener("click", ()=>{
    session.qIndex += 1;
    if (session.qIndex >= session.goal) finishLesson();
    else renderQuestion();
  });
  $("#againBtn").addEventListener("click", ()=>beginLesson("practice", session.skill || "calories"));
  $("#homeBtn").addEventListener("click", ()=>{
    setScreen("#screen-home");
    renderTop();
  });
}

// ---------------- Boot ----------------
async function boot(){
  // Load foods (prefer localStorage, else fetch default JSON)
  const cached = loadFoods();
  if (cached && Array.isArray(cached) && cached.length){
    FOODS = cached;
  } else {
    const res = await fetch("data/foods.json");
    FOODS = await res.json();
    saveFoods(FOODS);
  }
  // Prefs into UI
  const prefs = loadPrefs();
  $("#dailyGoal").value = prefs.dailyGoal;
  $("#leniency").value = prefs.leniency;
  renderTop();
  bindHome();
  bindLessonControls();
  bindSettings();

  // PWA service worker
  if ('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('sw.js'); } catch {}
  }
}
boot();
