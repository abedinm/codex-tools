# UniRoute Routine

UniRoute Routine is a responsive university routine web app for students. It includes login/signup, a clean dashboard, weekly class CRUD, room finder notes, search, dark mode, and offline support.

## Features

- Student login/signup using localStorage
- Weekly class routine with subject, teacher, room, building, day, start time, end time, and room directions
- Dashboard showing today's classes, next class countdown, attended/finished classes, and missed classes
- Add, edit, delete, search, and filter classes
- Room Finder Note field for directions such as "3rd floor, beside lab 2"
- Dark/light mode toggle
- Mobile-first responsive layout
- PWA manifest and service worker for offline use after first load

## How to Run

Open `index.html` directly for basic use, or serve the folder with a local server for the service worker:

```bash
npx serve .
```

Then open the shown localhost URL in your browser.

## Database Note

This version uses localStorage so it works immediately with no setup. For real online cross-device access, connect Firebase Auth and Firestore in `app.js` where the account and routine storage helpers are defined.
