# OpenClaw 系统身份升级路线图

本文档定义 OpenClaw 在 Linux / NixOS 上，如何从“用户态工具”逐步升级为“系统级主体”。

目标不是让 OpenClaw 立刻变成新的操作系统内核，而是让它逐步获得与产品定位相匹配的系统身份。

---

## 一、问题定义

当前 OpenClaw 在 Linux 桌面上遇到的很多限制，本质上不是单点实现问题，而是**系统身份问题**。

例如：

- 全局截图受限
- 全局窗口枚举受限
- 全局输入注入受限
- 跨应用观察与控制受限
- 系统级修复动作不能直接安全执行

这些限制不是偶然的，而是现代 Linux 桌面，尤其是 GNOME + Wayland，默认把普通应用视为低信任对象。

因此，如果 OpenClaw 继续长期停留在“普通桌面应用”身份，它的能力上限会持续被桌面安全模型卡住。

所以真正要解决的问题不是：

- 怎么把某一个截图命令调通

而是：

- OpenClaw 如何逐步获得高于普通应用的系统地位

---

## 二、总体原则

升级路线遵循以下原则：

1. 不一步拿满权限  
避免把整个 OpenClaw 直接做成 root 常驻进程。

2. 先掌控 AI 自己的工作视图  
优先让 OpenClaw 完整拥有自己的工作空间，而不是一开始就强行掌控用户全部桌面。

3. 高权限能力与主控制面分层  
把高权限动作放进受控的系统级执行层，而不是混进普通用户态控制平面。

4. 逐步提升系统身份  
从用户态工具 -> 会话级受信组件 -> 系统级特权组件 -> 图形栈内生组件。

---

## 三、四级升级模型

## 第 1 级：用户态控制平面

这是 OpenClaw 的基础层，当前已经接近收口。

### 形态

- 普通用户进程
- Web UI / Observer UI
- browser runtime
- screen-sense / screen-act
- command / file capture provider
- systemd user service

### 能力

- 管理 AI 自己的工作流
- 执行代码与浏览器任务
- 做任务编排和状态汇总
- 通过受限接口与系统交互

### 限制

- 很难稳定抓取整个 GNOME / Wayland 桌面
- 很难稳定枚举全局窗口
- 很难获得系统级治理权
- 输入和图形自动化会被限制

### 阶段目标

这一阶段的目标不是全能，而是：

- 建立稳定控制平面
- 建立稳定工作视图
- 建立稳定状态流
- 建立稳定外部 provider 接口

一句话：

**先让 OpenClaw 成为一个稳定的用户态中枢。**

---

## 第 2 级：受信会话组件

这是当前 bounded browser/work-view 范围内已经闭环的身份层。

### 形态

- 仍位于用户会话中
- 但不再只是普通前台应用
- 增加会话级 helper / trusted sidecar
- 与桌面 session 更紧密绑定

### 典型组件

- AI 专属工作视图管理器
- 会话级截图 sidecar
- 会话级输入执行器
- 会话级浏览器工作空间

### 能力

- 稳定管理 AI 自己的桌面空间
- 稳定观测 AI 自己的图形空间
- 稳定采集 AI 工作画面
- 稳定执行 AI 自己的图形动作

### 核心价值

这一阶段最重要的不是“攻破整个用户桌面”，而是：

**让 OpenClaw 完整掌控自己的工作画面。**

这和产品哲学高度一致：

- AI 不必默认控制用户全部桌面
- AI 应首先拥有自己的工作空间
- 用户可以随时观察、接管或切换过去

一句话：

**先让 OpenClaw 在同一具身体中拥有自己的图形领地。**

---

## 第 3 级：系统级特权组件

这是 OpenClaw 从“高级工具”变成“系统主体”的分水岭。

### 形态

- systemd system service
- privileged helper
- 受控 polkit / capability / sudo 边界
- 用户态控制平面 + 系统级执行层的双层结构

### 推荐结构

- `openclaw-core`
  - 继续留在普通用户态
  - 负责 UI、任务编排、状态管理、工作视图

- `openclaw-hostd`
  - 系统级 daemon
  - 负责主机治理、高权限动作、自愈、恢复

