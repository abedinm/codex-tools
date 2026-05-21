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

const ACCOUNT_KEY = "examWarRoom.accounts.v1";
const SESSION_KEY = "examWarRoom.session.v1";
const THEME_KEY = "examWarRoom.theme.v1";

let firebase = null;
let firebaseApi = null;
let unsubscribeData = null;
let currentUser = null;
let exams = [];
let revisionMode = false;
let timer = null;

const demoExams = [
  makeExam("Operating Systems", addDaysLocal(5, 9, 0), 5, 150, [
    "Process scheduling",
    "Deadlocks",
    "Memory management",
    "File systems",
    "Synchronization"
  ]),
  makeExam("Database Systems", addDaysLocal(9, 14, 0), 4, 120, [
    "ER diagrams",
    "Normalization",
    "SQL joins",
    "Transactions",
    "Indexing"
  ]),
  makeExam("Statistics", addDaysLocal(14, 10, 30), 3, 90, [
    "Probability distributions",
    "Hypothesis testing",
    "Regression",
    "Confidence intervals"
  ])
];

function makeExam(courseName, examDate, difficulty, dailyCapacity, topicNames) {
  return {
    id: crypto.randomUUID(),
    courseName,
    examDate,
    difficulty,
    dailyCapacity,
    topics: topicNames.map((name) => ({ id: crypto.randomUUID(), name, done: false, revised: false }))
  };
}

function addDaysLocal(days, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeLocal(date);
}

function toDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  return `examWarRoom.exams.${email.toLowerCase()}`;
}

function localLoad() {
  exams = JSON.parse(localStorage.getItem(dataKey(currentUser.email)) || "[]");
}

function localSave() {
  localStorage.setItem(dataKey(currentUser.email), JSON.stringify(exams));
}

async function saveData() {
  if (!currentUser) return;
  if (isCloudMode()) {
    await firebaseApi.setDoc(firebaseApi.doc(firebase.db, "users", currentUser.uid, "examWarRoom", "data"), {
      exams,
      updatedAt: firebaseApi.serverTimestamp()
    });
  } else {
    localSave();
  }
}

function listenCloudData() {
  if (unsubscribeData) unsubscribeData();
  const ref = firebaseApi.doc(firebase.db, "users", currentUser.uid, "examWarRoom", "data");
  unsubscribeData = firebaseApi.onSnapshot(ref, async (snapshot) => {
    if (snapshot.exists()) {
      exams = snapshot.data().exams || [];
      renderAll(false);
    } else {
      await firebaseApi.setDoc(ref, { exams });
      renderAll(false);
    }
  }, (error) => showToast(error.message));
}

function daysUntil(value) {
  return Math.ceil((new Date(value) - new Date()) / 864e5);
}

function hoursUntil(value) {
  return (new Date(value) - new Date()) / 36e5;
}

function sortedExams() {
  return [...exams].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
}

function topicProgress(exam) {
  if (!exam.topics.length) return 0;
  const key = revisionMode ? "revised" : "done";
  return Math.round(exam.topics.filter((topic) => topic[key]).length / exam.topics.length * 100);
}

function overallProgress() {
  if (!exams.length) return 0;
  return Math.round(exams.reduce((sum, exam) => sum + topicProgress(exam), 0) / exams.length);
}

function activeTopics(exam) {
  const key = revisionMode ? "revised" : "done";
  return exam.topics.filter((topic) => !topic[key]);
}

function studyPlan() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const missions = [];

  sortedExams().forEach((exam) => {
    const examDay = new Date(exam.examDate);
    examDay.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.ceil((examDay - today) / 864e5));
    const openTopics = activeTopics(exam);
    const weightedMinutes = Number(exam.dailyCapacity) + Number(exam.difficulty) * 22;
    const topicMinutes = Math.max(25, Math.round(weightedMinutes / Math.max(1, Math.min(openTopics.length, 3))));

    for (let d = 0; d < totalDays; d += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const dateKey = date.toISOString().slice(0, 10);
      const topic = openTopics[d % Math.max(1, openTopics.length)];
      if (!topic) continue;
      const intensity = d >= totalDays - 2 ? "Final revision" : d % 3 === 2 ? "Practice" : "Study";
      missions.push({
        examId: exam.id,
        courseName: exam.courseName,
        topicId: topic.id,
        topicName: topic.name,
        dateKey,
        minutes: topicMinutes,
        intensity,
        difficulty: exam.difficulty
      });
    }
  });

  return missions.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || b.difficulty - a.difficulty);
}

function todayMissions() {
  const today = new Date().toISOString().slice(0, 10);
  return studyPlan().filter((mission) => mission.dateKey === today);
}

function pressureState() {
  const next = sortedExams()[0];
  if (!next) return { label: "Calm", hint: "Add exams to calculate pressure.", level: "" };
  const days = daysUntil(next.examDate);
  const open = activeTopics(next).length;
  if (days <= 2 && open > 2) return { label: "High", hint: "Short time and many topics. Use revision mode after first pass.", level: "danger" };
  if (days <= 5 || Number(next.difficulty) >= 5) return { label: "Medium", hint: "Stay consistent with the daily plan.", level: "warn" };
  return { label: "Controlled", hint: "Plan is manageable if you keep momentum.", level: "good" };
}

