export const BROWSER_SEMANTIC_SUBMIT_FIXTURE_PATH =
  "/fixtures/semantic-submit";

export function buildBrowserSemanticSubmitFixtureUrl({ host, port } = {}) {
  const hostname = host === "::1" ? "[::1]" : host;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)
    || !Number.isInteger(port)
    || port < 1
    || port > 65_535) {
    throw new Error("Semantic submit fixture requires a loopback browser runtime URL.");
  }
  return `http://${hostname}:${port}${BROWSER_SEMANTIC_SUBMIT_FIXTURE_PATH}`;
}

export function browserSemanticSubmitFixtureHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NixSoma Semantic Submit Fixture</title>
</head>
<body>
  <main>
    <h1>Customer review</h1>
    <form id="customer-form">
      <label for="customer-name">Customer name</label>
      <input id="customer-name" name="customer-name" type="text" autocomplete="off" required>
      <button type="submit">Submit review</button>
    </form>
    <button id="completion-state" type="button" disabled hidden>Submission complete</button>
  </main>
  <script>
    document.querySelector("#customer-form").addEventListener("submit", (event) => {
      event.preventDefault();
      event.currentTarget.reset();
      event.currentTarget.hidden = true;
      document.querySelector("#completion-state").hidden = false;
    });
  </script>
</body>
</html>`;
}

export function serveBrowserSemanticSubmitFixture(req, res, requestUrl) {
  if (req.method !== "GET" || requestUrl.pathname !== BROWSER_SEMANTIC_SUBMIT_FIXTURE_PATH) {
    return false;
  }
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    "referrer-policy": "no-referrer",
  });
  res.end(browserSemanticSubmitFixtureHtml());
  return true;
}
