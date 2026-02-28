const mongoose = require('mongoose');

const stockWatchlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    notified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('StockWatchlist', stockWatchlistSchema);
