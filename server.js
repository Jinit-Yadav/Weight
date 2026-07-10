const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MONGODB CONNECTION
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jinit2003_db_user:WDKchFu3cQG9NMDU@cluster0.zbkun8d.mongodb.net/';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, '❌ Connection error:'));
db.once('open', () => console.log('✅ Connected to MongoDB Atlas!'));

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
// ROUTES - WEIGHT TRACKER (FIXED - No userId required)
// ============================================================

// GET all weight entries (uses default_user)
app.get('/api/weights', async (req, res) => {
    try {
        const userId = 'default_user';
        const entries = await WeightEntry.find({ userId }).sort({ date: -1 });
        res.json(entries);
    } catch (error) {
        console.error('GET Weights Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET all weight entries for a specific user (optional)
app.get('/api/weights/user/:userId?', async (req, res) => {
    try {
        const userId = req.params.userId || 'default_user';
        const entries = await WeightEntry.find({ userId }).sort({ date: -1 });
        res.json(entries);
    } catch (error) {
        console.error('GET Weights Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET latest weight entry
app.get('/api/weights/latest', async (req, res) => {
    try {
        const userId = 'default_user';
        const entry = await WeightEntry.findOne({ userId }).sort({ date: -1 });
        res.json(entry || null);
    } catch (error) {
        console.error('GET Latest Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Add new weight entry
app.post('/api/weights', async (req, res) => {
    try {
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

// DELETE - Clear all entries
app.delete('/api/weights/clear', async (req, res) => {
    try {
        const userId = 'default_user';
        await WeightEntry.deleteMany({ userId });
        res.json({ message: 'All entries cleared' });
    } catch (error) {
        console.error('Clear Weights Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Stats (average, min, max, total)
app.get('/api/weights/stats', async (req, res) => {
    try {
        const userId = 'default_user';
        const entries = await WeightEntry.find({ userId });
        
        if (entries.length === 0) {
            return res.json({ 
                total: 0, 
                average: 0, 
                min: 0, 
                max: 0,
                latest: null
            });
        }
        
        const weights = entries.map(e => e.weight);
        const total = entries.length;
        const average = weights.reduce((a, b) => a + b, 0) / total;
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        const latest = entries[0]; // sorted by date descending
        
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

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        routes: [
            '/api/weights',
            '/api/weights/latest',
            '/api/weights/stats',
            '/api/weights/user/:userId'
        ]
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: '🏋️‍♂️ Weight Tracker API is running!',
        endpoints: {
            health: '/api/health',
            weights: {
                get: '/api/weights',
                post: '/api/weights',
                delete: '/api/weights/:id',
                clear: '/api/weights/clear',
                stats: '/api/weights/stats',
                latest: '/api/weights/latest',
                getUser: '/api/weights/user/:userId'
            }
        }
    });
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📍 Weight entries: http://localhost:${PORT}/api/weights`);
});
