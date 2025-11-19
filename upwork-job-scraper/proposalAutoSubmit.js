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
    console.log("Attempting to click element...");
    
    // First, ensure element is in view and focused
    element.focus();
    
    // Try native click first
    console.log("Trying native click()...");
    element.click();
    
    // Also try dispatching events in sequence
    console.log("Dispatching mouse events...");
    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    mouseEvents.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      element.dispatchEvent(event);
    });
    
    // For links, also try navigation
    if (element.tagName === 'A' && element.href) {
      console.log("Element is a link, href:", element.href);
      // The click should handle navigation, but we can also try
      try {
        // Don't navigate directly as it might break the flow
        // window.location.href = element.href;
      } catch (e) {
        console.log("Could not navigate:", e);
      }
    }
    
    console.log("Click completed");
    return true;
  } catch (error) {
    console.error("Error clicking element:", error);
    return false;
  }
}

/**
 * Fill a field with value
 */
async function fillField(element, value) {
  if (!element || !value) return false;

  try {
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Focus and click
    element.focus();
    element.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clear existing value
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      element.value = "";
      element.textContent = "";
      element.innerText = "";
    }

    // Set new value
    element.value = value;
    
    // For textareas, also set textContent
    if (element.tagName === "TEXTAREA") {
      element.textContent = value;
    }
    
    // Trigger multiple events to ensure form validation picks it up
    const events = ["focus", "input", "change", "blur", "keyup", "keydown"];
    events.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });
    
    // Also try setting value property directly (for React forms)
    try {
      const textareaDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      const inputDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (textareaDescriptor?.set && element.tagName === "TEXTAREA") {
        textareaDescriptor.set.call(element, value);
      }
      if (inputDescriptor?.set && element.tagName === "INPUT") {
        inputDescriptor.set.call(element, value);
      }
    } catch (e) {
      // Ignore if property descriptor access fails
    }

    return true;
  } catch (error) {
    console.error("Error filling field:", error);
    return false;
  }
}

/**
 * Extract job ID from URL
 */
