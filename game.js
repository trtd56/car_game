// ゲーム設定
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // O
    '#0DFF72', // T
    '#F538FF', // S
    '#FF8E0D', // Z
    '#FFE138', // J
    '#3877FF'  // L
];

// テトロミノの形状定義
const SHAPES = [
    [], // 空
    [[1, 1, 1, 1]], // I
    [[2, 2], [2, 2]], // O
    [[0, 3, 0], [3, 3, 3]], // T
    [[0, 4, 4], [4, 4, 0]], // S
    [[5, 5, 0], [0, 5, 5]], // Z
    [[6, 0, 0], [6, 6, 6]], // J
    [[0, 0, 7], [7, 7, 7]]  // L
];

// ゲーム状態
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');

        this.board = this.createBoard();
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameOver = false;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;

        this.currentPiece = null;
        this.nextPiece = null;

        // カスタム画像用の配列
        this.blockImages = {};
        this.imagesLoaded = false;

        // オーディオ
        this.bgm = null;
        this.sounds = {};

        this.setupAudio();
        this.loadBlockImages();
        this.setupControls();
    }

    createBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    // ブロック画像の読み込み
    loadBlockImages() {
        // デフォルトでは色で描画
        // カスタム画像を使う場合は、imagesフォルダに以下のファイルを配置:
        // block_1.png, block_2.png, block_3.png, block_4.png,
        // block_5.png, block_6.png, block_7.png

        const imagePromises = [];
        for (let i = 1; i <= 7; i++) {
            const img = new Image();
            imagePromises.push(
                new Promise((resolve) => {
                    img.onload = () => {
                        this.blockImages[i] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        // 画像が読み込めない場合は色で描画
                        this.blockImages[i] = null;
                        resolve();
                    };
                    img.src = `images/block_${i}.png`;
                })
            );
        }

        Promise.all(imagePromises).then(() => {
            this.imagesLoaded = true;
            console.log('ブロック画像の読み込みが完了しました');
        });
    }

    // オーディオの設定
    setupAudio() {
        try {
            // BGM
            this.bgm = new Audio('sounds/bgm.mp3');
            this.bgm.loop = true;
            this.bgm.volume = 0.3;

            // 効果音
            this.sounds.move = new Audio('sounds/move.mp3');
            this.sounds.rotate = new Audio('sounds/rotate.mp3');
            this.sounds.drop = new Audio('sounds/drop.mp3');
            this.sounds.clear = new Audio('sounds/clear.mp3');
            this.sounds.gameOver = new Audio('sounds/gameover.mp3');

            // 音量設定
            Object.values(this.sounds).forEach(sound => {
                sound.volume = 0.5;
            });
        } catch (e) {
            console.log('オーディオ設定エラー:', e);
            // オーディオが利用できなくてもゲームは動作する
        }
    }

    playSound(soundName) {
        if (this.sounds[soundName]) {
            const sound = this.sounds[soundName].cloneNode();
            sound.play().catch(e => console.log('音声再生エラー:', e));
        }
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (this.gameOver) return;

            switch(e.key) {
                case 'ArrowLeft':
                    this.movePiece(-1);
                    this.playSound('move');
                    break;
                case 'ArrowRight':
                    this.movePiece(1);
                    this.playSound('move');
                    break;
                case 'ArrowDown':
                    this.dropPiece();
                    break;
                case 'ArrowUp':
                case ' ':
                    this.rotatePiece();
                    this.playSound('rotate');
                    e.preventDefault();
                    break;
            }

            this.draw();
        });

        // ボタンイベント
        document.getElementById('startBtn').addEventListener('click', () => {
            this.start();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.reset();
            this.start();
        });

        // タッチ/クリックコントロール
        this.setupTouchControls();
    }

    setupTouchControls() {
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const downBtn = document.getElementById('downBtn');
        const rotateBtn = document.getElementById('rotateBtn');

        // 左ボタン
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && this.currentPiece) {
                this.movePiece(-1);
                this.playSound('move');
                this.draw();
            }
        });

        leftBtn.addEventListener('click', (e) => {
            if (!this.gameOver && this.currentPiece) {
                this.movePiece(-1);
                this.playSound('move');
                this.draw();
            }
        });

        // 右ボタン
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && this.currentPiece) {
                this.movePiece(1);
                this.playSound('move');
                this.draw();
            }
        });

        rightBtn.addEventListener('click', (e) => {
            if (!this.gameOver && this.currentPiece) {
                this.movePiece(1);
                this.playSound('move');
                this.draw();
            }
        });

        // 下ボタン
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && this.currentPiece) {
                this.dropPiece();
                this.draw();
            }
        });

        downBtn.addEventListener('click', (e) => {
            if (!this.gameOver && this.currentPiece) {
                this.dropPiece();
                this.draw();
            }
        });

        // 回転ボタン
        rotateBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && this.currentPiece) {
                this.rotatePiece();
                this.playSound('rotate');
                this.draw();
            }
        });

        rotateBtn.addEventListener('click', (e) => {
            if (!this.gameOver && this.currentPiece) {
                this.rotatePiece();
                this.playSound('rotate');
                this.draw();
            }
        });

        // ボタンの有効/無効化を管理
        this.updateTouchControls();
    }

    updateTouchControls() {
        const buttons = [
            document.getElementById('leftBtn'),
            document.getElementById('rightBtn'),
            document.getElementById('downBtn'),
            document.getElementById('rotateBtn')
        ];

        buttons.forEach(btn => {
            // ゲームオーバーの時のみ無効化
            btn.disabled = this.gameOver;
        });
    }

    start() {
        if (this.gameOver) {
            this.reset();
        }

        // BGM再生を試みるが、失敗してもゲームは開始する
        if (this.bgm) {
            this.bgm.play().catch(e => {
                console.log('BGM再生エラー:', e);
                // エラーは無視してゲームを続行
            });
        }

        this.nextPiece = this.createPiece();
        this.spawnPiece();
        this.lastTime = performance.now();
        this.update(this.lastTime);

        document.getElementById('startBtn').disabled = true;
        this.updateTouchControls();
    }

    reset() {
        this.board = this.createBoard();
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameOver = false;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.currentPiece = null;
        this.nextPiece = null;

        this.updateScore();
        this.draw();

        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('startBtn').disabled = false;

        if (this.bgm) {
            try {
                this.bgm.pause();
                this.bgm.currentTime = 0;
            } catch (e) {
                console.log('BGM停止エラー:', e);
            }
        }

        this.updateTouchControls();
    }

    createPiece() {
        const type = Math.floor(Math.random() * 7) + 1;
        return {
            shape: SHAPES[type],
            type: type,
            x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
            y: 0
        };
    }

    spawnPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();

        if (this.checkCollision(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
            this.endGame();
        }

        this.drawNext();
        this.updateTouchControls();
    }

    movePiece(dir) {
        const newX = this.currentPiece.x + dir;
        if (!this.checkCollision(this.currentPiece, newX, this.currentPiece.y)) {
            this.currentPiece.x = newX;
        }
    }

    dropPiece() {
        const newY = this.currentPiece.y + 1;
        if (!this.checkCollision(this.currentPiece, this.currentPiece.x, newY)) {
            this.currentPiece.y = newY;
            this.dropCounter = 0;
        } else {
            this.lockPiece();
        }
    }

    rotatePiece() {
        const rotated = this.rotate(this.currentPiece.shape);
        const originalShape = this.currentPiece.shape;

        this.currentPiece.shape = rotated;

        if (this.checkCollision(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.shape = originalShape;
        }
    }

    rotate(shape) {
        const rotated = [];
        for (let i = 0; i < shape[0].length; i++) {
            const row = [];
            for (let j = shape.length - 1; j >= 0; j--) {
                row.push(shape[j][i]);
            }
            rotated.push(row);
        }
        return rotated;
    }

    checkCollision(piece, x, y) {
        for (let row = 0; row < piece.shape.length; row++) {
            for (let col = 0; col < piece.shape[row].length; col++) {
                if (piece.shape[row][col]) {
                    const newX = x + col;
                    const newY = y + row;

                    if (newX < 0 || newX >= COLS || newY >= ROWS) {
                        return true;
                    }

                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    lockPiece() {
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    const y = this.currentPiece.y + row;
                    const x = this.currentPiece.x + col;
                    if (y >= 0) {
                        this.board[y][x] = this.currentPiece.type;
                    }
                }
            }
        }

        this.playSound('drop');
        this.clearLines();
        this.spawnPiece();
    }

    clearLines() {
        let linesCleared = 0;

        for (let row = ROWS - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                this.board.splice(row, 1);
                this.board.unshift(Array(COLS).fill(0));
                linesCleared++;
                row++;
            }
        }

        if (linesCleared > 0) {
            this.playSound('clear');
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            this.updateScore();
        }
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }

    endGame() {
        this.gameOver = true;

        if (this.bgm) {
            try {
                this.bgm.pause();
            } catch (e) {
                console.log('BGM停止エラー:', e);
            }
        }

        this.playSound('gameOver');

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').classList.remove('hidden');
        this.updateTouchControls();
    }

    update(time = 0) {
        if (this.gameOver) return;

        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;

        if (this.dropCounter > this.dropInterval) {
            this.dropPiece();
            this.dropCounter = 0;
        }

        this.draw();
        requestAnimationFrame((t) => this.update(t));
    }

    drawBlock(x, y, type) {
        const px = x * BLOCK_SIZE;
        const py = y * BLOCK_SIZE;

        // カスタム画像が読み込まれていれば使用
        if (this.imagesLoaded && this.blockImages[type]) {
            this.ctx.drawImage(this.blockImages[type], px, py, BLOCK_SIZE, BLOCK_SIZE);
        } else {
            // 画像がない場合は色で描画
            this.ctx.fillStyle = COLORS[type];
            this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

            // グラデーション効果
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(px + BLOCK_SIZE - 4, py + 4, 4, BLOCK_SIZE - 4);
            this.ctx.fillRect(px + 4, py + BLOCK_SIZE - 4, BLOCK_SIZE - 4, 4);
        }
    }

    draw() {
        // ボードをクリア
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // グリッド描画
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= COLS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * BLOCK_SIZE, 0);
            this.ctx.lineTo(i * BLOCK_SIZE, ROWS * BLOCK_SIZE);
            this.ctx.stroke();
        }
        for (let i = 0; i <= ROWS; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * BLOCK_SIZE);
            this.ctx.lineTo(COLS * BLOCK_SIZE, i * BLOCK_SIZE);
            this.ctx.stroke();
        }

        // ボードを描画
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col]) {
                    this.drawBlock(col, row, this.board[row][col]);
                }
            }
        }

        // 現在のピースを描画
        if (this.currentPiece) {
            for (let row = 0; row < this.currentPiece.shape.length; row++) {
                for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                    if (this.currentPiece.shape[row][col]) {
                        this.drawBlock(
                            this.currentPiece.x + col,
                            this.currentPiece.y + row,
                            this.currentPiece.type
                        );
                    }
                }
            }
        }
    }

    drawNext() {
        this.nextCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

        if (!this.nextPiece) return;

        const offsetX = (4 - this.nextPiece.shape[0].length) * BLOCK_SIZE / 2;
        const offsetY = (4 - this.nextPiece.shape.length) * BLOCK_SIZE / 2;

        for (let row = 0; row < this.nextPiece.shape.length; row++) {
            for (let col = 0; col < this.nextPiece.shape[row].length; col++) {
                if (this.nextPiece.shape[row][col]) {
                    const px = offsetX + col * BLOCK_SIZE;
                    const py = offsetY + row * BLOCK_SIZE;

                    if (this.imagesLoaded && this.blockImages[this.nextPiece.type]) {
                        this.nextCtx.drawImage(
                            this.blockImages[this.nextPiece.type],
                            px, py, BLOCK_SIZE, BLOCK_SIZE
                        );
                    } else {
                        this.nextCtx.fillStyle = COLORS[this.nextPiece.type];
                        this.nextCtx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

                        this.nextCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                        this.nextCtx.lineWidth = 2;
                        this.nextCtx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                    }
                }
            }
        }
    }
}

// ゲーム開始
const game = new Game();
