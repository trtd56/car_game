const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('finalScore');
const gameOverScreen = document.getElementById('gameOver');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const livesElement = document.getElementById('lives');

// 効果音を作成（Web Audio API）
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playCollisionSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 100;
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// BGMを読み込む
const bgm = new Audio();
bgm.loop = true; // ループ再生
bgm.volume = 0.3; // 音量を30%に設定
bgm.src = 'bgm.mp3'; // BGMファイルのパスを指定（同じフォルダに「bgm.mp3」という名前で音楽ファイルを置く）

// BGMを再生する関数
function playBGM() {
    bgm.play().catch(err => {
        console.log('BGM再生エラー:', err);
    });
}

// BGMを停止する関数
function stopBGM() {
    bgm.pause();
    bgm.currentTime = 0;
}

// キャンバスサイズの設定
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // リサイズ後にプレイヤー位置も更新
    if (gameState === 'playing') {
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 100; // 画面下から100pxの位置に配置
        player.targetX = player.x;
    }
}

// ページ読み込み後に初期化
window.addEventListener('load', () => {
    resizeCanvas();
});
window.addEventListener('resize', resizeCanvas);

// ゲーム状態
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let gameSpeed = 3; // スピードを落とす（5→3）
let roadOffset = 0;
let lives = 3; // ライフ
let invincible = false; // 無敵時間
let invincibleTimer = 0;

// プレイヤー
const player = {
    width: 200,
    height: 200,
    x: 0,
    y: 0,
    targetX: 0,
    speed: 0.15,
    slowdown: 1.0, // 減速係数（1.0=通常、0.3=減速中）
    image: null,
    useImage: false
};

// プレイヤー画像を読み込む
const playerImage = new Image();
playerImage.onload = function() {
    player.image = playerImage;
    player.useImage = true;

    // 画像の縦横比を計算して、200pxの範囲内に収める
    const maxSize = 200;
    const aspectRatio = playerImage.width / playerImage.height;

    if (aspectRatio > 1) {
        // 横長の画像
        player.width = maxSize;
        player.height = maxSize / aspectRatio;
    } else {
        // 縦長または正方形の画像
        player.height = maxSize;
        player.width = maxSize * aspectRatio;
    }
};
// 画像ファイルのパスを指定（同じフォルダに「player.png」という名前で画像を置く）
playerImage.src = 'player.png';

// 障害物画像を読み込む
const obstacleImage = new Image();
let obstacleImageLoaded = false;
obstacleImage.onload = function() {
    obstacleImageLoaded = true;
};
// 画像ファイルのパスを指定（同じフォルダに「obstacle.png」という名前で画像を置く）
obstacleImage.src = 'obstacle.png';

// 障害物
let obstacles = [];
const obstacleSpawnTimer = {
    current: 0,
    interval: 60 // 障害物の出現間隔を短く（120→60）
};

// ライフ表示を更新
function updateLivesDisplay() {
    livesElement.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        livesElement.innerHTML += '❤️';
    }
}

// 道路の車線
const roadLanes = 3;
const roadWidth = 0.6; // キャンバス幅の60%

// 初期化
function init() {
    // キャンバスサイズが正しく設定されているか確認
    if (canvas.width === 0 || canvas.height === 0) {
        resizeCanvas();
    }

    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - player.height - 100; // 画面下から100pxの位置に配置
    player.targetX = player.x;
    obstacles = [];
    score = 0;
    gameSpeed = 3; // 初期スピードを遅く
    roadOffset = 0;
    obstacleSpawnTimer.current = 0;
    obstacleSpawnTimer.interval = 60; // 障害物の出現間隔を短く
    lives = 3;
    invincible = false;
    invincibleTimer = 0;
    player.slowdown = 1.0;
    scoreElement.textContent = score;
    updateLivesDisplay();

}

