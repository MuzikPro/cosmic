import { CosmicScreensaver } from './components/Screensaver/CosmicScreensaver';

/**
 * 天人 · Cosmic Meridian —— 单页独立站（owner 2026-09-05）。
 * 只有屏保这一页：无标题栏、无来路页（不传 onExit 即不画返回键），全部设置在 ⚙ 面板里。
 * 源码与 3dqiflow 的 Screensaver 目录保持同一份，站点差异只在 App/index.html。
 */
export default function App() {
  return <CosmicScreensaver />;
}
