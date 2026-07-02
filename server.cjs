const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8790);
const ROOT = __dirname;

function sendJson(res, code, payload) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".bat": "text/plain; charset=utf-8"
  }[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Invalid image data");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function readTag(item, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i").exec(item);
  return match ? decodeXml(match[1].trim()) : "";
}

async function getGoogleTrends({ geo = "PH", limit = 10 }) {
  const rssUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const response = await fetch(rssUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 Lazypost/1.0"
    }
  });
  if (!response.ok) throw new Error(`Google Trends failed: ${response.status}`);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, limit)
    .map((match, index) => {
      const item = match[1];
      return {
        rank: index + 1,
        title: readTag(item, "title"),
        traffic: readTag(item, "ht:approx_traffic"),
        picture: readTag(item, "ht:picture"),
        pictureSource: readTag(item, "ht:picture_source"),
        pubDate: readTag(item, "pubDate")
      };
    })
    .filter((item) => item.title);
  if (!items.length) throw new Error("No Google Trends items found");
  return items;
}

async function proxyImage(res, imageUrl) {
  const parsed = new URL(imageUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid image URL");
  const response = await fetch(parsed, {
    headers: {
      "user-agent": "Mozilla/5.0 Lazypost/1.0"
    }
  });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("URL did not return an image");
  const buffer = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": "public, max-age=1800"
  });
  res.end(buffer);
}

async function postFacebookPhoto({ pageId, token, version, caption, imageDataUrl }) {
  if (!pageId) throw new Error("Facebook Page ID is missing");
  if (!token) throw new Error("Facebook Page token is missing");

  const form = new FormData();
  form.append("access_token", token);
  form.append("caption", caption || "");
  form.append("source", dataUrlToBlob(imageDataUrl), "lazypost-lite.png");

  const apiVersion = version || "v25.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/photos`, {
    method: "POST",
    body: form
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Facebook error ${response.status}`);
  }
  return {
    ok: true,
    id: data.id,
    postId: data.post_id
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/facebook/photo" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, await postFacebookPhoto(body));
      return;
    }

    if (url.pathname === "/api/trends" && req.method === "GET") {
      const trends = await getGoogleTrends({
        geo: url.searchParams.get("geo") || "PH",
        limit: Number(url.searchParams.get("limit") || 10)
      });
      sendJson(res, 200, { trends });
      return;
    }

    if (url.pathname === "/api/image" && req.method === "GET") {
      await proxyImage(res, url.searchParams.get("url") || "");
      return;
    }

    const safePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.normalize(path.join(ROOT, safePath));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    sendFile(res, filePath);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Lazypost 1.0 Lite running at http://localhost:${PORT}`);
});
