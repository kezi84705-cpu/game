const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const titleScreenElement = document.getElementById('titleScreen');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const congratsMessage = document.getElementById('congratsMessage');
const rankingList = document.getElementById('rankingList');
const restartBtn = document.getElementById('restartBtn');
const startBtn = document.getElementById('startBtn');

// ランキング管理
function loadRanking() {
    const ranking = localStorage.getItem('shootingGameRanking');
    return ranking ? JSON.parse(ranking) : [];
}

function saveRanking(ranking) {
    localStorage.setItem('shootingGameRanking', JSON.stringify(ranking));
}

function updateRanking(newScore) {
    let ranking = loadRanking();
    ranking.push(newScore);
    ranking.sort((a, b) => b - a);
    ranking = ranking.slice(0, 5); // トップ5のみ保持
    saveRanking(ranking);
    return ranking;
}

function displayRanking(currentScore) {
    const ranking = loadRanking();
    rankingList.innerHTML = '';
    
    ranking.forEach((score, index) => {
        const li = document.createElement('li');
        li.textContent = `${score}点`;
        if (score === currentScore && index === ranking.indexOf(currentScore)) {
            li.classList.add('new-record');
        }
        rankingList.appendChild(li);
    });
    
    if (ranking.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'まだ記録がありません';
        li.style.color = '#888';
        rankingList.appendChild(li);
    }
}

// 紙吹雪の設定
let confetti = [];
let confettiActive = false;

class Confetti {
    constructor() {
        this.x = Math.random() * confettiCanvas.width;
        this.y = -10;
        this.size = Math.random() * 8 + 4;
        this.speedY = Math.random() * 1.5 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.color = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][Math.floor(Math.random() * 6)];
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
    }
    
    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        
        if (this.y > confettiCanvas.height) {
            return false;
        }
        return true;
    }
    
    draw() {
        confettiCtx.save();
        confettiCtx.translate(this.x, this.y);
        confettiCtx.rotate(this.rotation * Math.PI / 180);
        confettiCtx.fillStyle = this.color;
        confettiCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        confettiCtx.restore();
    }
}

function startConfetti() {
    confettiActive = true;
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            confetti.push(new Confetti());
        }, i * 30);
    }
}

function updateConfetti() {
    if (!confettiActive) return;
    
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    
    confetti = confetti.filter(c => {
        const alive = c.update();
        if (alive) c.draw();
        return alive;
    });
    
    if (confetti.length === 0) {
        confettiActive = false;
    }
}

// Audio Context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 効果音を生成する関数
function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'shoot':
            oscillator.frequency.value = 300;
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'hit':
            oscillator.frequency.value = 150;
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'damage':
            oscillator.frequency.value = 100;
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'powerup':
            oscillator.frequency.value = 400;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'gameover':
            oscillator.frequency.value = 200;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
            oscillator.stop(audioContext.currentTime + 0.5);
            break;
    }
}

let gameState = {
    running: false,
    score: 0,
    keys: {},
    lives: 3
};

// プレイヤー
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 80,
    width: 40,
    height: 40,
    speed: 5,
    color: '#00ff00',
    invincible: false,
    invincibleTimer: 0,
    autoShootTimer: 0,
    autoShootInterval: 15 // 15フレームごとに自動射撃（約0.25秒）
};

// 弾丸
let bullets = [];
const bulletSpeed = 7;
const bulletWidth = 4;
const bulletHeight = 15;

// 敵
let enemies = [];
const enemySpeed = 1;
let enemySpawnTimer = 0;
const enemySpawnInterval = 60;

// 敵の弾
let enemyBullets = [];
const enemyBulletSpeed = 4;

// おにぎり（回復アイテム）
let onigiri = [];
let onigiriSpawnTimer = 0;
const onigiriSpawnInterval = 300; // 5秒（60fps × 5）
const onigiriSpeed = 2;

// キーボード入力
document.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;
    if (e.key === ' ' && gameState.running) {
        e.preventDefault();
        shootBullet();
    }
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
});

restartBtn.addEventListener('click', restartGame);
startBtn.addEventListener('click', startGame);

