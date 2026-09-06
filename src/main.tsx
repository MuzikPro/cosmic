import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyLaunchParams } from './launchParams';

// 宿主（.saver / 壁纸 / kiosk）可用查询串预设设置；无参数时什么都不做
applyLaunchParams();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
