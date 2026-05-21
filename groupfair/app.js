const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "groupfair.project.v1";
const THEME_KEY = "groupfair.theme.v1";

let project = {
  name: "",
  course: "",
  deadline: "",
  members: [],
  tasks: [],
  comments: [],
  checklist: [
    { id: crypto.randomUUID(), text: "All tasks marked Done or Review", done: false },
    { id: crypto.randomUUID(), text: "Final report proofread", done: false },
    { id: crypto.randomUUID(), text: "Slides exported and tested", done: false },
    { id: crypto.randomUUID(), text: "Submission link checked", done: false }
  ]
};

const demoProject = {
  name: "Smart Campus Assistant",
  course: "CSE 320",
  deadline: nextDate(10),
  members: [
    { id: crypto.randomUUID(), name: "Amina" },
    { id: crypto.randomUUID(), name: "Rafi" },
    { id: crypto.randomUUID(), name: "Nusrat" },
    { id: crypto.randomUUID(), name: "Tanvir" }
  ],
  tasks: [],
  comments: [],
  checklist: [
    { id: crypto.randomUUID(), text: "All features merged", done: true },
    { id: crypto.randomUUID(), text: "Demo video recorded", done: false },
    { id: crypto.randomUUID(), text: "Final report proofread", done: false },
    { id: crypto.randomUUID(), text: "Submission link checked", done: false }
  ]
};

demoProject.tasks = [
  makeTask("UI dashboard", demoProject.members[0].id, 3, nextDate(3), "In Progress", "https://drive.google.com/", "Build responsive dashboard screens."),
  makeTask("Database schema", demoProject.members[1].id, 4, nextDate(2), "Review", "", "ERD and tables for project data."),
  makeTask("API integration", demoProject.members[1].id, 5, nextDate(5), "Todo", "", "Connect app to backend endpoints."),
  makeTask("Presentation slides", demoProject.members[2].id, 2, nextDate(7), "Todo", "", "Prepare 8-10 clean slides."),
  makeTask("Testing checklist", demoProject.members[3].id, 3, nextDate(4), "Done", "", "Functional and responsive testing.")
];
demoProject.comments = [
  { id: crypto.randomUUID(), name: "Amina", text: "Dashboard layout is ready for review.", createdAt: new Date().toLocaleString() },
  { id: crypto.randomUUID(), name: "Rafi", text: "Need final API route names before integration.", createdAt: new Date().toLocaleString() }
];

