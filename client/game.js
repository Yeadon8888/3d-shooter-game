// 3D射击游戏 - 游戏逻辑
import * as THREE from 'https://cdn.skypack.dev/three@0.158.0';

class Game {
    constructor() {
        console.log('🎮 初始化3D游戏...');
        
        // 游戏状态
        this.isGameStarted = false;
        this.players = new Map();
        
        // Three.js 核心对象
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 游戏对象
        this.player = null;
        this.ground = null;
        this.obstacles = [];
        
        // 输入控制
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // 鼠标控制
        this.mouse = {
            x: 0,
            y: 0,
            isLocked: false,
            sensitivity: 0.002
        };
        
        // 游戏状态
        this.playerStats = {
            health: 100,
            maxHealth: 100,
            ammo: 40,
            maxAmmo: 200,
            magazineSize: 40,
            isReloading: false,
            isAiming: false
        };
        
        // 射击系统
        this.bullets = [];
        this.lastShotTime = 0;
        this.shotInterval = 100; // 毫秒
        
        // 相机旋转
        this.cameraRotation = {
            x: 0,
            y: 0
        };
        
        this.init();
    }
    
    init() {
        this.setupScene();
        this.setupLighting();
        this.createWorld();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.animate();
        
        console.log('✅ 3D场景初始化完成！');
    }
    
