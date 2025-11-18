// Auto-submission script that runs on Upwork job pages to automatically submit proposals

/**
 * Wait for an element to appear
 */
function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  }
}

/**
 * Click an element safely
 */
function safeClick(element) {
  if (!element) return false;
  
  try {
    // Try multiple click methods
    element.click();
    
    // Also try dispatching events
    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(event);
    });
    
    return true;
  } catch (error) {
    console.error("Error clicking element:", error);
    return false;
  }
}

/**
 * Fill a field with value
 */
function fillField(element, value) {
  if (!element || !value) return false;

  try {
    element.focus();
    element.click();
    
    // Clear existing value
    element.value = "";
    if (element.tagName === "TEXTAREA") {
      element.textContent = "";
    }

    // Set new value
    element.value = value;
    
    // Trigger events
    const events = ["input", "change", "blur", "keyup"];
    events.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });

    return true;
  } catch (error) {
    console.error("Error filling field:", error);
    return false;
  }
}

/**
 * Main auto-submission function
 */
async function autoSubmitProposal(proposal) {
  try {
    console.log("Starting auto-submission for job:", proposal.jobUrl);
    
    // Step 1: Check if we're on a job page (not proposal page yet)
    const currentUrl = window.location.href;
    
    if (currentUrl.includes("/proposals/")) {
      // Already on proposal page, proceed to fill
      console.log("Already on proposal page");
      await fillAndSubmitProposal(proposal);
    } else if (currentUrl.includes("/jobs/")) {
      // On job page, need to click "Apply now"
      console.log("On job page, clicking Apply now");
      await clickApplyNow(proposal);
    } else {
      throw new Error("Not on a valid Upwork page");
    }
  } catch (error) {
    console.error("Error in auto-submission:", error);
    chrome.runtime.sendMessage({
      type: "markJobAsSubmitted",
      jobUrl: proposal.jobUrl,
      success: false,
    });
  }
}

/**
 * Click the "Apply now" button on job page
 */
async function clickApplyNow(proposal) {
  try {
    // Wait for Apply now button - try multiple selectors
    const applySelectors = [
      'button[data-test="apply-button"]',
      'a[data-test="apply-button"]',
      'button.air3-btn-primary',
      'a[href*="/proposals/"]',
    ];

    let applyButton = null;
    for (const selector of applySelectors) {
      try {
        applyButton = await waitForElement(selector, 5000);
        if (applyButton) break;
      } catch (e) {
        continue;
      }
    }

    if (!applyButton) {
      // Try finding by text content
      const buttons = Array.from(document.querySelectorAll('button, a'));
      applyButton = buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('apply') ||
        btn.textContent?.toLowerCase().includes('submit proposal')
      );
    }

    if (!applyButton) {
      throw new Error("Could not find Apply now button");
    }

    console.log("Found Apply now button, clicking...");
    safeClick(applyButton);

    // Wait for navigation to proposal page
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're now on proposal page
    if (window.location.href.includes("/proposals/")) {
      await fillAndSubmitProposal(proposal);
    } else {
      // Try to find proposal form on current page
      await fillAndSubmitProposal(proposal);
    }
  } catch (error) {
    console.error("Error clicking Apply now:", error);
    throw error;
  }
}

/**
 * Fill proposal form and submit
 */
async function fillAndSubmitProposal(proposal) {
  try {
    console.log("Filling proposal form...");

    // Wait for form to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    let filledFields = 0;

    // Fill cover letter (proposal text)
    if (proposal.proposalText) {
      const coverLetterSelectors = [
        'textarea[name="coverLetter"]',
        'textarea[data-test="cover-letter"]',
        'textarea.air3-textarea',
        'textarea#cover-letter',
        'textarea[placeholder*="cover"]',
        'textarea[placeholder*="proposal"]',
      ];

      for (const selector of coverLetterSelectors) {
        try {
          const element = await waitForElement(selector, 3000);
          if (fillField(element, proposal.proposalText)) {
            filledFields++;
            console.log("Filled cover letter");
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Fill hourly rate if provided
    if (proposal.bidAmount) {
      const rateSelectors = [
        'input[name="hourlyRate"]',
        'input[data-test="hourly-rate"]',
        'input[type="number"]',
        'input[placeholder*="rate"]',
        'input[placeholder*="$/hr"]',
      ];

      for (const selector of rateSelectors) {
        try {
          const element = await waitForElement(selector, 2000);
          if (element && element.type === "number" || element.type === "text") {
            if (fillField(element, proposal.bidAmount.toString())) {
              filledFields++;
              console.log("Filled hourly rate");
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Wait a bit for form to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit the proposal
    await submitProposal();
  } catch (error) {
    console.error("Error filling proposal:", error);
    throw error;
  }
}

/**
 * Submit the proposal form
 */
async function submitProposal() {
  try {
    console.log("Submitting proposal...");

    // Wait a bit before submitting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find submit button - try multiple selectors
    const submitSelectors = [
      'button[type="submit"]',
      'button[data-test="submit-proposal"]',
      'button.air3-btn-primary',
      'button.air3-btn-primary',
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await waitForElement(selector, 3000);
        if (submitButton) break;
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      // Try finding by text
      const buttons = Array.from(document.querySelectorAll('button'));
      submitButton = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('submit') && !text.includes('draft');
      });
    }

    if (!submitButton) {
      throw new Error("Could not find Submit button");
    }

    console.log("Found submit button, clicking...");
    safeClick(submitButton);

    // Wait for submission to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if submission was successful (look for success message or redirect)
    const successIndicators = [
      document.querySelector('[data-test="success"]'),
      document.querySelector('.success'),
      window.location.href.includes('success'),
    ];

    const submitted = successIndicators.some(indicator => indicator !== null);

    if (submitted) {
      console.log("Proposal submitted successfully!");
      chrome.runtime.sendMessage({
        type: "markJobAsSubmitted",
        jobUrl: window.location.href,
        success: true,
      });
    } else {
      // Assume success if no error (Upwork might not show confirmation immediately)
      console.log("Proposal submission attempted");
      chrome.runtime.sendMessage({
        type: "markJobAsSubmitted",
        jobUrl: window.location.href,
        success: true,
      });
    }
  } catch (error) {
    console.error("Error submitting proposal:", error);
    chrome.runtime.sendMessage({
      type: "markJobAsSubmitted",
      jobUrl: window.location.href,
      success: false,
    });
    throw error;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "startAutoSubmission") {
    autoSubmitProposal(message.proposal)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

// Note: This script is injected by the background script when needed
// Auto-detection is handled via message listener above

