import io from 'socket.io-client';
import { BOARD_SIZE, CELL_SIZE, TOKEN_SIZE, COLORS } from './config';

// Game state
let gameState = {
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    players: [],
    currentTurn: null,
    diceValue: null,
    selectedToken: null,
    gameStarted: false
};

// Initialize game board
function initBoard() {
    const board = document.getElementById('gameBoard');
    board.style.width = `${BOARD_SIZE * CELL_SIZE}px`;
    board.style.height = `${BOARD_SIZE * CELL_SIZE}px`;

    // Create cells
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width = `${CELL_SIZE}px`;
            cell.style.height = `${CELL_SIZE}px`;
            board.appendChild(cell);
        }
    }

    // Add home bases and start positions
    addHomeBases();
    addStartPositions();
}

// Socket connection
const socket = io();

// Event listeners
document.getElementById('dice').addEventListener('click', () => {
    if (gameState.currentTurn === currentPlayerId) {
        socket.emit('roll_dice', { room: gameId });
    }
});

document.getElementById('sendMessage').addEventListener('click', () => {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('chat_message', {
            room: gameId,
            message: message
        });
        input.value = '';
    }
});

// Socket event handlers
socket.on('game_state', (state) => {
    updateGameState(state);
});

socket.on('chat_message', (data) => {
    addChatMessage(data);
});

socket.on('game_over', (data) => {
    showGameOver(data);
});

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    initBoard();
    joinGame();
}); 