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

    // Wait for the proposal form to load
    // Upwork proposal form selectors (these may need adjustment based on actual Upwork structure)
    const proposalTextSelector =
      'textarea[name="coverLetter"], textarea[data-test="cover-letter"], textarea.air3-textarea, textarea#cover-letter';
    const bidAmountSelector =
      'input[name="bidAmount"], input[data-test="bid-amount"], input#bid-amount';
    const estimatedHoursSelector =
      'input[name="estimatedHours"], input[data-test="estimated-hours"]';

    let filledFields = 0;

    // Fill proposal text (cover letter)
    if (proposal.proposalText) {
      try {
        const proposalTextElement = await waitForElement(
          proposalTextSelector,
          5000
        );
        fillField(proposalTextElement, proposal.proposalText);
        filledFields++;
        console.log("Filled proposal text field");
      } catch (error) {
        console.warn("Could not find proposal text field:", error.message);
      }
    }

    // Fill bid amount if provided
    if (proposal.bidAmount) {
      try {
        const bidAmountElement = await waitForElement(bidAmountSelector, 3000);
        fillField(bidAmountElement, proposal.bidAmount.toString());
        filledFields++;
        console.log("Filled bid amount field");
      } catch (error) {
        console.warn("Could not find bid amount field:", error.message);
      }
    }

    // Fill estimated hours if provided
    if (proposal.estimatedHours) {
      try {
        const estimatedHoursElement = await waitForElement(
          estimatedHoursSelector,
          3000
        );
        fillField(estimatedHoursElement, proposal.estimatedHours.toString());
        filledFields++;
        console.log("Filled estimated hours field");
      } catch (error) {
        console.warn("Could not find estimated hours field:", error.message);
      }
    }

    // Handle screening questions if provided
    if (proposal.screeningAnswers && Array.isArray(proposal.screeningAnswers)) {
      for (let i = 0; i < proposal.screeningAnswers.length; i++) {
        const answer = proposal.screeningAnswers[i];
        try {
          // Try to find question input by index or data attribute
          const questionSelector = `textarea[data-question-index="${i}"], textarea[name="question-${i}"], .screening-question textarea`;
          const questionElement = await waitForElement(questionSelector, 3000);
          fillField(questionElement, answer);
          filledFields++;
          console.log(`Filled screening question ${i}`);
        } catch (error) {
          console.warn(`Could not find screening question ${i}:`, error.message);
        }
      }
    }

    if (filledFields > 0) {
      if (typeof addToActivityLog === "function") {
        addToActivityLog(
          `Auto-filled ${filledFields} field(s) in proposal form`
        );
      }
      console.log(`Successfully filled ${filledFields} field(s)`);

      // Update proposal status
      chrome.runtime.sendMessage({
        type: "updateProposalStatus",
        jobUrl: proposal.jobUrl,
        status: "filled",
      });

      // Show notification to user
      showAutoFillNotification(filledFields);
    } else {
      throw new Error("No fields were filled. Form structure may have changed.");
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
    // Upwork proposal pages typically have the job URL in the page
    let jobUrl = currentUrl;

    // Try to extract job URL from page elements or URL
    const jobLinkElement = document.querySelector(
      'a[href*="/jobs/"], a[data-test="job-link"]'
    );
    if (jobLinkElement) {
      jobUrl = jobLinkElement.href;
    }

    // Get proposal for this job
    const response = await chrome.runtime.sendMessage({
      type: "getProposalForJob",
      jobUrl: jobUrl,
    });

    if (response && response.proposal) {
      const proposal = response.proposal;

      // Check if proposal hasn't been filled yet
      if (proposal.status !== "filled") {
        console.log("Found proposal for this job, starting auto-fill");
        // Wait a bit for the form to fully load
        setTimeout(() => {
          fillProposalForm(proposal);
        }, 2000);
      } else {
        console.log("Proposal already filled for this job");
      }
    } else {
      console.log("No proposal found for this job");
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

