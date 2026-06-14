document.addEventListener('DOMContentLoaded', () => {
    const assetSelect = document.getElementById('assetSelect');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const signalDashboard = document.getElementById('signalDashboard');
    const signalDirection = document.getElementById('signalDirection');
    const dataGrid = document.getElementById('dataGrid');
    const entryPrice = document.getElementById('entryPrice');
    const takeProfit = document.getElementById('takeProfit');
    const stopLoss = document.getElementById('stopLoss');
    const toast = document.getElementById('toast');

    // Fetch and populate 80+ assets from backend
    async function loadAssets() {
        try {
            const response = await fetch('/api/assets');
            if (!response.ok) throw new Error('Failed to load');
            const assets = await response.json();
            
            // Clear existing options except default
            assetSelect.innerHTML = '<option value="R_100" selected>Volatility 100 Index</option>';
            
            assets.forEach(asset => {
                if (asset.symbol !== 'R_100') { // Prevent duplicate default
                    const option = document.createElement('option');
                    option.value = asset.symbol;
                    option.textContent = asset.display_name;
                    assetSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Asset loading error:", error);
            showToast("Warning: Could not fetch asset list. WebSocket may be disconnected.");
            analyzeBtn.disabled = true;
        }
    }

    // Trigger analysis
    analyzeBtn.addEventListener('click', async () => {
        const symbol = assetSelect.value;
        
        // UI Loading state
        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.disabled = true;
        signalDashboard.classList.add('hidden');
        dataGrid.classList.add('hidden');

        try {
            const response = await fetch(`/api/analyze?symbol=${symbol}`);
            const data = await response.json();

            if (data.error) {
                showToast(data.error);
                return;
            }

            // Display Results
            signalDashboard.classList.remove('hidden');
            signalDirection.textContent = data.signal;
            
            // Clean up previous color classes
            signalDirection.className = ''; 

            if (data.signal === "BUY") {
                signalDirection.classList.add('signal-buy');
                showDataGrid(data);
            } else if (data.signal === "SELL") {
                signalDirection.classList.add('signal-sell');
                showDataGrid(data);
            } else {
                signalDirection.classList.add('signal-hold');
                // Hide exact numbers if holding
                dataGrid.classList.add('hidden'); 
            }

        } catch (error) {
            showToast("Error connecting to backend server.");
        } finally {
            // Reset button
            analyzeBtn.textContent = 'Analyze';
            analyzeBtn.disabled = false;
        }
    });

    function showDataGrid(data) {
        dataGrid.classList.remove('hidden');
        entryPrice.textContent = data.entry.toFixed(4);
        takeProfit.textContent = data.tp.toFixed(4);
        stopLoss.textContent = data.sl.toFixed(4);
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);
    }

    // Initial Data Load
    loadAssets();
});
