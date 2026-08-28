import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "www");
const port = Number(process.env.PORT || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1:" + port);
  const pathname = decodeURIComponent(
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname,
  );
  const target = path.resolve(root, "." + pathname);

  if (!target.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.setHeader(
      "Content-Type",
      mime.get(path.extname(target)) || "application/octet-stream",
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    fs.createReadStream(target).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log("Wellness test server: http://127.0.0.1:" + port);
});
