# OpenClaw_On_NixOS — 代码审查修复日志

> **审查日期**：2026-05-24  
> **项目环境**：NixOS（Linux）  
> **修复总数**：13 项（高危 3 项 · 中危 7 项 · 低危 3 项）  
> **H-4 注**：原报告的 H-4（Windows 路径分隔符绕过）经确认为平台误判，在 NixOS 上不成立，仅补充了代码注释。

---

## 目录

| 编号 | 严重度 | 文件 | 标题 |
|------|--------|------|------|
| [H-1](#h-1) | 🔴 高危 | browser-runtime | Tab ID 基于数组长度生成，存在重复风险 |
| [H-2](#h-2) | 🔴 高危 | browser-runtime | `ensureSession()` 并发竞争条件 |
| [H-3](#h-3) | 🔴 高危 | event-hub | 审计日志使用同步阻塞 I/O |
| [M-1](#m-1) | 🟡 中危 | session-manager | work-view 事件类型全部错误标为 `service.started` |
| [M-2](#m-2) | 🟡 中危 | event-hub | `latestTimestamp` 取遍历最后一条而非最大值 |
| [M-3](#m-3) | 🟡 中危 | system-heal | `addHistory` 在两个 `publishEvent` 之间调用，状态可能不一致 |
| [M-4](#m-4) | 🟡 中危 | screen-act | 两个路由缺少 `try/catch`，异常导致连接挂起 |
| [M-5](#m-5) | 🟡 中危 | screen-sense | `browser=null`（fetch 失败）被误判为浏览器稳定状态 |
| [M-6](#m-6) | 🟡 中危 | system-heal | 持久化 `mode` 字段无枚举校验 |
| [L-1](#l-1) | 🟢 低危 | event-hub | `recentEvents` 超限时用多元素 `splice` 低效清理 |
| [L-2](#l-2) | 🟢 低危 | system-heal | `isMaintenanceDue` 对损坏的时间戳静默触发维护 |
| [L-3](#l-3) | 🟢 低危 | session-manager | 两个路由响应体完全重复的代码 |
| [N-1](#n-1) | 🟡 中危 | **openclaw-core** | `/tasks/{id}/phase` 路由直接将客户端的 `status` 写入任务，无枚举校验 |

---

## H-1 · browser-runtime — Tab ID 重复风险 {#h-1}

**文件**：`services/openclaw-browser-runtime/src/server.mjs`  
**函数**：`addTab()`

### 根本原因

Tab ID 使用 `tabs.length + 1` 生成。一旦存在 Tab 删除操作，`length` 减少后下次生成的 ID 将与已有 Tab 重复，可能导致操作作用于错误的 Tab。

### 修复前

```js
id: `tab-${browserState.tabs.length + 1}`,
```

### 修复后

```js
// 引入 import { randomUUID } from "node:crypto";
id: `tab-${randomUUID()}`,
```

### 影响评估

- **影响范围**：Tab 管理逻辑、所有依赖 Tab ID 的操作
- **触发条件**：Tab 被删除后继续新建 Tab 时
- **风险等级**：高危（数据完整性问题）

---

## H-2 · browser-runtime — `ensureSession()` 竞争条件 {#h-2}

**文件**：`services/openclaw-browser-runtime/src/server.mjs`  
**函数**：`ensureSession()`

### 根本原因

`/browser/open` 被并发调用时，两个请求可能同时通过 `status !== "running"` 的检查，各自向 `session-manager` 发送 `/session/start`，造成重复启动请求。

### 修复前

```js
async function ensureSession() {
  const current = await readSessionState();
  if (current?.status === "running" && current?.sessionId) {
    return current;
  }
  await fetch(`${sessionManagerUrl}/session/start`, { ... });
  return waitForReadySession();
}
```

### 修复后

```js
let _ensureSessionPromise = null;

async function ensureSession() {
  if (_ensureSessionPromise) {
    return _ensureSessionPromise;  // 复用进行中的 Promise
  }
  _ensureSessionPromise = _doEnsureSession().finally(() => {
    _ensureSessionPromise = null;
  });
  return _ensureSessionPromise;
}

async function _doEnsureSession() {
  // 原有逻辑
}
```

### 影响评估

- **影响范围**：所有并发的浏览器操作请求
- **触发条件**：多个请求在毫秒级内同时到达
- **风险等级**：高危（会话状态混乱）

---

## H-3 · event-hub — 同步阻塞 I/O {#h-3}

**文件**：`services/openclaw-event-hub/src/server.mjs`  
**函数**：`readAuditEvents()`、`buildAuditSummary()`、`appendAuditEvent()`、`publishEvent()`

### 根本原因

事件中心是整个系统的通信枢纽，但其审计日志的读写全部使用同步阻塞 API（`readFileSync`、`appendFileSync`），在 Node.js 单线程模型下会阻塞整个 HTTP 服务，导致所有服务的事件推送超时。

### 修复前

```js
function readAuditEvents(...) {
  const text = fs.readFileSync(auditLogFile, "utf8");  // 阻塞
  ...
}

function appendAuditEvent(event) {
  fs.appendFileSync(auditLogFile, `${JSON.stringify(event)}\n`);  // 阻塞
}

function publishEvent(event) {
  appendAuditEvent(event);  // 同步调用
  ...
}
```

### 修复后

```js
// 新增导入
import { promises as fsPromises } from "node:fs";

async function readAuditEvents(...) {
  const text = await fsPromises.readFile(auditLogFile, "utf8");
  ...
}

async function appendAuditEvent(event) {
  await fsPromises.appendFile(auditLogFile, `${JSON.stringify(event)}\n`);
}

async function publishEvent(event) {
  await appendAuditEvent(event);
  ...
}
```

同时将所有调用点（路由处理器、`hydrateRecentEventsFromAuditLog`）也改为 `async/await`。

### 影响评估

- **影响范围**：整个系统的事件吞吐量
- **触发条件**：审计日志超过数百 KB 时明显卡顿
- **风险等级**：高危（系统级性能和可用性问题）

---

## M-1 · session-manager — 事件类型语义错误 {#m-1}

**文件**：`services/openclaw-session-manager/src/server.mjs`  
**路由**：`/work-view/prepare`、`/work-view/reveal`、`/work-view/hide`

### 根本原因

三个 work-view 状态变更操作均发出 `"service.started"` 类型事件，与服务启动事件混淆，订阅方无法区分。

### 修复前

```js
// prepare / reveal / hide 均发出：
await publishEvent("service.started", { action: "work-view-prepared", ... });
await publishEvent("service.started", { action: "work-view-revealed", ... });
await publishEvent("service.started", { action: "work-view-hidden", ... });
```

### 修复后

```js
await publishEvent("screen.updated", { action: "work-view-prepared", ... });
await publishEvent("screen.updated", { action: "work-view-revealed", ... });
await publishEvent("screen.updated", { action: "work-view-hidden", ... });
```

### 影响评估

- **影响范围**：所有订阅 `service.started` 事件的下游消费者
- **风险等级**：中危（事件总线语义破坏）

---

## M-2 · event-hub — `latestTimestamp` 计算错误 {#m-2}

**文件**：`services/openclaw-event-hub/src/server.mjs`  
**函数**：`buildAuditSummary()`

### 根本原因

`latestTimestamp` 赋值为遍历中最后一条有 timestamp 的记录，而非时间值最大的记录。若日志存在乱序（如补录历史事件），返回的最大时间将不准确。

### 修复前

```js
latestTimestamp = event.timestamp;  // 总是覆盖为最后遍历到的
```

### 修复后

```js
// 字符串比较对 ISO 8601 格式的时间戳完全正确
latestTimestamp = latestTimestamp === null || event.timestamp > latestTimestamp
  ? event.timestamp
  : latestTimestamp;
```

### 影响评估

- **影响范围**：`/events/audit/summary` 接口返回的时间范围统计
- **风险等级**：中危（数据准确性问题）

---

## M-3 · system-heal — `addHistory` 位置导致状态不一致 {#m-3}

**文件**：`services/openclaw-system-heal/src/server.mjs`  
**函数**：`executeHealStep()`

### 根本原因

`addHistory(entry)` 在 `publishEvent("heal.started")` 和 `publishEvent("heal.completed")` 之间调用。若第一个事件发布后服务异常，历史记录已写入但 `heal.completed` 永远不发出，导致历史状态与实际事件不一致。此外，`completedAt` 在真正完成前就已设置，计时不准确。

### 修复前

```js
async function executeHealStep(step) {
  const entry = { ..., startedAt: now, completedAt: now };
  await publishEvent("heal.started", { entry, step });
  addHistory(entry);          // ← 历史已写入
  await publishEvent("heal.completed", { entry, step });
  return entry;
}
```

### 修复后

```js
async function executeHealStep(step) {
  const startedAt = new Date().toISOString();
  const entry = { ..., startedAt, completedAt: startedAt };
  await publishEvent("heal.started", { entry, step });
  entry.completedAt = new Date().toISOString();  // 真正完成后更新时间
  await publishEvent("heal.completed", { entry, step });
  addHistory(entry);  // ← 两个事件都发出后才写历史
  return entry;
}
```

### 影响评估

- **影响范围**：修复历史记录的完整性和 `heal.*` 事件的时序一致性
- **风险等级**：中危（数据一致性问题）

---

## M-4 · screen-act — 两个路由缺少错误处理 {#m-4}

**文件**：`services/openclaw-screen-act/src/server.mjs`  
**路由**：`POST /act/mouse/click`、`POST /act/keyboard/type`

### 根本原因

这两个路由没有 `try/catch`，而同文件其他路由都有。`readJsonBody` 或 `executeAction` 抛出异常时，HTTP 连接会挂起而不返回任何响应，客户端永远等待直到超时。

### 修复前

```js
if (req.method === "POST" && requestUrl.pathname === "/act/mouse/click") {
  const body = await readJsonBody(req);   // 无保护
  const action = await executeAction(...); // 无保护
  sendJson(res, 200, { ok: true, action });
  return;
}
```

### 修复后

```js
if (req.method === "POST" && requestUrl.pathname === "/act/mouse/click") {
  try {
    const body = await readJsonBody(req);
    const action = await executeAction(...);
    sendJson(res, 200, { ok: true, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, { ok: false, error: message });
  }
  return;
}
```

`/act/keyboard/type` 做同样处理。

### 影响评估

- **影响范围**：鼠标点击和键盘输入操作的可靠性
- **风险等级**：中危（请求挂起）

---

## M-5 · screen-sense — `browser=null` 被误判为稳定状态 {#m-5}

**文件**：`services/openclaw-screen-sense/src/server.mjs`  
**函数**：`collectStableScreenState()`

### 根本原因

原条件 `!(latest.browser?.running) || latest.session?.sessionId`：

当 `browser-runtime` fetch 失败时，`latest.browser` 为 `null`，`null?.running` 为 `undefined`，`!(undefined)` 为 `true`，直接以 `degraded: false` 退出循环——**将"获取不到浏览器状态"误判为"浏览器正常未运行"**。

### 修复前

```js
if (!(latest.browser?.running) || latest.session?.sessionId) {
  const patch = deriveScreenPatch({ ...latest, degraded: false });
  // 即使 browser=null（fetch 失败）也走这里
  ...
}
```

### 修复后

```js
// 情况1：browser 明确报告未运行（非 null）→ 稳定，无需等待
if (latest.browser !== null && !latest.browser.running) {
  const patch = deriveScreenPatch({ ...latest, degraded: false });
  updateScreenState(patch);
  return { ...screenState };
}

// 情况2：会话已就绪 → 稳定
if (latest.session?.sessionId) {
  const patch = deriveScreenPatch({ ...latest, degraded: false });
  updateScreenState(patch);
  return { ...screenState };
}

// 其他情况（browser=null 或 browser 运行中但 session 未就绪）→ 继续轮询
```

### 影响评估

- **影响范围**：浏览器 fetch 失败时的屏幕状态判断
- **风险等级**：中危（错误的状态快照被视为正常）

---

## M-6 · system-heal — 持久化 `mode` 字段无枚举校验 {#m-6}

**文件**：`services/openclaw-system-heal/src/server.mjs`  
**函数**：`loadPersistentState()`

### 根本原因

从持久化文件加载 `mode` 时仅检查是否为非空字符串，没有枚举白名单验证。若状态文件被意外修改，`mode` 可以被设置为任意字符串，绕过代码中各处对 `"simulated"` 和 `"audit_only"` 的预期逻辑。

### 修复前

```js
mode: typeof data.maintenancePolicy.mode === "string" && data.maintenancePolicy.mode.trim()
  ? data.maintenancePolicy.mode.trim()
  : maintenancePolicy.mode,
```

### 修复后

```js
const VALID_HEAL_MODES = ["simulated", "audit_only"];
mode: typeof data.maintenancePolicy.mode === "string"
  && VALID_HEAL_MODES.includes(data.maintenancePolicy.mode.trim())
  ? data.maintenancePolicy.mode.trim()
  : maintenancePolicy.mode,
```

### 影响评估

- **影响范围**：系统自愈模式的安全边界
- **触发条件**：状态文件被手动编辑或意外损坏
- **风险等级**：中危（安全边界绕过）

---

## L-1 · event-hub — `recentEvents` 清理性能低效 {#l-1}

**文件**：`services/openclaw-event-hub/src/server.mjs`  
**函数**：`publishEvent()`

### 根本原因

超限时用 `splice(0, length - max)` 从头删除多个元素，时间复杂度 O(N)。由于每次 `publishEvent` 只 push 一个元素，实际至多超出 1 个，使用 `shift()` 更合适。

### 修复前

```js
if (recentEvents.length > maxRecentEvents) {
  recentEvents.splice(0, recentEvents.length - maxRecentEvents);
}
```

### 修复后

```js
if (recentEvents.length > maxRecentEvents) {
  recentEvents.shift();  // 每次只 push 一个，故只需移除一个
}
```

### 影响评估

- **影响范围**：高频事件场景下的 GC 压力
- **风险等级**：低危（性能优化）

---

## L-2 · system-heal — 损坏的时间戳静默触发维护 {#l-2}

**文件**：`services/openclaw-system-heal/src/server.mjs`  
**函数**：`isMaintenanceDue()`

### 根本原因

若 `nextDueAt` 为无效字符串，`Date.parse()` 返回 `NaN`，原代码 `Number.isNaN(NaN) || dueAtMs <= now` 返回 `true`，静默触发维护运行。

### 修复前

```js
const dueAtMs = Date.parse(maintenancePolicy.nextDueAt);
return Number.isNaN(dueAtMs) || dueAtMs <= now.getTime();
// NaN 导致维护被意外触发
```

### 修复后

```js
const dueAtMs = Date.parse(maintenancePolicy.nextDueAt);
if (Number.isNaN(dueAtMs)) {
  console.warn(
    `[system-heal] Invalid nextDueAt "${maintenancePolicy.nextDueAt}", resetting schedule.`
  );
  maintenancePolicy.nextDueAt = calculateNextDueAt(now);
  return false;  // 重置后本次不触发
}
return dueAtMs <= now.getTime();
```

### 影响评估

- **影响范围**：维护任务调度
- **触发条件**：状态文件损坏或手动编辑产生非法日期字符串
- **风险等级**：低危（非预期维护触发）

---

## L-3 · session-manager — 路由响应体代码重复 {#l-3}

**文件**：`services/openclaw-session-manager/src/server.mjs`  
**路由**：`GET /session/state`、`GET /work-view/state`

### 根本原因

两个路由返回完全相同的响应结构，没有提取公共函数，未来若修改其中一个容易遗漏另一个，导致 API 不一致。

### 修复前

```js
// 两处完全相同的代码
if (...pathname === "/session/state") {
  sendJson(res, 200, {
    ok: true,
    session: serialiseSessionState(),
    workView: serialiseWorkViewState(),
  });
}

if (...pathname === "/work-view/state") {
  sendJson(res, 200, {
    ok: true,
    session: serialiseSessionState(),
    workView: serialiseWorkViewState(),
  });
}
```

### 修复后

```js
// 提取公共函数
function buildStateResponse() {
  return {
    ok: true,
    session: serialiseSessionState(),
    workView: serialiseWorkViewState(),
  };
}

// 两处路由均使用
sendJson(res, 200, buildStateResponse());
```

### 影响评估

- **影响范围**：代码可维护性
- **风险等级**：低危（维护性问题）



## N-1 · openclaw-core — task.status 无枚举校验 ✅ {#n-1}

**文件**：`services/openclaw-core/src/server.mjs`  
**路由**：`POST /tasks/{id}/phase`（约第 24960 行）

### 根本原因

`/tasks/{taskId}/phase` 路由直接将请求体的 `body.status` 字符串写入 `task.status`，无任何枚举白名单校验。攻击者或 bug 可将任务状态强制设置为任意字符串（如 `"approved"`、`"idle"`、`"admin"`），绕过任务状态机的正常转换逻辑，导致系统状态不一致。

### 问题代码

```js
// 第 24960-24962 行
if (typeof body.status === "string" && body.status.trim()) {
  task.status = body.status.trim();  // ← 无枚举校验，任意字符串均可写入
}
```

### 建议修复

```js
const VALID_TASK_STATUSES = new Set([
  "queued", "running", "paused", "completed", "failed", "superseded",
]);

if (typeof body.status === "string" && body.status.trim()) {
  const requestedStatus = body.status.trim();
  if (!VALID_TASK_STATUSES.has(requestedStatus)) {
    sendJson(res, 400, { ok: false, error: `Invalid task status: "${requestedStatus}"` });
    return;
  }
  task.status = requestedStatus;
}
```

### 影响评估

- **影响范围**：任务状态机的完整性，以及所有依赖 `task.status` 的下游逻辑
- **触发条件**：任何能访问 `/tasks/{id}/phase` 路由的调用方
- **风险等级**：中危（状态机绕过）

---

## 变更文件汇总

| 文件路径 | 修复项 | 变更类型 |
|---------|--------|---------|
| `services/openclaw-browser-runtime/src/server.mjs` | H-1, H-2 | 新增 import，新增互斥锁，修改 ID 生成 |
| `services/openclaw-event-hub/src/server.mjs` | H-3, M-2, L-1 | 新增 `fs.promises` import，函数异步化，逻辑修正 |
| `services/openclaw-session-manager/src/server.mjs` | M-1, L-3 | 事件类型修正，提取公共函数 |
| `services/openclaw-system-heal/src/server.mjs` | M-3, M-6, L-2 | 调用顺序修正，枚举校验，NaN 处理 |
| `services/openclaw-screen-act/src/server.mjs` | M-4 | 补全 try/catch |
| `services/openclaw-screen-sense/src/server.mjs` | M-5 | 稳定条件逻辑重写 |
| `services/openclaw-system-sense/src/server.mjs` | H-4（注释） | 补充代码注释，无逻辑变更 |
| `services/openclaw-core/src/server.mjs` | N-1 | 补充 task.status 枚举校验白名单 |

---

## 注意事项

> [!IMPORTANT]
> **H-3（event-hub 异步化）的向后兼容说明**：`publishEvent` 已变为 `async` 函数，所有内部调用点（如系统启动时的 hydration）已同步更新。若项目中其他未审查的位置也调用了 `publishEvent`，需确认调用处已加 `await`，否则可能产生未捕获的 Promise rejection。

> [!NOTE]
> **H-4 平台说明**：该问题原本识别为"Windows 路径分隔符绕过"，在 NixOS 环境下经确认不存在此风险（`path.sep='/'`，路径区分大小写）。已在相关代码处添加注释说明，无需修改逻辑。
