// somepeople reading club - daily Instagram carousel publisher.
//
// Publishes the card news for today's date (matching a 카드뉴스/YYYY-MM-DD
// folder) as an Instagram carousel post, using the Instagram API with
// Instagram Login (graph.instagram.com) - not the classic Facebook
// Page-linked Graph API.
//
// Required environment variables:
//   IG_ACCESS_TOKEN - long-lived Instagram User access token (starts with
//                      "IGAA...") with instagram_business_basic +
//                      instagram_business_content_publish scopes
//   IG_BUSINESS_ID  - the Instagram-scoped User ID returned by
//                      GET https://graph.instagram.com/v21.0/me (NOT the
//                      classic "Instagram Business Account ID")
//
// Images must already be publicly reachable (this project hosts them via
// GitHub Pages). Update GITHUB_PAGES_BASE below if the repo/owner changes.

const fs = require("fs");
const path = require("path");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

const GITHUB_PAGES_BASE = "https://dlcjdtn456789-svg.github.io/somepeople-reading-club";
const CARDNEWS_DIR_NAME = "카드뉴스";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CARDNEWS_ROOT = path.join(PROJECT_ROOT, CARDNEWS_DIR_NAME);
const PUBLISHED_LOG = path.join(__dirname, "published.json");
const TOKEN_STORE = path.join(__dirname, "token.json");

const SLIDE_COUNT = 7;

// Reads the working access token from token.json if we've saved a refreshed
// one before; otherwise bootstraps from the IG_ACCESS_TOKEN env var (first run).
function loadAccessToken() {
  if (fs.existsSync(TOKEN_STORE)) {
    return JSON.parse(fs.readFileSync(TOKEN_STORE, "utf-8")).access_token;
  }
  return process.env.IG_ACCESS_TOKEN;
}

function saveAccessToken(accessToken, expiresInSeconds) {
  fs.writeFileSync(
    TOKEN_STORE,
    JSON.stringify(
      {
        access_token: accessToken,
        refreshed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

// Instagram long-lived tokens last ~60 days and can be refreshed (without the
// app secret) once they're at least 24h old. Refreshing after every run means
// this never expires as long as the daily task keeps running.
async function refreshAccessToken(accessToken) {
  const qs = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const resp = await fetch(`https://graph.instagram.com/refresh_access_token?${qs}`);
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }
  return json;
}

function loadPublishedLog() {
  if (fs.existsSync(PUBLISHED_LOG)) {
    return JSON.parse(fs.readFileSync(PUBLISHED_LOG, "utf-8"));
  }
  return {};
}

function savePublishedLog(log) {
  fs.writeFileSync(PUBLISHED_LOG, JSON.stringify(log, null, 2), "utf-8");
}

function imageUrlFor(dateStr, index) {
  const encodedDir = encodeURIComponent(CARDNEWS_DIR_NAME);
  const n = String(index).padStart(2, "0");
  return `${GITHUB_PAGES_BASE}/${encodedDir}/${dateStr}/${n}.png`;
}

async function postForm(url, params) {
  const body = new URLSearchParams(params);
  const resp = await fetch(url, { method: "POST", body });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`POST ${url} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getJson(url, params) {
  const qs = new URLSearchParams(params);
  const resp = await fetch(`${url}?${qs}`);
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(`GET ${url} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function createChildContainer(igUserId, accessToken, imageUrl) {
  const json = await postForm(`${GRAPH_BASE}/${igUserId}/media`, {
    image_url: imageUrl,
    is_carousel_item: "true",
    access_token: accessToken,
  });
  return json.id;
}

async function createCarouselContainer(igUserId, accessToken, childrenIds, caption) {
  const json = await postForm(`${GRAPH_BASE}/${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
    access_token: accessToken,
  });
  return json.id;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilFinished(containerId, accessToken, timeoutMs = 120000, intervalMs = 5000) {
  let elapsed = 0;
  while (elapsed < timeoutMs) {
    const json = await getJson(`${GRAPH_BASE}/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new Error(`Container ${containerId} failed to process`);
    }
    await sleep(intervalMs);
    elapsed += intervalMs;
  }
  throw new Error(`Container ${containerId} did not finish processing in time`);
}

async function publishContainer(igUserId, accessToken, creationId) {
  const json = await postForm(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  return json.id;
}

async function main() {
  let accessToken = loadAccessToken();
  const igUserId = process.env.IG_BUSINESS_ID;
  if (!accessToken || !igUserId) {
    console.error("ERROR: set IG_ACCESS_TOKEN and IG_BUSINESS_ID environment variables first.");
    process.exit(1);
  }

  try {
    const refreshed = await refreshAccessToken(accessToken);
    accessToken = refreshed.access_token;
    saveAccessToken(accessToken, refreshed.expires_in);
    console.log(`  token refreshed, valid ~${Math.round(refreshed.expires_in / 86400)} more days`);
  } catch (err) {
    console.log(`  (token refresh skipped: ${err.message})`);
  }

  const dateStr = process.env.PUBLISH_DATE_OVERRIDE || new Date().toISOString().slice(0, 10);
  const folder = path.join(CARDNEWS_ROOT, dateStr);

  const log = loadPublishedLog();
  if (log[dateStr] && log[dateStr].status === "published") {
    console.log(`${dateStr} already published (media id ${log[dateStr].media_id}). Skipping.`);
    return;
  }

  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.log(`No card news folder found for ${dateStr} (${folder}). Nothing to publish.`);
    process.exit(2);
  }

  const captionPath = path.join(folder, "caption.txt");
  const caption = fs.existsSync(captionPath) ? fs.readFileSync(captionPath, "utf-8").trim() : "";

  console.log(`Publishing ${dateStr} ...`);

  const childIds = [];
  for (let i = 1; i <= SLIDE_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    const pngPath = path.join(folder, `${n}.png`);
    if (!fs.existsSync(pngPath)) {
      console.log(`  WARNING: ${n}.png missing, stopping at ${i - 1} slides.`);
      break;
    }
    const url = imageUrlFor(dateStr, i);
    console.log(`  creating container ${n} -> ${url}`);
    childIds.push(await createChildContainer(igUserId, accessToken, url));
  }

  if (childIds.length < 2) {
    console.error("ERROR: need at least 2 slides for a carousel.");
    process.exit(3);
  }

  console.log("  creating carousel container ...");
  const carouselId = await createCarouselContainer(igUserId, accessToken, childIds, caption);

  console.log("  waiting for processing ...");
  await waitUntilFinished(carouselId, accessToken);

  console.log("  publishing ...");
  const mediaId = await publishContainer(igUserId, accessToken, carouselId);

  log[dateStr] = {
    status: "published",
    media_id: mediaId,
    published_at: new Date().toISOString(),
  };
  savePublishedLog(log);

  console.log(`Done. Published media id: ${mediaId}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
