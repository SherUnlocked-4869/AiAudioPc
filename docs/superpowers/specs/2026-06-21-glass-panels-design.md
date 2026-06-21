# Glass Panels: 毛玻璃背景融合

## 目标

四个页面（Player、History、Profile、Settings）与 `InteractiveDots` 音频可视化 Canvas 背景融合不佳 —— 不透明面板遮挡了后面的柱形可视化。将所有页面外层容器改为毛玻璃效果，让音频可视化透过来。

## 范围

### 涉及

- `client/src/index.css` — 新增 CSS 变量 + Tailwind 颜色注册
- `client/tailwind.config.js` — 注册 `glass` / `glass-2` / `glass-input` 颜色
- `client/src/views/PlayerView.tsx` — 外层 section 类名
- `client/src/views/HistoryView.tsx` — 外层 section 类名
- `client/src/views/ProfileView.tsx` — 外层 section 类名
- `client/src/views/SettingsView.tsx` — 外层 section 类名
- `client/src/components/shell/TabNav.tsx` — 激活/非激活 tab 按钮类名
- `client/src/components/chat/ChatInput.tsx` — 输入框背景
- `client/src/components/player/PlayControls.tsx` — 下一首按钮背景

### 不涉及

- `ChatMessage.tsx` 用户气泡（`bg-panel-2`）—— 保持不透明确保可读性
- `SettingsView.tsx` 技术标签（`bg-panel-2`）—— 保持不透明
- `TrackInfo.tsx` 专辑占位 —— 已是渐变，不改
- 旧的 PWA 前端（`public/`）—— 不改

## 透明度参数

- **45-55% 不透明度**：外层面板背景
- **blur(12px)**：`backdrop-blur-md`
- 内部承载文字的小组件保持不透，确保可读性

## 设计

### CSS 变量

```css
--glass: rgba(18, 18, 26, 0.5);
--glass-2: rgba(26, 26, 36, 0.5);
--glass-input: rgba(10, 10, 15, 0.5);
```

现有 `--panel`、`--panel-2`、`--bg` 保留不变。

### Tailwind 配置

```js
colors: {
  glass: 'var(--glass)',
  'glass-2': 'var(--glass-2)',
  'glass-input': 'var(--glass-input)',
}
```

### 组件改动

| 组件 | 原类名 | 新类名 |
|------|--------|--------|
| 四个 View section | `bg-panel` | `bg-glass backdrop-blur-md` |
| TabNav 非激活 | `bg-panel` | `bg-glass backdrop-blur-md` |
| TabNav 激活 | `bg-panel-2` | `bg-glass-2 backdrop-blur-md` |
| ChatInput 输入框 | `bg-bg` | `bg-glass-input backdrop-blur-md` |
| PlayControls 下一首 | `bg-panel-2` | `bg-glass-2 backdrop-blur-md` |

### 不改动的组件

- `ChatMessage` 用户气泡：`bg-panel-2` 保持不透明
- `SettingsView` 标签：`bg-panel-2` 保持不透明
- `TrackInfo` 专辑占位：渐变保持
- `FeedbackBar`、`DJSay` 按钮：已是 `bg-transparent`

## 验证

- 视觉效果：四个页面背景下 `InteractiveDots` 柱形可视化应透过面板可见
- 文字可读性：所有文本正常阅读，无对比度问题
- 边界情况：长时间播放、快速切换 tab、浏览器缩放

## 回滚

恢复所有 `bg-glass*` 为对应的 `bg-panel*` / `bg-bg`，删除 CSS 变量和 Tailwind 配置中的 `glass*` 条目即可。
