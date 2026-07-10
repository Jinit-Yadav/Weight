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
// ROUTES - WEIGHT TRACKER (FIXED - Proper route order)
// ============================================================

// GET - Stats (average, min, max, total) - MUST come before /:id routes
app.get('/api/weights/stats', async (req, res) => {
    try {
        console.log('📊 Stats endpoint called');
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

// GET - Latest weight entry
app.get('/api/weights/latest', async (req, res) => {
    try {
        console.log('📊 Latest endpoint called');
        const userId = 'default_user';
        const entry = await WeightEntry.findOne({ userId }).sort({ date: -1 });
        res.json(entry || null);
    } catch (error) {
        console.error('GET Latest Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET all weight entries
app.get('/api/weights', async (req, res) => {
    try {
        console.log('📊 GET /api/weights called');
        const userId = 'default_user';
        const entries = await WeightEntry.find({ userId }).sort({ date: -1 });
        console.log(`✅ Found ${entries.length} entries`);
        res.json(entries);
    } catch (error) {
        console.error('GET Weights Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Add new weight entry
app.post('/api/weights', async (req, res) => {
    try {
        console.log('📊 POST /api/weights called with:', req.body);
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
        console.log('✅ Entry saved:', entry);
        res.status(201).json(entry);
    } catch (error) {
        console.error('POST Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Remove a weight entry (must come after specific routes)
app.delete('/api/weights/:id', async (req, res) => {
    try {
        console.log('📊 DELETE /api/weights/:id called with id:', req.params.id);
        const entry = await WeightEntry.findByIdAndDelete(req.params.id);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        console.log('✅ Entry deleted:', entry);
        res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('DELETE Weight Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Clear all entries
app.delete('/api/weights/clear', async (req, res) => {
    try {
        console.log('📊 DELETE /api/weights/clear called');
        const userId = 'default_user';
        await WeightEntry.deleteMany({ userId });
        console.log('✅ All entries cleared');
        res.json({ message: 'All entries cleared' });
    } catch (error) {
        console.error('Clear Weights Error:', error);
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
            '/api/weights/stats',
            '/api/weights/latest',
            'POST /api/weights',
            'DELETE /api/weights/:id'
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
                latest: '/api/weights/latest'
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
    console.log(`📍 Stats: http://localhost:${PORT}/api/weights/stats`);
});
