# Precision W&D — Marketing Site

Single-page luxury jewelry & watch site. Node/Express, deployable to Render.
Inventory (products, prices, photos, sold status) comes live from your
**Square** catalog, so the website and the in-person register always agree.

## How content works

| Content            | Where you edit it                                        |
| ------------------ | -------------------------------------------------------- |
| Products & photos  | Square Dashboard → Items (the site pulls them via API)   |
| Sold-out status    | Square inventory counts (automatic)                      |
| Brand name & copy  | `site.config.json`                                       |
| Reviews            | `data/reviews.json` (curated by you)                     |
| Past work gallery  | `data/gallery.json` + images in `public/gallery/`        |

No token set? The site runs with sample inventory from
`data/sample-inventory.json` so you can preview the design.

## Run locally

```
npm install
cp .env.example .env   # fill in your Square credentials
npm start              # http://localhost:3000
```

## Connect Square

1. Go to https://developer.squareup.com → create an application.
2. Copy the **Production Access Token** into `.env` as `SQUARE_ACCESS_TOKEN`.
3. Copy your **Location ID** (Square Dashboard → Account → Locations) into
   `SQUARE_LOCATION_ID` — required for the "Purchase" buttons (Square-hosted
   checkout links) and sold-out detection.
4. Add product photos to items in the Square Dashboard; they appear on the
   site automatically (cached for 5 minutes).

## Deploy to Render

1. Push this repo to GitHub and create a **Web Service** on Render pointing
   at it (`render.yaml` is picked up automatically as a Blueprint), or create
   the service manually with build `npm ci` and start `node server.js`.
2. In the Render dashboard, set the environment variables
   `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID`.
3. Add your custom domain under Settings → Custom Domains.