### 适合下放到系统级的能力

- systemd 服务管理
- journal / 主机状态采集
- 资源限制与 cgroup 控制
- sysctl / 网络规则 / 主机参数调整
- 快照、回滚、隔离、熔断
- 更强的系统健康修复动作

### 关键设计原则

不要让整个 OpenClaw 直接以 root 常驻。  
应该是：

- 用户态控制平面提出意图
- 系统级 daemon 执行受控动作
- 所有高权限动作可审计、可回滚、可限流

一句话：

**让 OpenClaw 拥有系统治理权，但通过受控特权层实现，而不是粗暴 root 化。**

---

## 第 4 级：图形栈内生组件

这是最接近“AI-Native 系统主体”的阶段。

### 形态

- 专属 AI session
- 嵌套 compositor
- AI 独立桌面
- 登录即运行的 AI 工作环境
- 用户前台与 AI 前台并存

### 能力

- OpenClaw 不再被迫偷看整个用户桌面
- OpenClaw 可以原生拥有自己的窗口树、画面流、输入流
- 截图、录制、输入控制都来自自己管理的图形层
- 用户看到的是 AI 工作视图的投影或切换视图

### 为什么这一阶段非常关键

因为到这时，很多今天看起来像“权限问题”的东西，会转化为“自己系统内部的能力”：

- 截图不再是抓别人桌面，而是读自己的图形空间
- 窗口树不再是偷窥别人的窗口，而是枚举自己的窗口
- 输入控制不再是抢别人焦点，而是操作自己的工作环境

一句话：

**让 OpenClaw 不再只是运行在桌面里，而是成为桌面图形秩序的一部分。**

---

## 四、实际实施顺序

按照投入产出比，推荐顺序如下：

### 第一步：稳住用户态主线

继续强化：

- browser/runtime capture
- screen-sense / screen-act
- command / file capture provider
- observer UI
- AI 工作视图

目标：

- 先把 AI 自己那块工作画面完全做稳
- 让 session-manager、browser-runtime、screen-sense、core 与 Observer 共享
  `level_2_trusted_session_work_view` 契约，明确这只是 AI-owned work view，
  不需要 root、全桌面 capture 或 host mutation

### 第二步：加入受信会话 helper

开始建设：

- session helper
- work-view manager
- 会话级 capture / action sidecar

目标：

- 让 AI 的图形工作空间更稳定、更像真实“第二前台”

### 第三步：拆出系统级 daemon

第一条受控边界已经完成：

- `openclaw-hostd`
- 固定 Unix socket 协议
- 仅允许 `openclaw-system-sense.service` 的原生 D-Bus restart
- 受现有 approval、Polkit、audit、恢复和 Observer 路径治理

后续目标：

- 在不扩大任意 systemd API 的前提下，逐个增加有明确产品价值的受控主机能力

### 第四步：推进图形层内生化

开始探索：

- 专属 AI session
- nested compositor
- AI 独立工作桌面
- 可投影、可接管的 AI 图形环境

目标：

- 让 OpenClaw 拥有与其产品哲学相匹配的图形身份

---

## 五、对当前项目的直接影响

基于这条路线，当前阶段不应把“攻克整个 GNOME 桌面抓屏”设为主线目标。

当前主线应该是：

- 保持已完成的用户态控制面和 bounded AI 工作视图稳定
- 通过既有 hostd owner 建立 diagnosis、fixed repair、post-repair verification 闭环
- 分开记录源码完成、验证通过、system generation 部署和真实特权动作
- 在独立 mutation 环境出现前保持 generation activation/rollback 禁用

而这些能力，已经比“强行抓整个用户桌面”更接近 OpenClaw 的长期产品形态。

---

## 六、当前证据化进度基线（2026-07-19）

进度不能再按历史 Phase 数量计算。以下比例是根据当前运行时代码、NixOS
模块、任务闭环、Observer、测试证据和仍缺失的架构组件估算的能力成熟度，
不是测试覆盖率：

