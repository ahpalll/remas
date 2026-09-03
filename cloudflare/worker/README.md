# Cloudflare Worker for Remas Private R2 Media Delivery

## Setup & Deployment Instructions

### Prerequisites
1. Cloudflare account with R2 enabled.
2. `wrangler` CLI installed (`npm i -g wrangler`).

### Local Development & Test
```bash
npm test
```

### Production Deployment
```bash
wrangler login
wrangler secret put R2_ACCESS_KEY
wrangler secret put R2_SECRET
wrangler deploy
```

### Live Deployment Status
`BLOCKED / USER ACTION REQUIRED`: Live deployment to Cloudflare production requires user credentials and Wrangler authentication. Local emulator/test suite verified 100%.
