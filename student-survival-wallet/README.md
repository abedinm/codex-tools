# Student Survival Wallet

A responsive web app for university students to plan monthly survival spending.

## Features

- Login/signup
- Monthly allowance/income
- Daily spending, food, transport, rent, mobile data, emergency expenses
- Safe daily spending calculation for the rest of the month
- Custom spending categories
- Daily spending logs
- Spending charts with native canvas
- Warning alerts
- Low Budget Survival Mode with saving suggestions
- Dark/light mode
- Firebase Auth + Firestore cloud-sync ready
- Local demo mode until Firebase config is added

## Run

Serve the folder because the app uses JavaScript modules:

```bash
python -m http.server 5185
```

Then open:

```text
http://127.0.0.1:5185/
```

## Enable Cloud Sync

1. Create a Firebase project.
2. Add a Web App.
3. Enable Email/Password Authentication.
4. Create a Cloud Firestore database.
5. In `app.js`, paste your Firebase config into `firebaseSettings.config`.
6. Change `enabled: false` to `enabled: true`.

Wallet data is stored at:

```text
users/{uid}/wallet/current
```

Suggested Firestore rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/wallet/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
