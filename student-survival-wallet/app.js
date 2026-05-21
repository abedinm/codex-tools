const firebaseSettings = {
  enabled: false,
  config: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ACCOUNT_KEY = "survivalWallet.accounts.v1";
const SESSION_KEY = "survivalWallet.session.v1";
const THEME_KEY = "survivalWallet.theme.v1";

let firebase = null;
let firebaseApi = null;
let unsubscribeWallet = null;
let currentUser = null;
let wallet = defaultWallet();

function defaultWallet() {
  return {
    income: 18000,
    dailySpending: 220,
    foodCost: 6500,
    transportCost: 1800,
    rent: 5000,
    mobileData: 700,
    emergency: 1200,
    currency: "৳",
    categories: [
      { id: crypto.randomUUID(), name: "Books & Printing", amount: 900 },
      { id: crypto.randomUUID(), name: "Snacks", amount: 850 }
    ],
    logs: [
      { id: crypto.randomUUID(), date: todayValue(), amount: 180, note: "Lunch" },
      { id: crypto.randomUUID(), date: todayValue(), amount: 60, note: "Bus" }
    ]
  };
}

async function initFirebase() {
  if (!firebaseSettings.enabled || !firebaseSettings.config.apiKey) return null;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js")
  ]);
  firebaseApi = { ...appModule, ...authModule, ...firestoreModule };
  const app = firebaseApi.initializeApp(firebaseSettings.config);
  return {
    app,
    auth: firebaseApi.getAuth(app),
    db: firebaseApi.getFirestore(app)
  };
}

