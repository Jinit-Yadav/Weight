const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MONGODB CONNECTION WITH BETTER ERROR HANDLING
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jinit2003_db_user:WDKchFu3cQG9NMDU@cluster0.zbkun8d.mongodb.net/';

console.log('🔌 Attempting to connect to MongoDB...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds
})
.then(() => {
    console.log('✅ Connected to MongoDB Atlas!');
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    // Don't exit - keep the server running but with limited functionality
});

const db = mongoose.connection;
db.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
});
db.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

// ============================================================
// WEIGHT TRACKER SCHEMA
// ============================================================
const weightEntrySchema = new mongoose.Schema({
    userId: { type: String, default: 'default_user', index: true },
    weight: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const WeightEntry = mongoose.model('WeightEntry', weightEntrySchema);

// ============================================================
// ROUTES - WITH ERROR HANDLING
// ============================================================

// Health check - always works even if DB is down
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState,
        dbStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
    });
});

// GET all weight entries
app.get('/api/weights', async (req, res) => {
    try {
        // Check if DB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const userId = 'default_user';
        const entries = await WeightEntry.find({ userId }).sort({ date: -1 });
        res.json(entries);
    } catch (error) {
        console.error('GET Weights Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Stats
app.get('/api/weights/stats', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const userId = 'default_user';
        const entries = await WeightEntry.find({ userId });
        
        if (entries.length === 0) {
            return res.json({ total: 0, average: 0, min: 0, max: 0, latest: null });
        }
        
        const weights = entries.map(e => e.weight);
        const total = entries.length;
        const average = weights.reduce((a, b) => a + b, 0) / total;
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        const latest = entries[0];
        
        res.json({ 
            total, 
            average: parseFloat(average.toFixed(2)),
            min, 
            max,
            latest
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Add new weight entry
app.post('/api/weights', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const { weight, notes } = req.body;
        if (!weight || weight <= 0) {
            return res.status(400).json({ error: 'Valid weight is required' });
        }
        
        const entry = new WeightEntry({
            userId: 'default_user',
            weight: parseFloat(weight),
            notes: notes || '',
            date: new Date()
        });
        
        await entry.save();
        res.status(201).json(entry);
    } catch (error) {
        console.error('POST Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Remove a weight entry
app.delete('/api/weights/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const entry = await WeightEntry.findByIdAndDelete(req.params.id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('DELETE Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: '🏋️‍♂️ Weight Tracker API is running!',
        dbConnected: mongoose.connection.readyState === 1,
        endpoints: {
            health: '/api/health',
            weights: '/api/weights',
            stats: '/api/weights/stats'
        }
    });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
