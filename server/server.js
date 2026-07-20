require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
const { initializeApp, cert } = require('firebase-admin/app');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log('Successfully initialized Firebase Admin.');
    } catch (e) {
        console.error('Failed to parse firebase-service-account.json:', e.message);
    }
} else {
    console.warn('WARN: firebase-service-account.json is missing. Push broadcasts will fail.');
}

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/resqlink';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch((err) => {
        console.error('MongoDB connection error. Please ensure MongoDB is running.');
        console.error(err);
    });

// Mount Routes
app.use('/api', apiRoutes);

// Base route for testing
app.get('/', (req, res) => {
    res.send('Resqlink Backend API is running.');
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    socket.join('sos-room');

    socket.on('sos-message', (data) => {
        // Broadcast user message
        io.to('sos-room').emit('sos-message', {
            id: Date.now(),
            sender: data.sender || 'Anonymous',
            role: data.role || 'User',
            message: data.message,
            location: data.location || null,
            timestamp: new Date().toISOString()
        });

        // Automated AI Bot Reply
        if (data.role === 'User') {
            setTimeout(() => {
                let aiResponse = "Emergency acknowledged. Rescue teams have been notified of your distress signal. Please stay calm.";
                
                const msgLower = data.message.toLowerCase();
                if (msgLower.includes('flood') || msgLower.includes('water')) {
                    aiResponse = "Flood distress logged. Move to the highest possible ground immediately. Do not walk or drive through flood waters. Rescue boats are being routed.";
                } else if (msgLower.includes('fire')) {
                    aiResponse = "Fire emergency logged. Evacuate the area immediately. Stay low to the ground to avoid smoke inhalation.";
                } else if (msgLower.includes('medical') || msgLower.includes('heart') || msgLower.includes('bleeding') || msgLower.includes('hurt')) {
                    aiResponse = "Medical emergency logged. An ambulance is being routed. Do not move the injured person unless they are in immediate danger.";
                } else if (msgLower.includes('landslide') || msgLower.includes('earthquake')) {
                    aiResponse = "Landslide distress logged. Move away from steep slopes, unstable structures, and power lines immediately.";
                }

                if (data.location && data.location !== 'Location Denied' && data.location !== 'Location Unsupported') {
                    aiResponse += ` (Target lock acquired at coordinates: ${data.location})`;
                }

                io.to('sos-room').emit('sos-message', {
                    id: Date.now() + 1,
                    sender: 'Resqlink AI Responder',
                    role: 'Bot',
                    message: aiResponse,
                    timestamp: new Date().toISOString()
                });
            }, 800); // Slight delay to feel like a real bot typing

            // Forward to Control Room via WhatsApp
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                try {
                    const twilio = require('twilio');
                    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                    const controlRoomNumber = '+919074242334';
                    
                    const waMsg = `🚨 *URGENT SOS DISTRESS SIGNAL* 🚨\n\n*Message:* ${data.message}\n*Location:* ${data.location || 'Unknown Coordinates'}\n\n_Auto-forwarded from Resqlink System_`;
                    
                    client.messages.create({
                        body: waMsg,
                        from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
                        to: `whatsapp:${controlRoomNumber}`
                    }).then(message => console.log(`[SOS] Forwarded to Control Room (${controlRoomNumber}). SID: ${message.sid}`))
                      .catch(err => console.error('[SOS] Failed to forward to Control Room:', err.message));
                } catch (e) {
                    console.error('Twilio initialization failed in SOS:', e.message);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
