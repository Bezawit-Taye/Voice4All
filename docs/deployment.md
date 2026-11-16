# Voice4All production deployment

This repository is a monorepo with a static, multi-page frontend, an Express API, and a separate FastAPI Edge TTS service. `vercel.json`, `netlify.toml`, and `render.yaml` describe deployment configuration; no deployment is started by this guide.

## Accounts and prerequisites

- A GitHub account with this repository pushed to the branch you intend to deploy.
- A Vercel account connected to that repository.
- A Render account connected to that repository.
- A Netlify account if you choose the manual Netlify Drop deployment described below; it does not require connecting GitHub.
- Optional: a Gemini API key if you choose the live Gemini tutor instead of the default `mock_demo` provider.
- Optional: provider accounts and credentials for Telegram, Twilio, or Africa's Talking notifications.

The frontend is static HTML/CSS/JavaScript. There is no root `package.json`, Vite/Webpack build, React router, or SPA. A small Node build script copies the public site and injects its API base from `VITE_API_URL`.

## Environment variables

### Vercel frontend

| Variable | Required | Value |
|---|---|---|
| `VITE_API_URL` | Yes | Public HTTPS URL of the Render Node service. Copy the actual URL from the Render dashboard; no trailing path is needed. |

This value is public and is embedded in the static build. Never put API keys or the TTS shared secret in Vercel frontend variables. `VOICE4ALL_API_BASE` is accepted as an alternative by the build script, but `VITE_API_URL` is the documented setting.

### Netlify manual deployment

The same public `VITE_API_URL` is required when building for Netlify. It must be the actual Express/Node service URL copied from Render, not the Python TTS URL. The repository's Render Blueprint provides the Node service name but does not verify its assigned public hostname.

For Netlify Drop, build locally from the repository root in PowerShell (replace the placeholder with the exact URL shown in Render):

```powershell
$env:VITE_API_URL = 'https://<actual-node-service-url-from-render>'
node .\scripts\build-vercel.js
```

