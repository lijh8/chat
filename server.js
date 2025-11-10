const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, '192.168.1.3', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

let userCounter = 1;
const users = new Map();
const userData = new Map();

function generateUsername() {
    return `user${userCounter++}`;
}

function broadcast(message) {
    const data = JSON.stringify(message);
    users.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });
}

function broadcastUserList() {
    const userList = Array.from(userData.values()).map(user => ({
        username: user.username,
        connectionTime: user.connectionTime
    }));

    broadcast({
        type: 'userList',
        users: userList
    });
}

wss.on('connection', (ws) => {
    const username = generateUsername();
    const connectionTime = new Date().toLocaleTimeString();

    users.set(username, ws);
    userData.set(username, { username, connectionTime });

    console.log(`User ${username} connected`);

    ws.send(JSON.stringify({
        type: 'init',
        username: username
    }));

    broadcastUserList();

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'privateMessage') {
                const targetWs = users.get(message.to);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'privateMessage',
                        from: username,
                        message: message.message,
                        timestamp: new Date().toISOString()
                    }));
                }
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        users.delete(username);
        userData.delete(username);
        console.log(`User ${username} disconnected`);
        broadcastUserList();
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${username}:`, error);
    });
});
