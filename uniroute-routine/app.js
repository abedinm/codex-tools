const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACCOUNT_KEY = "uniroute.accounts.v1";
const SESSION_KEY = "uniroute.session.v1";
const THEME_KEY = "uniroute.theme.v1";

let currentUser = null;
let classes = [];
let timer = null;

const demoClasses = [
  {
    id: crypto.randomUUID(),
    subjectName: "Artificial Intelligence",
    teacherName: "Dr. Samira Khan",
    roomNumber: "CSE-402",
    buildingName: "Innovation Building",
    classDay: DAYS[new Date().getDay()],
    startTime: "09:30",
    endTime: "10:45",
    colorTag: "#38bdf8",
    roomNote: "4th floor, right side corridor, beside AI lab.",
    attendedDates: []
  },
  {
    id: crypto.randomUUID(),
    subjectName: "Database Systems",
    teacherName: "Prof. Mahmud",
    roomNumber: "B-210",
    buildingName: "Academic Block B",
    classDay: DAYS[new Date().getDay()],
    startTime: "13:00",
    endTime: "14:15",
    colorTag: "#34d399",
    roomNote: "2nd floor, near the faculty lounge.",
    attendedDates: []
  },
  {
    id: crypto.randomUUID(),
    subjectName: "Software Engineering",
    teacherName: "Ms. Nusrat Jahan",
    roomNumber: "LAB-3",
    buildingName: "Computer Lab Complex",
    classDay: DAYS[(new Date().getDay() + 1) % 7],
    startTime: "11:00",
    endTime: "12:30",
    colorTag: "#a78bfa",
    roomNote: "Ground floor, glass door beside server room.",
    attendedDates: []
  }
];

function getAccounts() {
  return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "{}");
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

function userKey(email) {
  return `uniroute.routine.${email.toLowerCase()}`;
}

function simpleHash(value) {
  return btoa(unescape(encodeURIComponent(value))).split("").reverse().join("");
}

function loadUserData() {
  classes = JSON.parse(localStorage.getItem(userKey(currentUser.email)) || "[]");
}

function saveUserData() {
  localStorage.setItem(userKey(currentUser.email), JSON.stringify(classes));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function todayName() {
  return DAYS[new Date().getDay()];
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function classDateTime(item, key = "startTime", base = new Date()) {
  const date = new Date(base);
  const [hours, minutes] = item[key].split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function sortClasses(items) {
  return [...items].sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.classDay) - DAYS.indexOf(b.classDay);
    return dayDiff || minutesFromTime(a.startTime) - minutesFromTime(b.startTime);
  });
}

function statusFor(item) {
  const now = new Date();
  const isToday = item.classDay === todayName();
  const start = classDateTime(item, "startTime", now);
  const end = classDateTime(item, "endTime", now);
  const attended = item.attendedDates?.includes(dateStamp());

  if (!isToday) return "scheduled";
  if (attended) return "finished";
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "running";
  return "missed";
}