function extractJobIdFromUrl(url) {
  try {
    const match = url.match(/~[0-9]+/);
    return match ? match[0] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Main auto-submission function
 */
async function autoSubmitProposal(proposal) {
  try {
    console.log("=== Starting auto-submission for job ===", proposal.jobUrl);
    
    // Wait for page to be fully loaded
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve, { once: true });
        }
      });
    }
    
    // Additional wait for React/SPA to render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 1: Check if we're on the apply page
    const currentUrl = window.location.href;
    console.log("Current URL:", currentUrl);
    
    if (currentUrl.includes("/proposals/") && currentUrl.includes("/apply/")) {
      // Already on apply page, proceed to fill
      console.log("Already on apply page, starting to fill form...");
      await fillAndSubmitProposal(proposal);
    } else if (currentUrl.includes("/jobs/")) {
      // On job page, navigate directly to apply URL
      console.log("On job page, navigating to apply URL");
      const jobId = extractJobIdFromUrl(currentUrl) || proposal.jobId;
      if (jobId) {
        const applyUrl = `https://www.upwork.com/nx/proposals/job/${jobId}/apply/`;
        console.log("Navigating to:", applyUrl);
        window.location.href = applyUrl;
        // Wait for navigation and page load
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Wait for page to be ready
        if (document.readyState !== 'complete') {
          await new Promise(resolve => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve, { once: true });
            }
          });
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await fillAndSubmitProposal(proposal);
      } else {
        // Fallback to clicking Apply now
        console.log("Could not extract job ID, falling back to clicking Apply now");
        await clickApplyNow(proposal);
      }
    } else {
      console.warn("Not on a valid Upwork page, current URL:", currentUrl);
      // Wait a bit and check again (might be redirecting)
      await new Promise(resolve => setTimeout(resolve, 3000));
      const newUrl = window.location.href;
      if (newUrl.includes("/proposals/") && newUrl.includes("/apply/")) {
        console.log("Page redirected to apply page, proceeding...");
        await fillAndSubmitProposal(proposal);
      } else {
        throw new Error("Not on a valid Upwork page");
      }
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
    console.log("=== STEP 1: Looking for Apply now button ===");
    console.log("Current URL:", window.location.href);
    
    // Wait for page to fully load
    console.log("Waiting for page to load...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // First, let's see what buttons are on the page for debugging
    const allButtons = Array.from(document.querySelectorAll('button, a'));
    console.log(`Found ${allButtons.length} buttons/links on page`);
    
    // Log all visible buttons with "apply" in text for debugging
    const applyCandidates = allButtons.filter(btn => {
      const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
      const isVisible = btn.offsetParent !== null;
      return isVisible && text.includes('apply');
    });
    console.log(`Found ${applyCandidates.length} buttons with 'apply' in text:`, 
      applyCandidates.map(btn => ({
        text: btn.textContent?.trim(),
        tag: btn.tagName,
        classes: btn.className,
        visible: btn.offsetParent !== null
      }))
    );

    // Wait for Apply now button - try multiple selectors (updated for current Upwork UI)
    const applySelectors = [
      'button[data-test="apply-button"]',
      'a[data-test="apply-button"]',
      'button.air3-btn-primary',
      'a.air3-btn-primary',
      'button[class*="apply"]',
      'a[class*="apply"]',
      'button[aria-label*="Apply"]',
      'a[href*="/proposals/"]',
      // More specific Upwork selectors
      'button[class*="air3-btn"][class*="primary"]',
      'a[class*="air3-btn"][class*="primary"]',
    ];

    let applyButton = null;
    console.log("Trying selectors...");
    for (const selector of applySelectors) {
      try {
        console.log(`  Trying selector: ${selector}`);
        const elements = document.querySelectorAll(selector);
        console.log(`    Found ${elements.length} elements`);
        
        for (const elem of elements) {
          if (elem.offsetParent !== null) {
            const text = (elem.textContent || elem.innerText || '').toLowerCase().trim();
            console.log(`    Element text: "${text}", visible: ${elem.offsetParent !== null}`);
            if (text.includes('apply') || text === 'apply now') {
              applyButton = elem;
              console.log(`✓ Found Apply button with selector: ${selector}`);
              break;
            }
          }
        }
        if (applyButton) break;
      } catch (e) {
        console.log(`    Error with selector: ${e.message}`);
        continue;
      }
    }

    if (!applyButton) {
      console.log("Selectors didn't work, trying text-based search...");
      // Try finding by text content - more comprehensive search
      applyButton = allButtons.find(btn => {
        const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
        const isVisible = btn.offsetParent !== null;
        const matches = isVisible && (
          text === 'apply now' ||
          text.includes('apply now') ||
          (text.includes('apply') && !text.includes('draft') && !text.includes('saved'))
        );
        if (matches) {
          console.log(`Found button by text: "${text}"`);
        }
        return matches;
      });
    }

    if (!applyButton) {
      console.log("Text search didn't work, trying aria-label/title...");
      // Last resort: look for any button with "Apply" in aria-label or title
      applyButton = allButtons.find(btn => {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const isVisible = btn.offsetParent !== null;
        const matches = isVisible && (ariaLabel.includes('apply') || title.includes('apply'));
        if (matches) {
          console.log(`Found button by aria-label/title: aria-label="${ariaLabel}", title="${title}"`);
        }
        return matches;
      });
    }

    if (!applyButton) {
      // Log all primary buttons for debugging
      const primaryButtons = allButtons.filter(btn => 
        btn.offsetParent !== null && 
        (btn.className.includes('primary') || btn.className.includes('air3-btn'))
      );
      console.error("Could not find Apply button. Available primary buttons:", 
        primaryButtons.map(btn => ({
          text: btn.textContent?.trim(),
          classes: btn.className,
          href: btn.href
        }))
      );
      throw new Error("Could not find Apply now button. Please check the page structure.");
    }

    console.log("=== STEP 2: Clicking Apply now button ===");
    console.log("Button details:", {
      text: applyButton.textContent?.trim(),
      tag: applyButton.tagName,
      classes: applyButton.className,
      href: applyButton.href
    });
    
    // Scroll button into view
    console.log("Scrolling button into view...");
    applyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click the button
    console.log("Clicking button...");
    const clicked = safeClick(applyButton);
    console.log(`Button click result: ${clicked}`);
    
    // Also try programmatic navigation if it's a link
    if (applyButton.tagName === 'A' && applyButton.href) {
      console.log("Button is a link, also trying navigation to:", applyButton.href);
      // Don't navigate directly, let the click handle it
    }

    // Wait for navigation to proposal page or form to appear
    console.log("Waiting for proposal page to load...");
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if URL changed to proposal page
      if (window.location.href.includes("/proposals/")) {
        console.log("Navigated to proposal page");
        break;
      }
      
      // Check if proposal form appeared on current page
      const coverLetterField = document.querySelector('textarea[name*="cover"], textarea[placeholder*="cover"], textarea[placeholder*="letter"]');
      if (coverLetterField) {
        console.log("Proposal form detected on current page");
        break;
      }
      
      attempts++;
    }

    // Wait a bit more for form to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Now fill and submit
    await fillAndSubmitProposal(proposal);
  } catch (error) {
    console.error("Error clicking Apply now:", error);
    throw error;
  }
}

