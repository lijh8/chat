import express from 'express';
import path from 'node:path'
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IP = '192.168.1.3';
const PORT = process.env.PORT || 8080;

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, IP, () => {
    console.log(`Server running on http://${IP}:${PORT}`);
});

const io = new Server(server);

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

    io.emit('userList', { users: userList });
}

io.on('connection', (socket) => {
    const username = generateUsername();
    const connectionTime = new Date().toLocaleTimeString();

    users.set(username, socket);
    userData.set(username, { username, connectionTime });

    console.log(`User ${username} connected`);

    socket.emit('init', { username });

    broadcastUserList();

    socket.on('privateMessage', (data) => {
        try {
            const targetSocket = users.get(data.to);
            if (targetSocket) {
                targetSocket.emit('privateMessage', {
                    from: username,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Error handling private message:', error);
        }
    });

    socket.on('disconnect', () => {
        users.delete(username);
        userData.delete(username);
        console.log(`User ${username} disconnected`);
        broadcastUserList();
    });

    socket.on('error', (error) => {
        console.error(`Socket error for ${username}: `, error);
    });
});
