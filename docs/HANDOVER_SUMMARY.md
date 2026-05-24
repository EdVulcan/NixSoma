# OpenClaw 架构解耦与重构——团队接力交接手册

为了让后续接手开发工作的团队成员能够无缝过渡，本文件详细汇总了本次开发会话中完成的**架构解耦与重构工作**、**产生的对应技术文档**以及**后续的验证与开发建议**。

---

## 1. 本次会话完成的工作汇总

在本次会话中，我们对整个 OpenClaw 仓进行了全方位的模块解耦与可观测性重构，消除了历史技术债务，主要包含以下六大阶段（Phases）：

### 🛠️ Phase 1: 基础网络与磁盘持久化抽象提取
- **成果**：新建了公共包 `packages/shared-utils/src/http.mjs` 和 `persist.mjs`。
- **改动**：提取并封装了全服务通用的底层 HTTP 方法（`corsHeaders`, `sendJson`, `readJsonBody` 等）、自动服务注册函数（`registerService`）以及带抖动限制的文件持久化落盘方法。
- **影响**：删除了散落在 `openclaw-core`、`screen-act` 等 8 个微服务中手工复制的 **441** 行冗余网络代码，全部变更为 `@openclaw/shared-utils` 的统一导入。

### 🏛️ Phase 2: `openclaw-core` 2.5万行巨石单体彻底拆分
- **成果**：彻底瓦解了原先 25,233 行的巨大单体 `services/openclaw-core/src/server.mjs`。
- **改动**：主入口精简为仅 **132** 行的轻量装配层，通过**依赖注入（DI）**模式将业务剥离为 10 个功能内聚的独立 ESM 模块：
  1. `runtime-state.mjs` (全局状态 Map & 硬盘防抖落盘)
  2. `service-client.mjs` (网络请求客户端 & 动态服务地址构建)
  3. `policy-evaluator.mjs` (安全网关策略过滤与审计)
  4. `approval-engine.mjs` (人工审批与卡点流转逻辑)
  5. `task-manager.mjs` (任务 CRUD、状态变更及生命周期)
  6. `plugin-review.mjs` (Plugin SDK 签名校验与 Tool Catalog 管理)
  7. `workspace-ops.mjs` (工作区文件读写、Diff 补丁与命令安全执行)
  8. `plan-builder.mjs` (执行计划多阶段证据对比与比对引擎)
  9. `task-executor.mjs` (任务步骤驱动循环与自愈恢复机制)
  10. `route-handlers.mjs` (API 注册表，承载 186 个路由闭包注入)

### 🔄 Phase 3: 打破循环依赖 (Circular Dependency)
- **成果**：消除了 `browser-runtime` 与 `session-manager` 之间的循环调用链。
- **改动**：删除了 `browser-runtime` 主动发起网络调用读取或拉起会话的逆向控制流。使 `browser-runtime` 成为高内聚、无依赖的纯被动执行器，调用链完全变更为单向。

### 🛡️ Phase 4: 网关代理集成 (消灭前端旁路直连)
- **成果**：保护了底层微服务的通信安全性。
- **改动**：
  - 在 `openclaw-core` 路由中实现了基于 `/proxy/{service-name}/*` 的网关反向代理处理器。
  - 重写了 `observer-ui` 客户端的网络配置，屏蔽了底层微服务物理端口，前端流量 100% 收束于主网关（4100 端口）接受安全策略决策。

### 📝 Phase 5: 屏幕控制操作审计日志化
- **成果**：规范了 AI 控制动作的追踪链。
- **改动**：在 `openclaw-screen-act` 执行具体动作的前后，分别注入了 `screen_act.action_started` 与 `action_completed` 审计事件发布至 Event Hub。

### 📡 Phase 6: 分布式动态服务发现与全链路追踪
- **成果**：实现了微服务的“即插即用”与调用链可追溯。
- **改动**：
  - 在 `event-hub` 新增了服务动态注册表端点，各服务在启动 `listen` 后自动向注册表提交在线状态。
  - `system-sense` 轮询注册表实现微服务物理地址的自动刷新，消除了硬编码的 IP 和端口字典。
  - 网络层集成高阶 `withTracing` 代理，微服务通信自动在 Header 中流转并传播 `x-request-id` 和 `x-source-service` 请求追踪上下文。

---

## 2. 对应的技术与交接文档

在本次会话中，我们在 `docs/` 下生成了清晰的说明文档，以便接力开发：

1. **解耦工作技术报告**：
   - 📄 [**docs/architecture/DECOUPLING_REPORT.md**](./architecture/DECOUPLING_REPORT.md)
   - **用途**：详述了 Phase 1 至 Phase 6 的底层修改逻辑，提供了详尽的**三条后续开发编码规范**（如何添加新接口、如何添加新微服务、如何透传 Tracing 头部信息）。
2. **耦合性深度审计报告 (V3)**：
   - 📄 [**docs/architecture/coupling_analysis.md**](./architecture/coupling_analysis.md)
   - **用途**：对比重构前后系统各项关键指标（代码行数分布、扇出数、旁路通道等），从设计原则上评估重构后的系统架构健康状况（综合评分由 33.3% 提升至 100%）。
3. **全局文档库检索索引**：
   - 📄 [**docs/README.md**](./README.md)
   - **用途**：对 `docs/` 下的历史方案、阶段计划（Phase 2-11）以及部署指南做了树状整理与大纲表述，充当项目的技术文档首页。

---

## 3. 下一步验证与接力开发建议

为了保证重构后的系统在后续的新特性开发和集成验证中稳定运行，建议团队接力时关注以下步骤：

### 第一步：本地部署与兼容性运行测试
由于我们彻底消除并代理了 UI 的旁路直连，并增加了微服务自注册。请执行以下步骤以验证功能完整性：
1. **启动基础设施**：首先启动核心配置与 `openclaw-event-hub`。
2. **依次启动各微服务**：启动 `openclaw-core`、`browser-runtime`、`session-manager` 等服务，观察控制台是否成功打印出向 Event-Hub 自注册的日志（`Successfully registered openclaw-* to event-hub`）。
3. **启动 UI 测试**：启动 `observer-ui`，在浏览器中通过主网关（4100 端口）进行流程控制，验证各微服务的请求是否能够通过核心网关代理正确分发，UI 是否显示正常。

### 第二步：利用 Trace 上下文升级日志诊断
重构后全系统所有的 HTTP 内部通信已全部透传了 `x-request-id` 追踪头。接力开发团队可以：
- 将全服务日志收集系统（如 ELK 或简单的文件汇聚器）对接到 `event-hub`。
- 在日志流中通过匹配相同的 `x-request-id`，来追踪一条任务从 core 拆解到 `workspace-ops`，最终经由 `screen-act` 下发到 `browser-runtime` 的全链路流程，以此快速定位跨服务的逻辑延时与链路异常。

### 第三步：防止代码腐化的编码契约
请团队后续修改代码时务必牢记：
- **禁止在入口 `server.mjs` 中添加路由具体逻辑**（路由归 `route-handlers.mjs`，核心逻辑归各领域类）。
- **微服务间调用禁止使用本地硬编码端口**（使用服务自注册或经过 `core` 统一的代理进行间接交互）。

本交接文档为本次对话所有工作的终期总结。祝团队后续开发顺利！