function isCloudMode() {
  return Boolean(firebase);
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function daysLeftInMonth() {
  const now = new Date();
  return Math.max(1, daysInMonth() - now.getDate() + 1);
}

function elapsedDays() {
  return Math.max(1, new Date().getDate());
}

function getAccounts() {
  return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "{}");
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

function simpleHash(value) {
  return btoa(unescape(encodeURIComponent(value))).split("").reverse().join("");
}

function dataKey(email) {
  return `survivalWallet.data.${email.toLowerCase()}`;
}

function localLoad() {
  wallet = JSON.parse(localStorage.getItem(dataKey(currentUser.email)) || "null") || defaultWallet();
}

function localSave() {
  localStorage.setItem(dataKey(currentUser.email), JSON.stringify(wallet));
}

async function saveWallet() {
  if (!currentUser) return;
  if (isCloudMode()) {
    await firebaseApi.setDoc(firebaseApi.doc(firebase.db, "users", currentUser.uid, "wallet", "current"), {
      ...wallet,
      updatedAt: firebaseApi.serverTimestamp()
    });
  } else {
    localSave();
  }
}

function listenCloudWallet() {
  if (unsubscribeWallet) unsubscribeWallet();
  const ref = firebaseApi.doc(firebase.db, "users", currentUser.uid, "wallet", "current");
  unsubscribeWallet = firebaseApi.onSnapshot(ref, async (snapshot) => {
    if (snapshot.exists()) {
      wallet = { ...defaultWallet(), ...snapshot.data() };
      renderAll(false);
    } else {
      await firebaseApi.setDoc(ref, wallet);
      renderAll(false);
    }
  }, (error) => showToast(error.message));
}

function readForm() {
  wallet.income = number("#income");
  wallet.dailySpending = number("#dailySpending");
  wallet.foodCost = number("#foodCost");
  wallet.transportCost = number("#transportCost");
  wallet.rent = number("#rent");
  wallet.mobileData = number("#mobileData");
  wallet.emergency = number("#emergency");
  wallet.currency = $("#currency").value.trim() || "৳";
}

function number(selector) {
  return Number($(selector).value || 0);
}

function fixedCosts() {
  return wallet.foodCost + wallet.transportCost + wallet.rent + wallet.mobileData + wallet.emergency;
}

function customTotal() {
  return wallet.categories.reduce((sum, item) => sum + Number(item.amount), 0);
}

function logTotal() {
  return wallet.logs.reduce((sum, item) => sum + Number(item.amount), 0);
}

function plannedDailySpent() {
  return wallet.dailySpending * elapsedDays();
}

function spentTotal() {
  return fixedCosts() + customTotal() + logTotal() + plannedDailySpent();
}

function moneyLeft() {
  return wallet.income - spentTotal();
}

function safeDaily() {
  return moneyLeft() / daysLeftInMonth();
}

function formatMoney(value) {
  return `${wallet.currency}${Math.round(value).toLocaleString()}`;
}

function budgetState() {
  const safe = safeDaily();
  if (safe < 0) return { level: "danger", label: "Critical", message: "Your plan is over budget. Survival mode is active." };
  if (safe < 150) return { level: "danger", label: "Low", message: "Safe daily spend is very tight. Cut flexible spending now." };
  if (safe < 300) return { level: "warn", label: "Careful", message: "Budget is manageable, but small overspending will hurt." };
  return { level: "good", label: "Stable", message: "Your wallet has breathing room if you follow the plan." };
}

function suggestions() {
  const safe = safeDaily();
  const largest = [
    ["food", wallet.foodCost],
    ["transport", wallet.transportCost],
    ["custom categories", customTotal()],
    ["daily spending", plannedDailySpent()]
  ].sort((a, b) => b[1] - a[1])[0];

  return [
    { title: "Set a cash ceiling", text: `Limit tomorrow to ${formatMoney(Math.max(50, safe))}. Put the rest away before leaving home.` },
    { title: "Attack the biggest leak", text: `Your largest flexible area is ${largest[0]}. Try cutting it by 15% this week.` },
    { title: "Use campus resources", text: "Use library Wi-Fi, refill water, share rides, and avoid paid study spaces." },
    { title: "Emergency buffer", text: `Keep at least ${formatMoney(Math.max(300, wallet.emergency * 0.25))} untouched for urgent costs.` }
  ];
}

function renderAll(shouldSave = true) {
  if (!currentUser) return;
  $("#studentName").textContent = currentUser.displayName || currentUser.name || currentUser.email;
  $("#modeNote").textContent = isCloudMode() ? "Firebase cloud sync is active." : "Local demo mode is active until Firebase config is added.";
  $("#income").value = wallet.income;
  $("#dailySpending").value = wallet.dailySpending;
  $("#foodCost").value = wallet.foodCost;
  $("#transportCost").value = wallet.transportCost;
  $("#rent").value = wallet.rent;
  $("#mobileData").value = wallet.mobileData;
  $("#emergency").value = wallet.emergency;
  $("#currency").value = wallet.currency;
  $("#logDate").value ||= todayValue();
  renderMetrics();
  renderCategories();
  renderLogs();
  drawCharts();
  if (shouldSave) saveWallet();
}

function renderMetrics() {
  const state = budgetState();
  $("#safeDaily").textContent = formatMoney(Math.max(0, safeDaily()));
  $("#safeDailyHint").textContent = `For ${daysLeftInMonth()} day(s) left this month`;
  $("#moneyLeft").textContent = formatMoney(moneyLeft());
  $("#daysLeft").textContent = `${daysLeftInMonth()} days left`;
  $("#spentSoFar").textContent = formatMoney(spentTotal());
  $("#burnRate").textContent = `Daily burn ${formatMoney(spentTotal() / elapsedDays())}`;
  $("#budgetStatus").textContent = state.label;
  $("#budgetMessage").textContent = state.message;
  $(".alert").className = `metric alert ${state.level}`;
  $("#survivalPanel").classList.toggle("hidden", state.level === "good");
  $("#suggestions").innerHTML = suggestions().map((item) => `
    <article class="suggestion"><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.text)}</article>
  `).join("");
}

function renderCategories() {
  $("#categoryList").innerHTML = wallet.categories.length ? wallet.categories.map((item) => `
    <article class="list-card">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <p>${formatMoney(item.amount)}</p>
      </div>
      <div class="row-actions">
        <button class="secondary-btn compact" data-cat-edit="${item.id}" type="button">Edit</button>
        <button class="danger-btn compact" data-cat-delete="${item.id}" type="button">Delete</button>
      </div>
    </article>
  `).join("") : `<article class="list-card"><p>No custom categories yet.</p></article>`;
}

function renderLogs() {
  $("#logList").innerHTML = wallet.logs.length ? wallet.logs.slice().reverse().map((item) => `
    <article class="list-card">
      <div>
        <strong>${formatMoney(item.amount)} · ${escapeHtml(item.note || "Spending")}</strong>
        <p>${escapeHtml(item.date)}</p>
      </div>
      <button class="danger-btn compact" data-log-delete="${item.id}" type="button">Delete</button>
    </article>
  `).join("") : `<article class="list-card"><p>No daily spending records yet.</p></article>`;
}

function drawCharts() {
  drawCategoryChart();
  drawWalletChart();
}

function drawCategoryChart() {
  const rows = [
    ["Food", wallet.foodCost, "#65e89d"],
    ["Transport", wallet.transportCost, "#64d2ff"],
    ["Rent", wallet.rent, "#b8a1ff"],
    ["Mobile", wallet.mobileData, "#ffd166"],
    ["Emergency", wallet.emergency, "#ff6b7a"],
    ["Custom", customTotal(), "#9ef970"],
    ["Daily", plannedDailySpent(), "#7aa2ff"]
  ];
  drawBarChart($("#categoryChart"), "Spending by category", rows, Math.max(1, ...rows.map((row) => row[1])));
}

function drawWalletChart() {
  const rows = [
    ["Income", wallet.income, "#65e89d"],
    ["Spent", spentTotal(), "#ff6b7a"],
    ["Left", Math.max(0, moneyLeft()), "#64d2ff"],
    ["Safe/day", Math.max(0, safeDaily()), "#ffd166"]
  ];
  drawBarChart($("#walletChart"), "Wallet health", rows, Math.max(1, wallet.income, spentTotal()));
}

function drawBarChart(canvas, title, rows, maxValue) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = Math.max(260, Math.round(width * 0.58));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(document.body);
  const text = styles.getPropertyValue("--text").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const line = styles.getPropertyValue("--line").trim();
  const left = 44;
  const right = 18;
  const top = 52;
  const bottom = 58;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  ctx.fillStyle = text;
  ctx.font = "800 16px system-ui";
  ctx.fillText(title, left, 26);

  ctx.strokeStyle = line;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + plotH - (plotH * i / 4);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = "12px system-ui";
    ctx.fillText(Math.round(maxValue * i / 4).toLocaleString(), 6, y + 4);
  }

  const gap = 10;
  const barW = Math.max(20, (plotW - gap * (rows.length + 1)) / rows.length);
  rows.forEach((row, index) => {
    const [label, value, color] = row;
    const h = Math.max(2, Math.min(plotH, (value / maxValue) * plotH));
    const x = left + gap + index * (barW + gap);
    const y = top + plotH - h;
    ctx.fillStyle = color;
    rounded(ctx, x, y, barW, h, 8);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.font = "11px system-ui";
    ctx.fillText(label, x, height - 28);
    ctx.fillStyle = text;
    ctx.font = "800 11px system-ui";
    ctx.fillText(Math.round(value).toLocaleString(), x, y - 7);
  });
}

