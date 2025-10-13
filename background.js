// Store API key securely
let SAPLING_API_KEY = 'ONE7EY18PC3M0KI4LQCQJDZ16PIZAS97';

// Load API key from storage


// Sapling AI Detection API
async function detectAIContent(text) {
  if (!SAPLING_API_KEY) {
    throw new Error('API key not configured');
  }

  try {
    const response = await fetch('https://api.sapling.ai/api/v1/aidetect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: SAPLING_API_KEY,
        text: text,
        sent_scores: true,
        score_string: false
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      score: data.score,
      sentenceScores: data.sentence_scores,
      text: data.text
    };
  } catch (error) {
    console.error('Sapling API error:', error);
    throw error;
  }
}

// Process reviews in batches
async function processReviews(reviews) {
  const results = [];
  
  for (const review of reviews) {
    try {
      const detection = await detectAIContent(review.text);
      results.push({
        id: review.id,
        author: review.author,
        rating: review.rating,
        score: detection.score,
        isAI: detection.score > 0.5, // 50% threshold
        sentenceScores: detection.sentenceScores
      });
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      results.push({
        id: review.id,
        author: review.author,
        rating: review.rating,
        error: error.message
      });
    }
  }
  
  return results;
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startScan') {
    // Get active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      
      try {
        // Request reviews from content script
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'getReviews' 
        });
        
        if (!response.reviews || response.reviews.length === 0) {
          sendResponse({ error: 'No reviews found on this page' });
          return;
        }
        
        // Process reviews
        const results = await processReviews(response.reviews);
        
        // Send results back to content script for highlighting
        for (const result of results) {
          if (!result.error) {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'highlightReview',
              reviewId: result.id,
              score: result.score
            });
          }
        }
        
        // Store results for popup
        chrome.storage.local.set({ 
          lastScanResults: results,
          lastScanTime: Date.now()
        });
        
        // Notify completion
        chrome.tabs.sendMessage(tab.id, { 
          action: 'scanComplete',
          results: results
        });
        
        sendResponse({ success: true, results: results });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    });
    
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'saveApiKey') {
    SAPLING_API_KEY = message.apiKey;
    chrome.storage.sync.set({ saplingApiKey: message.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Listen for scan complete to reset button
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'scanComplete') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'updateButton',
        text: '✓ Scan Complete'
      });
    });
  }
});
