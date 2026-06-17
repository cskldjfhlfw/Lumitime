# Lumitime Frontend

Lumitime 的前端工程，基于 Vite、React、TypeScript 和 Tailwind CSS。

## 为什么根目录有 HTML，但源码里主要是 TypeScript

Vite 单页应用只需要一个宿主 HTML：`index.html`。页面内容由 `src/main.tsx` 挂载 React 应用后动态渲染，所以业务页面通常写成 `.tsx` 组件，而不是每个页面一个 `.html` 文件。

## 目录结构

```text
frontend/
  index.html                 # Vite 宿主 HTML
  src/
    app/                     # 应用入口、路由、全局 Provider
    assets/                  # 静态资源
    features/                # 按业务域拆分的组件
    layouts/                 # 页面布局和导航
    mocks/                   # 原型阶段的模拟数据
    pages/                   # 路由页面组件
    shared/                  # 跨业务复用的 UI、工具函数、基础组件
    styles/                  # 全局样式和主题
  docs/                      # 设计稿、计划和规范文档
```

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
```
