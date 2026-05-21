// Firebase setup:
// 1. Create a Firebase web app.
// 2. Enable Email/Password Auth and Cloud Firestore.
// 3. Paste your config below and set enabled: true.
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

const LOCAL_ACCOUNT_KEY = "deadlineShield.accounts.v1";
const LOCAL_SESSION_KEY = "deadlineShield.session.v1";
const THEME_KEY = "deadlineShield.theme.v1";

let firebase = null;
let firebaseApi = null;
let currentUser = null;
let assignments = [];
let unsubscribeAssignments = null;
let notificationTimer = null;

function toDateTimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

const demoAssignments = [
  {
    id: crypto.randomUUID(),
    courseName: "ENG 204",
    assignmentTitle: "Critical Essay Draft",
    deadlineAt: toDateTimeLocalValue(new Date(Date.now() + 6 * 60 * 60 * 1000)),
    wordCount: 1800,
    submissionLink: "https://classroom.google.com/",
    progress: 35,
    status: "Started",
    notes: "Need thesis, two quotes, conclusion, and references."
  },
  {
    id: crypto.randomUUID(),
    courseName: "CSE 321",
    assignmentTitle: "Database ERD + Report",
    deadlineAt: toDateTimeLocalValue(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
    wordCount: 1200,
    submissionLink: "https://moodle.example.edu/",
    progress: 72,
    status: "Almost Done",
    notes: "Export diagram as PDF before submitting."
  },
  {
    id: crypto.randomUUID(),
    courseName: "BUS 110",
    assignmentTitle: "Marketing Case Notes",
    deadlineAt: toDateTimeLocalValue(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
    wordCount: 900,
    submissionLink: "",
    progress: 0,
    status: "Not Started",
    notes: "Use the template from week 7."
  }
];

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

function getLocalAccounts() {
  return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY) || "{}");
}

function saveLocalAccounts(accounts) {
  localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(accounts));
}

function localDataKey(email) {
  return `deadlineShield.assignments.${email.toLowerCase()}`;
}

function simpleHash(value) {
  return btoa(unescape(encodeURIComponent(value))).split("").reverse().join("");
}

function loadLocalAssignments() {
  assignments = JSON.parse(localStorage.getItem(localDataKey(currentUser.email)) || "[]");
}

