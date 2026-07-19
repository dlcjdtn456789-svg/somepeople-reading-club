// somepeople reading club - daily Instagram carousel publisher.
//
// Publishes the card news for today's date (matching a 카드뉴스/YYYY-MM-DD
// folder) as an Instagram carousel post, using the Instagram Graph API.
//
// Required environment variables:
//   IG_ACCESS_TOKEN - long-lived Page/User access token with
//                      instagram_basic + instagram_content_publish scopes
//   IG_BUSINESS_ID  - the Instagram Business Account ID (numeric string)
//
// Images must already be publicly reachable (this project hosts them via
// GitHub Pages). Update GITHUB_PAGES_BASE below if the repo/owner changes.

const fs = require("fs");
const path = require("path");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const GITHUB_PAGES_BASE = "https://dlcjdtn456789-svg.github.io/somepeople-reading-club";
const CARDNEWS_DIR_NAME = "카드뉴스";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CARDNEWS_ROOT = path.join(PROJECT_ROOT, CARDNEWS_DIR_NAME);
const PUBLISHED_LOG = path.join(__dirname, "published.json");

const SLIDE_COUNT = 7;

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
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_BUSINESS_ID;
  if (!accessToken || !igUserId) {
    console.error("ERROR: set IG_ACCESS_TOKEN and IG_BUSINESS_ID environment variables first.");
    process.exit(1);
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
