const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
    fcmToken: { type: String, required: true },
    phone: { type: String, required: true },
    district: { type: String, required: true },
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscriber', subscriberSchema);
