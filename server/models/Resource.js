const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    intent: { type: String, required: true, enum: ['Need', 'Donate'] },
    type: { type: String, required: true },
    quantity: { type: String, required: true },
    location: { type: String, required: true },
    contact: { type: String, required: true },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Fulfilled'] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);
