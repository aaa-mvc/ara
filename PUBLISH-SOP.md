# Obsidian 插件发布 SOP

> 从零到上线社区市场的完整流程。踩过的坑，下次不用再踩。

---

## 一、前置条件

| 项 | 要求 |
|---|---|
| GitHub 账号 | 已注册 |
| 插件代码 | `main.js` + `manifest.json` + `styles.css`（至少前两个） |
| 开源协议 | `LICENSE`（通常 MIT） |
| 说明文档 | `README.md` |

---

## 二、文件清单

```
my-plugin/
├── main.js          ← 插件逻辑（CommonJS：require('obsidian') / module.exports）
├── manifest.json    ← 元信息（id / name / version / author / description）
├── styles.css       ← 样式（可选，但建议有）
├── README.md        ← 用户看到的说明
├── LICENSE          ← MIT
├── .gitignore       ← node_modules/ dist/
├── package.json     ← npm 包信息（含构建脚本）
├── esbuild.config.mjs ← esbuild 打包配置
├── tsconfig.json    ← TypeScript 配置
└── src/
    └── main.ts      ← TypeScript 源码（可选，但 Obsidian 会审查）
```

**关键检查点：**
- `manifest.json` 中的 `version` 必须和 GitHub Release tag 一致
- `manifest.json` 中的 `id` 不能包含 `obsidian`，必须全局唯一
- 插件名不要全大写（会触发警告）

---

## 三、代码审查注意（Obsidian 审核规则）

### 必过项（Error，不修会拒）

| 规则 | 说明 | 如何避免 |
|------|------|---------|
| `obsidianmd/no-static-styles-assignment` | 禁止 JavaScript 里直接写 `element.style.cssText = ...` | 用 CSS class（`element.className = 'xxx'`），样式写在 `styles.css` 里 |

### 建议修（Warning，不修也能过但影响评分）

| 规则 | 说明 | 如何避免 |
|------|------|---------|
| 插件名全大写 | `"name": "ARA"` 警告 | 改为 `"Ara"` 或 `"Inline Rename"` |
| `document` vs `activeDocument` | 弹窗兼容 | 换成 `activeDocument` |
| `requestAnimationFrame()` | 弹窗兼容 | 换成 `window.requestAnimationFrame()` |
| `setTimeout()` | 弹窗兼容 | 换成 `window.setTimeout()` |
| Vault 枚举 | `vault.getFiles()` | 这个不可避免，保持 |

---

## 四、发布流程

### 第 1 步：GitHub 准备

```bash
# 初始化
git init
git add -A
git commit -m "v1.0.0: 初始版本"

# 创建远程仓库（先在 GitHub 网页创建）
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin master
```

### 第 2 步：打 Tag

```bash
git tag 1.0.0
git push origin 1.0.0
```

**注意：** tag 名称必须和 `manifest.json` 的 `version` 字段**完全一致**。

### 第 3 步：创建 GitHub Release

1. 打开 `https://github.com/<用户名>/<仓库名>/releases/new`
2. **Tag** 下拉选择已创建的 tag
3. **Release title** 写 `插件名 v1.0.0`
4. **Description** 写用户能看懂的一句话（简洁）
5. **Attach binaries** 拖入三个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. 点 **Publish release**

### 第 4 步：提交到 Obsidian 社区

1. 打开 https://community.obsidian.md
2. 用 GitHub 登录（右上角 Sign in）
3. 侧边栏 → **Plugins** → **New plugin**
4. 粘贴仓库 URL：`https://github.com/<用户名>/<仓库名>`
5. 勾选两个复选框（同意政策 + 承诺维护）
6. 点 **Submit**

### 第 5 步：等待审核

系统自动扫描，结果在 Dashboard 查看。如果通过 → 点 **Publish** 上线。如果有 Error → 修完重新走 2-4 步。

---

## 五、版本更新流程

1. 修改代码
2. 更新 `manifest.json` 的 `version` 字段
3. 提交推送
4. 删除旧 tag，打新 tag：
   ```bash
   git tag -d 1.0.0 && git push origin --delete 1.0.0
   git tag 1.0.1 && git push origin 1.0.1
   ```
5. 删除旧 release，创建新 release（重新上传三个文件）
6. community.obsidian.md 会自动检测新版本

---

## 六、踩过的坑

| 坑 | 原因 | 解法 |
|----|------|------|
| 忘记上传 release 附件 | GitHub 拖文件区域不明显 | 每次 create release 后检查 Assets 数量 |
| `manifest.json` 版本号忘改 | 只改了 tag，没改文件 | 改完 `manifest.json` 再打 tag |
| community 页面用的是草稿而不是新 release | 旧草稿缓存 | 齿轮菜单 → 删除旧提交 → 重新提交 |
| 插件目录和开发目录不同 | Obsidian vault 在 `D:\Brain`，开发在 `C:\` | 开发完成后 `cp` 到 vault 的 `.obsidian/plugins/` 目录 |
| esbuild 覆盖手写 main.js | 跑 `npm run build` 会覆盖 | 手写版作为发布版；TypeScript 源码放 `src/` 仅做审查 |
| `obsidianmd/no-static-styles-assignment` | JS 里写了 `element.style.cssText` | 改成 CSS class，样式放 `styles.css` |
| 插件名全大写警告 | `"name": "ARA"` | 改成 `"Ara"` |
| Obsidian 新版 DOM 不同 | 文件浏览器用 `.tree-item-self` 而不是 `.nav-file-title-content` | 先用调试版打印实际 DOM，再修正选择器 |

---

## 七、开发流程

```
1. 写代码 → main.js（CommonJS 格式，require / module.exports）
2. 加调试日志 → console.log('[插件名] ...')
3. 复制到 vault 测试 → cp main.js manifest.json styles.css D:\Brain\.obsidian\plugins\xxx\
4. 重启 Obsidian → Ctrl+Shift+I 看 Console
5. 修复 → 重复 3-4
6. 确认可用 → commit → push → release
```

**调试技巧：**
- 用 `new Notice('...')` 弹出通知验证插件加载
- 用 `console.log()` 打印 DOM 结构确认选择器
- Obsidian 的 `Ctrl+Shift+I` 就是 Chrome DevTools

---

## 八、发布清单（每次发布前逐项检查）

- [ ] `manifest.json` 的 `version` 已更新
- [ ] `manifest.json` 的 `name` 不是全大写
- [ ] `main.js` 没有 `element.style.cssText = ...` 或 `element.setAttribute('style', ...)`
- [ ] `README.md` 已更新（版本号、名称、搜索关键词）
- [ ] Git 已 commit 并 push
- [ ] Tag 已创建并推送到 GitHub
- [ ] Release 已创建，三个文件已上传（main.js + manifest.json + styles.css）
- [ ] Release tag 和 manifest.json version 一致
