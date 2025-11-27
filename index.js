import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IP = '192.168.1.17';
const PORT = process.env.PORT || 8080;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

function broadcastUserList() {
    const userList = Array.from(userData.values()).map(user => ({
        username: user.username,
        connectionTime: user.connectionTime
    }));

    const message = JSON.stringify({ type: 'userList', users: userList });

    users.forEach((ws, username) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    const username = generateUsername();
    const connectionTime = new Date().toLocaleTimeString();

    users.set(username, ws);
    userData.set(username, { username, connectionTime });

    console.log(`User ${username} connected`);

    ws.send(JSON.stringify({ type: 'init', username }));

    broadcastUserList();

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'privateMessage') {
                const targetSocket = users.get(message.to);
                if (targetSocket && targetSocket.readyState === targetSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: 'privateMessage',
                        from: username,
                        message: message.message,
                        timestamp: new Date().toISOString()
                    }));
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
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
