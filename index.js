const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();

// In-memory storage for OTPs (stores all OTPs)
const otpData = {};

// WebSocket setup
const wss = new WebSocketServer({ noServer: true });
const clients = [];
wss.on('connection', (ws) => {
    console.log('WebSocket connected');
    clients.push(ws);

    ws.on('close', () => {
        console.log('WebSocket disconnected');
        const index = clients.indexOf(ws);
        if (index > -1) {
            clients.splice(index, 1);
        }
    });
});

// Helper function for Bangladesh time (UTC+6)
function getBangladeshTime() {
    const now = new Date();
    // Add 6 hours for UTC+6 (Bangladesh has no daylight saving)
    now.setHours(now.getHours() + 6);
    
    // Format as YYYY-MM-DD HH:mm:ss
    return now.toISOString()
        .replace('T', ' ')
        .replace(/\..+/, '');
}

// Handle OTP submission or fetching
app.get('/', (req, res) => {
    const phone = req.query.phone;
    const otp = req.query.otp;
    const purpose = req.query.purpose || 'unknown';
    const timestamp = getBangladeshTime();

    if (phone && otp) {
        // Initialize array if first OTP for this number
        if (!otpData[phone]) {
            otpData[phone] = [];
        }

        // Save OTP in memory
        const otpRecord = { otp, purpose, timestamp };
        otpData[phone].unshift(otpRecord); // Add new OTP at beginning

        // Notify WebSocket clients
        const message = JSON.stringify({ phone, otp, purpose, timestamp });
        clients.forEach((ws) => ws.send(message));

        return res.status(200).json({
            message: `OTP ${otp} received for phone ${phone} (purpose: ${purpose})`,
            status: 'success',
            timestamp
        });
    }

    if (phone && !otp) {
        // Return only the latest OTP for this number
        const otpRecords = otpData[phone];
        if (otpRecords && otpRecords.length > 0) {
            const latest = otpRecords[0];
            return res.status(200).json({
                phone,
                otp: latest.otp,
                purpose: latest.purpose,
                timestamp: latest.timestamp
            });
        } else {
            return res.status(404).json({
                message: `No OTP found for phone ${phone}`,
                status: 'error',
            });
        }
    }

    // Serve frontend
    if (!phone && !otp) {
        res.sendFile(__dirname + '/public/index.html');
    } else {
        res.status(400).json({
            message: 'Invalid request. Please provide phone and/or OTP.',
            status: 'error',
        });
    }
});

// Fetch ALL historical OTP data
app.get('/fetch-otp-data', (req, res) => {
    res.json(otpData);
});

// Add this near your other route handlers in index.js
app.get('/download/Ivacfwd4.4', (req, res) => {
    res.download(__dirname + '/public/apks/Ivacfwd4.4.apk');
});

app.get('/download/smslistener', (req, res) => {
    res.download(__dirname + '/public/apks/smslistener_kolpov2_signed.apk');
});

app.get('/download/ivac', (req, res) => {
    res.download(__dirname + '/public/apks/ivac_otp_kolpo.apk');
});

// Start server
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});