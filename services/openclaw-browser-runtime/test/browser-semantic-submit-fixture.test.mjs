import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_SEMANTIC_SUBMIT_FIXTURE_PATH,
  browserSemanticSubmitFixtureHtml,
  buildBrowserSemanticSubmitFixtureUrl,
  serveBrowserSemanticSubmitFixture,
} from "../src/browser-semantic-submit-fixture.mjs";

test("semantic submit fixture has one write-only form and local completion transition", () => {
  const html = browserSemanticSubmitFixtureHtml();
  assert.match(html, /<label for="customer-name">Customer name<\/label>/u);
  assert.match(html, /<button type="submit">Submit review<\/button>/u);
  assert.match(html, /disabled hidden>Submission complete<\/button>/u);
  assert.match(html, /event\.preventDefault\(\)/u);
  assert.match(html, /event\.currentTarget\.reset\(\)/u);
  assert.equal(html.includes("fetch("), false);
  assert.equal(html.includes("localStorage"), false);
  assert.equal(html.includes("sessionStorage"), false);
  assert.equal(html.includes("method="), false);
  assert.equal(html.includes("action="), false);
});

test("semantic submit fixture URL and route remain fixed to loopback GET", () => {
  const url = buildBrowserSemanticSubmitFixtureUrl({ host: "127.0.0.1", port: 4103 });
  assert.equal(url, `http://127.0.0.1:4103${BROWSER_SEMANTIC_SUBMIT_FIXTURE_PATH}`);
  assert.throws(
    () => buildBrowserSemanticSubmitFixtureUrl({ host: "0.0.0.0", port: 4103 }),
    /loopback/u,
  );

  const response = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
  assert.equal(serveBrowserSemanticSubmitFixture(
    { method: "GET" },
    response,
    new URL(url),
  ), true);
  assert.equal(response.status, 200);
  assert.match(response.headers["content-security-policy"], /form-action 'none'/u);
  assert.equal(response.headers["cache-control"].includes("no-store"), true);
  assert.match(response.body, /Submission complete/u);
  assert.equal(serveBrowserSemanticSubmitFixture(
    { method: "POST" },
    response,
    new URL(url),
  ), false);
});