// タッチ操作対応
let touchStartX = 0;
let isTouching = false;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameState.running) return;
    isTouching = true;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    updatePlayerPositionFromTouch(touchStartX, rect.width);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameState.running || !isTouching) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    updatePlayerPositionFromTouch(touchX, rect.width);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
});

function updatePlayerPositionFromTouch(touchX, canvasDisplayWidth) {
    // タッチ位置をキャンバスの実際の座標に変換
    const scaleX = canvas.width / canvasDisplayWidth;
    const targetX = touchX * scaleX;
    
    // プレイヤーを中心に配置
    player.x = targetX - player.width / 2;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function startGame() {
    titleScreenElement.classList.add('hidden');
    gameState.running = true;
    gameLoop();
}

function shootBullet() {
    bullets.push({
        x: player.x + player.width / 2 - bulletWidth / 2,
        y: player.y,
        width: bulletWidth,
        height: bulletHeight
    });
    playSound('shoot');
}

function spawnEnemy() {
    const width = 40;
    const height = 35;
    
    let enemyType;
    
    // スコア10000以上で星型の敵（ボス）が確定出現
    if (gameState.score >= 10000 && !enemies.some(e => e.type === 'star')) {
        enemyType = 'star';
    } else if (Math.random() < 0.001) {
        // 0.1%の確率で銀色の敵（超レア）
        enemyType = 'silver';
    } else if (gameState.score >= 1500 && Math.random() < 0.15) {
        // 15%の確率でピンクの敵（5方向攻撃）
        enemyType = 'pink';
    } else if (gameState.score >= 500 && Math.random() < 0.2) {
        // 20%の確率で黄色の敵（3方向攻撃）
        enemyType = 'yellow';
    } else {
        // 通常の敵（赤または青）
        enemyType = Math.random() < 0.5 ? 'red' : 'blue';
    }
    
    // 星型の敵は大きめに
    const starWidth = enemyType === 'star' ? 60 : width;
    const starHeight = enemyType === 'star' ? 60 : height;
    
    enemies.push({
        x: Math.random() * (canvas.width - starWidth),
        y: -starHeight,
        width: starWidth,
        height: starHeight,
        speed: enemyType === 'star' ? enemySpeed * 0.5 : enemySpeed + Math.random() * 0.5,
        shootTimer: Math.floor(Math.random() * 60) + 30,
        canShoot: enemyType !== 'blue' && enemyType !== 'silver',
        type: enemyType,
        hp: enemyType === 'star' ? 3 : 1,
        maxHp: enemyType === 'star' ? 3 : 1
    });
}

function spawnOnigiri() {
    const size = 25;
    onigiri.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size
    });
}

function updateOnigiri() {
    onigiri = onigiri.filter(item => {
        item.y += onigiriSpeed;
        
        if (item.y > canvas.height) {
            return false;
        }
        
        if (checkCollision(player, item)) {
            // スコアが1000以上の場合は5回復、それ以外は3回復
            const healAmount = gameState.score >= 1000 ? 5 : 3;
            gameState.lives = Math.min(gameState.lives + healAmount, 5);
            updateLivesDisplay();
            playSound('powerup');
            return false;
        }
        
        return true;
    });
}

function drawOnigiri() {
    onigiri.forEach(item => {
        // おにぎりを描画
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(item.x + item.width / 2, item.y);
        ctx.lineTo(item.x, item.y + item.height);
        ctx.lineTo(item.x + item.width, item.y + item.height);
        ctx.closePath();
        ctx.fill();
        
        // 海苔
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(item.x + item.width * 0.3, item.y + item.height * 0.5, item.width * 0.4, item.height * 0.3);
    });
}

