import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import '../css/style.css';

document.addEventListener('DOMContentLoaded', () => {
    // User management
    const userTable = document.getElementById('userTable');
    if (userTable) {
        userTable.addEventListener('click', (e) => {
            const target = e.target;
            const userId = target.dataset.userId;

            if (target.classList.contains('view-user')) {
                viewUserDetails(userId);
            } else if (target.classList.contains('toggle-ban')) {
                toggleUserBan(userId);
            } else if (target.classList.contains('reset-account')) {
                resetUserAccount(userId);
            }
        });
    }

    // Withdrawal requests
    const withdrawalTable = document.getElementById('withdrawalTable');
    if (withdrawalTable) {
        withdrawalTable.addEventListener('click', (e) => {
            const target = e.target;
            const requestId = target.dataset.requestId;

            if (target.classList.contains('process-withdrawal')) {
                processWithdrawal(requestId);
            }
        });
    }

    // Game settings form
    const gameSettingsForm = document.getElementById('gameSettingsForm');
    if (gameSettingsForm) {
        gameSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateGameSettings();
        });
    }
});

// User management functions
async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`);
        const userData = await response.json();
        
        // Update modal content with user details
        document.getElementById('userDetailsContent').innerHTML = `
            <p><strong>Username:</strong> ${userData.username}</p>
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>Account Balance:</strong> $${userData.balance}</p>
            <p><strong>Games Played:</strong> ${userData.gamesPlayed}</p>
            <p><strong>Win Rate:</strong> ${userData.winRate}%</p>
        `;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        modal.show();
    } catch (error) {
        showAlert('Error fetching user details', 'danger');
    }
}

async function toggleUserBan(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-ban`, {
            method: 'POST'
        });
        const result = await response.json();
        showAlert(result.message, 'success');
        location.reload();
    } catch (error) {
        showAlert('Error updating user status', 'danger');
    }
}

async function resetUserAccount(userId) {
    if (confirm('Are you sure you want to reset this account? This action cannot be undone.')) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/reset`, {
                method: 'POST'
            });
            const result = await response.json();
            showAlert(result.message, 'success');
            location.reload();
        } catch (error) {
            showAlert('Error resetting account', 'danger');
        }
    }
}

// Withdrawal processing
async function processWithdrawal(requestId) {
    try {
        const response = await fetch(`/api/admin/withdrawals/${requestId}/process`, {
            method: 'POST'
        });
        const result = await response.json();
        showAlert(result.message, 'success');
        location.reload();
    } catch (error) {
        showAlert('Error processing withdrawal', 'danger');
    }
}

// Game settings
async function updateGameSettings() {
    const formData = new FormData(document.getElementById('gameSettingsForm'));
    try {
        const response = await fetch('/api/admin/settings', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        showAlert('Game settings updated successfully', 'success');
    } catch (error) {
        showAlert('Error updating game settings', 'danger');
    }
}

// Helper function for showing alerts
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.getElementById('alertContainer').appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
} 