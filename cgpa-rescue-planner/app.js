const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ACCOUNT_KEY = "cgpaRescue.accounts.v1";
const SESSION_KEY = "cgpaRescue.session.v1";
const THEME_KEY = "cgpaRescue.theme.v1";

const gradeLabels = {
  "4": "A",
  "4.00": "A",
  "3.75": "A-",
  "3.5": "B+",
  "3.50": "B+",
  "3.25": "B",
  "3": "B-",
  "3.00": "B-",
  "2.75": "C+",
  "2.5": "C",
  "2.50": "C",
  "2.25": "D",
  "0": "F",
  "0.00": "F"
};

let currentUser = null;
let courses = [];
let snapshots = [];

const demoCourses = [
  { id: crypto.randomUUID(), semesterName: "Fall 2026", courseName: "Machine Learning", credits: 3, targetGrade: 3.75 },
  { id: crypto.randomUUID(), semesterName: "Fall 2026", courseName: "Software Project", credits: 3, targetGrade: 4.0 },
  { id: crypto.randomUUID(), semesterName: "Spring 2027", courseName: "Data Mining", credits: 3, targetGrade: 3.75 },
  { id: crypto.randomUUID(), semesterName: "Spring 2027", courseName: "Research Methods", credits: 2, targetGrade: 3.5 }
];

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
  return `cgpaRescue.data.${email.toLowerCase()}`;
}

function readInputs() {
  return {
    currentCgpa: Number($("#currentCgpa").value || 0),
    completedCredits: Number($("#completedCredits").value || 0),
    remainingCredits: Number($("#remainingCredits").value || 0),
    targetCgpa: Number($("#targetCgpa").value || 0)
  };
}

function loadData() {
  const saved = JSON.parse(localStorage.getItem(dataKey(currentUser.email)) || "{}");
  courses = saved.courses || [];
  snapshots = saved.snapshots || [];
  const values = saved.values || {};
  $("#currentCgpa").value = values.currentCgpa ?? 2.85;
  $("#completedCredits").value = values.completedCredits ?? 72;
  $("#remainingCredits").value = values.remainingCredits ?? 48;
  $("#targetCgpa").value = values.targetCgpa ?? 3.3;
}

function saveData() {
  if (!currentUser) return;
  localStorage.setItem(dataKey(currentUser.email), JSON.stringify({
    values: readInputs(),
    courses,
    snapshots
  }));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2300);
}

function calculateRequiredGpa() {
  const { currentCgpa, completedCredits, remainingCredits, targetCgpa } = readInputs();
  if (remainingCredits <= 0) return Infinity;
  const currentPoints = currentCgpa * completedCredits;
  const totalCredits = completedCredits + remainingCredits;
  const neededPoints = targetCgpa * totalCredits - currentPoints;
  return neededPoints / remainingCredits;
}

function plannedAverage() {
  const totalCredits = courses.reduce((sum, course) => sum + Number(course.credits), 0);
  if (!totalCredits) return 0;
  const points = courses.reduce((sum, course) => sum + Number(course.credits) * Number(course.targetGrade), 0);
  return points / totalCredits;
}

function projectedCgpa() {
  const { currentCgpa, completedCredits } = readInputs();
  const plannedCredits = courses.reduce((sum, course) => sum + Number(course.credits), 0);
  const plannedPoints = courses.reduce((sum, course) => sum + Number(course.credits) * Number(course.targetGrade), 0);
  const totalCredits = completedCredits + plannedCredits;
  if (!totalCredits) return currentCgpa;
  return ((currentCgpa * completedCredits) + plannedPoints) / totalCredits;
}

function maxReachableTarget(assumedFutureGpa = 4) {
  const { currentCgpa, completedCredits, remainingCredits } = readInputs();
  const total = completedCredits + remainingCredits;
  if (!total) return 0;
  return ((currentCgpa * completedCredits) + (assumedFutureGpa * remainingCredits)) / total;
}

