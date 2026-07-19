const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    type: { type: String, required: true },
    district: { type: String, required: true },
    village: { type: String, required: true },
    coordinates: { type: String, required: true },
    details: { type: String, required: true },
    photo: { type: String, default: '' },
    status: { type: String, default: 'Confirmed' },
    timestamp: { type: String, default: 'Just now' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
