# SMART PUSTAKA — deployment & PWA guide (Malaysia)

This package updates the existing React/Vite frontend and Express/MySQL API for production hosting, PWA installation, and Web Push reminders. It does not register `smartpustaka.com`, create cloud accounts, migrate your live database automatically, or deploy the app on your behalf.

## What changed

- Removed hard-coded `localhost:5003` API URLs from Login, Borrow, Fine and book search. Configure `VITE_API_URL` instead.
- Added a PWA manifest, app icons, service worker and Add to Home Screen / notification controls.
- Added authenticated `/api/website/push/subscribe` endpoint.
- Added tables `web_push_subscriptions` and `web_push_notification_log` (created by the backend at startup).
- Added daily reminders at 9:00 AM Malaysia time for books due tomorrow and books already overdue. Overdue reminders repeat daily until return; reminders require the user to have enabled push notifications.
- Added `/api/health` endpoint.

## Recommended first deployment (temporary free HTTPS URL)

Use two separate services initially:

1. **MySQL cloud service**: create a managed MySQL database from a reputable provider. Keep public access disabled if the host supports private networking; otherwise allow only the backend service's network/IP where possible. Create a dedicated database and non-root application user. Do not publish the DB password.
2. **Backend Node service**: deploy the `website_backend` folder as a Node web service. Build command: `npm install`; start command: `npm start`. Set environment variables listed below. The hosting provider supplies a temporary HTTPS hostname.
3. **Frontend static site**: deploy the `website` folder as a static site. Build command: `npm install && npm run build`; publish directory: `dist`. Set `VITE_API_URL` to the backend HTTPS hostname followed by `/api`, e.g. `https://YOUR-API-HOST/api`, and set `VITE_VAPID_PUBLIC_KEY` to the same public VAPID key used by the backend. These `VITE_` values are compiled into the public frontend; never put private keys or DB credentials there.
4. After deployment, set backend `CORS_ORIGIN` to the exact frontend HTTPS origin, with no trailing slash. Redeploy backend after changing it.
5. Open `https://YOUR-API-HOST/api/health`. It should return `status: ok` and `database: connected`. Then test the frontend login and book list.

Hosting provider dashboards change frequently; follow the provider's current instructions for creating a Node service, static site and managed MySQL database. Ensure the chosen Node service supports a persistent running process and scheduled code. Free services may sleep or have limits; scheduled push reminders will not be reliable if the backend is suspended. Use an always-on service for production reminders.

## Backend environment variables

Copy `website_backend/.env.example` to `.env` for local development, or enter these values in your cloud host's environment settings:

- `PORT`: provided by the hosting platform (the code honours it)
- `CORS_ORIGIN`: exact frontend HTTPS origin
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: managed MySQL credentials
- `DB_SSL=true` when required by your database host and its certificate configuration
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `REMINDER_CRON=0 9 * * *`, `TZ=Asia/Kuala_Lumpur`

Generate a VAPID key pair from the backend folder:

```bash
npx web-push generate-vapid-keys
```

Put the **Public Key** in backend `VAPID_PUBLIC_KEY` and frontend `VITE_VAPID_PUBLIC_KEY`. Put the **Private Key only in backend secrets**. Use a valid contact such as `mailto:your-admin-email@example.com` for `VAPID_SUBJECT`. Restart/redeploy backend and rebuild/redeploy frontend after setting environment variables.

## Migrate existing XAMPP MySQL data

1. In phpMyAdmin, select the current SMART PUSTAKA database and choose **Export → Quick → SQL → Go**. Save the `.sql` backup securely.
2. Create the cloud database and application user. Import the SQL backup into the cloud database using the provider's import tool or a secure MySQL client.
3. Verify the existing tables and columns expected by the application are present, including `users`, `books`, and `borrow`.
4. Update the backend environment variables to point to the cloud database and redeploy.
5. Test login, borrowed books, fines and search before considering the migration complete. Keep the original SQL backup until validation is finished.

Do not commit `.env`, database dumps, or VAPID private keys to Git. The uploaded project currently queries `users.password` directly; before production use, review and migrate the existing authentication to securely hashed passwords. The existing login token sessions are held in server memory, so a backend restart logs users out. These pre-existing design limitations are not automatically resolved by hosting.

## PWA installation

- **Android (Chrome/compatible browser):** open the public HTTPS URL, sign in if needed, tap **Add to Home Screen** or choose Install app from the browser menu.
- **iPhone/iPad (iOS/iPadOS 16.4+):** open the URL in Safari, tap Share, then **Add to Home Screen**. Open the installed icon before enabling push notifications.
- Tap **Enable reminders** and allow notification permission. Push reminders are sent only after subscription and permission are granted. Browser and OS notification settings can still suppress alerts.
- A PWA does not mean all features work offline. Login, database queries and notifications require the internet and backend to be reachable.

## Connect the purchased domain later

1. Buy `smartpustaka.com` from a domain registrar and configure its DNS as instructed by your frontend hosting provider.
2. Add `smartpustaka.com` and optionally `www.smartpustaka.com` as custom domains in the frontend host. Apply the provider's DNS records and wait for HTTPS certificate provisioning.
3. Change backend `CORS_ORIGIN` to the final frontend origin (for example `https://smartpustaka.com`) and redeploy.
4. Keep `VITE_API_URL` pointed at the backend HTTPS API hostname (or configure a same-origin reverse proxy if you later choose one). Rebuild/redeploy the frontend.
5. Verify HTTPS, login, PWA installation, notification permission and reminders from a real Android device and an iPhone.

## Local development

Run MySQL locally if you are developing locally, then in one terminal:

```bash
cd website_backend
cp .env.example .env
# Edit .env with your local MySQL settings and generated VAPID values
npm install
npm run dev
```

In another terminal:

```bash
cd website
cp .env.example .env
# Keep VITE_API_URL=http://localhost:5003/api for local development
npm install
npm run dev
```

Use `http://localhost:5173` locally. Production users will use the public HTTPS host and do not need XAMPP installed or running on their own devices.
