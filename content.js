// Configuration
const MAX_REVIEWS = 5;
const MIN_REVIEW_LENGTH = 10; // characters

// Review selectors for different sites
const SELECTORS = {
  amazon: {
    container: '[data-hook="review"]',
    text: '[data-hook="review-body"] span',
    author: '.a-profile-name',
    rating: '[data-hook="review-star-rating"]'
  },
  flipkart: {
    container: '._27M-vq',
    text: '._11pzQk',
    author: '._2_R_DZ',
    rating: '._3LWZlK'
  },
  ebay: {
    container: '.review',
    text: '.review-item-content',
    author: '.review-item-author',
    rating: '.star-rating'
  }
};

// Detect current site
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('amazon')) return 'amazon';
  if (hostname.includes('flipkart')) return 'flipkart';
  if (hostname.includes('ebay')) return 'ebay';
  return null;
}

// Extract reviews from page
function extractReviews() {
  const site = detectSite();
  if (!site) return [];

  const selector = SELECTORS[site];
  const reviewElements = document.querySelectorAll(selector.container);
  const reviews = [];

  reviewElements.forEach((element, index) => {
    if (index >= MAX_REVIEWS) return;

    const textElement = element.querySelector(selector.text);
    const authorElement = element.querySelector(selector.author);
    const ratingElement = element.querySelector(selector.rating);

    if (textElement) {
      const reviewText = textElement.textContent.trim();
      
      // Only include reviews with sufficient length
      if (reviewText.length >= MIN_REVIEW_LENGTH) {
        reviews.push({
          id: index,
          text: reviewText,
          author: authorElement?.textContent.trim() || 'Unknown',
          rating: ratingElement?.textContent.trim() || 'N/A',
          element: element
        });
      }
    }
  });

  return reviews;
}

// Add visual indicator to review
function addIndicator(reviewElement, score, isAI) {
  // Remove existing indicator
  const existing = reviewElement.querySelector('.ai-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.className = 'ai-indicator';
  indicator.style.cssText = `
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 6px;
    font-weight: bold;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const percentage = (score * 100).toFixed(1);
  
  if (isAI) {
    indicator.style.backgroundColor = '#fee';
    indicator.style.color = '#c33';
    indicator.style.border = '2px solid #faa';
    indicator.innerHTML = `
      ⚠️ Likely AI-Generated (${percentage}% confidence)
      <span style="font-size: 11px; font-weight: normal; margin-left: 8px;">
        This review may be fake or bot-written
      </span>
    `;
  } else {
    indicator.style.backgroundColor = '#efe';
    indicator.style.color = '#292';
    indicator.style.border = '2px solid #afa';
    indicator.innerHTML = `
      ✓ Likely Human-Written (${(100 - percentage).toFixed(1)}% confidence)
    `;
  }

  reviewElement.insertBefore(indicator, reviewElement.firstChild);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getReviews') {
    const reviews = extractReviews();
    sendResponse({ reviews: reviews });
  }
  
  if (message.action === 'highlightReview') {
    const reviews = document.querySelectorAll(SELECTORS[detectSite()].container);
    const reviewElement = reviews[message.reviewId];
    
    if (reviewElement) {
      const isAI = message.score > 0.5; // Threshold for AI detection
      addIndicator(reviewElement, message.score, isAI);
    }
    
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open
});

// Add scan button to page
function addScanButton() {
  const site = detectSite();
  if (!site) return;

  // Remove existing button
  const existing = document.getElementById('fake-review-scanner-btn');
  if (existing) existing.remove();

  const button = document.createElement('button');
  button.id = 'fake-review-scanner-btn';
  button.textContent = '🔍 Scan for Fake Reviews';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });

  button.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startScan' });
    button.textContent = '⏳ Scanning...';
    button.disabled = true;
  });

  document.body.appendChild(button);
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addScanButton);
} else {
  addScanButton();
}
