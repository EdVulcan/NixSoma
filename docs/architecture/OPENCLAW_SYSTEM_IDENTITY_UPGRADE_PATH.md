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

### 当前实现前沿

Level 4 已从第一个所有权边界推进到十个已部署并物理证明的切片：登录用户的
`systemd --user` 管理独立 Weston headless compositor 和固定
`nixsoma-ai-0` 1280x720 输出；现有 AI-owned Nix Firefox 作为 headed client
运行其中；session-manager 获取有界原生帧并只向状态面投影摘要；原生左键点击
绑定新鲜原生帧、现有 work-view lease、Core execution grant 和前置审计。
Weston 只接受 session-manager 的 mode-0600 Unix socket 连接，并用
`SO_PEERCRED`、PID 与 user-unit cgroup 认证调用者。第五个已部署切片让
Observer 在操作者已认证并明确选择 `AI Workspace` 时暂态显示该原生输出；Core
和浏览器分别校验帧契约，像素不进入服务状态、事件或浏览器存储。第六个切片
让 Weston 发布不含标题、app-id 和像素的最小 surface inventory，并让现有
Core execution grant、session-manager 与 Observer 只控制一个固定 Nix 管理的
Workbench user unit；它不接受任意命令，也不需要每次另建 approval。
第七个切片复用同一 owner 链，通过 session 专用 Weston 的 versioned kiosk-shell
API 激活当前 inventory 中一个数字 surface。Core grant 精确绑定
`surfaceId + inventorySequence`，session-manager 要求前置 audit、新鲜 pre-frame、
peer receipt、更新后的 activated inventory 和 post-frame；Observer 只提供数字
选择器。该切片已在 generation `7ycsdd61...` 部署，并由正常生产 Observer
完成真实双向切换。

第八个切片只扩展现有 pointer owner：在精确当前 frame、active numeric surface
和 inventory sequence 三者一致时，允许在固定输出中心执行一次 `up` 或 `down`
垂直滚轮事件。Core grant、前置 audit、session-manager 复验、Weston peer receipt
和 post-frame 形成同一条证据链，不接受调用方坐标、delta、次数、其他 axis 或
gesture。Generation `b6qjcbfc...` 已由真实生产 Observer 在 fixture surface 2
上完成上下滚动，并在清理后保持九个生产健康端点。Browser Runtime 同时成为隔离
compositor 的 `PartOf`，避免 compositor 重启后保留旧 socket 上的 headed browser。
该切片已部署；相关服务零重启、无 failed unit 和 warning journal。

第九个切片在源码和精确 Nix store closure 中加入一次显式 AI workspace
decision。操作者只提交固定确认，Core 自己读取当前 helper/browser authority、
新鲜 compositor frame、surface inventory 和唯一 active numeric surface，并让
DeepSeek 只在 `no_op`、`scroll_up`、`scroll_down` 中选择。Provider 不接收像素、
OCR、frame hash、PID、标题、app-id、URL、路径、凭据或 caller prompt。响应回到
本地后再次捕获并复验 inventory/surface；若选择滚动，只复用现有 `mouse.scroll`
grant/audit/peer-receipt/post-frame 链一次，不自动重复。该切片已通过工作区
测试、typecheck 和 store-native body check，并在 generation `6k51pmrglb...`
完成真实 DeepSeek gate：模型选择 `scroll_down`，surface 17 只执行一次且 pre/post
frame、active surface、Weston receipt 和三段 durable audit 全部匹配；cleanup 后
九个健康端点保持正常。它仍不能被描述为视觉理解或持续自治。

