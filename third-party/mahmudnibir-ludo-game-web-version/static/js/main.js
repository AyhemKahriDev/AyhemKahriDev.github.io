// Game board configuration
const BOARD_SIZE = 15;
const CELL_SIZE = 40;
const TOKEN_SIZE = 30;
const COLORS = {
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff'
};

// Game state
let gameState = {
    board: null,
    players: [],
    currentTurn: null,
    diceValue: null,
    selectedToken: null,
    gameStarted: false
};

// Initialize game board
function initializeBoard() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    
    // Create grid cells
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.position = 'absolute';
            cell.style.left = j * CELL_SIZE + 'px';
            cell.style.top = i * CELL_SIZE + 'px';
            cell.style.width = CELL_SIZE + 'px';
            cell.style.height = CELL_SIZE + 'px';
            cell.style.border = '1px solid #ccc';
            cell.dataset.row = i;
            cell.dataset.col = j;
            board.appendChild(cell);
        }
    }
    
    // Add home bases
    addHomeBase('red', 0, 0);
    addHomeBase('green', 0, BOARD_SIZE - 4);
    addHomeBase('yellow', BOARD_SIZE - 4, BOARD_SIZE - 4);
    addHomeBase('blue', BOARD_SIZE - 4, 0);
    
    // Add start positions
    addStartPosition('red', 6, 0);
    addStartPosition('green', 0, 6);
    addStartPosition('yellow', 8, BOARD_SIZE - 1);
    addStartPosition('blue', BOARD_SIZE - 1, 8);
}

// Add home base for a player
function addHomeBase(color, row, col) {
    const base = document.createElement('div');
    base.className = 'home-base';
    base.style.position = 'absolute';
    base.style.left = col * CELL_SIZE + 'px';
    base.style.top = row * CELL_SIZE + 'px';
    base.style.width = CELL_SIZE * 4 + 'px';
    base.style.height = CELL_SIZE * 4 + 'px';
    base.style.backgroundColor = COLORS[color];
    base.style.opacity = '0.3';
    base.style.border = '2px solid ' + COLORS[color];
    document.getElementById('gameBoard').appendChild(base);
}

// Add start position for a player
function addStartPosition(color, row, col) {
    const start = document.createElement('div');
    start.className = 'start-position';
    start.style.position = 'absolute';
    start.style.left = col * CELL_SIZE + 'px';
    start.style.top = row * CELL_SIZE + 'px';
    start.style.width = CELL_SIZE + 'px';
    start.style.height = CELL_SIZE + 'px';
    start.style.backgroundColor = COLORS[color];
    start.style.opacity = '0.5';
    document.getElementById('gameBoard').appendChild(start);
}

// Create a token
function createToken(color, index) {
    const token = document.createElement('div');
    token.className = 'token';
    token.style.backgroundColor = COLORS[color];
    token.style.width = TOKEN_SIZE + 'px';
    token.style.height = TOKEN_SIZE + 'px';
    token.style.borderRadius = '50%';
    token.style.position = 'absolute';
    token.style.cursor = 'pointer';
    token.style.zIndex = '1';
    token.dataset.index = index;
    token.dataset.color = color;
    
    token.addEventListener('click', () => handleTokenClick(token));
    
    return token;
}

// Handle token click
function handleTokenClick(token) {
    if (!gameState.gameStarted || gameState.currentTurn !== currentUserId) {
        return;
    }
    
    const color = token.dataset.color;
    const index = parseInt(token.dataset.index);
    
    if (gameState.selectedToken === token) {
        // Deselect token
        token.style.transform = 'scale(1)';
        gameState.selectedToken = null;
    } else {
        // Select token
        if (gameState.selectedToken) {
            gameState.selectedToken.style.transform = 'scale(1)';
        }
        token.style.transform = 'scale(1.2)';
        gameState.selectedToken = token;
        
        // Make move
        makeMove(color, index);
    }
}

// Make a move
function makeMove(color, index) {
    if (!gameState.diceValue) {
        return;
    }
    
    const move = {
        color: color,
        index: index,
        diceValue: gameState.diceValue
    };
    
    socket.emit('make_move', {
        room: gameId,
        move: move
    });
}

// Update game state
function updateGameState(state) {
    gameState = state;
    
    // Update player list
    updatePlayerList(state.players);
    
    // Update current turn
    document.getElementById('currentTurn').textContent = 
        state.players.find(p => p.id === state.currentTurn)?.username || '-';
    
    // Update tokens
    updateTokens(state);
    
    // Update dice
    if (state.diceValue) {
        document.getElementById('dice').textContent = state.diceValue;
    }
}

// Update player list
function updatePlayerList(players) {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = players.map(player => `
        <div class="d-flex align-items-center mb-2">
            <div class="token" style="background-color: ${COLORS[player.color]}"></div>
            <span class="ms-2">${player.username}</span>
        </div>
    `).join('');
}

// Update tokens on the board
function updateTokens(state) {
    // Remove all existing tokens
    const tokens = document.querySelectorAll('.token');
    tokens.forEach(token => token.remove());
    
    // Add tokens based on state
    state.players.forEach(player => {
        player.tokens.forEach((token, index) => {
            if (!token.is_home) {
                const tokenElement = createToken(player.color, index);
                tokenElement.style.left = token.position[1] * CELL_SIZE + (CELL_SIZE - TOKEN_SIZE) / 2 + 'px';
                tokenElement.style.top = token.position[0] * CELL_SIZE + (CELL_SIZE - TOKEN_SIZE) / 2 + 'px';
                document.getElementById('gameBoard').appendChild(tokenElement);
            }
        });
    });
}

// Handle dice roll
document.getElementById('dice').addEventListener('click', () => {
    if (gameState.currentTurn === currentUserId) {
        socket.emit('roll_dice', { room: gameId });
    }
});

// Handle chat message
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

// Handle game over
function handleGameOver(data) {
    const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const message = document.getElementById('gameOverMessage');
    message.textContent = data.winner === currentUserId 
        ? 'Congratulations! You won!' 
        : `Game Over! ${data.winnerName} won!`;
    modal.show();
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    
    // Join game room
    socket.emit('join_game', {
        room: gameId,
        player: {
            id: currentUserId,
            username: currentUsername,
            color: playerColor
        }
    });
});

// Dark Mode Toggle
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle.querySelector('i');
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
    
    function updateThemeIcon(theme) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
});

// Flash Message Auto-dismiss
document.addEventListener('DOMContentLoaded', () => {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.classList.add('fade');
            setTimeout(() => alert.remove(), 150);
        }, 5000);
    });
});

// Form Validation
document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
});

// Loading State for Buttons
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('button[type="submit"]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.form && button.form.checkValidity()) {
                button.disabled = true;
                button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
            }
        });
    });
});

// Smooth Scroll
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Tooltip Initialization
document.addEventListener('DOMContentLoaded', () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// Responsive Table
document.addEventListener('DOMContentLoaded', () => {
    const tables = document.querySelectorAll('.table-responsive');
    tables.forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
});

// Copy to Clipboard
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-copy]').forEach(element => {
        element.addEventListener('click', async () => {
            const text = element.getAttribute('data-copy');
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
    });
});

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.appendChild(toast);
    
    document.body.appendChild(container);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        container.remove();
    });
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle Function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Local Storage Helper
const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
    },
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing from localStorage:', e);
        }
    }
};

// Export functions for use in other files
window.utils = {
    showToast,
    debounce,
    throttle,
    storage
}; 