function enemyShoot(enemy) {
    if (enemy.type === 'star') {
        // 星型の敵は12方向に弾を撃つ
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            enemyBullets.push({
                x: enemy.x + enemy.width / 2 - 3,
                y: enemy.y + enemy.height / 2,
                width: 6,
                height: 12,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3
            });
        }
    } else if (enemy.type === 'pink') {
        // ピンクの敵は5方向に弾を撃つ
        const angles = [-0.5, -0.25, 0, 0.25, 0.5]; // 左2、左1、中央、右1、右2
        angles.forEach(angle => {
            enemyBullets.push({
                x: enemy.x + enemy.width / 2 - 3,
                y: enemy.y + enemy.height,
                width: 6,
                height: 12,
                vx: Math.sin(angle) * 3,
                vy: enemyBulletSpeed
            });
        });
    } else if (enemy.type === 'yellow') {
        // 黄色の敵は3方向に弾を撃つ
        const angles = [-0.3, 0, 0.3]; // 左、中央、右
        angles.forEach(angle => {
            enemyBullets.push({
                x: enemy.x + enemy.width / 2 - 3,
                y: enemy.y + enemy.height,
                width: 6,
                height: 12,
                vx: Math.sin(angle) * 3,
                vy: enemyBulletSpeed
            });
        });
    } else {
        // 通常の敵は1発だけ
        enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 3,
            y: enemy.y + enemy.height,
            width: 6,
            height: 12,
            vx: 0,
            vy: enemyBulletSpeed
        });
    }
}

function updatePlayer() {
    if (gameState.keys['ArrowLeft'] || gameState.keys['a']) {
        player.x -= player.speed;
    }
    if (gameState.keys['ArrowRight'] || gameState.keys['d']) {
        player.x += player.speed;
    }
    
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    
    if (player.invincible) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) {
            player.invincible = false;
        }
    }
    
    // 自動射撃
    player.autoShootTimer++;
    if (player.autoShootTimer >= player.autoShootInterval) {
        shootBullet();
        player.autoShootTimer = 0;
    }
}

function updateBullets() {
    bullets = bullets.filter(bullet => {
        bullet.y -= bulletSpeed;
        return bullet.y > -bullet.height;
    });
}

function updateEnemies() {
    enemies = enemies.filter(enemy => {
        enemy.y += enemy.speed;
        
        // 敵の射撃（攻撃できる敵のみ）
        if (enemy.canShoot) {
            enemy.shootTimer--;
            if (enemy.shootTimer <= 0) {
                enemyShoot(enemy);
                enemy.shootTimer = Math.floor(Math.random() * 80) + 40;
            }
        }
        
        if (enemy.y > canvas.height) {
            return false;
        }
        
        if (!player.invincible && checkCollision(player, enemy)) {
            loseLife();
            return false;
        }
        
        return true;
    });
}

function updateEnemyBullets() {
    enemyBullets = enemyBullets.filter(bullet => {
        bullet.y += bullet.vy;
        bullet.x += bullet.vx || 0;
        
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            return false;
        }
        
        if (!player.invincible && checkCollision(player, bullet)) {
            loseLife();
            return false;
        }
        
        return true;
    });
}

