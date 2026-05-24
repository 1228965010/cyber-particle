# Cyber Particle

赛博朋克风格手势识别粒子系统。通过摄像头实时识别手部手势，控制 10000+ WebGL 粒子在空间中的运动。

## 运行

```bash
npm install
npx serve . -p 3456
```

打开 `http://localhost:3456`，允许摄像头权限即可体验。

## 手势

| 手势 | 效果 | 颜色 |
|------|------|------|
| 🖐️ 张开手掌 | 粒子从手心向外爆散 | 青蓝 |
| ✊ 握拳 | 粒子螺旋吸入形成漩涡 | 品红 |
| ☝️ 食指指向 | 粒子沿食指方向渐进汇流 | 赤红 |
| 🤏 五指捏合 | 粒子汇聚成爱心形状 | 粉色 |

手离摄像头越近，粒子运动速度越快。

## 技术栈

- **手势识别**：MediaPipe HandLandmarker（`@mediapipe/tasks-vision`）
- **粒子渲染**：Three.js BufferGeometry + AdditiveBlending
- **后处理**：CSS CRT 扫描线 + 暗角
- **纯前端**：无后端、无框架、单 HTML 页面

## 按键

- `1` — 5000 粒子
- `2` — 8000 粒子
- `3` — 15000 粒子（默认）

## 项目结构

```
├── index.html          # 主页面 + 模块初始化
├── css/style.css       # CRT 扫描线、HUD 样式
├── js/
│   ├── gesture.js      # MediaPipe 初始化 + 手势分类
│   ├── particles.js    # Three.js 粒子系统 + 手势行为
│   └── hud.js          # FPS、手势名、置信度显示
└── mediapipe/
    ├── model/           # 手部关键点模型
    └── wasm/            # MediaPipe WASM（备用）
```