function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function clearCategoryForm() {
  $("#categoryForm").reset();
  $("#categoryId").value = "";
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderAll(false);
}

function showAuth() {
  $("#app").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
}

function applyTheme() {
  document.body.classList.toggle("light", localStorage.getItem(THEME_KEY) === "light");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#loginTab").addEventListener("click", () => {
  $("#loginTab").classList.add("active");
  $("#signupTab").classList.remove("active");
  $("#loginForm").classList.remove("hidden");
  $("#signupForm").classList.add("hidden");
});

$("#signupTab").addEventListener("click", () => {
  $("#signupTab").classList.add("active");
  $("#loginTab").classList.remove("active");
  $("#signupForm").classList.remove("hidden");
  $("#loginForm").classList.add("hidden");
});

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#signupEmail").value.trim().toLowerCase();
  const password = $("#signupPassword").value;
  const name = $("#signupName").value.trim();

  try {
    if (isCloudMode()) {
      const credential = await firebaseApi.createUserWithEmailAndPassword(firebase.auth, email, password);
      await firebaseApi.updateProfile(credential.user, { displayName: name });
      currentUser = credential.user;
      wallet = defaultWallet();
      listenCloudWallet();
    } else {
      const accounts = getAccounts();
      if (accounts[email]) throw new Error("An account already exists for this email.");
      accounts[email] = { email, name, passwordHash: simpleHash(password) };
      saveAccounts(accounts);
      localStorage.setItem(SESSION_KEY, email);
      currentUser = accounts[email];
      wallet = defaultWallet();
      localSave();
      showApp();
    }
    showToast("Wallet created.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#loginEmail").value.trim().toLowerCase();
  const password = $("#loginPassword").value;

  try {
    if (isCloudMode()) {
      const credential = await firebaseApi.signInWithEmailAndPassword(firebase.auth, email, password);
      currentUser = credential.user;
      listenCloudWallet();
    } else {
      const accounts = getAccounts();
      if (!accounts[email] || accounts[email].passwordHash !== simpleHash(password)) {
        throw new Error("Email or password is incorrect.");
      }
      currentUser = accounts[email];
      localStorage.setItem(SESSION_KEY, email);
      localLoad();
      showApp();
    }
    showToast("Logged in.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#demoLogin").addEventListener("click", () => {
  const email = "demo@studentwallet.app";
  const accounts = getAccounts();
  accounts[email] = { email, name: "Demo Student", passwordHash: simpleHash("demo123") };
  saveAccounts(accounts);
  localStorage.setItem(SESSION_KEY, email);
  currentUser = accounts[email];
  if (localStorage.getItem(dataKey(email))) localLoad();
  else {
    wallet = defaultWallet();
    localSave();
  }
  showApp();
  showToast("Demo wallet loaded.");
});

$("#walletForm").addEventListener("submit", (event) => {
  event.preventDefault();
  readForm();
  renderAll();
  showToast("Budget saved.");
});

$("#walletForm").addEventListener("input", () => {
  readForm();
  renderAll();
});

$("#categoryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = {
    id: $("#categoryId").value || crypto.randomUUID(),
    name: $("#categoryName").value.trim(),
    amount: Number($("#categoryAmount").value)
  };
  const index = wallet.categories.findIndex((cat) => cat.id === item.id);
  if (index >= 0) wallet.categories[index] = item;
  else wallet.categories.push(item);
  clearCategoryForm();
  renderAll();
});