function makeTask(title, assigneeId, difficulty, deadline, status, fileLink, notes) {
  return { id: crypto.randomUUID(), title, assigneeId, difficulty, deadline, status, fileLink, notes };
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadProject() {
  const shared = new URLSearchParams(location.search).get("share");
  if (shared) {
    try {
      project = JSON.parse(decodeURIComponent(escape(atob(shared))));
      saveProject();
      history.replaceState(null, "", location.pathname);
      showToast("Shared project imported.");
      return;
    } catch {
      showToast("Could not import shared project link.");
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) project = JSON.parse(saved);
}

function saveProject() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  updateShareLink();
}

function updateShareLink() {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(project))));
  $("#shareLink").value = `${location.origin}${location.pathname}?share=${encoded}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2300);
}

function memberName(id) {
  return project.members.find((member) => member.id === id)?.name || "Unassigned";
}

function memberStats() {
  const totalDifficulty = project.tasks.reduce((sum, task) => sum + Number(task.difficulty), 0);
  const target = project.members.length ? totalDifficulty / project.members.length : 0;
  return project.members.map((member) => {
    const tasks = project.tasks.filter((task) => task.assigneeId === member.id);
    const difficulty = tasks.reduce((sum, task) => sum + Number(task.difficulty), 0);
    const done = tasks.filter((task) => task.status === "Done").length;
    const fairness = target ? Math.max(0, 100 - Math.abs(difficulty - target) / target * 100) : 100;
    return { ...member, taskCount: tasks.length, difficulty, done, fairness: Math.round(fairness) };
  });
}

function projectProgress() {
  if (!project.tasks.length) return 0;
  const weights = { Todo: 0, "In Progress": 45, Review: 75, Done: 100 };
  return Math.round(project.tasks.reduce((sum, task) => sum + weights[task.status], 0) / project.tasks.length);
}

function fairnessHealth() {
  const stats = memberStats();
  if (!stats.length || !project.tasks.length) return { label: "--", hint: "Add members and tasks to calculate fairness." };
  const avg = Math.round(stats.reduce((sum, member) => sum + member.fairness, 0) / stats.length);
  if (avg >= 85) return { label: `${avg}%`, hint: "Workload looks balanced." };
  if (avg >= 65) return { label: `${avg}%`, hint: "Some workload imbalance exists." };
  return { label: `${avg}%`, hint: "Workload is uneven. Reassign high-difficulty tasks." };
}

function urgentCount() {
  const now = new Date();
  return project.tasks.filter((task) => task.status !== "Done" && (new Date(task.deadline) - now) / 864e5 <= 3).length;
}

function renderAll() {
  $("#projectName").value = project.name || "";
  $("#courseName").value = project.course || "";
  $("#projectDeadline").value = project.deadline || "";
  renderAssigneeOptions();
  renderMembers();
  renderTasks();
  renderComments();
  renderChecklist();
  renderMetrics();
  saveProject();
}

function renderMetrics() {
  const progress = projectProgress();
  const health = fairnessHealth();
  $("#projectProgress").textContent = `${progress}%`;
  $("#projectProgressBar").style.width = `${progress}%`;
  $("#fairnessHealth").textContent = health.label;
  $("#fairnessHint").textContent = health.hint;
  $("#openTasks").textContent = project.tasks.filter((task) => task.status !== "Done").length;
  $("#urgentTasks").textContent = `${urgentCount()} urgent`;
}

function renderAssigneeOptions() {
  $("#taskAssignee").innerHTML = project.members.length
    ? project.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")
    : `<option value="">Add a member first</option>`;
}

function renderMembers() {
  const stats = memberStats();
  $("#memberList").innerHTML = stats.length ? stats.map((member) => `
    <article class="member-card">
      <strong>${escapeHtml(member.name)}</strong>
      <p>${member.taskCount} tasks · difficulty load ${member.difficulty} · ${member.done} done</p>
      <div class="tag-row">
        <span class="tag">Fairness ${member.fairness}%</span>
      </div>
      <div class="mini-progress"><div style="width:${member.fairness}%"></div></div>
      <div class="row-actions" style="margin-top:.75rem">
        <button class="danger-btn compact" data-member-delete="${member.id}" type="button">Delete</button>
      </div>
    </article>
  `).join("") : `<article class="member-card"><p>No members yet. Add everyone in the group.</p></article>`;
}

function renderTasks() {
  const filter = $("#statusFilter").value;
  const tasks = [...project.tasks]
    .filter((task) => !filter || task.status === filter)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  $("#taskList").innerHTML = tasks.length ? tasks.map((task) => {
    const urgent = task.status !== "Done" && (new Date(task.deadline) - new Date()) / 864e5 <= 3;
    const file = task.fileLink ? `<a class="secondary-btn compact" href="${escapeHtml(task.fileLink)}" target="_blank" rel="noreferrer">Open File</a>` : "";
    return `
      <article class="task-card">
        <div class="task-head">
          <div>
            <strong>${escapeHtml(task.title)}</strong>
            <p>${escapeHtml(memberName(task.assigneeId))} · due ${escapeHtml(task.deadline || "No deadline")}</p>
          </div>
          <span class="tag ${statusClass(task.status)}">${escapeHtml(task.status)}</span>
        </div>
        <div class="tag-row">
          <span class="tag">Difficulty ${task.difficulty}/5</span>
          ${urgent ? `<span class="tag urgent">Urgent</span>` : ""}
        </div>
        <p>${escapeHtml(task.notes || "No notes added.")}</p>
        <div class="row-actions" style="margin-top:.75rem">
          <button class="secondary-btn compact" data-task-edit="${task.id}" type="button">Edit</button>
          ${file}
          <button class="danger-btn compact" data-task-delete="${task.id}" type="button">Delete</button>
        </div>
      </article>
    `;
  }).join("") : `<article class="task-card"><p>No tasks in this view.</p></article>`;
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function renderComments() {
  $("#commentList").innerHTML = project.comments.length ? project.comments.slice().reverse().map((comment) => `
    <article class="comment-card">
      <strong>${escapeHtml(comment.name || "Anonymous")} <span class="tag">${escapeHtml(comment.createdAt)}</span></strong>
      <p>${escapeHtml(comment.text)}</p>
    </article>
  `).join("") : `<article class="comment-card"><p>No comments yet.</p></article>`;
}

function renderChecklist() {
  $("#checklist").innerHTML = project.checklist.map((item) => `
    <label class="check-item">
      <span><input type="checkbox" data-check="${item.id}" ${item.done ? "checked" : ""}> ${escapeHtml(item.text)}</span>
      <button class="danger-btn compact" data-check-delete="${item.id}" type="button">Delete</button>
    </label>
  `).join("");
}

function clearTaskForm() {
  $("#taskForm").reset();
  $("#taskId").value = "";
  $("#taskDifficulty").value = "3";
  $("#taskStatus").value = "Todo";
  $("#taskFormTitle").textContent = "Add task";
}

function fillTaskForm(task) {
  $("#taskId").value = task.id;
  $("#taskTitle").value = task.title;
  $("#taskAssignee").value = task.assigneeId;
  $("#taskDifficulty").value = task.difficulty;
  $("#taskDeadline").value = task.deadline;
  $("#taskStatus").value = task.status;
  $("#taskFile").value = task.fileLink || "";
  $("#taskNotes").value = task.notes || "";
  $("#taskFormTitle").textContent = "Update task";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyTheme() {
  document.body.classList.toggle("light", localStorage.getItem(THEME_KEY) === "light");
}

$("#projectForm").addEventListener("submit", (event) => {
  event.preventDefault();
  project.name = $("#projectName").value.trim();
  project.course = $("#courseName").value.trim();
  project.deadline = $("#projectDeadline").value;
  renderAll();
  showToast("Project saved.");
});

$("#memberForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#memberName").value.trim();
  if (!name) return;
  project.members.push({ id: crypto.randomUUID(), name });
  $("#memberName").value = "";
  renderAll();
  showToast("Member added.");
});

$("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!project.members.length) {
    showToast("Add a member before creating tasks.");
    return;
  }

  const task = {
    id: $("#taskId").value || crypto.randomUUID(),
    title: $("#taskTitle").value.trim(),
    assigneeId: $("#taskAssignee").value,
    difficulty: Number($("#taskDifficulty").value),
    deadline: $("#taskDeadline").value,
    status: $("#taskStatus").value,
    fileLink: $("#taskFile").value.trim(),
    notes: $("#taskNotes").value.trim()
  };

  const index = project.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) project.tasks[index] = task;
  else project.tasks.push(task);
  clearTaskForm();
  renderAll();
  showToast("Task saved.");
});

$("#commentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  project.comments.push({
    id: crypto.randomUUID(),
    name: $("#commentName").value.trim() || "Anonymous",
    text: $("#commentText").value.trim(),
    createdAt: new Date().toLocaleString()
  });
  $("#commentText").value = "";
  renderAll();
  showToast("Comment added.");
});

$("#checkForm").addEventListener("submit", (event) => {
  event.preventDefault();
  project.checklist.push({ id: crypto.randomUUID(), text: $("#checkText").value.trim(), done: false });
  $("#checkText").value = "";
  renderAll();
});

document.addEventListener("click", async (event) => {
  const memberDelete = event.target.closest("[data-member-delete]");
  const taskEdit = event.target.closest("[data-task-edit]");
  const taskDelete = event.target.closest("[data-task-delete]");
  const checkDelete = event.target.closest("[data-check-delete]");

  if (memberDelete) {
    const id = memberDelete.dataset.memberDelete;
    if (confirm("Delete this member and their assigned tasks?")) {
      project.members = project.members.filter((member) => member.id !== id);
      project.tasks = project.tasks.filter((task) => task.assigneeId !== id);
      renderAll();
      showToast("Member deleted.");
    }
  }

  if (taskEdit) {
    const task = project.tasks.find((item) => item.id === taskEdit.dataset.taskEdit);
    if (task) fillTaskForm(task);
  }

  if (taskDelete) {
    project.tasks = project.tasks.filter((task) => task.id !== taskDelete.dataset.taskDelete);
    renderAll();
    showToast("Task deleted.");
  }

  if (checkDelete) {
    project.checklist = project.checklist.filter((item) => item.id !== checkDelete.dataset.checkDelete);
    renderAll();
  }
});

document.addEventListener("change", (event) => {
  const check = event.target.closest("[data-check]");
  if (!check) return;
  const item = project.checklist.find((entry) => entry.id === check.dataset.check);
  if (item) item.done = check.checked;
  renderAll();
});

$("#statusFilter").addEventListener("change", renderTasks);
$("#clearTaskForm").addEventListener("click", clearTaskForm);

$("#copyShare").addEventListener("click", async () => {
  updateShareLink();
  await navigator.clipboard.writeText($("#shareLink").value).catch(() => {});
  showToast("Share link copied.");
});

$("#loadDemo").addEventListener("click", () => {
  project = structuredClone(demoProject);
  renderAll();
  showToast("Demo project loaded.");
});

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
});

applyTheme();
loadProject();
renderAll();
