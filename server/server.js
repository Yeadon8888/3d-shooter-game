// 3D多人射击游戏 - 服务器端
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 生产环境安全配置
app.use(helmet({
    contentSecurityPolicy: false // 允许内联脚本用于游戏
}));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP 100个请求
    message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 配置CORS - Railway全栈部署支持
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? "*"  // Railway部署临时允许所有来源，用于调试
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

console.log('🔧 CORS配置:', allowedOrigins);
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 提供静态文件服务（为客户端文件提供服务）
app.use(express.static('../client'));

// 根路径重定向到游戏
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});


// 配置Socket.io - 强制Polling模式（Railway WebSocket不稳定）
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: false
    },
    allowEIO3: true,
    transports: ['polling'], // 只使用polling，完全禁用websocket
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    // Railway优化配置
    serveClient: false,
    cookie: false,
    allowUpgrades: false // 禁止升级到WebSocket
});

console.log('🔌 Socket.io服务器配置完成');
console.log('📡 传输方式: polling only (WebSocket已禁用)');
console.log('🌍 CORS: 允许所有来源');
console.log('⚙️ 环境:', process.env.NODE_ENV || 'development');

// 存储玩家信息 - 简化为全局游戏大厅模式
const players = new Map(); // playerUID -> { socketId, name, joinTime, position, health }
const playerActivity = new Map(); // 跟踪玩家活动以防滥用
const globalRoom = 'global'; // 所有玩家都在全局房间

// 输入验证函数
function validatePlayerInput(data) {
    if (!data || typeof data !== 'object') return false;
    
    // 验证位置数据
    if (data.position) {
        const { x, y, z } = data.position;
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return false;
        if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) return false;
    }
    
    // 验证旋转数据
    if (data.rotation) {
        const { x, y, z } = data.rotation;
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return false;
    }
    
    return true;
}

// 速率限制检查
function checkRateLimit(socketId, action, limit = 60, window = 60000) {
    const now = Date.now();
    const key = `${socketId}:${action}`;
    const activity = playerActivity.get(key) || { count: 0, windowStart: now };
    
    if (now - activity.windowStart > window) {
        activity.count = 0;
        activity.windowStart = now;
    }
    
    activity.count++;
    playerActivity.set(key, activity);
    
    return activity.count <= limit;
}

// 生成唯一玩家UID
function generatePlayerUID() {
    return 'player_' + Math.random().toString(36).substring(2, 15);
}

// 通过socketId查找玩家UID
function findPlayerUIDBySocket(socketId) {
    for (const [uid, player] of players) {
        if (player.socketId === socketId) {
            return uid;
        }
    }
    return null;
}

// 基础路由 - 检查服务器状态
app.get('/', (req, res) => {
    res.json({ 
        message: '🎮 3D射击游戏服务器运行中!', 
        rooms: gameRooms.size,
        players: players.size,
        timestamp: new Date().toISOString()
    });
});

// API路由 - 获取服务器状态
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        message: '3D射击游戏服务器在线 - 全局大厅模式',
        totalPlayers: players.size,
        connectedSockets: io.engine.clientsCount,
        uptime: process.uptime(),
        players: Array.from(players.entries()).map(([uid, player]) => ({
            uid,
            name: player.name,
            joinTime: player.joinTime
        })),
        socketio: {
            connected: io.engine.clientsCount,
            version: require('socket.io/package.json').version
        }
    });
});