function renderResult() {
  const required = calculateRequiredGpa();
  const planned = plannedAverage();
  const projection = projectedCgpa();
  const safeTarget = maxReachableTarget(3.5);
  const maxTarget = maxReachableTarget(4);
  const warning = $("#warningBox");

  $("#requiredGpa").textContent = Number.isFinite(required) ? required.toFixed(2) : "--";
  $("#resultText").textContent = `Your planned courses average ${planned.toFixed(2)} and currently project a CGPA of ${projection.toFixed(2)}.`;

  warning.className = "warning-box";
  if (!Number.isFinite(required)) {
    warning.classList.add("warn");
    warning.textContent = "No remaining credits entered. Add remaining credits to calculate a rescue path.";
  } else if (required > 4) {
    warning.classList.add("bad");
    warning.textContent = `This target is unrealistic on a 4.00 scale. Maximum possible target is about ${maxTarget.toFixed(2)}. Safer target: ${safeTarget.toFixed(2)}.`;
  } else if (required >= 3.75) {
    warning.classList.add("warn");
    warning.textContent = `This is possible but very demanding. You need around ${required.toFixed(2)} every remaining credit. Safer target: ${safeTarget.toFixed(2)}.`;
  } else if (required <= 0) {
    warning.classList.add("good");
    warning.textContent = "Your current CGPA already meets or exceeds this target.";
  } else {
    warning.classList.add("good");
    warning.textContent = `This target looks realistic if you can average about ${required.toFixed(2)} going forward.`;
  }
}

function groupBySemester() {
  return courses.reduce((groups, course) => {
    groups[course.semesterName] ||= [];
    groups[course.semesterName].push(course);
    return groups;
  }, {});
}

function renderSemesters() {
  const groups = groupBySemester();
  const semesterNames = Object.keys(groups);
  if (!semesterNames.length) {
    $("#semesterList").innerHTML = `<div class="semester-card"><p>No planned courses yet. Add your next semester to start projecting.</p></div>`;
    return;
  }

  $("#semesterList").innerHTML = semesterNames.map((semester) => {
    const rows = groups[semester];
    const credits = rows.reduce((sum, course) => sum + Number(course.credits), 0);
    const avg = rows.reduce((sum, course) => sum + Number(course.credits) * Number(course.targetGrade), 0) / credits;
    return `
      <article class="semester-card">
        <div class="semester-head">
          <div>
            <strong>${escapeHtml(semester)}</strong>
            <p>${credits} credits · target semester GPA ${avg.toFixed(2)}</p>
          </div>
          <span class="tag">${rows.length} course${rows.length === 1 ? "" : "s"}</span>
        </div>
        ${rows.map(courseRow).join("")}
      </article>
    `;
  }).join("");
}

function courseRow(course) {
  const grade = gradeLabels[String(course.targetGrade)] || Number(course.targetGrade).toFixed(2);
  return `
    <div class="course-row">
      <div>
        <strong>${escapeHtml(course.courseName)}</strong>
        <p>${course.credits} credits · target ${grade} / ${Number(course.targetGrade).toFixed(2)}</p>
      </div>
      <div class="row-actions">
        <button class="secondary-btn compact" data-edit="${course.id}" type="button">Edit</button>
        <button class="danger-btn compact" data-delete="${course.id}" type="button">Delete</button>
      </div>
    </div>
  `;
}

function renderSnapshots() {
  if (!snapshots.length) {
    $("#snapshotList").innerHTML = `<div class="snapshot-card"><p>No saved checkpoints yet.</p></div>`;
    return;
  }

  $("#snapshotList").innerHTML = snapshots.slice().reverse().map((snapshot) => `
    <article class="snapshot-card">
      <div>
        <strong>${escapeHtml(snapshot.label)}</strong>
        <p>Required ${snapshot.requiredGpa} · projected ${snapshot.projectedCgpa} · ${snapshot.createdAt}</p>
      </div>
      <button class="danger-btn compact" data-snapshot-delete="${snapshot.id}" type="button">Delete</button>
    </article>
  `).join("");
}