/**
 * Fill rate increase dropdowns
 */
async function fillRateIncrease() {
  try {
    console.log("Filling rate increase fields...");
    
    // Wait for rate increase section to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find the frequency dropdown: "How often do you want a rate increase?"
    let frequencyDropdown = null;
    
    // Search by label text first
    const labels = Array.from(document.querySelectorAll('label'));
    const frequencyLabel = labels.find(l => {
      const text = l.textContent.toLowerCase();
      return text.includes('how often') && text.includes('rate increase');
    });
    
    if (frequencyLabel) {
      const inputId = frequencyLabel.getAttribute('for');
      if (inputId) {
        frequencyDropdown = document.getElementById(inputId);
      } else {
        // Find next sibling or parent's next sibling
        frequencyDropdown = frequencyLabel.nextElementSibling || 
                          frequencyLabel.parentElement?.querySelector('select, div[role="combobox"], button[role="combobox"]');
      }
    }
    
    // If not found, try to find by searching all selects/comboboxes
    if (!frequencyDropdown) {
      const allSelects = Array.from(document.querySelectorAll('select, div[role="combobox"], button[role="combobox"]'));
      for (const elem of allSelects) {
        const parent = elem.closest('div');
        const label = parent?.querySelector('label');
        if (label && label.textContent.toLowerCase().includes('how often')) {
          frequencyDropdown = elem;
          break;
        }
      }
    }
    
    if (frequencyDropdown) {
      console.log("Found frequency dropdown");
      if (frequencyDropdown.tagName === 'SELECT') {
        const options = Array.from(frequencyDropdown.options);
        const targetOption = options.find(opt => 
          opt.textContent.toLowerCase().includes('three months') ||
          opt.textContent.toLowerCase().includes('every three')
        );
        if (targetOption) {
          frequencyDropdown.value = targetOption.value;
          frequencyDropdown.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("Selected frequency: Every Three Months");
        }
      } else {
        // Custom dropdown - click to open
        safeClick(frequencyDropdown);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Look for dropdown menu options
        const menuOptions = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li[role="option"]'));
        const targetOption = menuOptions.find(opt => {
          const text = opt.textContent.toLowerCase();
          return text.includes('three months') || text.includes('every three');
        });
        if (targetOption) {
          safeClick(targetOption);
          console.log("Selected frequency: Every Three Months");
        }
      }
    } else {
      console.warn("Could not find frequency dropdown");
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find the percentage dropdown: "How much of an increase do you want?"
    let percentDropdown = null;
    
    const percentLabel = labels.find(l => {
      const text = l.textContent.toLowerCase();
      return text.includes('how much') && text.includes('increase');
    });
    
    if (percentLabel) {
      const inputId = percentLabel.getAttribute('for');
      if (inputId) {
        percentDropdown = document.getElementById(inputId);
      } else {
        percentDropdown = percentLabel.nextElementSibling || 
                         percentLabel.parentElement?.querySelector('select, div[role="combobox"], button[role="combobox"]');
      }
    }
    
    if (!percentDropdown) {
      const allSelects = Array.from(document.querySelectorAll('select, div[role="combobox"], button[role="combobox"]'));
      for (const elem of allSelects) {
        const parent = elem.closest('div');
        const label = parent?.querySelector('label');
        if (label && label.textContent.toLowerCase().includes('how much')) {
          percentDropdown = elem;
          break;
        }
      }
    }
    
    if (percentDropdown) {
      console.log("Found percent dropdown");
      if (percentDropdown.tagName === 'SELECT') {
        const options = Array.from(percentDropdown.options);
        const targetOption = options.find(opt => 
          opt.textContent.includes('10%') ||
          opt.textContent.trim() === '10'
        );
        if (targetOption) {
          percentDropdown.value = targetOption.value;
          percentDropdown.dispatchEvent(new Event('change', { bubbles: true }));
          console.log("Selected percent: 10%");
        }
      } else {
        safeClick(percentDropdown);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const menuOptions = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li[role="option"]'));
        const targetOption = menuOptions.find(opt => {
          const text = opt.textContent;
          return text.includes('10%') || text.trim() === '10';
        });
        if (targetOption) {
          safeClick(targetOption);
          console.log("Selected percent: 10%");
        }
      }
    } else {
      console.warn("Could not find percent dropdown");
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error("Error filling rate increase:", error);
  }
}

/**
 * Attach resume file
 */
async function attachResume() {
  try {
    console.log("=== Starting resume attachment ===");
    
    // Wait a bit for page to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find the "Attach files" button or file input
    let fileInput = document.querySelector('input[type="file"]');
    let attachButton = null;
    
    // Try multiple strategies to find attach button
    if (!fileInput) {
      console.log("File input not found, looking for attach button...");
      
      // Strategy 1: Look for button with "attach" text
      const buttons = Array.from(document.querySelectorAll('button, label, a'));
      attachButton = buttons.find(btn => {
        const text = (btn.textContent || btn.innerText || '').toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        return (text.includes('attach') && (text.includes('file') || text.includes('document'))) ||
               (ariaLabel.includes('attach') && (ariaLabel.includes('file') || ariaLabel.includes('document'))) ||
               (title.includes('attach') && (title.includes('file') || title.includes('document')));
      });
      
      if (attachButton) {
        console.log("Found attach button, clicking...");
        attachButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        safeClick(attachButton);
        await new Promise(resolve => setTimeout(resolve, 2000));
        fileInput = document.querySelector('input[type="file"]');
      }
      
      // Strategy 2: Look for file input that might be hidden
      if (!fileInput) {
        const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        if (allFileInputs.length > 0) {
          fileInput = allFileInputs[0];
          console.log("Found hidden file input");
        }
      }
    }
    
    if (fileInput) {
      console.log("Found file input, attaching resume...");
      
      // Get the resume file URL from extension
      const resumeUrl = chrome.runtime.getURL('PiyushRajputResume.pdf');
      console.log("Resume URL:", resumeUrl);
      
      // Fetch the file and create a File object
      try {
        const response = await fetch(resumeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch resume: ${response.status}`);
        }
        const blob = await response.blob();
        const file = new File([blob], 'PiyushRajputResume.pdf', { type: 'application/pdf' });
        
        console.log("File created, size:", file.size, "bytes");
        
        // Create a DataTransfer object and add the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Set the files property of the input
        fileInput.files = dataTransfer.files;
        
        // Trigger multiple events to ensure form picks it up
        const events = ['change', 'input', 'blur'];
        events.forEach(eventType => {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          fileInput.dispatchEvent(event);
        });
        
        // Also try setting value directly (for some browsers)
        try {
          Object.defineProperty(fileInput, 'files', {
            value: dataTransfer.files,
            writable: false
          });
        } catch (e) {
          // Ignore if can't set
        }
        
        console.log("✓ Resume file attached successfully");
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("Error attaching resume file:", error);
        throw error;
      }
    } else {
      console.warn("Could not find file input or attach button - resume may not be attached");
      // Don't throw error, continue without resume
    }
  } catch (error) {
    console.error("Error attaching resume:", error);
    // Continue anyway - resume attachment is optional
  }
}

/**
 * Add profile highlights
 */
async function addProfileHighlights() {
  try {
    console.log("=== Starting profile highlights ===");
    
    // Wait for profile highlights section to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll to find the profile highlights section
    const profileSection = document.querySelector('[data-test*="highlight"], [class*="highlight"], section');
    if (profileSection) {
      profileSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Find "Add a project" or "Add a portfolio project" button
    const buttons = Array.from(document.querySelectorAll('button, a'));
    let addProjectButton = buttons.find(btn => {
      const text = (btn.textContent || btn.innerText || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (text.includes('add') && (text.includes('project') || text.includes('portfolio'))) ||
             (ariaLabel.includes('add') && (ariaLabel.includes('project') || ariaLabel.includes('portfolio')));
    });
    
    // If not found, try looking for buttons near "profile highlights" text
    if (!addProjectButton) {
      const highlightLabels = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('profile highlight') || text.includes('add a project');
      });
      
      for (const label of highlightLabels) {
        const nearbyButton = label.closest('div, section')?.querySelector('button, a');
        if (nearbyButton) {
          const btnText = (nearbyButton.textContent || '').toLowerCase();
          if (btnText.includes('add')) {
            addProjectButton = nearbyButton;
            break;
          }
        }
      }
    }
    
    if (addProjectButton) {
      console.log("Found Add a project button, clicking...");
      addProjectButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));
      safeClick(addProjectButton);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Wait for modal to appear, then look for "Select highlight" buttons
      let highlightButtons = [];
      let attempts = 0;
      while (highlightButtons.length === 0 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const selectHighlightButtons = Array.from(document.querySelectorAll('button'));
        highlightButtons = selectHighlightButtons.filter(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase();
          return text.includes('select highlight') || 
                 (text.includes('select') && btn.closest('[role="dialog"], [role="modal"], [class*="modal"], [class*="dialog"]'));
        });
        attempts++;
      }
      
      if (highlightButtons.length > 0) {
        console.log(`Found ${highlightButtons.length} select highlight button(s)`);
        // Click the first available select highlight button
        highlightButtons[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        safeClick(highlightButtons[0]);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Look for "Add" button in the modal
        const allButtons = Array.from(document.querySelectorAll('button'));
        const addButton = allButtons.find(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
          return (text === 'add' || text === 'add highlight') && 
                 btn.closest('[role="dialog"], [role="modal"], [class*="modal"], [class*="dialog"]');
        });
        
        if (addButton) {
          console.log("Found Add button, clicking...");
          addButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          safeClick(addButton);
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log("✓ Profile highlight added");
        } else {
          console.warn("Could not find Add button in modal");
        }
      } else {
        console.warn("Could not find Select highlight buttons after waiting");
      }
    } else {
      console.warn("Could not find Add a project button - profile highlights may not be added");
      // Continue anyway - profile highlights are optional
    }
  } catch (error) {
    console.error("Error adding profile highlights:", error);
    // Continue anyway - profile highlights are optional
  }
}

/**
 * Fill proposal form and submit
 */
async function fillAndSubmitProposal(proposal) {
  try {
    console.log("=== Filling proposal form ===");
    console.log("Proposal data:", {
      jobUrl: proposal.jobUrl,
      hasProposalText: !!proposal.proposalText,
      proposalTextLength: proposal.proposalText?.length || 0
    });

    // Wait for form to load - check for key elements
    let formReady = false;
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    
    while (!formReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if form elements are present
      const hasTextarea = document.querySelector('textarea') !== null;
      const hasForm = document.querySelector('form') !== null || 
                     document.querySelector('[role="form"]') !== null;
      
      if (hasTextarea || hasForm) {
        formReady = true;
        console.log("Form elements detected");
      }
      attempts++;
    }
    
    if (!formReady) {
      console.warn("Form may not be fully loaded, proceeding anyway...");
    }
    
    // Additional wait for React/SPA to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll to bottom of page to find cover letter field
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

    let filledFields = 0;

    // Fill cover letter (proposal text)
    // Extract proposalText exactly as it comes from Google Sheets via n8n
    // n8n extracts: proposalText: data.proposalText || ''
    const proposalText = proposal.proposalText || '';
    
    if (proposalText && proposalText.trim()) {
      console.log("=== Extracting proposalText from proposal object ===");
      console.log("Proposal object keys:", Object.keys(proposal));
      console.log("Proposal text extracted (length):", proposalText.length);
      console.log("Proposal text preview:", proposalText.substring(0, 150) + "...");
      console.log("Looking for cover letter field to fill...");
      
      const coverLetterSelectors = [
        // Exact match for Upwork's current textarea
        'textarea[aria-labelledby="cover_letter_label"]',
        'textarea.air3-textarea.inner-textarea',
        'textarea.air3-textarea[aria-labelledby="cover_letter_label"]',
        'textarea[data-v-cf0298f4][aria-labelledby="cover_letter_label"]',
        'textarea.air3-textarea',
        // Fallback selectors
        'textarea[name*="cover"]',
        'textarea[name*="letter"]',
        'textarea[data-test*="cover"]',
        'textarea[data-test*="letter"]',
        'textarea#cover-letter',
        'textarea[placeholder*="cover"]',
        'textarea[placeholder*="letter"]',
        'textarea[placeholder*="proposal"]',
        'textarea[aria-label*="cover"]',
        'textarea[aria-label*="letter"]',
        'textarea[role="textbox"]',
        'div[contenteditable="true"][role="textbox"]', // Some forms use contenteditable divs
      ];

      let coverLetterFilled = false;
      let foundElement = null;
      
      // First, try to find the element with the exact selectors (after scrolling)
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
      
      // If not found immediately, wait for it to appear (might be lazy-loaded)
      if (!foundElement) {
        console.log("Cover letter field not found immediately, waiting and scrolling more...");
        
        // Scroll to absolute bottom again
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const selector of coverLetterSelectors.slice(0, 5)) { // Try top 5 selectors with wait
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
      
      // Fill the field if found
      if (foundElement) {
        try {
          // Ensure element is in view
          foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Handle contenteditable divs
          if (foundElement.tagName === 'DIV' && foundElement.contentEditable === 'true') {
            console.log("Filling contenteditable div with proposalText...");
            foundElement.focus();
            foundElement.textContent = proposalText;
            foundElement.innerText = proposalText;
            // Trigger input event
            const inputEvent = new Event('input', { bubbles: true });
            foundElement.dispatchEvent(inputEvent);
            coverLetterFilled = true;
            console.log("✓ Filled cover letter (contenteditable div)");
          } else {
            console.log("Filling textarea with proposalText...");
            if (await fillField(foundElement, proposalText)) {
              coverLetterFilled = true;
              filledFields++;
              console.log("✓ Filled cover letter (textarea)");
              
              // Verify it was filled
              await new Promise(resolve => setTimeout(resolve, 500));
              const currentValue = foundElement.value || foundElement.textContent || '';
              if (currentValue.length > 0) {
                console.log(`✓ Verified: Cover letter has ${currentValue.length} characters`);
              } else {
                console.warn("⚠ Warning: Cover letter field appears empty after filling");
              }
            }
          }
        } catch (error) {
          console.error("Error filling cover letter field:", error);
        }
      }
      
      if (!coverLetterFilled) {
        console.warn("Could not find cover letter field, trying fallback...");
        // Fallback: try to find any large textarea
        const allTextareas = Array.from(document.querySelectorAll('textarea'));
        const largeTextarea = allTextareas.find(ta => 
          ta.offsetParent !== null && 
          (ta.rows > 5 || ta.style.height > '200px' || ta.offsetHeight > 200)
        );
        if (largeTextarea) {
          console.log("Found large textarea, attempting to fill...");
          if (await fillField(largeTextarea, proposalText)) {
            filledFields++;
            console.log("Filled cover letter using fallback");
            coverLetterFilled = true;
          }
        }
        
        // Last resort: try any textarea or contenteditable div
        if (!coverLetterFilled) {
          console.log("Trying last resort: any textarea or contenteditable...");
          const anyTextarea = document.querySelector('textarea');
          if (anyTextarea && await fillField(anyTextarea, proposalText)) {
            console.log("Filled using any textarea found");
            coverLetterFilled = true;
          } else {
            const contentEditable = document.querySelector('div[contenteditable="true"]');
            if (contentEditable) {
              contentEditable.focus();
              contentEditable.textContent = proposalText;
              contentEditable.innerText = proposalText;
              const inputEvent = new Event('input', { bubbles: true });
              contentEditable.dispatchEvent(inputEvent);
              console.log("Filled using contenteditable div");
              coverLetterFilled = true;
            }
          }
        }
      }
      
      if (!coverLetterFilled) {
        console.error("CRITICAL: Could not fill cover letter field!");
        throw new Error("Could not find or fill cover letter field");
      } else {
        console.log("✓ Cover letter filled successfully");
      }
    } else {
      console.warn("No proposal text provided!");
    }

    // Only fill cover letter - do not submit
    console.log("=== Auto-fill complete (submission disabled) ===");
    console.log("Cover letter has been filled. Please review and submit manually.");
    
    // Mark as filled but not submitted
    chrome.runtime.sendMessage({
      type: "markJobAsSubmitted",
      jobUrl: proposal?.jobUrl || window.location.href,
      success: true,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error marking job:", chrome.runtime.lastError);
      } else {
        console.log("Job marked as filled (not submitted)");
      }
    });
  } catch (error) {
    console.error("Error filling proposal:", error);
    throw error;
  }
}

/**
 * Submit the proposal form
 */
async function submitProposal(proposal) {
  try {
    console.log("Submitting proposal...");

    // Wait a bit before submitting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find submit button - try multiple selectors (updated for current Upwork UI)
    console.log("Looking for submit button...");
    const submitSelectors = [
      'button[type="submit"]',
      'button[data-test*="submit"]',
      'button[data-test*="proposal"]',
      'button.air3-btn-primary[type="submit"]',
      'button.air3-btn-primary:not([disabled])',
      'button[class*="submit"]',
      'button[aria-label*="submit"]',
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await waitForElement(selector, 2000);
        if (submitButton && submitButton.offsetParent !== null && !submitButton.disabled) {
          console.log(`Found submit button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      // Try finding by text - more comprehensive
      const buttons = Array.from(document.querySelectorAll('button'));
      submitButton = buttons.find(btn => {
        const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
        const isVisible = btn.offsetParent !== null;
        const isEnabled = !btn.disabled;
        return isVisible && isEnabled && (
          text.includes('submit proposal') ||
          text.includes('submit') ||
          text === 'submit'
        ) && !text.includes('draft') && !text.includes('save');
      });
    }

    if (!submitButton) {
      // Last resort: look for primary button that's enabled
      const primaryButtons = Array.from(document.querySelectorAll('button.air3-btn-primary'));
      submitButton = primaryButtons.find(btn => 
        btn.offsetParent !== null && 
        !btn.disabled &&
        (btn.textContent?.toLowerCase().includes('submit') || 
         btn.textContent?.toLowerCase().includes('send'))
      );
    }

    if (!submitButton) {
      throw new Error("Could not find Submit button. Please check the page structure.");
    }

    console.log("Found submit button, clicking...");
    safeClick(submitButton);

    // Wait for submission to complete - check multiple times
    console.log("Waiting for submission to complete...");
    let submitted = false;
    const maxWaitAttempts = 30; // 15 seconds max
    let waitAttempts = 0;
    
    while (!submitted && waitAttempts < maxWaitAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waitAttempts++;
      
      // Check if submission was successful (look for success message or redirect)
      const successIndicators = [
        document.querySelector('[data-test="success"]'),
        document.querySelector('.success'),
        document.querySelector('[data-test*="success"]'),
        window.location.href.includes('success'),
        window.location.href.includes('submitted'),
        // Check if submit button is disabled (indicates submission in progress)
        submitButton?.disabled === true && waitAttempts > 5,
      ];

      submitted = successIndicators.some(indicator => indicator !== null);
      
      // Also check if URL changed (might indicate redirect after submission)
      if (waitAttempts > 5 && !window.location.href.includes('/apply/')) {
        submitted = true;
        console.log("URL changed, assuming submission successful");
      }
    }

    if (submitted || waitAttempts >= maxWaitAttempts) {
      console.log("Proposal submission completed (or timeout reached)");
      
      // Additional wait to ensure submission is processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Remove job from sheets via webhook
      if (proposal && proposal.jobUrl) {
        try {
          console.log("Calling delete webhook for job:", proposal.jobUrl);
          const deleteWebhookUrl = "https://primary-production-01db.up.railway.app/webhook/delete-job";
          const response = await fetch(deleteWebhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jobUrl: proposal.jobUrl,
              jobId: proposal.jobId,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log("Job removed from sheets:", result);
          } else {
            console.warn("Failed to remove job from sheets:", response.status);
          }
        } catch (error) {
          console.error("Error removing job from sheets:", error);
        }
      }
      
      // Mark job as submitted - this will trigger next job processing
      console.log("Sending markJobAsSubmitted message...");
      chrome.runtime.sendMessage({
        type: "markJobAsSubmitted",
        jobUrl: proposal?.jobUrl || window.location.href,
        success: true,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending markJobAsSubmitted:", chrome.runtime.lastError);
        } else {
          console.log("Job marked as submitted successfully");
        }
      });
    } else {
      // If we couldn't confirm, still mark as attempted
      console.log("Proposal submission attempted (could not confirm)");
      chrome.runtime.sendMessage({
        type: "markJobAsSubmitted",
        jobUrl: proposal?.jobUrl || window.location.href,
        success: true,
      });
    }
  } catch (error) {
    console.error("Error submitting proposal:", error);
    chrome.runtime.sendMessage({
      type: "markJobAsSubmitted",
      jobUrl: proposal?.jobUrl || window.location.href,
      success: false,
    });
    throw error;
  }
}

// Ensure message listener is set up only once
if (!window.proposalAutoSubmitListenerSetup) {
  window.proposalAutoSubmitListenerSetup = true;
  
  console.log("Setting up proposal auto-submit message listener...");
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message.type);
    
    if (message.type === "startAutoSubmission") {
      console.log("=== RECEIVED startAutoSubmission MESSAGE ===");
      console.log("Job URL:", message.proposal?.jobUrl);
      console.log("Job ID:", message.proposal?.jobId);
      console.log("Has proposal text:", !!message.proposal?.proposalText);
      console.log("Proposal text length:", message.proposal?.proposalText?.length || 0);
      
      if (!message.proposal) {
        console.error("❌ ERROR: No proposal object received!");
        console.error("Message received:", JSON.stringify(message, null, 2));
        sendResponse({ success: false, error: "No proposal object received" });
        return true;
      }
      
      if (!message.proposal.proposalText) {
        console.error("❌ ERROR: Proposal text is missing!");
        console.error("Proposal object keys:", Object.keys(message.proposal));
        console.error("Proposal object:", JSON.stringify(message.proposal, null, 2));
        sendResponse({ success: false, error: "Proposal text is missing" });
        return true;
      }
      
      console.log("✓ Proposal data validated");
      console.log("Proposal text preview:", message.proposal.proposalText.substring(0, 150) + "...");
      
      // Wait a bit to ensure page is ready
      setTimeout(async () => {
        try {
          await autoSubmitProposal(message.proposal);
          console.log("✓ Auto-submission completed successfully");
          sendResponse({ success: true });
        } catch (error) {
          console.error("❌ Auto-submission failed:", error);
          sendResponse({ success: false, error: error.message });
        }
      }, 2000);
      
      return true; // Will respond asynchronously
    }
    
    return false;
  });
  
  console.log("Message listener set up successfully");
}

// Also check if we're on an apply page and log it
if (window.location.href.includes("/proposals/") && window.location.href.includes("/apply/")) {
  console.log("=== DETECTED APPLY PAGE ===");
  console.log("URL:", window.location.href);
  console.log("Waiting for proposal data from background script...");
}

