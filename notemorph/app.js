const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "notemorph.data.v1";
const THEME_KEY = "notemorph.theme.v1";

const aiConfig = {
  enabled: false,
  endpoint: "",
  apiKey: ""
};

let state = {
  activeCourseId: null,
  courses: [],
  output: null,
  flashcardIndex: 0,
  flashcardFlipped: false,
  quizStarted: false,
  quizScore: 0,
  answered: {}
};

const demoNotes = `Operating Systems Lecture 4
Process = program in execution. Each process has an address space, registers, program counter, stack, heap.
PCB means process control block. It stores process id, process state, CPU registers, scheduling information, memory information, accounting info, and I/O status.
Process states: new, ready, running, waiting, terminated. Scheduler selects next ready process.
Context switching saves the current process state and loads another process state. It is useful for multitasking but adds overhead.
CPU scheduling goals: maximize CPU utilization and throughput, minimize waiting time, response time, and turnaround time.
Algorithms: FCFS simple but convoy effect, SJF gives minimum average waiting but needs burst prediction, Round Robin uses time quantum and works well for time-sharing systems.
Important exam idea: smaller time quantum means better response but more context switching overhead.`;

function loadState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved) state = { ...state, ...saved, flashcardIndex: 0, flashcardFlipped: false, quizStarted: false, quizScore: 0, answered: {} };
  if (!state.courses.length) {
    const id = crypto.randomUUID();
    state.courses = [{ id, name: "General Notes", notes: "" }];
    state.activeCourseId = id;
    saveState();
  }
}

function saveState() {
  const { activeCourseId, courses, output } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeCourseId, courses, output }));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2300);
}

function activeCourse() {
  return state.courses.find((course) => course.id === state.activeCourseId) || state.courses[0];
}

function renderCourses() {
  $("#courseList").innerHTML = state.courses.map((course) => `
    <button class="course-btn ${course.id === state.activeCourseId ? "active" : ""}" data-course="${course.id}" type="button">
      <span>${escapeHtml(course.name)}</span>
      <small>${wordCount(course.notes)} words</small>
    </button>
  `).join("");

  const course = activeCourse();
  $("#activeCourseLabel").textContent = course ? course.name : "No course selected";
  $("#rawNotes").value = course?.notes || "";
}

async function morphNotes() {
  const notes = $("#rawNotes").value.trim();
  if (!notes) {
    showToast("Paste notes first.");
    return;
  }

  showToast("Morphing notes...");
  state.output = aiConfig.enabled ? await callAiProcessor(notes) : localProcessor(notes);
  state.flashcardIndex = 0;
  state.flashcardFlipped = false;
  state.quizStarted = false;
  state.quizScore = 0;
  state.answered = {};
  saveCurrentNotes();
  renderOutput();
  showToast("Study pack generated.");
}

async function callAiProcessor(notes) {
  if (!aiConfig.endpoint || !aiConfig.apiKey) return localProcessor(notes);

  try {
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify({
        task: "Convert university lecture notes into summary, study bullets, flashcards, and MCQ quiz.",
        notes
      })
    });

    if (!response.ok) throw new Error("AI API request failed");
    return await response.json();
  } catch (error) {
    showToast("AI API unavailable. Local processor used.");
    return localProcessor(notes);
  }
}

function localProcessor(notes) {
  const cleaned = normalizeNotes(notes);
  const sentences = splitSentences(cleaned);
  const keywords = extractKeywords(cleaned);
  const important = rankSentences(sentences, keywords).slice(0, 6);
  const concepts = buildConcepts(sentences, keywords);

  return {
    title: detectTitle(notes),
    summary: buildSummary(important, cleaned),
    bullets: buildBullets(sentences, keywords),
    flashcards: buildFlashcards(concepts, keywords),
    quiz: buildQuiz(concepts, keywords)
  };
}

