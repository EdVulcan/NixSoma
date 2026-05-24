# OpenClaw 项目文档库索引

欢迎阅读 OpenClaw 项目文档库。为了方便开发团队和系统架构师能高效地查阅，我们对 `docs/` 目录下的所有技术文档、方案蓝图和开发指南进行了系统性分类整理。

> [!IMPORTANT]
> **团队开发交接必读**：📄 [**HANDOVER_SUMMARY.md**](./HANDOVER_SUMMARY.md)  
> 本文档汇总了本次重构工作在基础网络、巨石拆分、循环依赖打破、代理集成、动作审计、动态发现和全链路追踪等方面的具体成果，并为接手开发的成员提供了运行验证指导和编码契约规范。

---

## 📂 文档分类索引

### 🏛️ 1. 系统架构与协议设计 (`docs/architecture/`)
本目录包含关于系统拓扑设计、服务解耦报告、API 合约以及安全治理策略的深度架构文档。

| 文档名称 | 核心内容概述 |
| :--- | :--- |
| 📄 [**DECOUPLING_REPORT.md**](./architecture/DECOUPLING_REPORT.md) | **微服务解耦与重构总结报告**：记录了对 `openclaw-core` 超 25k 行单体代码进行彻底服务拆分、消除循环依赖与旁路直连的实施细节，以及团队协作与微服务扩容开发规范。 |
| 📄 [**coupling_analysis.md**](./architecture/coupling_analysis.md) | **服务耦合性深度审查报告 (V3)**：全方位审计重构后项目的耦合状态，包含前后期指标对比、动态服务发现原理以及内部跨服务 Trace 调用链流转规范。 |
| 📄 [**ARCHITECTURE.md**](./architecture/ARCHITECTURE.md) | **系统架构纲要**：OpenClaw 系统的基础模块架构与多级调度逻辑大纲。 |
| 📄 [**AI_WORK_VIEW_CAPTURE_STRATEGY.md**](./architecture/AI_WORK_VIEW_CAPTURE_STRATEGY.md) | **AI 工作视图捕获策略**：设计并规定了 AI 在图形界面级进行工作区观测的视图获取逻辑与网络通信优化。 |
| 📄 [**DESKTOP_CAPTURE_CONTRACT_V1.md**](./architecture/DESKTOP_CAPTURE_CONTRACT_V1.md) | **桌面捕获协议契约 V1**：屏幕感知模块（`screen-sense`）的接口协议、事件流数据结构与图像抓取交互协议规范。 |
| 📄 [**OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md**](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md) | **系统身份升级演进路线**：系统凭证体系升级以及各分布式微服务实体鉴权架构的平滑过渡策略。 |

---

### 📋 2. 阶段性研发与集成计划 (`docs/plans/`)
本目录完整记录了 OpenClaw 从 MVP 研发阶段逐步演化到高级源集成阶段的路线图与执行方案（Phase 2 至 Phase 11）。

| 计划范围 | 关联文档列表 |
| :--- | :--- |
| **基础建设与核心计划** | <ul><li>📄 [Phase 2 核心修复与演示计划](./plans/OPENCLAW_PHASE_2_PLAN.md)</li><li>📄 [Phase 3 系统自愈与状态机对齐计划](./plans/OPENCLAW_PHASE_3_PLAN.md)</li><li>📄 [Phase 4 API 审计与动态治理计划](./plans/OPENCLAW_PHASE_4_PLAN.md)</li><li>📄 [Phase 5 外部资源隔离与沙箱演进计划](./plans/OPENCLAW_PHASE_5_PLAN.md)</li></ul> |
| **高级扩展与功能演进** | <ul><li>📄 [Phase 6 多会话隔离与运行时管理](./plans/OPENCLAW_PHASE_6_PLAN.md)</li><li>📄 [Phase 7 动态能力注册与热插拔插件机制](./plans/OPENCLAW_PHASE_7_PLAN.md)</li><li>📄 [Phase 8 分布式日志汇聚与可观测性体系](./plans/OPENCLAW_PHASE_8_PLAN.md)</li><li>📄 [Phase 9 大模型交互契约与 prompt 强化](./plans/OPENCLAW_PHASE_9_PLAN.md)</li></ul> |
| **高阶融合与交付准备** | <ul><li>📄 [Phase 10 工作区精细化 Diff 与版本回滚机制](./plans/OPENCLAW_PHASE_10_PLAN.md)</li><li>📄 [Phase 11 全系统灾备与故障自动注入验证](./plans/OPENCLAW_PHASE_11_PLAN.md)</li><li>📄 [Post-MVP 后期演进宏观蓝图](./plans/OPENCLAW_POST_MVP_PLAN.md)</li><li>📄 [深层引擎源集成阶段落地总方案](./plans/OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md)</li></ul> |

---

### 📘 3. 操作指南与运行诊断 (`docs/guides/`)
本目录包含 MVP 演示的诊断说明、部署检查清单、以及历史修复日志。

| 文档名称 | 核心内容概述 |
| :--- | :--- |
| 📄 [**OPENCLAW_MVP_DEMO_GUIDE.md**](./guides/OPENCLAW_MVP_DEMO_GUIDE.md) | **MVP 演示流程操作手册**：向开发和演示人员详细说明如何启动全套微服务，进行端到端的会话控制和沙箱命令流演示。 |
| 📄 [**OPENCLAW_MVP_STATUS.md**](./guides/OPENCLAW_MVP_STATUS.md) | **MVP 核心功能对齐状态**：列举了微服务各模块针对最小可行性产品（MVP）的指标达成与阻碍项解决进度。 |
| 📄 [**OPENCLAW_MVP_FINAL_READINESS.md**](./guides/OPENCLAW_MVP_FINAL_READINESS.md) | **最终交付就绪清单**：系统上线或移交前需要满足的最后一公里静态检查和预飞测试检查项。 |
| 📄 [**fix_log.md**](./guides/fix_log.md) | **系统历史诊断与修复日志**：详尽记录了针对分布式状态机冲突、文件锁死锁以及多网络端口抢占的定位与修复流水。 |

---

## 🛠️ 后续维护规范

- **新建文档规范**：后续新增的技术文档、开发计划，严禁直接塞入 `docs/` 根目录。必须根据其类型放入对应的 `architecture/`、`plans/` 或 `guides/` 文件夹中。
- **更新索引规范**：新增文档后，请开发人员同步在此 `docs/README.md` 中注册该文档的相对链接与内容大纲，以确保索引目录的时效性。
