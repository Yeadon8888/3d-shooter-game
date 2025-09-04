# 🎮 3D多人射击游戏

[![部署状态](https://img.shields.io/badge/status-ready%20to%20deploy-green)](https://github.com/yourusername/3d-shooter-game)
[![技术栈](https://img.shields.io/badge/tech-Three.js%20%2B%20Socket.io-blue)](https://threejs.org/)
[![许可证](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> 一个基于Web的3D多人实时射击游戏，使用Three.js和Socket.io构建

## 🌟 特性

- 🎯 **3D第一人称射击** - 流畅的3D游戏体验
- 🌐 **多人实时对战** - Socket.io驱动的低延迟多人游戏
- 🎨 **现代UI设计** - CS:GO风格的游戏界面
- 🏠 **房间系统** - 创建/加入私人游戏房间
- 🔫 **完整射击机制** - 射击、换弹、瞄准系统
- 🎵 **音效系统** - Web Audio API音效支持
- 📱 **响应式设计** - 支持不同屏幕尺寸

## 🚀 快速开始

### 开发环境要求

- Node.js >= 16.0.0
- 现代浏览器支持WebGL 2.0
- 网络连接

### 本地运行

```bash
# 克隆项目
git clone https://github.com/yourusername/3d-shooter-game.git
cd 3d-shooter-game

# 启动服务器
cd server
npm install
npm run dev

# 启动客户端 (新终端)
cd ../client
npm install
npm run dev
```

访问 `http://localhost:3000` 开始游戏！

## 🏗️ 项目结构

```
3d-shooter-game/
├── client/                 # 前端代码
│   ├── index.html         # 主游戏页面
│   ├── test.html          # 连接测试页面
│   └── package.json       # 客户端依赖
└── server/                # 后端代码
    ├── server.js          # Express + Socket.io 服务器
    ├── package.json       # 服务器依赖
    └── .env.example       # 环境变量模板
```

## 🎮 游戏玩法

1. **创建房间** - 点击"创建房间"获得6位房间码
2. **加入游戏** - 输入房间码加入多人游戏
3. **游戏控制**:
   - `WASD` - 移动
   - `鼠标` - 视角控制
   - `左键` - 射击
   - `R` - 换弹
   - `ESC` - 暂停菜单

## 🛠️ 技术栈

### 前端
- **Three.js** - 3D图形渲染
- **Socket.io Client** - 实时通信
- **Web Audio API** - 音效系统
- **Pointer Lock API** - 鼠标控制

### 后端
- **Node.js** - 服务器运行时
- **Express** - Web框架
- **Socket.io** - WebSocket通信
- **Helmet** - 安全中间件

## 🚀 部署

详细部署指南请查看 [DEPLOYMENT.md](../DEPLOYMENT.md)

### 生产环境部署
- **后端**: Railway.app
- **前端**: Vercel/Netlify
- **域名**: 支持自定义域名

## 🔒 安全特性

- ✅ 输入验证和数据净化
- ✅ 速率限制防护
- ✅ CORS安全配置
- ✅ Helmet安全头
- ✅ HTTPS/WSS加密传输

## 📊 性能指标

- **帧率**: 目标60 FPS
- **延迟**: <100ms
- **并发**: 支持200+玩家
- **房间容量**: 最多8人/房间

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📜 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🎯 未来计划

- [ ] 移动端优化
- [ ] 更多武器类型
- [ ] 成就系统
- [ ] 排行榜
- [ ] Pokemon模式 (基于现有requirements.md)

## 📞 支持

- 🐛 [报告Bug](https://github.com/yourusername/3d-shooter-game/issues)
- 💡 [功能建议](https://github.com/yourusername/3d-shooter-game/discussions)
- 📧 联系邮箱: your-email@example.com

---

⭐ 如果这个项目对你有帮助，请给个Star支持一下！