// 简单的服务器测试脚本
const http = require('http');

console.log('🧪 测试服务器连接...');

// 测试HTTP连接
const req = http.request('http://localhost:3001', (res) => {
    console.log('✅ HTTP连接成功，状态码:', res.statusCode);
    console.log('📋 响应头:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('📊 服务器响应:', json);
        } catch (e) {
            console.log('📄 服务器响应:', data);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ HTTP连接失败:', error.message);
});

req.end();

// 测试Socket.io端点
const testSocketIo = http.request('http://localhost:3001/socket.io/?EIO=4&transport=polling', (res) => {
    console.log('🔌 Socket.io端点状态:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('🔌 Socket.io响应:', data.substring(0, 100) + '...');
    });
});

testSocketIo.on('error', (error) => {
    console.log('❌ Socket.io端点失败:', error.message);
});

testSocketIo.end();