// Socket.io测试路由
app.get('/socket.io/test', (req, res) => {
    res.json({
        message: 'Socket.io endpoint is working',
        clients: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Socket.io 连接处理
io.on('connection', (socket) => {
    console.log('🎯 新玩家连接:', socket.id);
    
    // 玩家加入全局游戏大厅
    socket.on('joinGame', (data) => {
        try {
            const playerName = data?.playerName || `玩家${socket.id.substring(0, 4)}`;
            const sanitizedName = playerName.toString().substring(0, 20);
            
            // 生成唯一UID
            const playerUID = generatePlayerUID();
            
            // 加入全局房间
            socket.join(globalRoom);
            
            // 获取当前所有在线玩家
            const existingPlayers = Array.from(players.values());
            
            // 创建新玩家数据
            const newPlayer = {
                uid: playerUID,
                socketId: socket.id,
                name: sanitizedName,
                joinTime: new Date(),
                health: 100,
                position: { x: 0, y: 1, z: 0 },
                isAlive: true
            };
            
            // 存储玩家信息（以UID为键）
            players.set(playerUID, newPlayer);
            
            console.log('👤 玩家加入游戏:', sanitizedName, 'UID:', playerUID);
            
            // 向新玩家发送所有现有玩家信息（包含位置）
            console.log(`📊 向新玩家${sanitizedName}发送${existingPlayers.length}个现有玩家`);
            existingPlayers.forEach(existingPlayer => {
                socket.emit('playerJoined', {
                    playerId: existingPlayer.uid,
                    playerName: existingPlayer.name,
                    position: existingPlayer.position,
                    playersCount: players.size
                });
                console.log(`  -> 发送现有玩家: ${existingPlayer.name} (${existingPlayer.uid}) 位置:`, existingPlayer.position);
            });
            
            // 通知所有玩家有新玩家加入
            io.to(globalRoom).emit('playerJoined', {
                playerId: playerUID,
                playerName: sanitizedName,
                playersCount: players.size
            });
            
            // 确认加入成功
            socket.emit('joinedGame', { 
                playerUID, 
                playerName: sanitizedName,
                playersCount: players.size 
            });
            
            console.log(`✅ 全局游戏大厅更新完成: ${players.size}人在线`);
            
        } catch (error) {
            console.error('加入游戏错误:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });

    // 旧的房间系统已移除，现在使用全局UID系统

    // 玩家位置更新
    socket.on('playerMove', (data) => {
        try {
            // 速率限制检查
            if (!checkRateLimit(socket.id, 'move', 120)) {
                return; // 静默忽略过频繁的移动请求
            }
            
            // 通过socketId找到玩家UID
            const playerUID = findPlayerUIDBySocket(socket.id);
            const player = players.get(playerUID);
            
            if (player && validatePlayerInput(data)) {
                // 更新玩家位置
                player.position = data.position;
                
                // 广播玩家位置给所有其他玩家
                socket.to(globalRoom).emit('playerMoved', {
                    playerId: playerUID,
                    position: data.position,
                    rotation: data.rotation,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('玩家移动错误:', error);
        }
    });

    // 玩家射击事件
    socket.on('playerShoot', (data) => {
        try {
            // 射击速率限制 (每秒最多10发)
            if (!checkRateLimit(socket.id, 'shoot', 10)) {
                return;
            }
            
            const playerUID = findPlayerUIDBySocket(socket.id);
            const player = players.get(playerUID);
            
            if (player && validatePlayerInput(data)) {
                // 广播射击事件给所有其他玩家
                socket.to(globalRoom).emit('playerShot', {
                    playerId: playerUID,
                    position: data.position,
                    direction: data.direction,
                    timestamp: Date.now()
                });
                console.log('💥 玩家射击:', playerUID);
            }
        } catch (error) {
            console.error('玩家射击错误:', error);
        }
    });

    // 玩家受伤事件
    socket.on('playerHit', (data) => {
        const playerUID = findPlayerUIDBySocket(socket.id);
        const player = players.get(playerUID);
        if (player) {
            // 更新玩家血量
            player.health = Math.max(0, player.health - (data.damage || 25));
            
            // 广播受伤事件
            socket.to(globalRoom).emit('playerWasHit', {
                playerId: playerUID,
                damage: data.damage,
                health: player.health,
                shooterId: data.shooterId
            });
            
            console.log('🩸 玩家受伤:', playerUID, '剩余血量:', player.health);
        }
    });

    // 玩家死亡事件
    socket.on('playerDeath', (data) => {
        const playerUID = findPlayerUIDBySocket(socket.id);
        const player = players.get(playerUID);
        if (player) {
            player.health = 0;
            player.isAlive = false;
            
            // 广播死亡事件
            socket.to(globalRoom).emit('playerDied', {
                playerId: playerUID,
                killerId: data.killerId,
                timestamp: Date.now()
            });
            console.log('💀 玩家死亡:', playerUID);
        }
    });

    // 玩家得分事件
    socket.on('playerScore', (data) => {
        const playerUID = findPlayerUIDBySocket(socket.id);
        const player = players.get(playerUID);
        if (player) {
            console.log('🏆 玩家得分:', player.name, data);
            
            // 广播得分事件给所有玩家
            io.to(globalRoom).emit('playerScored', {
                playerId: playerUID,
                playerName: player.name,
                scoreType: data.scoreType,
                points: data.points,
                targetName: data.targetName,
                timestamp: Date.now()
            });
        }
    });

    // 心跳检测
    socket.on('ping', (data) => {
        // 回应客户端心跳
        socket.emit('pong', { 
            timestamp: data.timestamp,
            serverTime: Date.now()
        });
    });
    
    // 玩家断开连接
    socket.on('disconnect', () => {
        console.log('👋 玩家断开连接:', socket.id);
        
        const playerUID = findPlayerUIDBySocket(socket.id);
        if (playerUID) {
            const player = players.get(playerUID);
            if (player) {
                console.log('📤 移除玩家:', player.name, playerUID);
                
                // 通知其他玩家
                socket.to(globalRoom).emit('playerLeft', {
                    playerId: playerUID,
                    playersCount: players.size - 1
                });
                
                // 移除玩家数据
                players.delete(playerUID);
                console.log(`✅ 玩家移除完成，当前在线: ${players.size}人`);
            }
        }
    });
});

// 启动服务器 - Railway自动分配端口
const PORT = process.env.PORT || 3001;
console.log('🔧 环境变量PORT:', process.env.PORT);
console.log('🔧 使用端口:', PORT);
server.listen(PORT, () => {
    console.log('🚀 服务器启动成功!');
    console.log('📍 本地地址: http://localhost:' + PORT);
    console.log('🎮 游戏客户端: http://localhost:' + PORT + '/index.html');
    console.log('🧪 连接测试: http://localhost:' + PORT + '/test.html');
    console.log('📊 服务器状态: http://localhost:' + PORT + '/api/status');
    console.log('🌐 Socket.io端点: ws://localhost:' + PORT + '/socket.io/');
    console.log('🎮 游戏服务器准备就绪!');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('🛑 服务器正在关闭...');
    server.close();
    process.exit(0);
});