The script writes the deployable site to `dist\`. Drag the generated `dist` folder into Netlify Drop. Netlify Drop does not run the build or read environment variables from the dashboard, so set `VITE_API_URL` in the shell before building. Do not upload the repository root or `backend\`.

For a Netlify build that runs from a connected repository or the Netlify CLI, [netlify.toml](../netlify.toml) sets the build command to `node scripts/build-vercel.js` and the publish directory to `dist`. No frontend package installation is required.

The site is multi-page: its routes are actual files such as `/pages/career-development.html`. Netlify serves those files directly after refresh, so no SPA fallback redirect is configured. A catch-all rewrite to `/index.html` would not provide React routing and would change how unknown paths behave.

### Render Node.js service

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | Yes | `production` (set by the Blueprint). |
| `PORT` | Render-managed | Do not hardcode or manually set it. Express binds to `0.0.0.0`. |
| `CORS_ORIGIN` | Yes | Exact Vercel production origin(s), comma-separated, e.g. `https://voice4all.vercel.app,https://learn.example.org`. Wildcards are rejected in production. |
| `TTS_SERVICE_URL` | Yes | Render Blueprint references the Python service host. The server uses HTTPS for a host-only value. |
| `TTS_SERVICE_TOKEN` | Yes | High-entropy shared secret; the Blueprint prompts once and shares it with both Render services. |
| `AI_PROVIDER` | No | `mock_demo` by default. Set to `gemini` only with `GEMINI_API_KEY`. |
| `DEFAULT_LANGUAGE` | No | `en` by default; `am` is also supported. |
| `GEMINI_API_KEY` | Conditional | Required only when `AI_PROVIDER=gemini`; keep it in Render, never in the frontend. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash-lite` in the current backend. |
| `TELEGRAM_BOT_TOKEN` | Conditional | Enables live Telegram notifications. |
| `TELEGRAM_BOT_USERNAME` | No | Defaults to `@Voice4AllJobsBot`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Conditional | Configure together to enable Twilio SMS. |
| `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` | Conditional | Configure together to enable Africa's Talking SMS. |

`LOCAL_MODEL_URL` and `ENABLE_LOCAL_AI` are for a separately managed local model and are not suitable for this Render setup. The current backend does not read an `OPENAI_API_KEY`.

### Render Python TTS service

| Variable | Required | Value |
|---|---|---|
| `PORT` | Render-managed | Uvicorn reads this value at startup. |
| `NODE_ENV` | Yes | `production` (set by the Blueprint). |
| `TTS_SERVICE_TOKEN` | Yes | The same secret configured for the Node service. The synthesis route rejects requests without it. |

Edge TTS needs no API key or model download, but it does need outbound internet access to Microsoft's online speech service.

Local development values and placeholders are in the root [.env.example](../.env.example) and [backend/.env.example](../backend/.env.example). Render/Vercel dashboard values take precedence in production.

## Deployment order

### 1. Create the Vercel project to reserve its origin

1. In Vercel, choose **Add New → Project**, import this repository, and set the project root to the repository root (`.`).
2. Keep the provided settings from [vercel.json](../vercel.json): build command `node scripts/build-vercel.js`, output directory `dist`, and no dependency install needed. The repo is not an SPA, so direct `.html` page routes are served as static files; no fallback rewrite is required.
3. Note the production Vercel origin (or configure a custom domain). You can finish the first build after Render is ready.

The production frontend build deliberately fails until `VITE_API_URL` is set to the actual Node service URL. If Vercel starts an initial build during project import, add the variable once Render is deployed and then redeploy.

### 2. Create and configure both Render services

1. In Render, choose **New → Blueprint**, connect this repository, and select the intended branch. Render reads [render.yaml](../render.yaml).
2. Set `CORS_ORIGIN` to the exact Vercel origin from step 1 (and any other exact allowed Vercel/custom origins). Do not use `*`.
3. When prompted for the `voice4all-tts-auth` environment group secret, provide a long, random value. Render shares it with the Node and Python services; do not put it in source control or Vercel.
   The Blueprint disables automatic Render deploys on later commits; deploy changes manually from the Render Dashboard.
4. Review the two services before creating them:

   **Node service**
   - Root directory: `backend`
   - Build: `npm ci`
   - Start: `npm start`
   - Health check: `/api/health`

   **Python TTS service**
   - Root directory: `backend/tts`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn edge_tts_server:app --host 0.0.0.0 --port $PORT`
   - Health check: `/health`

5. Create/deploy the Blueprint. The Node service receives the Python service hostname through Render's service reference. The backend normalizes the host to HTTPS and calls the Python service; the browser never calls Python directly.
6. Confirm the Node service's public URL, then use it as `VITE_API_URL` in Vercel.

If you are not using the Blueprint, create two Render **Web Services** manually with the roots and commands above. Set `TTS_SERVICE_URL` to the Python service's full `https://...onrender.com` URL and set the same `TTS_SERVICE_TOKEN` on both services. Set `CORS_ORIGIN` on Node.

### 3. Deploy the Vercel frontend

1. In Vercel **Project Settings → Environment Variables**, set `VITE_API_URL` to the Node service's public HTTPS URL for Production. Add it for Preview too if preview deployments should use that backend.
2. Redeploy after setting or changing the variable; it is injected at build time.
3. If you have preview domains, add their exact origins to Render's comma-separated `CORS_ORIGIN` as needed. Vercel preview URLs can vary; prefer a stable domain or maintain the explicit allowlist.
4. Open the production site and confirm page reloads on paths such as `/pages/career-development.html` and `/pages/human-support.html`.

For future Vercel builds, `VITE_API_URL` is required. The build intentionally fails if it is missing, invalid, or not HTTPS, preventing a successful production build from silently using localhost or the Vercel origin for API calls.

