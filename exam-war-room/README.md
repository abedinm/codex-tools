# Exam War Room

A responsive exam planner for university students.

## Features

- Login/signup
- Add upcoming exams with course name, exam date, syllabus topics, difficulty level, and daily study capacity
- Automatic daily study plan until each exam
- Harder subjects receive more study time
- Countdown timer for the next exam
- Topic checklist
- Revision mode with separate revised tracking
- Progress percentage
- Clean dashboard
- Calendar view
- Dark/light mode
- Firebase Auth + Firestore-ready online account system
- Local demo mode until Firebase config is added

## Run

Serve the folder because the app uses JavaScript modules:

```bash
python -m http.server 5186
```

Then open:

```text
http://127.0.0.1:5186/
```

## Enable Online Accounts

1. Create a Firebase project.
2. Add a Web App.
3. Enable Email/Password Authentication.
4. Create a Cloud Firestore database.
5. In `app.js`, paste your Firebase config into `firebaseSettings.config`.
6. Change `enabled: false` to `enabled: true`.

Data path:

```text
users/{uid}/examWarRoom/data
```

Suggested Firestore rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/examWarRoom/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Firebase pattern follows the modular Web SDK style from the official Firestore docs.
