class MessengerApp {
    constructor() {
        this.ws = null;
        this.username = null;
        this.activeChat = null;
        this.chats = new Map();
        this.onlineUsers = new Set();
        this.initializeApp();
    }

    initializeApp() {
        this.connectWebSocket();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        this.ws.onclose = () => {
            setTimeout(() => this.connectWebSocket(), 3000);
        };
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
        userList.innerHTML = '';

        otherUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.textContent = `👤 ${user.username}`;
            userItem.addEventListener('click', () => this.startChat(user.username));
            userList.appendChild(userItem);
        });
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

    sendMessage(targetUser) {
        const input = document.getElementById(`input-${targetUser}`);
        const message = input.value.trim();
        if (!message) return;

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
        this.ws.send(JSON.stringify({
            type: 'privateMessage',
            to: targetUser,
            message: message
        }));

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
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

let messenger;
document.addEventListener('DOMContentLoaded', () => {
    messenger = new MessengerApp();
});