第十个切片在源码和精确 Core/Screen Sense store closure 中补上 bounded
semantic scene grounding。Screen Sense 通过现有 Browser Runtime service
credential 请求 metadata-only capture，只投影最多 12 个可见项目的 `role`、
有界 `name`、`disabled` 和整数 `bounds`。Core 在本地要求 Browser PID 与唯一
active Weston surface PID 一致，再删除 PID、semantic/compositor frame hash、
URL、input value、selector、target id、page script 和 pixels 后将场景交给
DeepSeek。Provider 返回后重新捕获；surface id/PID、inventory sequence、scene
content hash 或 semantic frame hash 改变都会在 actuator 前 fail closed。
`no_op` 不联系 screen-act，滚动仍最多一次。Durable evidence 只保存 scene hash
和 item count。初始 generation `7j28vnll8...` 的物理 gate 在 provider 前发现
Browser metadata 默认只返回 semantic summary、没有 items；Screen Sense 因此正确
fail closed。修正后只有显式 `semantic=items` 才在无像素 metadata capture 中返回
有界 items，默认行为不变。第十切片已通过 1005 项工作区测试、typecheck、811 项
registry/script audit、Windows path budget 和 store-native body check。修正版
system candidate
`/nix/store/jricbfdsixwn4h6jl12hiip7cmfvsnl3-nixos-system-nixos-26.05.4808.569d57850992`
已绑定 Browser Runtime `ha9syr...` 与 Screen Sense `amkk77...` closure 并完成
switch。真实 gate 将一个 semantic item 与 active Browser/Weston surface 绑定，
DeepSeek 返回 `no_op`，没有 actuator 调用；scene hash、egress/completion durable
audit、九个健康端点全部匹配，相关服务零重启且无 warning journal。

第十一个切片已经部署到 generation `lb3mif3b...`。DeepSeek 的固定响应契约新增
`click_item` 和一个 1-based `itemOrdinal`；Core 在 provider 返回后继续复验唯一
active surface、Browser PID、semantic frame 与 scene content，并在序号越界或目标
disabled 时于 actuator 前停止。Screen Act 只接收 scene hash、ordinal 与本地
Browser/frame binding，使用既有 Browser Runtime credential 重新 capture，在本进程
内把 ordinal 映射成既有 frame-bound semantic target，最多点击一次，再以相同
Browser PID 和推进后的 fresh frame 做动作后验证。Target id、selector、URL、input
value、pixel、caller prompt 与 provider reason 不进入 Core/provider/durable summary；
键盘、文本输入、任意坐标、循环动作、任意 page script、进程/窗口 API、root 与 host
mutation 仍不包含。1016 项 workspace tests、完整 typecheck、811 项 registry/script
audit、Windows path budget 和精确 body closure 已通过；physical candidate
`/nix/store/lb3mif3bad9ss4g3r9y6rig7nwflkabr-nixos-system-nixos-26.05.4808.569d57850992`
已完成 switch。物理 gate 在 Browser Runtime 重启后使用幂等 `prepare` 恢复浏览器，
绑定一个启用的 `Learn more` 项目，并完成真实 contract-v1 DeepSeek 调用；模型返回
`no_op`，因此没有 actuator 执行，scene/request hash 与 durable audit 全部匹配。点击
分支仍是源码与 closure 证明，尚未被 provider 在物理机选择。下一切片应绑定有界的
服务器已有任务目标，使模型能在不接受 caller prompt 的前提下判断点击是否有意义。

第十二个切片目前是源码与 system candidate，尚未 switch 或真实 provider 验收。
`act.ai.workspace.single_step` 现在要求标准 `taskId`，只在本地解析 queued/running、
policy 为 allow/audit-only、且由操作者显式绑定当前 trusted work view 的已有任务。
目标投影最多 180 字符；包含 URL、路径、网络地址、凭据、prompt role/override、
可执行命令形态、结构化 payload 或换行的任务目标会在 provider 前直接拒绝。Provider
只接收短目标语句，不接收 task id、状态、policy、时间戳、session/work-view id 或原始
任务对象。Durable evidence 只记录 task id/status、objective hash、task-version hash 与
动作事实。

Core 在 provider 返回后重新解析任务，并在 required action audit 返回后、actuator
调用前再次同步重验；goal、status、policy、version 或 trusted binding 变化都会停止，
execution grant 也携带同一 task id。`no_op` 仍不接触 actuator，scroll/click 最多一次且
不重放。Workspace tests、typecheck、811-entry registry、997-script audit、Windows path
budget、232-file Core closure 与 system candidate
`/nix/store/xv20sdiys622przz94226sacpq9yvgd8-nixos-system-nixos-26.05.4808.569d57850992`
均通过。当天 standing provider 3/3 预算已耗尽，因此该候选没有额外真实 DeepSeek
调用，不能描述为 deployed 或 physically proven。完整 1023 项 workspace tests 已通过。