## Health checks and smoke tests

Substitute the real service hostnames:

```text
https://<node-service>.onrender.com/api/health
https://<python-service>.onrender.com/health
```

The Python health endpoint is public and reports readiness only when the production shared token is configured. Do not send the shared token from a browser.

Test Node-to-Python audio proxying (Node validates and proxies the result):

```powershell
$body = @{ text = 'ሰላም፣ እንኳን ወደ Voice4All በደህና መጡ።'; language = 'am' } | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri 'https://<node-service>.onrender.com/api/tutor/speech' -ContentType 'application/json' -Body $body -OutFile amharic.mp3

$body = @{ text = 'Welcome to Voice4All.'; language = 'en' } | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri 'https://<node-service>.onrender.com/api/tutor/speech' -ContentType 'application/json' -Body $body -OutFile english.mp3
```

The returned files should be playable MP3 audio. Also test the deployed tutor, support form, career pages, voice assistant welcome/settings, keyboard navigation, and browser refresh on nested `.html` routes. Check browser DevTools for CORS errors and confirm API requests go to the Render Node URL.

## Common deployment issues

- **Vercel build says `VITE_API_URL` is missing/invalid:** Add the public HTTPS Node URL to Vercel's environment variables and redeploy.
- **Browser reports CORS errors:** `CORS_ORIGIN` must exactly match the page origin, including `https://`, and be set on the Node service. Commas separate exact origins; wildcard values are rejected in production.
- **Speech returns 502/503:** Ensure `TTS_SERVICE_TOKEN` is set identically on both Render services and redeploy them. For manually created services, confirm `TTS_SERVICE_URL` is the Python service's HTTPS URL. A direct, unauthenticated Python synthesis request should return 401.
- **Initial request is slow or times out:** Free Render services can spin down while idle. Retry after the health check becomes ready. Speech has longer client/upstream timeouts than normal API calls, but cold starts and the external Edge TTS provider can still exceed platform limits.
- **`/api/health` works but a route fails:** Check the Render Node logs and confirm the selected AI/notification provider has the required server-side credentials.
- **Support tickets disappear or differ between instances:** The current queue persists to a local JSON file and is also held in process memory; analytics and notification subscribers are in memory. Render free filesystems are ephemeral and multiple instances do not share these stores. This is not durable production persistence; use a managed database before relying on long-term tickets or multi-instance support.

## Production and free-plan limitations

- Edge TTS is an unofficial client for Microsoft's online speech service. It requires internet, can be unavailable or change without notice, and is not guaranteed to remain free or production-supported.
- Render free Web Services can spin down when idle; cold starts delay the first request. Low free-tier CPU/RAM may affect Edge TTS performance.
- The app currently has no managed database. Support requests, analytics, SMS/Telegram subscriber state, and other in-memory state are not durable across restarts. Career/course JSON datasets are bundled with the service deployment.
- Speech text is capped and validated, but the public Node API does not currently enforce per-client request-rate limits. Add API-level rate limiting or an upstream gateway policy before exposing the service broadly.
- The current default tutor provider is `mock_demo`. Set `AI_PROVIDER=gemini` and a Render-only `GEMINI_API_KEY` to use Gemini; this may have separate provider costs and terms.
- Browser speech synthesis is only a fallback; Amharic voices depend on the user's browser/device.
- CORS and the shared TTS token protect service communication, but they are not end-user authentication. The current support `authorize` middleware trusts caller-supplied role headers/query values rather than verifying an identity; agent/admin endpoints are therefore not protected by a real login. Do not expose the support-agent portal or handle real learner data until an identity provider and server-verified authorization are implemented. The current deployment setup does not add those systems.
- This guide prepares configuration only. You must create the Vercel and Render projects, configure domains/secrets, review plan limits, and press Deploy in their dashboards. No services were connected or deployed as part of this work; Vercel Git auto-deploy behavior remains controlled in its dashboard.
