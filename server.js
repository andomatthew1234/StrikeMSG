const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running! Access it at http://localhost:${PORT}`);
});

// Attach a WebSocket server to our HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
    socket.on('message', (rawData) => {
        try {
            // Parse the incoming string into a structured JSON object
            const messageData = JSON.parse(rawData.toString());
            
            // Broadcast the JSON string back out to EVERY open client
            wss.clients.forEach((client) => {
                if (client.readyState === 1) { // 1 means OPEN
                    client.send(JSON.stringify(messageData));
                }
            });
        } catch (err) {
            console.error("Error processing incoming message payload:", err);
        }
    });
});