function findNextClass() {
  if (!classes.length) return null;
  const now = new Date();
  const candidates = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (now.getDay() + offset) % 7;
    const day = DAYS[dayIndex];
    classes
      .filter((item) => item.classDay === day)
      .forEach((item) => {
        const next = new Date(now);
        next.setDate(now.getDate() + offset);
        const [hours, minutes] = item.startTime.split(":").map(Number);
        next.setHours(hours, minutes, 0, 0);
        if (next > now) candidates.push({ item, next });
      });
  }

  return candidates.sort((a, b) => a.next - b.next)[0] || null;
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function renderClassCard(item, options = {}) {
  const status = statusFor(item);
  const statusLabel = {
    scheduled: "Scheduled",
    upcoming: "Upcoming",
    running: "Running now",
    finished: "Finished",
    missed: "Missed"
  }[status];

  const attendButton = item.classDay === todayName()
    ? `<button class="outline-btn compact" data-attend="${item.id}" type="button">${status === "finished" ? "Undo attended" : "Mark attended"}</button>`
    : "";

  const actions = options.readonly ? "" : `
    <div class="card-actions">
      ${attendButton}
      <button class="outline-btn compact" data-edit="${item.id}" type="button">Edit</button>
      <button class="danger-btn compact" data-delete="${item.id}" type="button">Delete</button>
    </div>
  `;

  return `
    <article class="class-card" style="--accent:${item.colorTag}">
      <div class="class-head">
        <div>
          <strong>${escapeHtml(item.subjectName)}</strong>
          <div class="class-meta">${escapeHtml(item.teacherName)} · ${item.classDay}, ${item.startTime} - ${item.endTime}</div>
        </div>
        <span class="tag">${statusLabel}</span>
      </div>
      <div class="tag-row">
        <span class="tag">Room ${escapeHtml(item.roomNumber)}</span>
        <span class="tag">${escapeHtml(item.buildingName)}</span>
      </div>
      <div class="room-note">${escapeHtml(item.roomNote || "No room finder note saved yet.")}</div>
      ${actions}
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function renderDashboard() {
  const today = todayName();
  const todayItems = sortClasses(classes.filter((item) => item.classDay === today));
  const finished = todayItems.filter((item) => statusFor(item) === "finished");
  const missed = todayItems.filter((item) => statusFor(item) === "missed");
  const next = findNextClass();

  $("#todayLabel").textContent = `${today}'s classes`;
  $("#todayCount").textContent = todayItems.length;
  $("#finishedCount").textContent = finished.length;
  $("#missedCount").textContent = missed.length;
  $("#todayClasses").innerHTML = todayItems.length
    ? todayItems.map((item) => renderClassCard(item)).join("")
    : emptyState("No classes for today. Add a weekly routine to see your day here.");

  if (next) {
    $("#nextSubject").textContent = next.item.subjectName;
    $("#nextMeta").textContent = `${next.item.classDay}, ${next.item.startTime} · ${next.item.buildingName}, room ${next.item.roomNumber}`;
    $("#countdown").textContent = formatDuration(next.next - new Date());
  } else {
    $("#nextSubject").textContent = "No class scheduled";
    $("#nextMeta").textContent = "Add your weekly routine to start countdown.";
    $("#countdown").textContent = "--:--:--";
  }
}

function renderRoutineList() {
  const sorted = sortClasses(classes);
  $("#routineList").innerHTML = sorted.length
    ? sorted.map((item) => renderClassCard(item)).join("")
    : emptyState("Your routine is empty. Add your first class above.");
}

function renderSearch() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const day = $("#dayFilter").value;
  const results = sortClasses(classes).filter((item) => {
    const haystack = [
      item.subjectName,
      item.teacherName,
      item.roomNumber,
      item.buildingName,
      item.classDay,
      item.roomNote
    ].join(" ").toLowerCase();

    return (!day || item.classDay === day) && (!query || haystack.includes(query));
  });

  $("#searchResults").innerHTML = results.length
    ? results.map((item) => renderClassCard(item)).join("")
    : emptyState("No matching classes found.");
}

function renderAll() {
  if (!currentUser) return;
  $("#studentName").textContent = currentUser.name;
  $("#accountEmail").textContent = currentUser.email;
  renderDashboard();
  renderRoutineList();
  renderSearch();
}

function fillForm(item) {
  $("#classId").value = item.id;
  $("#subjectName").value = item.subjectName;
  $("#teacherName").value = item.teacherName;
  $("#roomNumber").value = item.roomNumber;
  $("#buildingName").value = item.buildingName;
  $("#classDay").value = item.classDay;
  $("#startTime").value = item.startTime;
  $("#endTime").value = item.endTime;
  $("#colorTag").value = item.colorTag;
  $("#roomNote").value = item.roomNote || "";
  $("#formTitle").textContent = "Update class";
  showSection("routineSection");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  $("#routineForm").reset();
  $("#classId").value = "";
  $("#colorTag").value = "#38bdf8";
  $("#formTitle").textContent = "Add a class";
}

function showSection(id) {
  $$(".section").forEach((section) => section.classList.toggle("active", section.id === id));
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.section === id));
}

function bootSession() {
  const sessionEmail = localStorage.getItem(SESSION_KEY);
  const accounts = getAccounts();
  if (!sessionEmail || !accounts[sessionEmail]) return;

  currentUser = accounts[sessionEmail];
  loadUserData();
  showApp();
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  renderAll();
  if (timer) clearInterval(timer);
  timer = setInterval(renderDashboard, 1000);
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  classes = [];
  clearInterval(timer);
  $("#dashboard").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  showToast("Logged out.");
}