$("#logForm").addEventListener("submit", (event) => {
  event.preventDefault();
  wallet.logs.push({
    id: crypto.randomUUID(),
    date: $("#logDate").value,
    amount: Number($("#logAmount").value),
    note: $("#logNote").value.trim()
  });
  $("#logAmount").value = "";
  $("#logNote").value = "";
  renderAll();
});

document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-cat-edit]");
  const catDelete = event.target.closest("[data-cat-delete]");
  const logDelete = event.target.closest("[data-log-delete]");

  if (edit) {
    const item = wallet.categories.find((cat) => cat.id === edit.dataset.catEdit);
    if (!item) return;
    $("#categoryId").value = item.id;
    $("#categoryName").value = item.name;
    $("#categoryAmount").value = item.amount;
  }

  if (catDelete) {
    wallet.categories = wallet.categories.filter((cat) => cat.id !== catDelete.dataset.catDelete);
    renderAll();
  }

  if (logDelete) {
    wallet.logs = wallet.logs.filter((log) => log.id !== logDelete.dataset.logDelete);
    renderAll();
  }
});

$("#addTodaySpend").addEventListener("click", () => {
  $("#logDate").value = todayValue();
  $("#logAmount").focus();
});

$("#clearCategoryForm").addEventListener("click", clearCategoryForm);

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
  drawCharts();
});

$("#logoutBtn").addEventListener("click", async () => {
  if (unsubscribeWallet) unsubscribeWallet();
  if (isCloudMode()) await firebaseApi.signOut(firebase.auth);
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  wallet = defaultWallet();
  showAuth();
});

window.addEventListener("resize", () => currentUser && drawCharts());

applyTheme();

try {
  firebase = await initFirebase();
  if (isCloudMode()) {
    firebaseApi.onAuthStateChanged(firebase.auth, (user) => {
      if (user) {
        currentUser = user;
        listenCloudWallet();
        showApp();
      } else {
        showAuth();
      }
    });
  } else {
    const email = localStorage.getItem(SESSION_KEY);
    const accounts = getAccounts();
    if (email && accounts[email]) {
      currentUser = accounts[email];
      localLoad();
      showApp();
    }
  }
} catch (error) {
  firebase = null;
  firebaseApi = null;
  showToast(`Firebase unavailable: ${error.message}. Local mode active.`);
}
