// Proposal auto-fill content script for Upwork proposal pages

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element>} The element when found
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
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
  });
}

/**
 * Fill a textarea or input field
 * @param {Element} element - The input/textarea element
 * @param {string} value - The value to fill
 */
function fillField(element, value) {
  if (!element || !value) return;

  // Focus the element
  element.focus();
  element.click();

  // Clear existing value
  element.value = "";
  element.textContent = "";

  // Set the value
  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    element.value = value;
  } else {
    element.textContent = value;
  }

  // Trigger input events to ensure Upwork's form validation works
  const events = ["input", "change", "blur"];
  events.forEach((eventType) => {
    const event = new Event(eventType, { bubbles: true });
    element.dispatchEvent(event);
  });

  console.log(`Filled field with value (length: ${value.length})`);
}

/**
 * Fill proposal form on Upwork
 * @param {Object} proposal - Proposal object with proposalText, bidAmount, etc.
 */
async function fillProposalForm(proposal) {
  try {
    console.log("Starting proposal auto-fill for job:", proposal.jobUrl);
    addToActivityLog(`Attempting to auto-fill proposal for job`);

    // Scroll to bottom of page to find cover letter field (it's at the bottom)
    console.log("=== Scrolling to bottom of page to find cover letter ===");
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Scroll a bit more to ensure we're at the very bottom
    window.scrollTo(0, document.body.scrollHeight + 500);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Also try scrolling the main content area if it exists
    const mainContent = document.querySelector('main, [role="main"], .main-content, #main-content');
    if (mainContent) {
      mainContent.scrollTop = mainContent.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("Reached bottom of page, looking for cover letter field...");

    // Wait for the proposal form to load
    // Upwork proposal form selectors - using exact selector from Upwork
    const coverLetterSelectors = [
      'textarea[aria-labelledby="cover_letter_label"]',
      'textarea.air3-textarea.inner-textarea',
      'textarea.air3-textarea[aria-labelledby="cover_letter_label"]',
      'textarea[data-v-cf0298f4][aria-labelledby="cover_letter_label"]',
      'textarea.air3-textarea',
      'textarea[name="coverLetter"]',
      'textarea[data-test="cover-letter"]',
      'textarea#cover-letter'
    ];

    let filledFields = 0;

    // Fill proposal text (cover letter) - this is the main goal
    // Extract proposalText exactly as it comes from Google Sheets via n8n
    // n8n extracts: proposalText: data.proposalText || ''
    const proposalText = proposal.proposalText || '';
    
    if (proposalText && proposalText.trim()) {
      console.log("=== Extracting proposalText from proposal object ===");
      console.log("Proposal object keys:", Object.keys(proposal));
      console.log("Proposal text extracted (length):", proposalText.length);
      console.log("Proposal text preview:", proposalText.substring(0, 150) + "...");
      console.log("Looking for cover letter field to fill...");
      
      let foundElement = null;
      
      // Try each selector (after scrolling to bottom)
      for (const selector of coverLetterSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            // Scroll element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (element.offsetParent !== null) {
              foundElement = element;
              console.log(`Found cover letter field with selector: ${selector}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // If not found immediately, wait for it and scroll more
      if (!foundElement) {
        console.log("Cover letter field not found immediately, waiting and scrolling more...");
        
        // Scroll to absolute bottom again
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const selector of coverLetterSelectors.slice(0, 5)) {
          try {
            foundElement = await waitForElement(selector, 5000);
            if (foundElement) {
              // Scroll element into view
              foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(resolve => setTimeout(resolve, 500));
              
              if (foundElement.offsetParent !== null) {
                console.log(`Found cover letter field with selector (after wait): ${selector}`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      if (foundElement) {
        try {
          // Ensure element is in view before filling
          foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log("Filling cover letter field with proposalText from Google Sheets...");
          fillField(foundElement, proposalText);
          filledFields++;
          console.log("✓ Filled cover letter field successfully");
          
          // Verify it was filled
          await new Promise(resolve => setTimeout(resolve, 500));
          const currentValue = foundElement.value || foundElement.textContent || '';
          if (currentValue.length > 0) {
            console.log(`✓ Verified: Cover letter has ${currentValue.length} characters`);
          } else {
            console.warn("⚠ Warning: Cover letter field appears empty after filling");
          }
        } catch (error) {
          console.error("Error filling cover letter:", error);
        }
      } else {
        console.error("❌ Could not find cover letter field with any selector");
        console.error("Tried selectors:", coverLetterSelectors);
      }
    } else {
      console.warn("No proposal text provided!");
    }

    // Only fill cover letter - skip other fields
    // (Bid amount, estimated hours, and screening questions are not auto-filled)
    
    if (filledFields > 0) {
      console.log(`✓ Successfully filled ${filledFields} field(s)`);
      
      // Update proposal status
      chrome.runtime.sendMessage({
        type: "updateProposalStatus",
        jobUrl: proposal.jobUrl,
        status: "filled",
      });
      
      // Show notification to user
      if (typeof showAutoFillNotification === "function") {
        showAutoFillNotification(filledFields);
      }
      
      if (typeof addToActivityLog === "function") {
        addToActivityLog(`Auto-filled ${filledFields} field(s) for proposal`);
      }
    } else {
      console.warn("No fields were filled");
      if (typeof addToActivityLog === "function") {
        addToActivityLog("Auto-fill attempted but no fields were filled");
      }
    }
  } catch (error) {
    console.error("Error filling proposal form:", error);
    if (typeof addToActivityLog === "function") {
      addToActivityLog(`Failed to auto-fill proposal: ${error.message}`);
    }

    // Update proposal status to failed
    chrome.runtime.sendMessage({
      type: "updateProposalStatus",
      jobUrl: proposal.jobUrl,
      status: "failed",
      errorMessage: error.message,
    });
  }
}

/**
 * Show notification to user about auto-fill
 * @param {number} filledFields - Number of fields filled
 */
function showAutoFillNotification(filledFields) {
  // Create a temporary notification element
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  notification.textContent = `✓ Auto-filled ${filledFields} field(s) in proposal form`;
  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s";
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Check if current page is an Upwork proposal page and has a matching proposal
 */
async function checkAndFillProposal() {
  try {
    // Check if we're on an Upwork job proposal page
    const currentUrl = window.location.href;
    if (
      !currentUrl.includes("upwork.com") ||
      !currentUrl.includes("/proposals/")
    ) {
      return;
    }

    console.log("Detected Upwork proposal page, checking for proposal data");

    // Extract job URL from current page
    // For apply pages, extract job ID from URL and construct job URL
    let jobUrl = currentUrl;
    let jobId = null;
    
    // Extract job ID from apply URL: /proposals/job/~021990106921915111448/apply/
    const jobIdMatch = currentUrl.match(/\/job\/(~[0-9]+)\//);
    if (jobIdMatch) {
      jobId = jobIdMatch[1];
      // Construct job URL from job ID
      jobUrl = `https://www.upwork.com/jobs/${jobId}/`;
      console.log("Extracted job ID:", jobId);
      console.log("Constructed job URL:", jobUrl);
    }

    // Try to extract job URL from page elements or URL
    const jobLinkElement = document.querySelector(
      'a[href*="/jobs/"], a[data-test="job-link"]'
    );
    if (jobLinkElement) {
      jobUrl = jobLinkElement.href;
    }

    // Get proposal for this job - try multiple matching strategies
    const response = await chrome.runtime.sendMessage({
      type: "getProposalForJob",
      jobUrl: jobUrl,
      jobId: jobId,
    });

    if (response && response.proposal) {
      const proposal = response.proposal;

      // Check if proposal hasn't been filled yet
      if (proposal.status !== "filled" && proposal.status !== "submitted") {
        console.log("Found proposal for this job, starting auto-fill");
        // Wait a bit for the form to fully load
        setTimeout(() => {
          fillProposalForm(proposal);
        }, 2000);
      } else {
        console.log("Proposal already filled/submitted for this job");
      }
    } else {
      console.log("No proposal found for this job (this is normal if using auto-submission)");
      // Don't show error - auto-submission will handle it via messages
    }
  } catch (error) {
    console.error("Error checking and filling proposal:", error);
  }
}

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(checkAndFillProposal, 3000); // Wait 3 seconds for page to load
  });
} else {
  setTimeout(checkAndFillProposal, 3000);
}

// Also listen for navigation changes (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkAndFillProposal, 3000);
  }
}).observe(document, { subtree: true, childList: true });

