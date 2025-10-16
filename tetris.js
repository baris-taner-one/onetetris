// Canvas and context
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');

// Game constants
const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // J
    '#0DFF72', // L
    '#F538FF', // O
    '#FF8E0D', // S
    '#FFE138', // T
    '#3877FF'  // Z
];

// Tetromino shapes
const SHAPES = [
    null,
    [[1, 1, 1, 1]], // I
    [[2, 0, 0], [2, 2, 2]], // J
    [[0, 0, 3], [3, 3, 3]], // L
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0]], // S
    [[0, 6, 0], [6, 6, 6]], // T
    [[7, 7, 0], [0, 7, 7]]  // Z
];

// Game state
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let gameLoop = null;
let isPaused = false;
let isGameOver = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// UI elements
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverDiv = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');

// Initialize board
function createBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// Create a random piece
function createPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    return {
        shape: SHAPES[type],
        color: type,
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
        y: 0
    };
}

// Draw a block
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// Draw the board
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            ctx.strokeRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    // Draw placed blocks
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(ctx, col, row, COLORS[board[row][col]]);
            }
        }
    }
}

// Draw current piece
function drawPiece() {
    if (!currentPiece) return;

    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, COLORS[currentPiece.color]);
            }
        });
    });
}

// Draw next piece
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextPiece) return;

    const blockSize = 20;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2;

    nextPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                nextCtx.fillStyle = COLORS[nextPiece.color];
                nextCtx.fillRect(
                    offsetX + x * blockSize,
                    offsetY + y * blockSize,
                    blockSize,
                    blockSize
                );
                nextCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                nextCtx.lineWidth = 1;
                nextCtx.strokeRect(
                    offsetX + x * blockSize,
                    offsetY + y * blockSize,
                    blockSize,
                    blockSize
                );
            }
        });
    });
}

// Check collision
function collide(piece = currentPiece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const newX = piece.x + x;
                const newY = piece.y + y;

                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }

                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Merge piece to board
function merge() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        });
    });
}

// Rotate piece
function rotate() {
    const rotated = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );

    const previousShape = currentPiece.shape;
    currentPiece.shape = rotated;

    // Wall kick
    let offset = 0;
    while (collide()) {
        currentPiece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > currentPiece.shape[0].length) {
            currentPiece.shape = previousShape;
            currentPiece.x = currentPiece.x - offset + (offset > 0 ? 1 : -1);
            return;
        }
    }
}

// Move piece
function move(dir) {
    currentPiece.x += dir;
    if (collide()) {
        currentPiece.x -= dir;
        return false;
    }
    return true;
}

// Drop piece
function drop() {
    currentPiece.y++;
    if (collide()) {
        currentPiece.y--;
        merge();
        clearLines();
        spawnPiece();

        if (collide()) {
            gameOver();
        }
    }
    dropCounter = 0;
}

// Hard drop
function hardDrop() {
    while (!collide()) {
        currentPiece.y++;
        score += 2;
    }
    currentPiece.y--;
    merge();
    clearLines();
    spawnPiece();

    if (collide()) {
        gameOver();
    }
}

// Clear completed lines
function clearLines() {
    let linesCleared = 0;

    outer: for (let row = ROWS - 1; row >= 0; row--) {
        for (let col = 0; col < COLS; col++) {
            if (!board[row][col]) {
                continue outer;
            }
        }

        // Remove the line
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(0));
        linesCleared++;
        row++; // Check the same row again
    }

    if (linesCleared > 0) {
        lines += linesCleared;
        score += [0, 100, 300, 500, 800][linesCleared] * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        updateScore();
    }
}

// Spawn new piece
function spawnPiece() {
    currentPiece = nextPiece || createPiece();
    nextPiece = createPiece();
    drawNextPiece();
}

// Update score display
function updateScore() {
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
}

// Game over
function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(gameLoop);
    gameOverDiv.classList.remove('hidden');
    finalScoreElement.textContent = score;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// Game loop
function update(time = 0) {
    if (isPaused || isGameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        drop();
    }

    drawBoard();
    drawPiece();

    gameLoop = requestAnimationFrame(update);
}

// Start game
function startGame() {
    createBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    isGameOver = false;
    isPaused = false;
    dropCounter = 0;
    lastTime = 0;

    updateScore();
    gameOverDiv.classList.add('hidden');

    nextPiece = createPiece();
    spawnPiece();

    startBtn.disabled = true;
    pauseBtn.disabled = false;

    gameLoop = requestAnimationFrame(update);
}

// Pause game
function togglePause() {
    if (isGameOver) return;

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';

    if (!isPaused) {
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(update);
    }
}

// Event listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
    if (isGameOver || !currentPiece) return;

    if (e.key === 'p' || e.key === 'P') {
        togglePause();
        return;
    }

    if (isPaused) return;

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            move(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            move(1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            drop();
            score += 1;
            updateScore();
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            updateScore();
            break;
    }

    drawBoard();
    drawPiece();
});

// Initialize
createBoard();
drawBoard();
