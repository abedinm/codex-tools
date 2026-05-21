# CGPA Rescue Planner

A mobile-friendly web app for university students who want to calculate what future GPA average they need to reach a target CGPA.

## Features

- Login/signup with browser-based accounts
- Current CGPA, completed credits, remaining credits, and target CGPA calculator
- Required future GPA calculation
- Unrealistic target warnings
- Safer target suggestions
- Semester-wise course planning
- Expected course credits and target grades
- Canvas charts for CGPA projection and credit progress
- Saved progress snapshots
- Dark/light theme
- Responsive layout for phone, tablet, and desktop

## How to Run

Open `index.html` directly, or serve it locally:

```bash
python -m http.server 5182
```

Then open:

```text
http://127.0.0.1:5182/
```

## Online Access

This is a static app, so it can be published on GitHub Pages, Netlify, Vercel, or any normal web hosting. The current login stores each student's planner in that browser using localStorage.