    // 设置Three.js场景
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // 天空蓝色
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 200); // 添加雾效
    }
    
    // 设置光照
    setupLighting() {
        // 环境光 - 提供基础亮度
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 方向光 - 模拟太阳光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }
    
    // 创建3D世界
    createWorld() {
        // 创建地面
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x3d6b3d,  // 草绿色
            transparent: true,
            opacity: 0.8
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2; // 水平放置
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // 创建一些障碍物（箱子）
        this.createObstacles();
        
        // 创建玩家角色
        this.createPlayer();
    }
    
    // 创建障碍物
    createObstacles() {
        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        const boxMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // 棕色
        
        // 随机放置一些箱子作为掩体
        for (let i = 0; i < 10; i++) {
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            box.position.set(
                (Math.random() - 0.5) * 50,
                1,
                (Math.random() - 0.5) * 50
            );
            box.castShadow = true;
            box.receiveShadow = true;
            this.obstacles.push(box);
            this.scene.add(box);
        }
        
        console.log('📦 创建了', this.obstacles.length, '个障碍物');
    }
    
    // 创建玩家角色
    createPlayer() {
        // 简单的玩家模型（胶囊体）
        const playerGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0066ff }); // 蓝色
        this.player = new THREE.Mesh(playerGeometry, playerMaterial);
        this.player.position.set(0, 1, 0);
        this.player.castShadow = true;
        this.scene.add(this.player);
        
        console.log('👤 玩家角色创建完成');
    }
    
    // 设置相机
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, // 视野角度
            window.innerWidth / window.innerHeight, // 宽高比
            0.1, // 近平面
            1000 // 远平面
        );
        
        // 第一人称相机位置（在玩家头部）
        this.camera.position.set(0, 1.6, 0);
        this.player.add(this.camera); // 相机跟随玩家
    }
    
    // 设置渲染器
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 替换页面内容为3D画布
        const gameContainer = document.getElementById('gameContainer');
        gameContainer.innerHTML = '';
        gameContainer.appendChild(this.renderer.domElement);
        
        // 添加简单的HUD
        this.createHUD();
    }
    
    // 创建游戏HUD
    createHUD() {
        const hudHTML = `
            <div id="gameHUD" style="position: absolute; top: 0; left: 0; z-index: 1000; color: white; font-family: Arial; pointer-events: none;">
                <div style="position: absolute; top: 20px; left: 20px;">
                    <div>❤️ 血量: <span id="healthDisplay">100</span></div>
                    <div>🔫 弹药: <span id="ammoDisplay">40/200</span></div>
                </div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                    <div style="color: white; font-size: 24px;">+</div>
                </div>
                <div style="position: absolute; top: 20px; right: 20px;">
                    <div>🏠 房间: <span id="roomDisplay">--</span></div>
                    <div>👥 玩家: <span id="playersDisplay">1</span></div>
                </div>
            </div>
            <div id="instructions" style="position: absolute; bottom: 20px; left: 20px; color: white; font-family: Arial; z-index: 1000;">
                <div>🎮 WASD - 移动</div>
                <div>🖱️ 鼠标 - 视角</div>
                <div>🔫 左键 - 射击</div>
                <div>🎯 右键 - 瞄准</div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', hudHTML);
    }
    
    // 设置控制
    setupControls() {
        // 键盘事件监听
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW': this.keys.forward = true; break;
                case 'KeyS': this.keys.backward = true; break;
                case 'KeyA': this.keys.left = true; break;
                case 'KeyD': this.keys.right = true; break;
                case 'KeyR': this.reload(); break;
                case 'Escape': this.unlockMouse(); break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW': this.keys.forward = false; break;
                case 'KeyS': this.keys.backward = false; break;
                case 'KeyA': this.keys.left = false; break;
                case 'KeyD': this.keys.right = false; break;
            }
        });
        
        // 鼠标点击事件
        document.addEventListener('click', (event) => {
            if (!this.mouse.isLocked) {
                this.lockMouse();
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (!this.mouse.isLocked) return;
            
            if (event.button === 0) { // 左键射击
                this.shoot();
            } else if (event.button === 2) { // 右键瞄准
                this.playerStats.isAiming = true;
                this.camera.fov = 45; // 缩放视野
                this.camera.updateProjectionMatrix();
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 2) { // 松开右键
                this.playerStats.isAiming = false;
                this.camera.fov = 75; // 恢复视野
                this.camera.updateProjectionMatrix();
            }
        });
        
        // 禁用右键菜单
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // 鼠标移动事件
        document.addEventListener('mousemove', (event) => {
            if (!this.mouse.isLocked) return;
            
            this.cameraRotation.y -= event.movementX * this.mouse.sensitivity;
            this.cameraRotation.x -= event.movementY * this.mouse.sensitivity;
            
            // 限制上下视角
            this.cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotation.x));
            
            // 应用旋转
            this.player.rotation.y = this.cameraRotation.y;
            this.camera.rotation.x = this.cameraRotation.x;
        });
        
        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        console.log('🎮 控制系统设置完成');
    }
    
    // 锁定鼠标
    lockMouse() {
        this.renderer.domElement.requestPointerLock();
        this.renderer.domElement.addEventListener('pointerlockchange', () => {
            this.mouse.isLocked = document.pointerLockElement === this.renderer.domElement;
        });
    }
    
    // 解锁鼠标
    unlockMouse() {
        document.exitPointerLock();
    }
    
    // 射击功能
    shoot() {
        if (this.playerStats.ammo <= 0 || this.playerStats.isReloading) return;
        
        const now = Date.now();
        if (now - this.lastShotTime < this.shotInterval) return;
        
        this.lastShotTime = now;
        this.playerStats.ammo--;
        
        // 创建子弹
        this.createBullet();
        
        // 更新弹药显示
        this.updateHUD();
        
        console.log('🔫 射击！剩余子弹:', this.playerStats.ammo);
    }
    
    // 创建子弹
    createBullet() {
        const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // 子弹起始位置（玩家前方）
        bullet.position.copy(this.player.position);
        bullet.position.y += 1.6; // 眼睛高度
        
        // 子弹方向（相机朝向）
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        bullet.userData = {
            direction: direction,
            speed: 1.0,
            life: 100 // 子弹生命周期
        };
        
        this.bullets.push(bullet);
        this.scene.add(bullet);
        
        // 创建枪口火光效果
        this.createMuzzleFlash();
    }
    
    // 枪口火光
    createMuzzleFlash() {
        const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff4400, 
            transparent: true, 
            opacity: 0.8 
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        
        flash.position.copy(this.player.position);
        flash.position.y += 1.6;
        
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        flash.position.add(direction.multiplyScalar(0.5));
        
        this.scene.add(flash);
        
        // 0.1秒后移除火光
        setTimeout(() => {
            this.scene.remove(flash);
        }, 100);
    }
    
    // 更新子弹
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // 移动子弹
            bullet.position.add(
                bullet.userData.direction.clone().multiplyScalar(bullet.userData.speed)
            );
            
            // 检查子弹生命周期
            bullet.userData.life--;
            if (bullet.userData.life <= 0) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
                continue;
            }
            
            // 简单的碰撞检测（与障碍物）
            for (const obstacle of this.obstacles) {
                const distance = bullet.position.distanceTo(obstacle.position);
                if (distance < 1) {
                    // 命中障碍物
                    this.scene.remove(bullet);
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    // 换弹功能
    reload() {
        if (this.playerStats.isReloading || this.playerStats.ammo === this.playerStats.magazineSize) return;
        
        this.playerStats.isReloading = true;
        console.log('🔄 换弹中...');
        
        setTimeout(() => {
            const neededAmmo = this.playerStats.magazineSize - this.playerStats.ammo;
            const availableAmmo = this.playerStats.maxAmmo - this.playerStats.ammo;
            const reloadAmount = Math.min(neededAmmo, availableAmmo);
            
            this.playerStats.ammo += reloadAmount;
            this.playerStats.isReloading = false;
            this.updateHUD();
            
            console.log('✅ 换弹完成！弹药:', this.playerStats.ammo);
        }, 2000); // 2秒换弹时间
    }
    
    // 更新HUD显示
    updateHUD() {
        document.getElementById('healthDisplay').textContent = this.playerStats.health;
        document.getElementById('ammoDisplay').textContent = 
            `${this.playerStats.ammo}/${this.playerStats.maxAmmo}`;
    }
    
    // 更新玩家移动
    updatePlayer() {
        const speed = 0.1;
        const direction = new THREE.Vector3();
        
        // 获取玩家朝向
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        
        // 根据玩家旋转调整方向
        forward.applyQuaternion(this.player.quaternion);
        right.applyQuaternion(this.player.quaternion);
        
        // 根据按键移动
        if (this.keys.forward) direction.add(forward);
        if (this.keys.backward) direction.sub(forward);
        if (this.keys.left) direction.sub(right);
        if (this.keys.right) direction.add(right);
        
        // 标准化方向并应用速度
        if (direction.length() > 0) {
            direction.normalize();
            this.player.position.add(direction.multiplyScalar(speed));
        }
        
        // 限制玩家在地面范围内
        this.player.position.x = Math.max(-45, Math.min(45, this.player.position.x));
        this.player.position.z = Math.max(-45, Math.min(45, this.player.position.z));
        this.player.position.y = 1; // 保持在地面上
    }
    
    // 动画循环
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateBullets();
        this.renderer.render(this.scene, this.camera);
    }
    
    // 启动游戏
    startGame(roomId) {
        this.isGameStarted = true;
        document.getElementById('roomDisplay').textContent = roomId;
        document.getElementById('instructions').style.display = 'block';
        this.updateHUD(); // 初始化HUD显示
        console.log('🎯 游戏开始！房间:', roomId);
        
        // 显示控制提示
        setTimeout(() => {
            alert('🎮 点击屏幕锁定鼠标开始游戏！\n\n控制说明：\nWASD - 移动\n鼠标 - 视角\n左键 - 射击\n右键 - 瞄准\nR - 换弹\nESC - 解锁鼠标');
        }, 500);
    }
}

// 导出Game类供其他文件使用
window.Game = Game;