const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Serve HTML/CSS/JS

// Deriv API Configuration (App ID 1089 is for testing)
const derivWsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
let ws = new WebSocket(derivWsUrl);
const pendingRequests = new Map();

// Manage persistent WebSocket connection
function connectDeriv() {
    ws = new WebSocket(derivWsUrl);
    
    ws.on('open', () => {
        console.log('Connected to Deriv API');
    });

    ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.req_id && pendingRequests.has(response.req_id)) {
            const resolve = pendingRequests.get(response.req_id);
            resolve(response);
            pendingRequests.delete(response.req_id);
        }
    });

    ws.on('close', () => {
        console.log('Deriv API disconnected. Reconnecting...');
        setTimeout(connectDeriv, 3000);
    });
}
connectDeriv();

// Helper to send WS messages as Promises
function sendDerivRequest(request) {
    return new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) {
            return reject('WebSocket disconnected');
        }
        const req_id = Date.now() + Math.floor(Math.random() * 1000);
        request.req_id = req_id;
        pendingRequests.set(req_id, resolve);
        ws.send(JSON.stringify(request));
        
        // Timeout after 10 seconds
        setTimeout(() => {
            if (pendingRequests.has(req_id)) {
                pendingRequests.delete(req_id);
                reject('Deriv API timeout');
            }
        }, 10000);
    });
}

// Endpoint to fetch active symbols
app.get('/api/assets', async (req, res) => {
    try {
        const response = await sendDerivRequest({ active_symbols: 'brief', product_type: 'basic' });
        res.json(response.active_symbols);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// Endpoint to run Momentum Micro-Breakout logic
app.get('/api/analyze', async (req, res) => {
    const symbol = req.query.symbol || 'R_100';

    try {
        // Fetch last ten 5-minute (300s) candles
        const historyData = await sendDerivRequest({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 10,
            end: "latest",
            style: "candles",
            granularity: 300
        });

        if (!historyData.candles || historyData.candles.length < 10) {
            return res.status(400).json({ error: 'Insufficient market data' });
        }

        const candles = historyData.candles;
        
        // Range Calculation
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const resistance = Math.max(...highs);
        const support = Math.min(...lows);

        // Fetch current active price (latest tick)
        const tickData = await sendDerivRequest({ ticks: symbol });
        const currentPrice = tickData.tick.quote;

        // Signal Generation Logic
        let signal = "Hold - Consolidating";
        let entry = null;
        let tp = null;
        let sl = null;

        if (currentPrice >= (resistance + 2)) {
            signal = "BUY";
            entry = currentPrice;
            sl = support;
            tp = entry + ((entry - sl) * 2);
        } else if (currentPrice <= (support - 2)) {
            signal = "SELL";
            entry = currentPrice;
            sl = resistance;
            tp = entry - ((sl - entry) * 2);
        }

        res.json({
            signal,
            entry,
            tp,
            sl,
            currentPrice,
            support,
            resistance
        });

    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});
