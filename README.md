# Moss Budget

A personal budget tracker: cards and virtual cards (with freeze), monthly limits,
category budgets, monthly recurring bills, statistics, and log in / log out with Firebase.

Each person who signs up gets their own private budget. Data is stored in Firestore
under `users/{their user id}/…`, and the security rules in `firestore.rules` make sure
nobody can read anyone else's.

## What you need

- [Node.js](https://nodejs.org) 18 or newer
- A free Firebase account (https://console.firebase.google.com)

## 1. Create the Firebase project

1. In the Firebase console, click **Add project** and follow the steps (Google Analytics is optional).
2. **Add a web app**: on the project overview, click the `</>` (Web) icon, give it a name,
   and click **Register app**. You'll see a `firebaseConfig` block. Keep that page open.
3. **Turn on sign-in**: go to **Build → Authentication → Get started → Sign-in method** and enable:
   - **Email/Password**
   - **Google** (pick a support email, then save)
4. **Create the database**: go to **Build → Firestore Database → Create database**.
   Choose a location close to you (for Taiwan, `asia-east1`), and start in **production mode**.
5. **Add the security rules**: in Firestore, open the **Rules** tab, replace everything with the
   contents of `firestore.rules` from this folder, and click **Publish**.

## 2. Add your keys

1. Copy `.env.example` to a new file called `.env`.
2. Fill in each value from the `firebaseConfig` block in step 1.2:

   | `.env` name | `firebaseConfig` field |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

These web keys are meant to be in the browser; your data is protected by the Firestore
rules, not by hiding the keys. Still, `.env` is in `.gitignore` so it doesn't end up on GitHub.

## 3. Run it

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173), create an account, and start adding expenses.

## 4. Put it online (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
npm run deploy            # builds and uploads the site + Firestore rules
```

You'll get a link like `https://your-project.web.app`. That domain is already allowed for
sign-in. If you host somewhere else (Vercel, Netlify…), add your domain under
**Authentication → Settings → Authorized domains**, or Google sign-in will be refused.

## Files

| File | What it does |
|---|---|
| `index.html` | The page: sign-in screen and the app layout |
| `src/style.css` | All styles, light and dark mode |
| `src/firebase.js` | Firebase setup, sign in / sign up / log out, reading and saving data |
| `src/main.js` | The app: overview, statistics, cards, budgets, recurring bills, activity |
| `firestore.rules` | Keeps each user's data private |
| `firebase.json` | Hosting and rules settings for `firebase deploy` |

## How the data is stored

```
users/{uid}/settings/main        currency + categories with monthly budgets
users/{uid}/cards/{cardId}       name, kind, last4, color, limit, frozen
users/{uid}/expenses/{id}        amount, category, cardId, note, date (YYYY-MM-DD)
users/{uid}/recurring/{id}       amount, note, category, cardId, day, startMonth, active, skipped[]
```

Recurring bills are logged by the app when you open it, on or after their day. Each one
gets a fixed id per month (`r-{recurringId}-{YYYY-MM}`), so it's never logged twice.
Only the last 4 digits of a card are stored. Never put a full card number in the app.