// 道路を描画
function drawRoad() {
    const roadX = canvas.width * (1 - roadWidth) / 2;
    const roadWidthPx = canvas.width * roadWidth;

    // 路肩
    ctx.fillStyle = '#1a5c1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 道路
    ctx.fillStyle = '#555';
    ctx.fillRect(roadX, 0, roadWidthPx, canvas.height);

    // 車線の白線
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);

    for (let i = 1; i < roadLanes; i++) {
        const laneX = roadX + (roadWidthPx / roadLanes) * i;
        ctx.beginPath();
        ctx.moveTo(laneX, -roadOffset);
        ctx.lineTo(laneX, canvas.height - roadOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(laneX, -roadOffset + canvas.height);
        ctx.lineTo(laneX, canvas.height * 2 - roadOffset);
        ctx.stroke();
    }

    ctx.setLineDash([]);

    // 路肩の線
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(roadX, 0);
    ctx.lineTo(roadX, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(roadX + roadWidthPx, 0);
    ctx.lineTo(roadX + roadWidthPx, canvas.height);
    ctx.stroke();
}

// プレイヤーを描画
function drawPlayer() {
    // 無敵時間中は点滅
    if (invincible && Math.floor(invincibleTimer / 10) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // 画像がある場合は画像を描画、ない場合はデフォルトの車を描画
    if (player.useImage && player.image) {
        ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
    } else {
        // デバッグ用の境界線
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(player.x, player.y, player.width, player.height);

        // 車体（明るい青）
        ctx.fillStyle = '#3498db';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // 窓（水色）
        ctx.fillStyle = '#5dade2';
        ctx.fillRect(player.x + 5, player.y + 10, player.width - 10, player.height * 0.3);

        // フロントガラス部分（明るい水色）
        ctx.fillStyle = '#85c1e9';
        ctx.fillRect(player.x + 8, player.y + player.height * 0.5, player.width - 16, player.height * 0.2);

        // ライト（黄色）
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(player.x + 5, player.y + player.height - 8, 10, 6);
        ctx.fillRect(player.x + player.width - 15, player.y + player.height - 8, 10, 6);
    }

    ctx.globalAlpha = 1.0;
}

// 障害物を描画
function drawObstacle(obstacle) {
    // 衝突時の点滅エフェクト
    if (obstacle.hit && obstacle.blinkTimer > 0) {
        if (Math.floor(obstacle.blinkTimer / 3) % 2 === 0) {
            ctx.globalAlpha = 0.3;
        }
    }

    // 画像がある場合は画像を描画、ない場合はデフォルトの車を描画
    if (obstacleImageLoaded) {
        ctx.drawImage(obstacleImage, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    } else {
        // 車体
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // 窓
        ctx.fillStyle = '#34495e';
        ctx.fillRect(obstacle.x + 5, obstacle.y + obstacle.height * 0.6, obstacle.width - 10, obstacle.height * 0.3);

        // ライト
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(obstacle.x + 5, obstacle.y + 5, 8, 5);
        ctx.fillRect(obstacle.x + obstacle.width - 13, obstacle.y + 5, 8, 5);
    }

    ctx.globalAlpha = 1.0;
}

// 障害物を生成
function spawnObstacle() {
    const roadX = canvas.width * (1 - roadWidth) / 2;
    const roadWidthPx = canvas.width * roadWidth;
    const laneWidth = roadWidthPx / roadLanes;
    const lane = Math.floor(Math.random() * roadLanes);
    const laneX = roadX + laneWidth * lane + laneWidth / 2;

    const colors = ['#e74c3c', '#e67e22', '#9b59b6', '#2c3e50'];

    obstacles.push({
        x: laneX - 40,
        y: -80,
        width: 80,
        height: 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        hit: false,
        blinkTimer: 0
    });
}

// 衝突判定
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 道路内に収める
function keepPlayerOnRoad() {
    const roadX = canvas.width * (1 - roadWidth) / 2;
    const roadWidthPx = canvas.width * roadWidth;

    if (player.targetX < roadX) {
        player.targetX = roadX;
    }
    if (player.targetX + player.width > roadX + roadWidthPx) {
        player.targetX = roadX + roadWidthPx - player.width;
    }
}

// マウス/タッチ操作
function handlePointerMove(e) {
    if (gameState !== 'playing') return;

    let clientX;
    if (e.touches) {
        clientX = e.touches[0].clientX;
    } else {
        clientX = e.clientX;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;

    player.targetX = canvasX - player.width / 2;
    keepPlayerOnRoad();
}

canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('touchmove', handlePointerMove);

// ゲーム開始
startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameState = 'playing';
    resizeCanvas(); // キャンバスサイズを確実に設定
    init();
    playBGM(); // BGMを再生
    gameLoop();
});

// リスタート
restartBtn.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    gameState = 'playing';
    resizeCanvas(); // キャンバスサイズを確実に設定
    init();
    playBGM(); // BGMを再生
    gameLoop();
});

