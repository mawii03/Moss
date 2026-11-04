# Moss Budget

Budget tracker with cards and virtual cards (freeze, limits), category budgets, monthly
recurring bills, statistics, and Google / email sign-in with Firebase.
It uses the same Firebase project as Finlora (LapMob Budget Tracking), and like Finlora
it has no build step: Firebase loads from Google's servers.

## Files

| File | What it does |
|---|---|
| `index.html` | The page: sign-in screen and the app |
| `src/style.css` | Styles, light and dark mode |
| `src/firebase-config.js` | Your Firebase keys |
| `src/firebase.js` | Sign in / sign up / log out, reading and saving data |
| `src/main.js` | The app itself |
| `firestore.rules` | Keeps each user's data private (works for Finlora too) |

## Put it on GitHub Pages

1. Upload all files to the repo (keep the `src` folder).
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`, **Save**.
3. Open `https://<username>.github.io/<repo>/`.
4. Firebase: **Authentication → Settings → Authorized domains** must include `<username>.github.io`.

## Run it on your computer

It must be opened through a small web server (double-clicking `index.html` won't work).
In VS Code, install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.
`127.0.0.1` / `localhost` is allowed for sign-in by default.

## Data

```
users/{uid}/settings/moss        currency + categories with monthly budgets
users/{uid}/cards/{cardId}       name, kind, last4, color, limit, frozen
users/{uid}/expenses/{id}        amount, category, cardId, note, date (YYYY-MM-DD)
users/{uid}/recurring/{id}       amount, note, category, cardId, day, startMonth, active, skipped[]
```

Finlora's `users/{uid}/transactions` are not touched. Only the last 4 digits of a card are stored.
