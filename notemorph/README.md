# NoteMorph

NoteMorph is a clean student-focused web app that converts messy university lecture notes into:

- Clean summaries
- Bullet-point study notes
- Flashcards
- MCQ quizzes

## Features

- Course folders
- Paste and save messy lecture notes
- Local AI-like processor
- Placeholder AI API hook in `app.js`
- Flashcard viewer
- MCQ quiz generator with instant feedback
- Export as `.txt`
- Export as PDF through the browser print dialog
- Dark/light theme
- Responsive design for mobile, tablet, and desktop

## Run

Open `index.html` directly, or serve locally:

```bash
python -m http.server 5183
```

Then open:

```text
http://127.0.0.1:5183/
```

## AI API Hook

Open `app.js` and set:

```js
const aiConfig = {
  enabled: true,
  endpoint: "YOUR_AI_ENDPOINT",
  apiKey: "YOUR_API_KEY"
};
```

The endpoint should return JSON shaped like:

```json
{
  "title": "Lecture Title",
  "summary": ["Paragraph"],
  "bullets": [{"heading": "Topic", "detail": "Explanation"}],
  "flashcards": [{"front": "Question", "back": "Answer"}],
  "quiz": [{"question": "MCQ", "options": ["A", "B"], "answer": "A", "explanation": "Why"}]
}
```