// ゲームループ
function gameLoop() {
    if (gameState !== 'playing') return;

    // クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 道路のアニメーション（減速効果を適用）
    roadOffset += gameSpeed * player.slowdown;
    if (roadOffset >= canvas.height) {
        roadOffset = 0;
    }

    // 減速効果を徐々に元に戻す
    if (player.slowdown < 1.0) {
        player.slowdown += 0.01; // ゆっくり加速（0.02→0.01）
        if (player.slowdown > 1.0) {
            player.slowdown = 1.0;
        }
    }

    // 描画
    drawRoad();

    // プレイヤーの移動（スムーズに追従）
    player.x += (player.targetX - player.x) * player.speed;
    drawPlayer();

    // 障害物の生成
    obstacleSpawnTimer.current++;
    if (obstacleSpawnTimer.current >= obstacleSpawnTimer.interval) {
        spawnObstacle();
        obstacleSpawnTimer.current = 0;

        // 難易度を徐々に上げる（子供向けに控えめに）
        if (obstacleSpawnTimer.interval > 40) {
            obstacleSpawnTimer.interval -= 0.3;
        }
        if (gameSpeed < 6) {
            gameSpeed += 0.02;
        }
    }

    // 無敵時間のタイマー
    if (invincible) {
        invincibleTimer--;
        if (invincibleTimer <= 0) {
            invincible = false;
        }
    }

    // 障害物の更新と描画
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.y += gameSpeed * player.slowdown; // 減速効果を適用

        // 点滅タイマーの更新
        if (obstacle.hit) {
            obstacle.blinkTimer--;
            if (obstacle.blinkTimer <= 0) {
                obstacles.splice(i, 1);
                continue;
            }
        }

        drawObstacle(obstacle);

        // 衝突判定（無敵時間でなく、まだ衝突していない障害物のみ）
        if (!invincible && !obstacle.hit && checkCollision(player, obstacle)) {
            // 効果音を鳴らす
            playCollisionSound();

            // 障害物を点滅させて消す
            obstacle.hit = true;
            obstacle.blinkTimer = 30; // 30フレーム点滅

            // ライフを減らす
            lives--;
            updateLivesDisplay();

            // 無敵時間を設定
            invincible = true;
            invincibleTimer = 90; // 90フレーム（約1.5秒）

            // 車を減速させる
            player.slowdown = 0.15; // 15%まで大幅減速（0.3→0.15）

            // ライフが0になったらゲームオーバー
            if (lives <= 0) {
                gameState = 'gameOver';
                finalScoreElement.textContent = score;
                gameOverScreen.style.display = 'block';
                stopBGM(); // BGMを停止
                return;
            }
        }

        // 画面外に出た障害物を削除
        if (obstacle.y > canvas.height && !obstacle.hit) {
            obstacles.splice(i, 1);
            score += 10;
            scoreElement.textContent = score;
        }
    }

    requestAnimationFrame(gameLoop);
}

// 初期化
init();