function drawCharts() {
  drawCgpaChart();
  drawCreditChart();
}

function drawCgpaChart() {
  const canvas = $("#cgpaChart");
  const ctx = canvas.getContext("2d");
  const { currentCgpa, targetCgpa } = readInputs();
  const required = calculateRequiredGpa();
  const projection = projectedCgpa();
  drawBarChart(ctx, canvas, "CGPA Projection", [
    { label: "Current", value: currentCgpa, color: "#57e389" },
    { label: "Target", value: targetCgpa, color: "#ffd166" },
    { label: "Projected", value: projection, color: "#73fbd3" },
    { label: "Need Avg", value: Math.min(4, Math.max(0, required || 0)), color: required > 4 ? "#ff6b6b" : "#8ec5ff" }
  ], 4);
}

function drawCreditChart() {
  const canvas = $("#creditChart");
  const ctx = canvas.getContext("2d");
  const { completedCredits, remainingCredits } = readInputs();
  const plannedCredits = courses.reduce((sum, course) => sum + Number(course.credits), 0);
  drawBarChart(ctx, canvas, "Credit Map", [
    { label: "Completed", value: completedCredits, color: "#57e389" },
    { label: "Planned", value: plannedCredits, color: "#73fbd3" },
    { label: "Remaining", value: Math.max(0, remainingCredits - plannedCredits), color: "#ffd166" }
  ], Math.max(1, completedCredits + remainingCredits));
}

function drawBarChart(ctx, canvas, title, bars, maxValue) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 640;
  const cssHeight = Math.max(250, Math.round(cssWidth * 0.54));
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const styles = getComputedStyle(document.body);
  const text = styles.getPropertyValue("--text").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const line = styles.getPropertyValue("--line").trim();
  const left = 42;
  const right = 18;
  const top = 52;
  const bottom = 46;
  const plotWidth = cssWidth - left - right;
  const plotHeight = cssHeight - top - bottom;

  ctx.fillStyle = text;
  ctx.font = "800 16px system-ui";
  ctx.fillText(title, left, 26);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + plotHeight - (plotHeight * i / 4);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(cssWidth - right, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = "12px system-ui";
    ctx.fillText(((maxValue * i) / 4).toFixed(maxValue <= 4 ? 1 : 0), 8, y + 4);
  }

  const gap = 14;
  const width = Math.max(28, (plotWidth - gap * (bars.length + 1)) / bars.length);
  bars.forEach((bar, index) => {
    const height = Math.max(2, Math.min(plotHeight, (bar.value / maxValue) * plotHeight));
    const x = left + gap + index * (width + gap);
    const y = top + plotHeight - height;
    ctx.fillStyle = bar.color;
    roundRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.fillStyle = text;
    ctx.font = "800 12px system-ui";
    ctx.fillText(Number(bar.value || 0).toFixed(maxValue <= 4 ? 2 : 0), x, y - 8);
    ctx.fillStyle = muted;
    ctx.font = "12px system-ui";
    ctx.fillText(bar.label, x, cssHeight - 18);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderAll() {
  if (!currentUser) return;
  $("#studentName").textContent = currentUser.name;
  renderResult();
  renderSemesters();
  renderSnapshots();
  drawCharts();
  saveData();
}

function fillCourseForm(course) {
  $("#courseId").value = course.id;
  $("#semesterName").value = course.semesterName;
  $("#courseName").value = course.courseName;
  $("#courseCredits").value = course.credits;
  $("#targetGrade").value = Number(course.targetGrade).toFixed(2);
}

function clearCourseForm() {
  $("#courseForm").reset();
  $("#courseId").value = "";
  $("#courseCredits").value = 3;
  $("#targetGrade").value = "4.00";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderAll();
}

function bootSession() {
  const email = localStorage.getItem(SESSION_KEY);
  const accounts = getAccounts();
  if (!email || !accounts[email]) return;
  currentUser = accounts[email];
  loadData();
  showApp();
}

function applyTheme() {
  document.body.classList.toggle("light", localStorage.getItem(THEME_KEY) === "light");
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
    email,
    name: $("#signupName").value.trim(),
    passwordHash: simpleHash($("#signupPassword").value)
  };
  saveAccounts(accounts);
  currentUser = accounts[email];
  localStorage.setItem(SESSION_KEY, email);
  courses = [];
  snapshots = [];
  showApp();
  showToast("Planner created.");
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
  loadData();
  showApp();
  showToast("Logged in.");
});

