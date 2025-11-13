class MessengerApp {
    constructor() {
        this.socket = null;
        this.username = null;
        this.activeChat = null;
        this.chats = new Map();
        this.onlineUsers = new Set();
        this.serverAvailable = true;
        this.initializeApp();
    }

    initializeApp() {
        this.connectSocket();
    }

    connectSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.serverAvailable = true;
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.serverAvailable = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.serverAvailable = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('init', (data) => {
            this.handleMessage({ type: 'init', ...data });
        });

        this.socket.on('userList', (data) => {
            this.handleMessage({ type: 'userList', ...data });
        });

        this.socket.on('privateMessage', (data) => {
            this.handleMessage({ type: 'privateMessage', ...data });
        });
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/health', {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                this.serverAvailable = true;
                this.updateConnectionStatus(true);
                return true;
            } else {
                this.serverAvailable = false;
                this.updateConnectionStatus(false);
                return false;
            }
        } catch (error) {
            console.error('Server health check failed:', error);
            this.serverAvailable = false;
            this.updateConnectionStatus(false);
            return false;
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus') || this.createStatusElement();
        statusElement.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
        statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;

        this.serverAvailable = connected;
    }

    createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'connectionStatus';
        statusElement.className = 'connection-status connected';

        const userList = document.getElementById('userList');
        if (userList) {
            userList.appendChild(statusElement);
        }

        return statusElement;
    }

    handleMessage(data) {
        switch (data.type) {
            case 'init':
                this.username = data.username;
                this.updateCurrentUserDisplay();
                this.updateUserList([]);
                break;

            case 'userList':
                this.updateUserList(data.users);
                break;

            case 'privateMessage':
                this.handlePrivateMessage(data);
                break;
        }
    }

    updateCurrentUserDisplay() {
        const currentUserDiv = document.getElementById('currentUser');
        if (currentUserDiv) {
            currentUserDiv.innerHTML = `👤 ${this.username} <span style="font-style: italic;">@me</span>`;
        }
    }

    updateUserList(users) {
        this.onlineUsers.clear();
        const otherUsers = users.filter(user => user.username !== this.username);
        otherUsers.forEach(user => this.onlineUsers.add(user.username));
        const userList = document.getElementById('userList');

        const statusElement = document.getElementById('connectionStatus');

        userList.innerHTML = '';

        otherUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.textContent = `👤 ${user.username}`;
            userItem.addEventListener('click', () => this.startChat(user.username));
            userList.appendChild(userItem);
        });

        if (statusElement) {
            userList.appendChild(statusElement);
        }
    }

    startChat(targetUser) {
        if (!this.chats.has(targetUser)) {
            this.createChatTab(targetUser);
        }
        this.switchChat(targetUser);
    }

    createChatTab(targetUser) {
        if (this.chats.has(targetUser)) return;

        this.chats.set(targetUser, {
            messages: [],
            element: null
        });

        const chatTabs = document.getElementById('chatTabs');
        const tab = document.createElement('button');
        tab.className = 'chat-tab';
        tab.textContent = `👤 ${targetUser}`;
        tab.dataset.username = targetUser;
        tab.addEventListener('click', () => this.switchChat(targetUser));
        chatTabs.appendChild(tab);
        this.createChatWindow(targetUser);
    }

    createChatWindow(targetUser) {
        const chatContainer = document.getElementById('chatContainer');
        const chatWindow = document.createElement('div');
        chatWindow.className = 'chat-window';
        chatWindow.id = `chat-${targetUser}`;

        chatWindow.innerHTML = `
            <div class="messages" id="messages-${targetUser}"></div>
            <div class="message-input-container">
                <input
                    type="text"
                    class="message-input"
                    id="input-${targetUser}"
                    placeholder="Type a message..."
                >
                <button class="send-button" onclick="messenger.sendMessage('${targetUser}')">
                    Send
                </button>
            </div>
        `;

        chatContainer.appendChild(chatWindow);
        this.chats.get(targetUser).element = chatWindow;
        const input = document.getElementById(`input-${targetUser}`);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage(targetUser);
            }
        });
    }

    switchChat(targetUser) {
        document.querySelectorAll('.chat-window').forEach(chat => {
            chat.classList.remove('active');
        });

        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const chatWindow = document.getElementById(`chat-${targetUser}`);
        if (chatWindow) {
            chatWindow.classList.add('active');
        }

        const activeTab = document.querySelector(`.chat-tab[data-username="${targetUser}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        this.activeChat = targetUser;
        const input = document.getElementById(`input-${targetUser}`);
        if (input) input.focus();
    }

    handlePrivateMessage(data) {
        const { from, message, timestamp } = data;

        if (!this.chats.has(from)) {
            this.createChatTab(from);
        }

        const chat = this.chats.get(from);
        chat.messages.push({
            from,
            message,
            timestamp,
            type: 'received'
        });

        this.renderMessages(from);
    }

    async sendMessage(targetUser) {
        const input = document.getElementById(`input-${targetUser}`);
        const message = input.value.trim();
        if (!message) return;

        const isServerAvailable = await this.checkServerStatus();
        if (!isServerAvailable) {
            if (!this.chats.has(targetUser)) {
                this.createChatTab(targetUser);
            }

            const chat = this.chats.get(targetUser);
            chat.messages.push({
                from: 'System',
                message: '❌ Server unavailable. Cannot send message.',
                timestamp: new Date().toISOString(),
                type: 'error'
            });
            this.renderMessages(targetUser);
            input.value = '';
            return;
        }

        if (!this.onlineUsers.has(targetUser)) {
            if (!this.chats.has(targetUser)) {
                this.createChatTab(targetUser);
            }

            const chat = this.chats.get(targetUser);
            chat.messages.push({
                from: 'System',
                message: '⚠️ This user is offline. Messages cannot be delivered.',
                timestamp: new Date().toISOString(),
                type: 'error'
            });
            this.renderMessages(targetUser);
            return;
        }

        if (!this.chats.has(targetUser)) {
            this.createChatTab(targetUser);
        }

        const chat = this.chats.get(targetUser);
        chat.messages.push({
            from: this.username,
            message,
            timestamp: new Date().toISOString(),
            type: 'sent'
        });

        this.renderMessages(targetUser);

        this.socket.emit('privateMessage', {
            to: targetUser,
            message: message
        });

        input.value = '';
    }

    renderMessages(targetUser) {
        const chat = this.chats.get(targetUser);
        if (!chat) return;
        const messagesContainer = document.getElementById(`messages-${targetUser}`);
        messagesContainer.innerHTML = '';

        chat.messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${msg.type}`;
            const time = new Date(msg.timestamp).toLocaleTimeString();
            messageElement.innerHTML = `
                <div class="message-text">${this.escapeHtml(msg.message)}</div>
                <div class="message-info">
                    ${msg.type === 'sent' ? 'You' : msg.from} • ${time}
                </div>
            `;

            messagesContainer.appendChild(messageElement);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

let messenger;
document.addEventListener('DOMContentLoaded', () => {
    messenger = new MessengerApp();
});