function checkBulletCollisions() {
    bullets = bullets.filter(bullet => {
        for (let i = 0; i < enemies.length; i++) {
            if (checkCollision(bullet, enemies[i])) {
                // 敵にダメージを与える
                enemies[i].hp--;
                
                // HPが0になったら倒す
                if (enemies[i].hp <= 0) {
                    // 敵のタイプによってスコアを変える
                    let points;
                    if (enemies[i].type === 'silver') {
                        points = 20000; // 銀色の敵は20000点
                    } else if (enemies[i].type === 'star') {
                        points = 5000; // 星型の敵（ボス）は5000点
                    } else if (enemies[i].type === 'pink') {
                        points = 500; // ピンクの敵は500点
                    } else if (enemies[i].type === 'yellow') {
                        points = 300; // 黄色の敵は300点
                    } else if (enemies[i].type === 'red') {
                        points = 100; // 赤い敵は100点
                    } else {
                        points = 25; // 青い敵は25点
                    }
                    
                    gameState.score += points;
                    enemies.splice(i, 1);
                    updateLivesDisplay();
                }
                
                playSound('hit');
                return false;
            }
        }
        return true;
    });
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function drawPlayer() {
    if (player.invincible && Math.floor(player.invincibleTimer / 5) % 2 === 0) {
        return;
    }
    
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();
}

function drawBullets() {
    ctx.fillStyle = '#ffff00';
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        // 敵のタイプによって色を変える
        let mainColor, darkColor;
        if (enemy.type === 'star') {
            mainColor = '#ffd700';
            darkColor = '#ffaa00';
        } else if (enemy.type === 'silver') {
            mainColor = '#c0c0c0';
            darkColor = '#808080';
        } else if (enemy.type === 'pink') {
            mainColor = '#ff1493';
            darkColor = '#c71585';
        } else if (enemy.type === 'yellow') {
            mainColor = '#ffff00';
            darkColor = '#cccc00';
        } else if (enemy.type === 'red') {
            mainColor = '#ff0000';
            darkColor = '#8b0000';
        } else {
            mainColor = '#0088ff';
            darkColor = '#005599';
        }
        
        // 星型の敵は特別な描画
        if (enemy.type === 'star') {
            drawStar(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 5, enemy.width / 2, enemy.width / 4, mainColor);
            
            // HPバーを表示
            const barWidth = enemy.width;
            const barHeight = 5;
            const barX = enemy.x;
            const barY = enemy.y - 10;
            
            // 背景（赤）
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // HP（緑）
            ctx.fillStyle = '#00ff00';
            const hpWidth = (enemy.hp / enemy.maxHp) * barWidth;
            ctx.fillRect(barX, barY, hpWidth, barHeight);
            
            // 枠線
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        } else {
            ctx.fillStyle = mainColor;
            
            // 機体
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
            ctx.lineTo(enemy.x + enemy.width * 0.3, enemy.y + enemy.height * 0.4);
            ctx.lineTo(enemy.x + enemy.width * 0.7, enemy.y + enemy.height * 0.4);
            ctx.closePath();
            ctx.fill();
            
            // 主翼
            ctx.fillRect(enemy.x, enemy.y + enemy.height * 0.5, enemy.width, enemy.height * 0.15);
            
            // コックピット
            ctx.fillStyle = darkColor;
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height * 0.6, enemy.width * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawEnemyBullets() {
    ctx.fillStyle = '#ff6600';
    enemyBullets.forEach(bullet => {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
}

function loseLife() {
    gameState.lives--;
    updateLivesDisplay();
    playSound('damage');
    
    if (gameState.lives <= 0) {
        endGame();
    } else {
        player.invincible = true;
        player.invincibleTimer = 120;
    }
}

function updateLivesDisplay() {
    scoreElement.textContent = `スコア: ${gameState.score} | ライフ: ${gameState.lives}`;
}

function endGame() {
    gameState.running = false;
    finalScoreElement.textContent = gameState.score;
    
    // ランキングを更新
    updateRanking(gameState.score);
    displayRanking(gameState.score);
    
    // スコアが10000以上の場合、おめでとうメッセージと紙吹雪を表示
    if (gameState.score >= 10000) {
        congratsMessage.classList.remove('hidden');
        startConfetti();
    } else {
        congratsMessage.classList.add('hidden');
    }
    
    gameOverElement.classList.remove('hidden');
    playSound('gameover');
}

function restartGame() {
    gameState.running = true;
    gameState.score = 0;
    gameState.lives = 3;
    player.x = canvas.width / 2 - 20;
    player.y = canvas.height - 80;
    player.invincible = false;
    player.invincibleTimer = 0;
    player.autoShootTimer = 0;
    bullets = [];
    enemies = [];
    enemyBullets = [];
    onigiri = [];
    confetti = [];
    confettiActive = false;
    enemySpawnTimer = 0;
    onigiriSpawnTimer = 0;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    updateLivesDisplay();
    gameOverElement.classList.add('hidden');
    gameLoop();
}

function gameLoop() {
    if (!gameState.running) {
        updateConfetti();
        if (confettiActive) {
            requestAnimationFrame(gameLoop);
        }
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updatePlayer();
    updateBullets();
    updateEnemies();
    updateEnemyBullets();
    updateOnigiri();
    checkBulletCollisions();
    
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }
    
    onigiriSpawnTimer++;
    if (onigiriSpawnTimer >= onigiriSpawnInterval) {
        spawnOnigiri();
        onigiriSpawnTimer = 0;
    }
    
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawEnemyBullets();
    drawOnigiri();
    
    requestAnimationFrame(gameLoop);
}