function normalizeNotes(notes) {
  return notes
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function detectTitle(notes) {
  const firstLine = notes.split(/\n/).map((line) => line.trim()).find(Boolean);
  return firstLine && firstLine.length <= 80 ? firstLine : "Morphed Study Pack";
}

function splitSentences(text) {
  return text
    .replace(/\n/g, ". ")
    .split(/(?<=[.!?])\s+|;\s+|,\s+(?=[A-Z][a-z])/)
    .map((sentence) => sentence.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter((sentence) => sentence.length > 24);
}

function extractKeywords(text) {
  const stop = new Set("about above after again against all also and are because been but can could each from has have into its more most not now often only other over should than that the their them then there these they this through under using very was were when where which while with would".split(" "));
  const counts = {};
  text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)?.forEach((word) => {
    if (!stop.has(word)) counts[word] = (counts[word] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([word]) => word);
}

function rankSentences(sentences, keywords) {
  return sentences
    .map((sentence) => ({
      sentence,
      score: keywords.reduce((sum, keyword) => sum + (sentence.toLowerCase().includes(keyword) ? 1 : 0), 0) + Math.min(sentence.length / 160, 1)
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence);
}

function buildSummary(sentences, text) {
  if (!sentences.length) return ["The notes are short, so review the original text and add more lecture details for a richer summary."];
  const intro = `These notes focus on ${extractKeywords(text).slice(0, 4).join(", ") || "the main lecture ideas"}.`;
  return [intro, ...sentences.slice(0, 4)];
}

function buildBullets(sentences, keywords) {
  const ranked = rankSentences(sentences, keywords).slice(0, 10);
  return ranked.map((sentence, index) => ({
    heading: keywordHeading(sentence, keywords) || `Key Point ${index + 1}`,
    detail: sentence
  }));
}

function buildConcepts(sentences, keywords) {
  const concepts = [];
  sentences.forEach((sentence) => {
    const definitionMatch = sentence.match(/^(.{3,45}?)(?: means| is | are | refers to | = )(.{12,})/i);
    if (definitionMatch) {
      concepts.push({
        term: cleanTerm(definitionMatch[1]),
        definition: cleanDefinition(definitionMatch[2])
      });
    }
  });

  keywords.slice(0, 8).forEach((keyword) => {
    if (concepts.some((concept) => concept.term.toLowerCase().includes(keyword))) return;
    const sentence = sentences.find((item) => item.toLowerCase().includes(keyword));
    if (sentence) concepts.push({ term: titleCase(keyword), definition: sentence });
  });

  return concepts.slice(0, 10);
}

function buildFlashcards(concepts, keywords) {
  const cards = concepts.map((concept) => ({
    front: `What should you remember about ${concept.term}?`,
    back: concept.definition
  }));

  if (cards.length < 4) {
    keywords.slice(0, 4).forEach((keyword) => cards.push({
      front: `Explain ${titleCase(keyword)} in your own words.`,
      back: "Use the original notes to connect this keyword with the lecture's main idea."
    }));
  }

  return cards.slice(0, 8);
}

function buildQuiz(concepts, keywords) {
  const distractors = [...new Set(keywords.map(titleCase))].filter(Boolean);
  const questions = concepts.slice(0, 6).map((concept, index) => {
    const correct = concept.definition.length > 120 ? `${concept.definition.slice(0, 117)}...` : concept.definition;
    const options = shuffle([
      correct,
      `It is mainly unrelated to ${concept.term}.`,
      `${concept.term} is only a grading policy.`,
      `It is another name for ${distractors[(index + 2) % Math.max(1, distractors.length)] || "a different topic"}.`
    ]);
    return {
      question: `Which option best describes ${concept.term}?`,
      options,
      answer: correct,
      explanation: concept.definition
    };
  });

  if (!questions.length) {
    questions.push({
      question: "What is the best next step for studying these notes?",
      options: ["Identify key terms and test yourself", "Ignore headings", "Memorize random words only", "Delete the notes"],
      answer: "Identify key terms and test yourself",
      explanation: "Strong study notes begin by finding key terms, definitions, and relationships."
    });
  }

  return questions;
}

function keywordHeading(sentence, keywords) {
  const found = keywords.find((keyword) => sentence.toLowerCase().includes(keyword));
  return found ? titleCase(found) : "";
}

function cleanTerm(value) {
  return titleCase(value.replace(/lecture|important|note|idea/gi, "").trim().slice(0, 48)) || "Concept";
}

function cleanDefinition(value) {
  return value.trim().replace(/\.$/, ".");
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function shuffle(items) {
  return items
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function renderOutput() {
  const output = state.output;
  if (!output) {
    $("#summaryOutput").innerHTML = `<p>Paste notes and click Morph Notes to generate a study pack.</p>`;
    $("#bulletsOutput").innerHTML = "";
    $("#flashcardGrid").innerHTML = "";
    $("#quizOutput").innerHTML = "";
    return;
  }

  $("#outputTitle").textContent = output.title || "Study Pack";
  $("#summaryOutput").innerHTML = output.summary.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  $("#bulletsOutput").innerHTML = output.bullets.map((item) => `
    <article class="note-item">
      <strong>${escapeHtml(item.heading)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </article>
  `).join("");

  renderFlashcards();
  renderQuiz();
}

function renderFlashcards() {
  const cards = state.output?.flashcards || [];
  $("#cardCounter").textContent = cards.length ? `${state.flashcardIndex + 1} / ${cards.length}` : "0 / 0";
  const card = cards[state.flashcardIndex];
  if (!card) {
    $("#cardFront").textContent = "Morph notes to generate flashcards.";
    $("#cardBack").textContent = "Click a generated card to flip it.";
    $("#flashcardGrid").innerHTML = "";
    return;
  }

  $("#cardFront").textContent = state.flashcardFlipped ? card.back : card.front;
  $("#cardBack").textContent = state.flashcardFlipped ? "Click to see the question again." : "Click to reveal the answer.";
  $("#flashcardGrid").innerHTML = cards.map((item, index) => `
    <article class="mini-card">
      <strong>${index + 1}. ${escapeHtml(item.front)}</strong>
      <p>${escapeHtml(item.back)}</p>
    </article>
  `).join("");
}

function renderQuiz() {
  const quiz = state.output?.quiz || [];
  $("#quizScore").textContent = `Score: ${state.quizScore} / ${quiz.length}`;
  $("#quizOutput").innerHTML = quiz.map((item, index) => `
    <article class="quiz-card">
      <strong>${index + 1}. ${escapeHtml(item.question)}</strong>
      ${item.options.map((option) => {
        const selected = state.answered[index] === option;
        const done = Object.hasOwn(state.answered, index);
        const className = done && option === item.answer ? "correct" : selected ? "wrong" : "";
        return `<button class="answer-btn ${className}" data-answer="${index}" data-option="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>`;
      }).join("")}
      ${Object.hasOwn(state.answered, index) ? `<p><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</p>` : ""}
    </article>
  `).join("");
}

function saveCurrentNotes() {
  const course = activeCourse();
  if (!course) return;
  course.notes = $("#rawNotes").value.trim();
  saveState();
  renderCourses();
}

function exportText() {
  if (!state.output) {
    showToast("Morph notes before exporting.");
    return;
  }

  const output = state.output;
  const text = [
    `NoteMorph Study Pack: ${output.title}`,
    "",
    "CLEAN SUMMARY",
    ...output.summary.map((item) => `- ${item}`),
    "",
    "BULLET-POINT STUDY NOTES",
    ...output.bullets.map((item) => `- ${item.heading}: ${item.detail}`),
    "",
    "FLASHCARDS",
    ...output.flashcards.map((item, index) => `${index + 1}. Q: ${item.front}\n   A: ${item.back}`),
    "",
    "MCQ QUIZ",
    ...output.quiz.map((item, index) => `${index + 1}. ${item.question}\n${item.options.map((option) => `   - ${option}`).join("\n")}\nAnswer: ${item.answer}\nExplanation: ${item.explanation}`)
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(output.title)}-study-pack.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  if (!state.output) {
    showToast("Morph notes before exporting.");
    return;
  }
  window.print();
}

function wordCount(value = "") {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "notemorph";
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

$("#courseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#courseName").value.trim();
  if (!name) return;
  const id = crypto.randomUUID();
  state.courses.push({ id, name, notes: "" });
  state.activeCourseId = id;
  $("#courseName").value = "";
  saveState();
  renderCourses();
  showToast("Course folder added.");
});

$("#courseList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-course]");
  if (!button) return;
  saveCurrentNotes();
  state.activeCourseId = button.dataset.course;
  saveState();
  renderCourses();
});

$("#morphNotes").addEventListener("click", morphNotes);
$("#saveNote").addEventListener("click", () => {
  saveCurrentNotes();
  showToast("Notes saved to course.");
});
$("#clearNotes").addEventListener("click", () => {
  $("#rawNotes").value = "";
  saveCurrentNotes();
});

$("#loadDemo").addEventListener("click", () => {
  $("#rawNotes").value = demoNotes;
  saveCurrentNotes();
  morphNotes();
});

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.tab));
  });
});

$("#flashcard").addEventListener("click", () => {
  state.flashcardFlipped = !state.flashcardFlipped;
  renderFlashcards();
});

$("#prevCard").addEventListener("click", () => {
  const cards = state.output?.flashcards || [];
  if (!cards.length) return;
  state.flashcardIndex = (state.flashcardIndex - 1 + cards.length) % cards.length;
  state.flashcardFlipped = false;
  renderFlashcards();
});

$("#nextCard").addEventListener("click", () => {
  const cards = state.output?.flashcards || [];
  if (!cards.length) return;
  state.flashcardIndex = (state.flashcardIndex + 1) % cards.length;
  state.flashcardFlipped = false;
  renderFlashcards();
});

$("#startQuiz").addEventListener("click", () => {
  state.quizScore = 0;
  state.answered = {};
  renderQuiz();
  showToast("Quiz restarted.");
});

$("#quizOutput").addEventListener("click", (event) => {
  const answer = event.target.closest("[data-answer]");
  if (!answer) return;
  const index = Number(answer.dataset.answer);
  if (Object.hasOwn(state.answered, index)) return;
  const question = state.output.quiz[index];
  state.answered[index] = answer.dataset.option;
  if (answer.dataset.option === question.answer) state.quizScore += 1;
  renderQuiz();
});

$("#exportText").addEventListener("click", exportText);
$("#exportPdf").addEventListener("click", exportPdf);

$("#themeToggle").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, document.body.classList.contains("light") ? "dark" : "light");
  applyTheme();
});

applyTheme();
loadState();
renderCourses();
renderOutput();
