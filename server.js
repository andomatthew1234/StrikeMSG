const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const chatFile = path.join(__dirname, 'chat.csv');

// Initialize the CSV file with headers if it doesn't exist yet
if (!fs.existsSync(chatFile)) {
    fs.writeFileSync(chatFile, 'senderId,username,text\n');
}

// Helper to escape commas and quotes for CSV format
function escapeCSV(str) {
    return `"${String(str).replace(/"/g, '""')}"`;
}

// Helper to parse a CSV line properly (ignoring commas inside quotes)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } 
            else { inQuotes = !inQuotes; }
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += line[i];
        }
    }
    result.push(current);
    return result;
}

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running! Access it at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
    // 1. SEND HISTORY ON CONNECT
    try {
        const content = fs.readFileSync(chatFile, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        const history = [];
        
        // Skip header line (index 0)
        for (let i = 1; i < lines.length; i++) {
            const [senderId, username, text] = parseCSVLine(lines[i]);
            history.push({ senderId, username, text });
        }
        
        // Send history payload
        socket.send(JSON.stringify({ type: 'history', data: history }));
    } catch (err) {
        console.error("Error reading history:", err);
    }

    // 2. HANDLE INCOMING MESSAGES
    socket.on('message', (rawData) => {
        try {
            const messageData = JSON.parse(rawData.toString());
            
            // Append to CSV file permanently
            const csvLine = `${escapeCSV(messageData.senderId)},${escapeCSV(messageData.username)},${escapeCSV(messageData.text)}\n`;
            fs.appendFileSync(chatFile, csvLine);
            
            // Broadcast to everyone else (tagging it as a single message)
            const broadcastPayload = { type: 'message', data: messageData };
            
            wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(broadcastPayload));
                }
            });
        } catch (err) {
            console.error("Error processing message:", err);
        }
    });
});