function formatCountdown(value) {
  const ms = new Date(value) - new Date();
  if (ms <= 0) return "Exam time";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function renderAll(shouldSave = true) {
  if (!currentUser) return;
  $("#studentName").textContent = currentUser.displayName || currentUser.name || currentUser.email;
  $("#modeNote").textContent = isCloudMode() ? "Firebase cloud sync is active." : "Local demo mode is active until Firebase config is added.";
  renderMetrics();
  renderExamList();
  renderPlanFilter();
  renderStudyPlan();
  renderCalendar();
  if (shouldSave) saveData();
}

function renderMetrics() {
  const next = sortedExams()[0];
  const progress = overallProgress();
  const missions = todayMissions();
  const pressure = pressureState();

  $("#overallProgress").textContent = `${progress}%`;
  $("#overallProgressBar").style.width = `${progress}%`;
  $("#todayMinutes").textContent = `${missions.reduce((sum, item) => sum + item.minutes, 0)} min`;
  $("#todayMissionCount").textContent = `${missions.length} mission${missions.length === 1 ? "" : "s"}`;
  $("#pressureLabel").textContent = pressure.label;
  $("#pressureHint").textContent = pressure.hint;
  $(".alert").className = `metric alert ${pressure.level}`;

  if (next) {
    $("#nextExamName").textContent = next.courseName;
    $("#nextExamMeta").textContent = new Date(next.examDate).toLocaleString();
    $("#countdown").textContent = formatCountdown(next.examDate);
  } else {
    $("#nextExamName").textContent = "No exams";
    $("#nextExamMeta").textContent = "Add an exam to start planning.";
    $("#countdown").textContent = "--d --h --m";
  }
}

function renderExamList() {
  $("#examList").innerHTML = sortedExams().length ? sortedExams().map((exam) => {
    const progress = topicProgress(exam);
    return `
      <article class="exam-card">
        <div class="exam-head">
          <div>
            <strong>${escapeHtml(exam.courseName)}</strong>
            <p>${new Date(exam.examDate).toLocaleString()} · Difficulty ${exam.difficulty}/5 · ${daysUntil(exam.examDate)} day(s)</p>
          </div>
          <span class="tag">${progress}% ${revisionMode ? "revised" : "done"}</span>
        </div>
        <div class="mini-progress"><div style="width:${progress}%"></div></div>
        <div class="topic-row">
          ${exam.topics.map((topic) => `
            <label class="topic-check">
              <input type="checkbox" data-topic="${topic.id}" data-exam="${exam.id}" data-mode="${revisionMode ? "revised" : "done"}" ${topic[revisionMode ? "revised" : "done"] ? "checked" : ""}>
              ${escapeHtml(topic.name)}
            </label>
          `).join("")}
        </div>
        <div class="mission-actions" style="margin-top:.75rem">
          <button class="secondary-btn compact" data-edit="${exam.id}" type="button">Edit</button>
          <button class="danger-btn compact" data-delete="${exam.id}" type="button">Delete</button>
        </div>
      </article>
    `;
  }).join("") : `<div class="empty">No exams yet. Add your first course to start the campaign.</div>`;
}

function renderPlanFilter() {
  const previous = $("#planFilter").value;
  $("#planFilter").innerHTML = `<option value="">All exams</option>${sortedExams().map((exam) => `<option value="${exam.id}">${escapeHtml(exam.courseName)}</option>`).join("")}`;
  $("#planFilter").value = previous;
}

function renderStudyPlan() {
  const filter = $("#planFilter").value;
  const missions = studyPlan().filter((mission) => !filter || mission.examId === filter);
  const grouped = missions.slice(0, 28).reduce((groups, mission) => {
    groups[mission.dateKey] ||= [];
    groups[mission.dateKey].push(mission);
    return groups;
  }, {});

  const dates = Object.keys(grouped);
  $("#studyPlan").innerHTML = dates.length ? dates.map((date) => `
    <article class="mission-card">
      <div class="mission-head">
        <strong>${new Date(`${date}T00:00`).toDateString()}</strong>
        <span class="tag">${grouped[date].reduce((sum, item) => sum + item.minutes, 0)} min</span>
      </div>
      ${grouped[date].map((mission) => `
        <p>${escapeHtml(mission.courseName)}: ${escapeHtml(mission.topicName)} · ${mission.intensity} · ${mission.minutes} min</p>
      `).join("")}
    </article>
  `).join("") : `<div class="empty">All topics are checked for this view.</div>`;
}

function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const items = [];

  for (let day = 1; day <= days; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const examsOnDay = exams.filter((exam) => exam.examDate.startsWith(dateKey));
    const missions = studyPlan().filter((mission) => mission.dateKey === dateKey);
    items.push(`
      <div class="calendar-day ${day === today ? "today" : ""} ${examsOnDay.length ? "exam" : ""}">
        <strong>${day}</strong>
        ${examsOnDay.map((exam) => `<span class="calendar-event">Exam: ${escapeHtml(exam.courseName)}</span>`).join("")}
        ${missions.length ? `<span class="calendar-event">${missions.reduce((sum, item) => sum + item.minutes, 0)} min study</span>` : ""}
      </div>
    `);
  }

  $("#calendar").innerHTML = items.join("");
}

