const mongoose = require('mongoose');

const campSchema = new mongoose.Schema({
    name: { type: String, required: true },
    district: { type: String, required: true },
    capacity: { type: Number, required: true },
    occupancy: { type: Number, default: 0 },
    facilities: { type: String, default: '' },
    contact: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Camp', campSchema);