function saveLocalAssignments() {
  localStorage.setItem(localDataKey(currentUser.email), JSON.stringify(assignments));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function hoursUntil(value) {
  return (new Date(value) - new Date()) / 36e5;
}

function urgencyScore(item) {
  if (item.status === "Submitted") return 999999;
  const hours = hoursUntil(item.deadlineAt);
  const progressPenalty = (100 - Number(item.progress || 0)) / 8;
  return hours + progressPenalty;
}

function sortedAssignments() {
  return [...assignments].sort((a, b) => urgencyScore(a) - urgencyScore(b));
}

function tagClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function renderMetrics() {
  const active = assignments.filter((item) => item.status !== "Submitted");
  const panic = active.filter((item) => hoursUntil(item.deadlineAt) <= 24 && hoursUntil(item.deadlineAt) >= 0);
  const submitted = assignments.filter((item) => item.status === "Submitted");
  const average = assignments.length
    ? Math.round(assignments.reduce((sum, item) => sum + Number(item.progress || 0), 0) / assignments.length)
    : 0;

  $("#panicCount").textContent = panic.length;
  $("#activeCount").textContent = active.length;
  $("#submittedCount").textContent = submitted.length;
  $("#averageProgress").textContent = `${average}%`;
}

function renderPanicMode() {
  const panicItems = sortedAssignments().filter((item) => {
    const hours = hoursUntil(item.deadlineAt);
    return item.status !== "Submitted" && hours <= 24 && hours >= 0;
  });

  if (!panicItems.length) {
    $("#panicPanel").classList.add("hidden");
    return;
  }

  const item = panicItems[0];
  const remainingHours = Math.max(1, Math.floor(hoursUntil(item.deadlineAt)));
  const remainingWords = Math.max(0, Number(item.wordCount || 0) - Math.round(Number(item.wordCount || 0) * Number(item.progress || 0) / 100));
  const chunks = Math.max(2, Math.min(6, Math.ceil(remainingHours / 2)));
  const wordsPerChunk = Math.ceil(remainingWords / chunks);

  $("#panicPanel").classList.remove("hidden");
  $("#panicTitle").textContent = `${item.courseName}: ${item.assignmentTitle}`;
  $("#panicSubtitle").textContent = `${remainingHours} hour(s) left. Target about ${remainingWords} remaining words.`;
  $("#panicSteps").innerHTML = [
    `Open the submission page and confirm exact requirements for ${escapeHtml(item.courseName)}.`,
    `Create a rough outline in 10 minutes: intro, ${chunks} body chunk(s), conclusion, references.`,
    `Write ${wordsPerChunk} words per sprint. Use 25 minutes writing, 5 minutes checking.`,
    `Spend one sprint only on sources, citations, images, or tables. Do not over-polish early.`,
    `At 90 minutes before deadline, stop adding new ideas and format the document.`,
    `At 30 minutes before deadline, export, upload, screenshot confirmation, and mark Submitted.`
  ].map((step) => `<li>${step}</li>`).join("");
}

function assignmentCard(item) {
  const hours = hoursUntil(item.deadlineAt);
  const isPanic = item.status !== "Submitted" && hours <= 24 && hours >= 0;
  const timeLabel = hours < 0 ? "Overdue" : `${Math.max(0, Math.floor(hours))}h left`;
  const link = item.submissionLink
    ? `<a class="secondary-btn compact" href="${escapeHtml(item.submissionLink)}" target="_blank" rel="noreferrer">Open Link</a>`
    : "";

  return `
    <article class="assignment-card">
      <div class="assignment-head">
        <div>
          <strong>${escapeHtml(item.assignmentTitle)}</strong>
          <div class="meta">${escapeHtml(item.courseName)} · Due ${formatDateTime(item.deadlineAt)}</div>
        </div>
        <span class="tag ${isPanic ? "status-not-started" : ""}">${isPanic ? "Panic Mode" : timeLabel}</span>
      </div>
      <div class="tag-row">
        <span class="tag ${tagClass(item.status)}">${item.status}</span>
        <span class="tag">${Number(item.wordCount).toLocaleString()} words</span>
        <span class="tag">${item.progress}% complete</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${item.progress}%"></div></div>
      <p>${escapeHtml(item.notes || "No notes added.")}</p>
      <div class="card-actions">
        <button class="secondary-btn compact" data-edit="${item.id}" type="button">Edit</button>
        <button class="secondary-btn compact" data-submit="${item.id}" type="button">Mark Submitted</button>
        ${link}
        <button class="danger-btn compact" data-delete="${item.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function renderAssignments() {
  const filter = $("#statusFilter").value;
  const items = sortedAssignments().filter((item) => !filter || item.status === filter);
  $("#assignmentList").innerHTML = items.length
    ? items.map(assignmentCard).join("")
    : `<div class="empty">No assignments match this view. Add one and let the shield sort it.</div>`;
}

function renderAll() {
  if (!currentUser) return;
  $("#studentName").textContent = currentUser.displayName || currentUser.name || currentUser.email;
  $("#cloudNote").textContent = isCloudMode()
    ? "Firebase cloud mode is active."
    : "Local demo mode is active until Firebase config is added.";
  renderMetrics();
  renderPanicMode();
  renderAssignments();
}

function resetForm() {
  $("#assignmentForm").reset();
  $("#assignmentId").value = "";
  $("#progress").value = 0;
  $("#progressValue").textContent = "0%";
  $("#formTitle").textContent = "Add assignment";
}

function fillForm(item) {
  $("#assignmentId").value = item.id;
  $("#courseName").value = item.courseName;
  $("#assignmentTitle").value = item.assignmentTitle;
  $("#deadlineAt").value = item.deadlineAt;
  $("#wordCount").value = item.wordCount;
  $("#submissionLink").value = item.submissionLink || "";
  $("#progress").value = item.progress;
  $("#progressValue").textContent = `${item.progress}%`;
  $("#status").value = item.status;
  $("#notes").value = item.notes || "";
  $("#formTitle").textContent = "Update assignment";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveAssignment(item) {
  if (isCloudMode()) {
    await firebaseApi.setDoc(firebaseApi.doc(firebase.db, "users", currentUser.uid, "assignments", item.id), {
      ...item,
      updatedAt: firebaseApi.serverTimestamp()
    });
    return;
  }

  const index = assignments.findIndex((assignment) => assignment.id === item.id);
  if (index >= 0) assignments[index] = item;
  else assignments.push(item);
  saveLocalAssignments();
  renderAll();
}

async function removeAssignment(id) {
  if (isCloudMode()) {
    await firebaseApi.deleteDoc(firebaseApi.doc(firebase.db, "users", currentUser.uid, "assignments", id));
    return;
  }

  assignments = assignments.filter((item) => item.id !== id);
  saveLocalAssignments();
  renderAll();
}

function listenCloudAssignments() {
  if (unsubscribeAssignments) unsubscribeAssignments();
  const ref = firebaseApi.collection(firebase.db, "users", currentUser.uid, "assignments");
  unsubscribeAssignments = firebaseApi.onSnapshot(ref, (snapshot) => {
    assignments = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderAll();
  }, (error) => showToast(error.message));
}

function showApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  renderAll();
  startNotificationLoop();
}

function showAuth() {
  $("#appView").classList.add("hidden");
  $("#authView").classList.remove("hidden");
}

function applyTheme() {
  document.body.classList.toggle("light", localStorage.getItem(THEME_KEY) === "light");
}

function startNotificationLoop() {
  clearInterval(notificationTimer);
  notificationTimer = setInterval(() => {
    if (Notification?.permission !== "granted") return;
    sortedAssignments().forEach((item) => {
      const hours = hoursUntil(item.deadlineAt);
      const noticeKey = `deadlineShield.notice.${item.id}`;
      if (item.status !== "Submitted" && hours <= 24 && hours > 23.7 && !localStorage.getItem(noticeKey)) {
        new Notification("Deadline Panic Shield", {
          body: `${item.courseName}: ${item.assignmentTitle} is within 24 hours. Panic Mode is ready.`
        });
        localStorage.setItem(noticeKey, "sent");
      }
    });
  }, 60_000);
}

function bootLocalSession() {
  const email = localStorage.getItem(LOCAL_SESSION_KEY);
  const accounts = getLocalAccounts();
  if (!email || !accounts[email]) return;
  currentUser = accounts[email];
  loadLocalAssignments();
  showApp();
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
      listenCloudAssignments();
    } else {
      const accounts = getLocalAccounts();
      if (accounts[email]) throw new Error("An account already exists for this email.");
      accounts[email] = { email, name, passwordHash: simpleHash(password) };
      saveLocalAccounts(accounts);
      localStorage.setItem(LOCAL_SESSION_KEY, email);
      currentUser = accounts[email];
      assignments = [];
      saveLocalAssignments();
    }
    showApp();
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
      listenCloudAssignments();
    } else {
      const accounts = getLocalAccounts();
      if (!accounts[email] || accounts[email].passwordHash !== simpleHash(password)) {
        throw new Error("Email or password is incorrect.");
      }
      localStorage.setItem(LOCAL_SESSION_KEY, email);
      currentUser = accounts[email];
      loadLocalAssignments();
    }
    showApp();
    showToast("Logged in.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#demoLogin").addEventListener("click", () => {
  const email = "demo@panicshield.app";
  const accounts = getLocalAccounts();
  accounts[email] = { email, name: "Demo Student", passwordHash: simpleHash("demo123") };
  saveLocalAccounts(accounts);
  localStorage.setItem(LOCAL_SESSION_KEY, email);
  currentUser = accounts[email];

  if (!localStorage.getItem(localDataKey(email))) {
    assignments = demoAssignments;
    saveLocalAssignments();
  } else {
    loadLocalAssignments();
  }

  showApp();
  showToast("Demo dashboard loaded.");
});

$("#assignmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = {
    id: $("#assignmentId").value || crypto.randomUUID(),
    courseName: $("#courseName").value.trim(),
    assignmentTitle: $("#assignmentTitle").value.trim(),
    deadlineAt: $("#deadlineAt").value,
    wordCount: Number($("#wordCount").value),
    submissionLink: $("#submissionLink").value.trim(),
    progress: Number($("#progress").value),
    status: $("#status").value,
    notes: $("#notes").value.trim()
  };

  if (item.status === "Submitted") item.progress = 100;

  await saveAssignment(item);
  resetForm();
  showToast("Assignment saved.");
});

document.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  const submit = event.target.closest("[data-submit]");

  if (edit) {
    const item = assignments.find((assignment) => assignment.id === edit.dataset.edit);
    if (item) fillForm(item);
  }

  if (del) {
    const item = assignments.find((assignment) => assignment.id === del.dataset.delete);
    if (item && confirm(`Delete ${item.assignmentTitle}?`)) {
      await removeAssignment(item.id);
      showToast("Assignment deleted.");
    }
  }

  if (submit) {
    const item = assignments.find((assignment) => assignment.id === submit.dataset.submit);
    if (item) {
      await saveAssignment({ ...item, status: "Submitted", progress: 100 });
      showToast("Marked submitted.");
    }
  }
});

$("#progress").addEventListener("input", () => {
  $("#progressValue").textContent = `${$("#progress").value}%`;
  if (Number($("#progress").value) >= 90) $("#status").value = "Almost Done";
  else if (Number($("#progress").value) > 0 && $("#status").value === "Not Started") $("#status").value = "Started";
});

$("#statusFilter").addEventListener("change", renderAssignments);
$("#resetForm").addEventListener("click", resetForm);

$("#notificationBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications.");
    return;
  }
  const result = await Notification.requestPermission();
  showToast(result === "granted" ? "Notifications enabled." : "Notifications were not enabled.");
});

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
});

$("#logoutBtn").addEventListener("click", async () => {
  if (unsubscribeAssignments) unsubscribeAssignments();
  clearInterval(notificationTimer);
  if (isCloudMode()) await firebaseApi.signOut(firebase.auth);
  localStorage.removeItem(LOCAL_SESSION_KEY);
  currentUser = null;
  assignments = [];
  showAuth();
  showToast("Logged out.");
});

applyTheme();

try {
  firebase = await initFirebase();
  if (isCloudMode()) {
    firebaseApi.onAuthStateChanged(firebase.auth, (user) => {
      if (user) {
        currentUser = user;
        listenCloudAssignments();
        showApp();
      } else {
        showAuth();
      }
    });
  } else {
    bootLocalSession();
  }
} catch (error) {
  firebase = null;
  firebaseApi = null;
  bootLocalSession();
  showToast(`Firebase did not start: ${error.message}. Local mode is active.`);
}
