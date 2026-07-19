const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    district: { type: String, required: true },
    skills: { type: String, default: '' },
    equipment: { type: String, default: '' },
    status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
