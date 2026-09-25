// Local stand-in for production hosting of the web app: serves the export at
// /app and forwards /api to the live backend, so the browser sees one origin
// exactly as it will on www.getomen.xyz.
//   node scripts/serve-web.mjs [dir] [port]
// Development, with Metro's live reload instead of an export:
//   npx expo start --web --port 8081       (one terminal)
//   OMEN_DEV=http://localhost:8081 node scripts/serve-web.mjs   (another)
// The page and its API then share http://localhost:3200, which Privy has
// to list as an allowed origin.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve(process.argv[2] ?? ".local/web-export");
const port = Number(process.argv[3] ?? 3200);
const upstream = process.env.OMEN_API ?? "https://www.getomen.xyz";
const dev = process.env.OMEN_DEV ? new URL(process.env.OMEN_DEV) : null;
/** Metro in development: the page, its bundle and its hot-reload socket. */
function proxyToMetro(req, res) {
  const r = http.request(
    { host: dev.hostname, port: dev.port, method: req.method, path: req.url, headers: { ...req.headers, host: dev.host } },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    },
  );
  r.on("error", () => res.writeHead(502).end("Metro is not running on " + dev.origin));
  req.pipe(r);
}
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".ttf": "font/ttf", ".css": "text/css" };
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { ...req.headers };
      delete headers.host; delete headers.origin; delete headers.referer; delete headers["content-length"];
      const r = await fetch(upstream + url.pathname + url.search, {
        method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
      }).catch(() => null);
      if (!r) return void res.writeHead(502).end();
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") ?? "application/json" });
      return void res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (dev) return proxyToMetro(req, res);
    if (!url.pathname.startsWith("/app")) return void res.writeHead(302, { location: "/app" }).end();
    let file = path.join(dir, url.pathname.slice(4) || "/");
    if (!file.startsWith(dir)) return void res.writeHead(403).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, "index.html");
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .on("upgrade", (req, socket, head) => {
    // Metro's hot-reload WebSocket, piped through as raw bytes.
    if (!dev) return socket.destroy();
    const to = net.connect(Number(dev.port), dev.hostname, () => {
      const CRLF = String.fromCharCode(13, 10);
      to.write("GET " + req.url + " HTTP/1.1" + CRLF + Object.entries(req.headers).map(([k, v]) => k + ": " + v + CRLF).join("") + CRLF);
      if (head.length) to.write(head);
      socket.pipe(to).pipe(socket);
    });
    to.on("error", () => socket.destroy());
    socket.on("error", () => to.destroy());
  })
  .listen(port, () =>
    console.log("OMEN web on http://localhost:" + port + (dev ? "  (page -> " + dev.origin : "/app  (dev export") + ", api -> " + upstream + ")"),
  );