function clearExamForm() {
  $("#examForm").reset();
  $("#examId").value = "";
  $("#difficulty").value = "3";
  $("#dailyCapacity").value = "120";
  $("#examFormTitle").textContent = "Add exam";
}

function fillExamForm(exam) {
  $("#examId").value = exam.id;
  $("#courseName").value = exam.courseName;
  $("#examDate").value = exam.examDate;
  $("#difficulty").value = exam.difficulty;
  $("#dailyCapacity").value = exam.dailyCapacity;
  $("#topicsInput").value = exam.topics.map((topic) => topic.name).join("\n");
  $("#examFormTitle").textContent = "Update exam";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderAll(false);
  clearInterval(timer);
  timer = setInterval(renderMetrics, 30000);
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
      exams = [];
      listenCloudData();
    } else {
      const accounts = getAccounts();
      if (accounts[email]) throw new Error("An account already exists for this email.");
      accounts[email] = { email, name, passwordHash: simpleHash(password) };
      saveAccounts(accounts);
      localStorage.setItem(SESSION_KEY, email);
      currentUser = accounts[email];
      exams = [];
      localSave();
      showApp();
    }
    showToast("Account created.");
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
      listenCloudData();
    } else {
      const accounts = getAccounts();
      if (!accounts[email] || accounts[email].passwordHash !== simpleHash(password)) throw new Error("Email or password is incorrect.");
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
  const email = "demo@examwarroom.app";
  const accounts = getAccounts();
  accounts[email] = { email, name: "Demo Student", passwordHash: simpleHash("demo123") };
  saveAccounts(accounts);
  localStorage.setItem(SESSION_KEY, email);
  currentUser = accounts[email];
  if (localStorage.getItem(dataKey(email))) localLoad();
  else {
    exams = structuredClone(demoExams);
    localSave();
  }
  showApp();
  showToast("Demo war room loaded.");
});

$("#examForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const existing = exams.find((exam) => exam.id === $("#examId").value);
  const topicNames = $("#topicsInput").value.split(/\n|,/).map((topic) => topic.trim()).filter(Boolean);
  const exam = {
    id: $("#examId").value || crypto.randomUUID(),
    courseName: $("#courseName").value.trim(),
    examDate: $("#examDate").value,
    difficulty: Number($("#difficulty").value),
    dailyCapacity: Number($("#dailyCapacity").value),
    topics: topicNames.map((name) => {
      const old = existing?.topics.find((topic) => topic.name.toLowerCase() === name.toLowerCase());
      return old || { id: crypto.randomUUID(), name, done: false, revised: false };
    })
  };

  const index = exams.findIndex((item) => item.id === exam.id);
  if (index >= 0) exams[index] = exam;
  else exams.push(exam);
  clearExamForm();
  renderAll();
  showToast("Exam saved.");
});

document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");

  if (edit) {
    const exam = exams.find((item) => item.id === edit.dataset.edit);
    if (exam) fillExamForm(exam);
  }

  if (del) {
    exams = exams.filter((exam) => exam.id !== del.dataset.delete);
    renderAll();
    showToast("Exam deleted.");
  }
});

document.addEventListener("change", (event) => {
  const topicInput = event.target.closest("[data-topic]");
  if (!topicInput) return;
  const exam = exams.find((item) => item.id === topicInput.dataset.exam);
  const topic = exam?.topics.find((item) => item.id === topicInput.dataset.topic);
  if (!topic) return;
  topic[topicInput.dataset.mode] = topicInput.checked;
  renderAll();
});

$("#planFilter").addEventListener("change", renderStudyPlan);
$("#clearExamForm").addEventListener("click", clearExamForm);

$("#revisionToggle").addEventListener("click", () => {
  revisionMode = !revisionMode;
  $("#revisionToggle").textContent = revisionMode ? "First Pass Mode" : "Revision Mode";
  renderAll(false);
  showToast(revisionMode ? "Revision mode active." : "First-pass mode active.");
});

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
});

$("#logoutBtn").addEventListener("click", async () => {
  if (unsubscribeData) unsubscribeData();
  clearInterval(timer);
  if (isCloudMode()) await firebaseApi.signOut(firebase.auth);
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  exams = [];
  showAuth();
});

applyTheme();

try {
  firebase = await initFirebase();
  if (isCloudMode()) {
    firebaseApi.onAuthStateChanged(firebase.auth, (user) => {
      if (user) {
        currentUser = user;
        listenCloudData();
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
