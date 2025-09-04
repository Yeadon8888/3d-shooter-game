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


// 配置Socket.io
const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB限制
    allowRequest: (req, callback) => {
        // 基础安全检查
        const isOriginValid = !req.headers.origin || allowedOrigins.includes(req.headers.origin);
        callback(null, isOriginValid);
    }
});

// 存储游戏房间和玩家信息
const gameRooms = new Map();
const players = new Map();
const playerActivity = new Map(); // 跟踪玩家活动以防滥用

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

// 生成随机房间号
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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
        message: '3D射击游戏服务器在线',
        rooms: Array.from(gameRooms.entries()).map(([id, room]) => ({
            id,
            players: room.players.length,
            createdAt: room.createdAt
        })),
        totalPlayers: players.size,
        uptime: process.uptime(),
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

    // 玩家创建房间
    socket.on('createRoom', () => {
        const roomId = generateRoomId();
        const room = {
            id: roomId,
            players: [],
            createdAt: new Date()
        };
        
        gameRooms.set(roomId, room);
        socket.join(roomId);
        
        console.log('🏠 房间创建:', roomId);
        socket.emit('roomCreated', { roomId });
    });

    // 玩家加入房间
    socket.on('joinRoom', (data) => {
        try {
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: '无效的数据格式' });
                return;
            }
            
            const { roomId, playerName } = data;
            
            // 验证房间ID格式
            if (!roomId || typeof roomId !== 'string' || roomId.length !== 6) {
                socket.emit('error', { message: '无效的房间ID' });
                return;
            }
            
            // 验证玩家名称
            const sanitizedName = playerName ? playerName.toString().substring(0, 20) : `玩家${socket.id.substring(0, 4)}`;
            
            const room = gameRooms.get(roomId);
            
            if (room) {
                // 检查房间是否已满
                if (room.players.length >= 8) {
                    socket.emit('error', { message: '房间已满' });
                    return;
                }
                
                socket.join(roomId);
                room.players.push({
                    id: socket.id,
                    name: sanitizedName,
                    joinTime: new Date()
                });
                
                players.set(socket.id, { roomId, name: sanitizedName });
                
                console.log('👤 玩家加入房间:', sanitizedName, '房间:', roomId);
                
                // 通知房间内所有玩家
                io.to(roomId).emit('playerJoined', {
                    playerId: socket.id,
                    playerName: sanitizedName,
                    playersCount: room.players.length
                });
                
                socket.emit('joinedRoom', { roomId, playersCount: room.players.length });
            } else {
                socket.emit('error', { message: '房间不存在' });
            }
        } catch (error) {
            console.error('加入房间错误:', error);
            socket.emit('error', { message: '服务器错误' });
        }
    });

    // 玩家位置更新
    socket.on('playerMove', (data) => {
        try {
            // 速率限制检查
            if (!checkRateLimit(socket.id, 'move', 120)) {
                return; // 静默忽略过频繁的移动请求
            }
            
            const player = players.get(socket.id);
            if (player && validatePlayerInput(data)) {
                // 广播玩家位置给房间内其他玩家
                socket.to(player.roomId).emit('playerMoved', {
                    playerId: socket.id,
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
            
            const player = players.get(socket.id);
            if (player && validatePlayerInput(data)) {
                // 广播射击事件给房间内其他玩家
                socket.to(player.roomId).emit('playerShot', {
                    playerId: socket.id,
                    position: data.position,
                    direction: data.direction,
                    timestamp: Date.now()
                });
                console.log('💥 玩家射击:', socket.id);
            }
        } catch (error) {
            console.error('玩家射击错误:', error);
        }
    });

    // 玩家受伤事件
    socket.on('playerHit', (data) => {
        const player = players.get(socket.id);
        if (player) {
            // 广播受伤事件
            socket.to(player.roomId).emit('playerWasHit', {
                playerId: socket.id,
                damage: data.damage,
                health: data.health,
                shooterId: data.shooterId
            });
        }
    });

    // 玩家死亡事件
    socket.on('playerDeath', (data) => {
        const player = players.get(socket.id);
        if (player) {
            // 广播死亡事件
            socket.to(player.roomId).emit('playerDied', {
                playerId: socket.id,
                killerId: data.killerId,
                timestamp: Date.now()
            });
            console.log('💀 玩家死亡:', socket.id);
        }
    });

    // 玩家断开连接
    socket.on('disconnect', () => {
        console.log('👋 玩家断开连接:', socket.id);
        
        const player = players.get(socket.id);
        if (player) {
            const room = gameRooms.get(player.roomId);
            if (room) {
                // 从房间中移除玩家
                room.players = room.players.filter(p => p.id !== socket.id);
                
                // 通知其他玩家
                socket.to(player.roomId).emit('playerLeft', {
                    playerId: socket.id,
                    playersCount: room.players.length
                });
                
                // 如果房间空了就删除房间
                if (room.players.length === 0) {
                    gameRooms.delete(player.roomId);
                    console.log('🗑️ 房间已删除:', player.roomId);
                }
            }
            players.delete(socket.id);
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