compositor、browser、native frame 和 native input 已在物理机部署。真实点击
已证明同一 active lease、fresh frame、Weston receipt 与推进后的原生帧。
画面投影、应用生命周期、surface 激活、垂直滚动、AI 单步和 semantic scene
grounding 已通过源码、1005 项工作区测试、body-config/store
closure、完整 system generation 与物理 Observer 验收。真实 Firefox 渲染了
1280x720 原生画面，切换模式和退出登录都会释放像素；真实 Workbench 启动后
PID 与 surface 匹配，停止后 surface 消失；服务状态和 audit 只保留摘要。桌面
接管、键盘/热键、通用滚轮/手势/任意输入设备、任意进程/窗口 API、GNOME 输入、root 与
host mutation 仍未包含。这证明 AI 已拥有独立图形空间的最小原生眼手投影与
固定应用生命周期闭环，但尚未成为可接管的完整 AI 图形工作环境。

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

- 保持已完成的用户态控制面、bounded AI 工作视图和固定 Level 3 owner 稳定
- 沿独立 `nixsoma-ai-0` 推进有产品价值的 Level 4 垂直能力
- 复用现有 frame、input、projection、surface 和 application lifecycle owner
- 分开记录源码完成、验证通过、system generation 部署和真实物理动作
- 在独立 mutation 环境出现前保持真实 repair/rollback 禁用

而这些能力，已经比“强行抓整个用户桌面”更接近 OpenClaw 的长期产品形态。

---

## 六、当前证据化进度基线（2026-07-28）

进度不能再按历史 Phase 数量计算。以下比例是根据当前运行时代码、NixOS
模块、任务闭环、Observer、测试证据和仍缺失的架构组件估算的能力成熟度，
不是测试覆盖率：

| 身份层级 | 当前成熟度 | 证据与主要缺口 |
| --- | --- | --- |
| Level 1 用户态控制平面 | 约 90% | 本地服务、任务/审批/审计、工程读写验证恢复、记忆与 provider 治理面已形成；仍需少量整合与产品化。 |
| Level 2 受信会话组件 | 约 95-100%（当前 bounded browser 边界） | trusted-session、takeover/rebind、user-session sidecar、fail-closed recovery、`systemd --user` ownership、workspace continuity、真实 NixOS Firefox、bounded 像素帧、frame-grounded action、语义目标清单、stale rejection、自主 semantic click/type、write-only input、审计与 Observer 证据已形成闭环。更广的原生图形工作空间属于 Level 4，不应继续作为 Level 2 横向变体。 |
| Level 3 系统级特权组件 | 约 60% | 独立 `openclaw-hostd`、精确 Polkit、`SO_PEERCRED`、三个固定 OpenClaw unit restart、原生只读 systemd D-Bus、bounded journal diagnosis、target-specific post-repair health receipt、只读 eBPF process evidence、已部署的 automatic incident scheduler，以及固定 body unit 的内存/CPU/task/OOM 观测、有界趋势和声明式 system/user cgroup envelope 已部署并通过无压力探测。真实 repair/rollback、开发终端资源隔离和更广系统能力仍未建立。 |
| Level 4 图形栈内生组件 | 约 56%（十个切片已部署并物理证明） | 已有 user-owned、资源受限的 nested compositor 和固定 Wayland socket；AI-owned Nix Firefox、原生 frame/click/projection、最小 surface identity、固定 Workbench 生命周期和当前数字 surface 激活均已部署。Generation `6k51pmrglb...` 完成固定动作集且最多执行一次的 AI workspace decision；`jricbfds...` 又完成 metadata-only semantic scene、Browser/Weston surface 绑定和真实 DeepSeek `no_op`。像素/OCR、多步循环、任意进程/窗口控制和桌面接管仍未完成。 |

按四级身份路线与内核长期白皮书综合衡量，整个最终项目当前约完成
**49-57%**。内核白皮书中的 Phase A 已完成全部 9 个服务 closure 与 trusted
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
变更。该策略现已随 `czq8arvh...` generation 部署，并完成一次 459-token
真实调用，返回 `observe_current_screen`；task/approval 数量未变化，required
audit 与持久哈希一致，状态不含 prompt、建议理由或 credential value。冻结
provider lane，下一步转向另一条白皮书能力主线。

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