$("#demoLogin").addEventListener("click", () => {
  const email = "demo@cgparescue.app";
  const accounts = getAccounts();
  accounts[email] = { email, name: "Demo Student", passwordHash: simpleHash("demo") };
  saveAccounts(accounts);
  localStorage.setItem(SESSION_KEY, email);
  currentUser = accounts[email];
  if (!localStorage.getItem(dataKey(email))) {
    courses = demoCourses;
    snapshots = [];
    $("#currentCgpa").value = 2.85;
    $("#completedCredits").value = 72;
    $("#remainingCredits").value = 48;
    $("#targetCgpa").value = 3.3;
    saveData();
  } else {
    loadData();
  }
  showApp();
  showToast("Demo planner loaded.");
});

$("#cgpaForm").addEventListener("input", renderAll);

$("#courseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = {
    id: $("#courseId").value || crypto.randomUUID(),
    semesterName: $("#semesterName").value.trim(),
    courseName: $("#courseName").value.trim(),
    credits: Number($("#courseCredits").value),
    targetGrade: Number($("#targetGrade").value)
  };

  const index = courses.findIndex((course) => course.id === item.id);
  if (index >= 0) courses[index] = item;
  else courses.push(item);

  clearCourseForm();
  renderAll();
  showToast("Course saved.");
});

document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  const snapDel = event.target.closest("[data-snapshot-delete]");

  if (edit) {
    const course = courses.find((item) => item.id === edit.dataset.edit);
    if (course) fillCourseForm(course);
  }

  if (del) {
    const course = courses.find((item) => item.id === del.dataset.delete);
    if (course && confirm(`Delete ${course.courseName}?`)) {
      courses = courses.filter((item) => item.id !== course.id);
      renderAll();
      showToast("Course deleted.");
    }
  }

  if (snapDel) {
    snapshots = snapshots.filter((snapshot) => snapshot.id !== snapDel.dataset.snapshotDelete);
    renderAll();
    showToast("Snapshot deleted.");
  }
});

$("#saveSnapshot").addEventListener("click", () => {
  snapshots.push({
    id: crypto.randomUUID(),
    label: `Checkpoint ${snapshots.length + 1}`,
    requiredGpa: calculateRequiredGpa().toFixed(2),
    projectedCgpa: projectedCgpa().toFixed(2),
    createdAt: new Date().toLocaleString()
  });
  renderAll();
  showToast("Snapshot saved.");
});

$("#resetPlanner").addEventListener("click", () => {
  if (!confirm("Reset all planner values and courses?")) return;
  courses = [];
  snapshots = [];
  $("#currentCgpa").value = 0;
  $("#completedCredits").value = 0;
  $("#remainingCredits").value = 0;
  $("#targetCgpa").value = 0;
  renderAll();
  showToast("Planner reset.");
});

$("#clearCourseForm").addEventListener("click", clearCourseForm);

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
  drawCharts();
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  courses = [];
  snapshots = [];
  $("#app").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  showToast("Logged out.");
});

window.addEventListener("resize", () => {
  if (currentUser) drawCharts();
});

applyTheme();
bootSession();