function updateNetworkStatus() {
  const status = $("#networkStatus");
  status.textContent = navigator.onLine ? "Online" : "Offline";
  status.style.color = navigator.onLine ? "var(--success)" : "var(--warning)";
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", theme === "light");
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

$("#signupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#signupEmail").value.trim().toLowerCase();
  const accounts = getAccounts();
  if (accounts[email]) {
    showToast("An account already exists for this email.");
    return;
  }

  accounts[email] = {
    name: $("#signupName").value.trim(),
    email,
    passwordHash: simpleHash($("#signupPassword").value)
  };
  saveAccounts(accounts);
  localStorage.setItem(SESSION_KEY, email);
  currentUser = accounts[email];
  classes = [];
  saveUserData();
  showApp();
  showToast("Account created. Your routine is ready.");
});

$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#loginEmail").value.trim().toLowerCase();
  const accounts = getAccounts();
  if (!accounts[email] || accounts[email].passwordHash !== simpleHash($("#loginPassword").value)) {
    showToast("Email or password is incorrect.");
    return;
  }

  currentUser = accounts[email];
  localStorage.setItem(SESSION_KEY, email);
  loadUserData();
  showApp();
  showToast("Logged in.");
});

$("#demoLogin").addEventListener("click", () => {
  const email = "demo@uniroute.app";
  const accounts = getAccounts();
  accounts[email] = {
    name: "Demo Student",
    email,
    passwordHash: simpleHash("demo")
  };
  saveAccounts(accounts);
  currentUser = accounts[email];
  localStorage.setItem(SESSION_KEY, email);
  if (!localStorage.getItem(userKey(email))) {
    classes = demoClasses;
    saveUserData();
  } else {
    loadUserData();
  }
  showApp();
  showToast("Demo account loaded.");
});

$("#routineForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("#endTime").value <= $("#startTime").value) {
    showToast("End time must be after start time.");
    return;
  }

  const payload = {
    id: $("#classId").value || crypto.randomUUID(),
    subjectName: $("#subjectName").value.trim(),
    teacherName: $("#teacherName").value.trim(),
    roomNumber: $("#roomNumber").value.trim(),
    buildingName: $("#buildingName").value.trim(),
    classDay: $("#classDay").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    colorTag: $("#colorTag").value,
    roomNote: $("#roomNote").value.trim(),
    attendedDates: classes.find((item) => item.id === $("#classId").value)?.attendedDates || []
  };

  const index = classes.findIndex((item) => item.id === payload.id);
  if (index >= 0) {
    classes[index] = payload;
    showToast("Class updated.");
  } else {
    classes.push(payload);
    showToast("Class added.");
  }

  saveUserData();
  clearForm();
  renderAll();
});

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-section]");
  const jump = event.target.closest("[data-jump]");
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  const attend = event.target.closest("[data-attend]");

  if (nav) showSection(nav.dataset.section);
  if (jump) showSection(jump.dataset.jump);
  if (edit) {
    const item = classes.find((classItem) => classItem.id === edit.dataset.edit);
    if (item) fillForm(item);
  }
  if (del) {
    const item = classes.find((classItem) => classItem.id === del.dataset.delete);
    if (item && confirm(`Delete ${item.subjectName}?`)) {
      classes = classes.filter((classItem) => classItem.id !== item.id);
      saveUserData();
      renderAll();
      showToast("Class deleted.");
    }
  }
  if (attend) {
    const item = classes.find((classItem) => classItem.id === attend.dataset.attend);
    if (!item) return;
    item.attendedDates ||= [];
    const stamp = dateStamp();
    if (item.attendedDates.includes(stamp)) {
      item.attendedDates = item.attendedDates.filter((date) => date !== stamp);
      showToast("Attendance removed.");
    } else {
      item.attendedDates.push(stamp);
      showToast("Marked attended.");
    }
    saveUserData();
    renderAll();
  }
});

$("#clearForm").addEventListener("click", clearForm);
$("#logoutBtn").addEventListener("click", logout);
$("#searchInput").addEventListener("input", renderSearch);
$("#dayFilter").addEventListener("change", renderSearch);

$("#themeToggle").addEventListener("click", () => {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
});

$("#clearData").addEventListener("click", () => {
  if (!confirm("Delete all routine data for this account?")) return;
  classes = [];
  saveUserData();
  renderAll();
  showToast("Routine data deleted.");
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

applyTheme();
updateNetworkStatus();
bootSession();
