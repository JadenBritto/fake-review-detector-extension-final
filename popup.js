// Load saved API key
chrome.storage.sync.get(['saplingApiKey'], (result) => {
  if (result.saplingApiKey) {
    document.getElementById('apiKey').value = result.saplingApiKey;
  }
});

// Save API key
document.getElementById('saveKey').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'saveApiKey', 
    apiKey: apiKey 
  }, (response) => {
    if (response.success) {
      showStatus('API key saved successfully!', 'success');
    }
  });
});

// Start scan
document.getElementById('scanBtn').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter and save your API key first', 'error');
    return;
  }
  
  showStatus('Scanning reviews...', 'success');
  
  chrome.runtime.sendMessage({ action: 'startScan' });
  
  // Poll for results
  const checkResults = setInterval(() => {
    chrome.storage.local.get(['lastScanResults', 'lastScanTime'], (result) => {
      if (result.lastScanResults && result.lastScanTime) {
        // Check if results are recent (within last 10 seconds)
        if (Date.now() - result.lastScanTime < 10000) {
          displayResults(result.lastScanResults);
          showStatus('Scan complete!', 'success');
          clearInterval(checkResults);
        }
      }
    });
  }, 1000);
  
  // Stop polling after 60 seconds
  setTimeout(() => clearInterval(checkResults), 60000);
});

// Display results
function displayResults(results) {
  const resultsDiv = document.getElementById('results');
  const totalReviewsEl = document.getElementById('totalReviews');
  const aiReviewsEl = document.getElementById('aiReviews');
  const reviewListEl = document.getElementById('reviewList');
  
  resultsDiv.style.display = 'block';
  
  const aiCount = results.filter(r => r.isAI && !r.error).length;
  totalReviewsEl.textContent = results.length;
  aiReviewsEl.textContent = aiCount;
  
  reviewListEl.innerHTML = '';
  
  results.forEach(review => {
    if (review.error) return;
    
    const item = document.createElement('div');
    item.className = `review-item ${review.isAI ? 'ai' : 'human'}`;
    
    const percentage = (review.score * 100).toFixed(1);
    const label = review.isAI ? 'AI-Generated' : 'Human-Written';
    
    item.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">
        ${review.author} - ${review.rating}
      </div>
      <div>
        ${label}: ${percentage}% confidence
      </div>
    `;
    
    reviewListEl.appendChild(item);
  });
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// Load previous results on popup open
chrome.storage.local.get(['lastScanResults', 'lastScanTime'], (result) => {
  if (result.lastScanResults && result.lastScanTime) {
    // Show if less than 5 minutes old
    if (Date.now() - result.lastScanTime < 300000) {
      displayResults(result.lastScanResults);
    }
  }
});