| 身份层级 | 当前成熟度 | 证据与主要缺口 |
| --- | --- | --- |
| Level 1 用户态控制平面 | 约 90% | 本地服务、任务/审批/审计、工程读写验证恢复、记忆与 provider 治理面已形成；仍需少量整合与产品化。 |
| Level 2 受信会话组件 | 约 95-100%（当前 bounded browser 边界） | trusted-session、takeover/rebind、user-session sidecar、fail-closed recovery、`systemd --user` ownership、workspace continuity、真实 NixOS Firefox、bounded 像素帧、frame-grounded action、语义目标清单、stale rejection、自主 semantic click/type、write-only input、审计与 Observer 证据已形成闭环。更广的原生图形工作空间属于 Level 4，不应继续作为 Level 2 横向变体。 |
| Level 3 系统级特权组件 | 约 60% | 独立 `openclaw-hostd`、精确 Polkit、`SO_PEERCRED`、三个固定 OpenClaw unit restart、原生只读 systemd D-Bus、bounded journal diagnosis、target-specific post-repair health receipt、只读 eBPF process evidence、已部署的 automatic incident scheduler，以及固定 body unit 的内存/CPU/task/OOM 观测、有界趋势和声明式 system/user cgroup envelope 已部署并通过无压力探测。真实 repair/rollback、开发终端资源隔离和更广系统能力仍未建立。 |
| Level 4 图形栈内生组件 | 约 0-5% | 只有 AI-owned work-view 方向与接口预留；专属 session、nested compositor、原生图形输入输出尚未实现。 |

按四级身份路线与内核长期白皮书综合衡量，整个最终项目当前约完成
**45-55%**。内核白皮书中的 Phase A 已完成全部 9 个服务 closure 与 trusted
sidecar store 运行路径；Phase B 已完成原生只读 D-Bus inventory、三个由精确
Polkit 和独立 hostd 所有的固定 native restart，以及 bounded journal
diagnosis；Phase C 已完成首个只读 `sched_process_exec` eBPF 探针切片；Phase D
已完成候选生成、审批绑定、staging/build、真实 closure receipt、独立
host-health oracle、受控 activation contract、人工 rollback evidence 和物理机
安全失败演练。真实 generation activation 与 rollback 仍未在可抛弃 mutation
环境中证明。因此旧阶段路线的“接近 90%”只能描述早期里程碑清单，不能代表
最终白皮书完成度。

当前 bounded Level 2 browser 眼手闭环与内核白皮书 Phase A 已收口。
Phase B 的固定 D-Bus 控制切片、bounded journal diagnosis、incident loop、
显式批准的 DeepSeek diagnosis handoff、目标相关经验召回、自动本地分诊和
审批后一次性 repair dispatch 均已形成。当前物理机已部署到 approved-dispatch
baseline；资源观测、趋势告警和 system/user cgroup envelope 已随
`9bbc00da...` generation 部署并通过无压力探测。当前 `6dm12j7...`
generation 已通过 systemd `LoadCredential` 接入 root-only DeepSeek key，并完成
一次 request-hash/approval 绑定、只返回建议且不自动执行的真实调用；prompt、
建议理由和 credential value 均未进入持久状态。不要把 hostd 扩展成任意
systemd API，也不要重做已经完成的 provider transport。低风险 standing
advisory policy 已在源码完成：它只接受认证操作者的固定确认请求，由 Core
生成三个固定 unit 的布尔/枚举健康上下文，强制 required audit、single-flight、
15 分钟 cooldown、每日 3 次/4096 token 保守预算和本地 fallback。provider
建议仍需人工审阅，且不能自动创建 task/approval，不能执行命令、修复或主机
变更。下一步只做物理机启用和一次非变更型真实调用证明，然后转向另一条
白皮书能力主线。

---

## 七、结论

OpenClaw 从用户态工具升级到系统级主体，正确路径不是：

- 一步拿到所有权限
- 或者把所有东西直接 root 常驻

而是：

1. 先成为稳定的用户态控制平面
2. 再掌控 AI 自己的会话和工作视图
3. 再引入受控系统级特权组件
4. 最后把 AI 嵌入图形栈和系统运行秩序本身

压缩成一句话：

**先掌控 AI 自己的工作世界，再逐步获得整台机器的系统治理权。**
