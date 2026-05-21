# GroupFair

GroupFair is a responsive web app for university group projects. It helps teams create projects, assign work, track deadlines, and see whether task difficulty is fairly distributed.

## Features

- Create and save a project
- Add group members
- Add tasks with assignee, difficulty, deadline, status, notes, and file link
- Fairness score for each member based on task count and difficulty load
- Overall fairness health
- Project progress bars
- Comments section
- Final project checklist
- Status filtering
- Shared project link with encoded project data
- Dark/light mode
- Mobile-friendly design

## How to Run

Open `index.html` directly, or serve locally:

```bash
python -m http.server 5184
```

Then open:

```text
http://127.0.0.1:5184/
```

## Shared Link Note

The share link stores the full project state inside the URL. This makes it easy to host on GitHub Pages without a backend. For real-time multi-user editing, the next upgrade would be Firebase or Supabase.
