# Deadline Panic Shield

A responsive web app for university students to track assignment deadlines and avoid last-minute chaos.

## Features

- Login/signup
- Assignment CRUD with course name, title, deadline, word count, submission link, progress, notes, and status
- Dashboard sorted by urgency
- Panic Mode when a deadline is within 24 hours
- Status tags: Not Started, Started, Almost Done, Submitted
- Browser notifications
- Dark/light mode
- Firebase Auth + Firestore-ready cloud storage
- Local demo mode until Firebase config is added

## Run Locally

Serve the folder from a local web server because the app uses JavaScript modules:

```bash
npx serve .
```

Or with Python:

```bash
python -m http.server 5181
```

Then open the localhost URL.

## Enable Firebase Cloud Storage

This app is already wired for Firebase Auth and Firestore using the current modular Web SDK style described in the official Firebase docs.

1. Create a Firebase project.
2. Add a Web App in Firebase.
3. Enable Authentication > Email/Password.
4. Create a Cloud Firestore database.
5. Open `app.js`.
6. Paste your Firebase config into `firebaseSettings.config`.
7. Change `enabled: false` to `enabled: true`.

Assignments are stored at:

```text
users/{uid}/assignments/{assignmentId}
```

## Suggested Firestore Rules

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/assignments/{assignmentId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
