import express from 'express';
import path from 'node:path'
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IP = '192.168.1.3';
const PORT = process.env.PORT || 8080;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
const server = app.listen(PORT, IP, () => {
    console.log(`Server running on http://${IP}:${PORT}`);
});

const wss = new WebSocketServer({ server });

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
        console.error(`WebSocket error for ${username}: `, error);
    });
});
