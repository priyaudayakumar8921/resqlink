const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Subscriber = require('../models/Subscriber');
const Resource = require('../models/Resource');
const Volunteer = require('../models/Volunteer');
const Camp = require('../models/Camp');

// Get stats
router.get('/stats', async (req, res) => {
    try {
        const totalReports = await Report.countDocuments();
        const stats = {
            totalReports: totalReports,
            confirmedAlerts: await Report.countDocuments({ status: 'Confirmed' }),
            subscribers: await Subscriber.countDocuments()
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent feeds
router.get('/reports', async (req, res) => {
    try {
        // Fetch most recent reports from DB
        const reports = await Report.find().sort({ createdAt: -1 }).limit(50);
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit new report(s)
router.post('/reports', async (req, res) => {
    try {
        const reportsData = req.body; // Could be array (offline sync) or single object
        if (Array.isArray(reportsData)) {
            // Bulk insert for offline sync
            // First remove the string IDs to let Mongo generate ObjectIds
            const prepared = reportsData.map(r => {
                const { id, ...rest } = r;
                return { ...rest, status: 'Confirmed' }; // mark as confirmed upon sync
            });
            const inserted = await Report.insertMany(prepared);
            res.status(201).json({ message: `Successfully synced ${inserted.length} reports.`, data: inserted });
        } else {
            // Single insert
            const { id, ...rest } = reportsData;
            const newReport = new Report({ ...rest, status: 'Confirmed' });
            await newReport.save();
            res.status(201).json({ message: 'Report submitted successfully.', data: newReport });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Subscribe to alerts
router.post('/subscribe', async (req, res) => {
    try {
        const { fcmToken, phone, district } = req.body;
        if (!fcmToken || !phone || !district) {
            return res.status(400).json({ error: 'Push Token, Phone, and district are required.' });
        }
        
        // Prevent duplicate subscriptions for same token
        const existing = await Subscriber.findOne({ fcmToken });
        if (existing) {
            existing.district = district; // Update district if already subscribed
            existing.phone = phone; // Update phone as well
            await existing.save();
            return res.status(200).json({ message: 'Push subscription updated.' });
        }
        
        const newSub = new Subscriber({ fcmToken, phone, district });
        await newSub.save();
        res.status(201).json({ message: 'Successfully subscribed to Push Alerts.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RESOURCES ROUTES ---

// Get resources
router.get('/resources', async (req, res) => {
    try {
        const resources = await Resource.find().sort({ status: -1, createdAt: -1 });
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit a resource request
router.post('/resources', async (req, res) => {
    try {
        const newResource = new Resource(req.body);
        await newResource.save();
        res.status(201).json(newResource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark resource as fulfilled
router.patch('/resources/:id/fulfill', async (req, res) => {
    try {
        const updated = await Resource.findByIdAndUpdate(req.params.id, { status: 'Fulfilled' }, { new: true });
        if (!updated) return res.status(404).json({ error: 'Resource not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- VOLUNTEER ROUTES ---

// Get volunteers
router.get('/volunteers', async (req, res) => {
    try {
        const volunteers = await Volunteer.find().sort({ createdAt: -1 });
        res.json(volunteers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Register volunteer
router.post('/volunteers', async (req, res) => {
    try {
        const newVol = new Volunteer(req.body);
        await newVol.save();
        res.status(201).json(newVol);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- WEATHER ALERTS ROUTE (LIVE METEOROLOGICAL DATA) ---
const districtsData = [
    { name: "Kasaragod", lat: 12.51020, lng: 74.98520 },
    { name: "Kannur", lat: 11.87450, lng: 75.37040 },
    { name: "Wayanad", lat: 11.68540, lng: 76.13200 },
    { name: "Kozhikode", lat: 11.25880, lng: 75.78040 },
    { name: "Malappuram", lat: 11.07350, lng: 76.07400 },
    { name: "Palakkad", lat: 10.78670, lng: 76.65470 },
    { name: "Thrissur", lat: 10.52760, lng: 76.21440 },
    { name: "Ernakulam", lat: 9.98160, lng: 76.29990 },
    { name: "Idukki", lat: 9.91890, lng: 77.10250 },
    { name: "Kottayam", lat: 9.59160, lng: 76.52200 },
    { name: "Alappuzha", lat: 9.49810, lng: 76.33880 },
    { name: "Pathanamthitta", lat: 9.26480, lng: 76.78700 },
    { name: "Kollam", lat: 8.89320, lng: 76.61410 },
    { name: "Thiruvananthapuram", lat: 8.52410, lng: 76.93660 }
];

let weatherCache = {
    data: [],
    lastFetch: 0
};

router.get('/weather-alerts', async (req, res) => {
    const now = Date.now();
    // Cache for 10 minutes (600000 ms) to avoid spamming the free API
    if (now - weatherCache.lastFetch < 600000) {
        return res.json(weatherCache.data);
    }

    try {
        const lats = districtsData.map(d => d.lat).join(',');
        const lngs = districtsData.map(d => d.lng).join(',');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&daily=precipitation_sum&timezone=auto&forecast_days=1`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather API fetch failed');
        const data = await response.json();

        const alerts = [];
        districtsData.forEach((district, index) => {
            const distData = Array.isArray(data) ? data[index] : data;
            const precip = distData.daily.precipitation_sum[0] || 0;
            
            let level = 'Green';
            let message = 'No significant rainfall expected.';
            
            // IMD standard thresholds for 24h rainfall
            if (precip > 204.4) {
                level = 'Red';
                message = `Extremely Heavy Rainfall Expected (${precip}mm). High risk of flash floods and landslides.`;
            } else if (precip > 115.5) {
                level = 'Orange';
                message = `Heavy to Very Heavy Rainfall (${precip}mm). Be prepared.`;
            } else if (precip > 64.5) {
                level = 'Yellow';
                message = `Moderate to Heavy Rainfall (${precip}mm). Be updated.`;
            }

            if (level !== 'Green') {
                alerts.push({ district: district.name, level, message });
            }
        });

        weatherCache = {
            data: alerts,
            lastFetch: now
        };

        res.json(alerts);
    } catch (error) {
        console.error('Weather fetch error:', error);
        res.json(weatherCache.data || []);
    }
});

// --- RELIEF CAMPS ROUTES ---

// Get all camps
router.get('/camps', async (req, res) => {
    try {
        const camps = await Camp.find().sort({ createdAt: -1 });
        res.json(camps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new camp (Admin)
router.post('/camps', async (req, res) => {
    try {
        const newCamp = new Camp(req.body);
        await newCamp.save();
        res.status(201).json(newCamp);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ADMIN ROUTES ---

// Admin Login
router.post('/admin/login', (req, res) => {
    const { password } = req.body;
    // Hardcoded password for basic auth as per plan
    if (password === 'admin123') {
        res.status(200).json({ success: true, token: 'admin-token-777' });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Get all subscribers
router.get('/subscribers', async (req, res) => {
    try {
        const subs = await Subscriber.find().sort({ createdAt: -1 });
        res.json(subs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Broadcast SMS / Push
router.post('/subscribers/broadcast', async (req, res) => {
    try {
        const { district, message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });
        
        let filter = { status: 'Approved' };
        if (district && district !== 'All') {
            filter.district = district;
        }

        const targets = await Subscriber.find(filter);
        if (targets.length === 0) {
            return res.status(404).json({ error: 'No approved subscribers found in this district' });
        }

        const tokens = targets.map(t => t.fcmToken);

        // --- TWILIO WHATSAPP INTEGRATION ---
        let waSuccess = 0;
        let waFail = 0;
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const twilio = require('twilio');
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            
            for (const sub of targets) {
                if (sub.phone) {
                    try {
                        const formattedPhone = sub.phone.startsWith('+') ? sub.phone : '+91' + sub.phone;
                        await client.messages.create({
                            body: message,
                            from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886', // Default Sandbox number
                            to: `whatsapp:${formattedPhone}`
                        });
                        waSuccess++;
                    } catch (err) {
                        console.error(`WhatsApp dispatch failed for ${sub.phone}:`, err.message);
                        waFail++;
                    }
                }
            }
            console.log(`[WHATSAPP BROADCAST] Success: ${waSuccess}, Failed: ${waFail}`);
        }

        // Send multicast via Firebase Admin
        const { getMessaging } = require('firebase-admin/messaging');
        const { getApps } = require('firebase-admin/app');
        
        if (getApps().length === 0) {
            console.warn('[PUSH BROADCAST SIMULATION] Firebase Admin not initialized. Simulated push to', tokens.length, 'devices.');
            return res.json({ message: `(Simulated) Dispatched alerts to ${tokens.length} devices.` });
        }

        const payload = {
            notification: {
                title: 'Resqlink Emergency Alert',
                body: message
            },
            tokens: tokens
        };

        const response = await getMessaging().sendEachForMulticast(payload);
        
        console.log(`[PUSH BROADCAST] Success: ${response.successCount}, Failed: ${response.failureCount}`);
        
        res.json({ message: `Successfully dispatched alerts. Push: ${response.successCount} verified devices. WhatsApp: ${waSuccess} numbers.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk Approve Subscribers
router.patch('/subscribers/bulk-approve', async (req, res) => {
    try {
        const result = await Subscriber.updateMany({ status: 'Pending' }, { status: 'Approved' });
        res.json({ message: `Approved ${result.modifiedCount} subscribers.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve Single Subscriber
router.patch('/subscribers/:id/approve', async (req, res) => {
    try {
        const updated = await Subscriber.findByIdAndUpdate(req.params.id, { status: 'Approved' }, { new: true });
        if (!updated) return res.status(404).json({ error: 'Subscriber not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Subscriber
router.delete('/subscribers/:id', async (req, res) => {
    try {
        const deleted = await Subscriber.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Subscriber not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Report Status
router.patch('/reports/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!updated) return res.status(404).json({ error: 'Report not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Report
router.delete('/reports/:id', async (req, res) => {
    try {
        const deleted = await Report.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Report not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
