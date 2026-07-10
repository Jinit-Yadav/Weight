const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MONGODB CONNECTION - FIXED CONNECTION STRING
// ============================================================
// IMPORTANT: Use the EXACT connection string from Atlas with retryWrites=true
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jinit2003_db_user:WDKchFu3cQG9NMDU@cluster0.zbkun8d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔌 Connecting to MongoDB Atlas...');
console.log('📡 Connection string:', MONGODB_URI.replace(/:[^:]*@/, ':****@')); // Hide password

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4 // Use IPv4, skip trying IPv6
})
.then(() => {
    console.log('✅ Connected to MongoDB Atlas!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('❌ MongoDB connection error:');
    console.error('   Name:', err.name);
    console.error('   Message:', err.message);
    console.error('   Code:', err.code);
    // Server stays running - will show as disconnected
});

const db = mongoose.connection;
db.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
});
db.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected - attempting to reconnect...');
});
db.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected!');
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
// ROUTES
// ============================================================

// Health check - shows DB status
app.get('/api/health', (req, res) => {
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        dbState: state,
        dbStateText: states[state] || 'unknown',
        dbConnected: state === 1,
        mongodbUri: MONGODB_URI ? 'configured' : 'missing'
    });
});

// GET all weight entries
app.get('/api/weights', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                error: 'Database not connected',
                dbState: mongoose.connection.readyState,
                message: 'Please wait for MongoDB to connect'
            });
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
            return res.status(503).json({ 
                error: 'Database not connected',
                dbState: mongoose.connection.readyState
            });
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
            return res.status(503).json({ 
                error: 'Database not connected',
                dbState: mongoose.connection.readyState
            });
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
            return res.status(503).json({ 
                error: 'Database not connected',
                dbState: mongoose.connection.readyState
            });
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
    const state = mongoose.connection.readyState;
    res.json({ 
        message: '🏋️‍♂️ Weight Tracker API is running!',
        dbConnected: state === 1,
        dbState: ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown',
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
    console.log(`📍 Root: http://localhost:${PORT}/`);
});
