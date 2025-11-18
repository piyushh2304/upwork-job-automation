// Auto-submission manager for processing jobs and submitting proposals automatically

/**
 * Normalize a URL for consistent comparison
 * - Removes 'www.' prefix
 * - Removes query string and hash
 * @param {string} urlString - The URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    url.hostname = url.hostname.replace(/^www\./, "");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (error) {
    // Fallback for invalid URLs
    return urlString.split("?")[0].split("#")[0];
  }
}

/**
 * Process the next job in the queue for auto-submission
 */
async function processNextJobInQueue() {
  try {
    // Get queue and settings
    const data = await chrome.storage.local.get([
      "submissionQueue",
      "autoSubmissionEnabled",
      "autoSubmissionDelay",
    ]);

    const queue = data.submissionQueue || [];
    const enabled = data.autoSubmissionEnabled !== false; // Default to true
    const delay = data.autoSubmissionDelay || 5000; // Default 5 seconds between jobs

    if (!enabled) {
      console.log("Auto-submission is disabled");
      return;
    }

    if (queue.length === 0) {
      console.log("No jobs in submission queue");
      return;
    }

    // Get the next job from queue
    const nextJob = queue[0];
    console.log("Processing job from queue:", nextJob.jobUrl);

    // Check if proposal exists for this job
    const proposals = await getAllStoredProposals();
    const proposal = proposals.find((p) => p.jobUrl === nextJob.jobUrl);

    if (!proposal) {
      console.log("No proposal found for job, skipping:", nextJob.jobUrl);
      // Remove from queue
      const updatedQueue = queue.slice(1);
      await chrome.storage.local.set({ submissionQueue: updatedQueue });
      // Process next job after delay
      setTimeout(processNextJobInQueue, delay);
      return;
    }

    // Check if already submitted
    if (proposal.status === "submitted") {
      console.log("Proposal already submitted for this job");
      const updatedQueue = queue.slice(1);
      await chrome.storage.local.set({ submissionQueue: updatedQueue });
      setTimeout(processNextJobInQueue, delay);
      return;
    }

    // Open the job page in a new tab
    const tab = await chrome.tabs.create({
      url: nextJob.jobUrl,
      active: true, // Open in foreground so user can see
    });

    // Wait for page to load, then inject script to handle submission
    setTimeout(async () => {
      try {
        // Wait for tab to be ready
        await new Promise((resolve) => {
          const checkTab = () => {
            chrome.tabs.get(tab.id, (tabInfo) => {
              if (chrome.runtime.lastError) {
                setTimeout(checkTab, 500);
                return;
              }
              if (tabInfo.status === "complete") {
                resolve();
              } else {
                setTimeout(checkTab, 500);
              }
            });
          };
          checkTab();
        });

        // Inject auto-submission script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["proposalAutoSubmit.js"],
        });

        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send message to start auto-submission process
        chrome.tabs.sendMessage(tab.id, {
          type: "startAutoSubmission",
          jobUrl: nextJob.jobUrl,
          proposal: proposal,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            // Remove from queue on error
            markJobAsSubmitted(nextJob.jobUrl, false);
          } else {
            console.log("Auto-submission started for job:", nextJob.jobUrl);
          }
        });
      } catch (error) {
        console.error("Error starting auto-submission:", error);
        // Remove from queue on error
        await markJobAsSubmitted(nextJob.jobUrl, false);
      }
    }, 5000); // Wait 5 seconds for page to load
  } catch (error) {
    console.error("Error processing job queue:", error);
    logAndReportError("Error processing job queue", error);
  }
}

/**
 * Add jobs to submission queue after proposals are generated
 */
async function addJobsToSubmissionQueue() {
  try {
    // Get all stored proposals with status "pending"
    const proposals = await getAllStoredProposals();
    const pendingProposals = proposals.filter((p) => p.status === "pending");

    if (pendingProposals.length === 0) {
      return;
    }

    // Get current queue
    const data = await chrome.storage.local.get(["submissionQueue"]);
    const currentQueue = data.submissionQueue || [];

    // Get all scraped jobs
    const jobsData = await chrome.storage.local.get(["scrapedJobs"]);
    const scrapedJobs = jobsData.scrapedJobs || [];

    // Create a map of job URLs to jobs
    const jobsMap = new Map(scrapedJobs.map((job) => [job.url, job]));

    // Add jobs with pending proposals to queue (avoid duplicates)
    const existingUrls = new Set(currentQueue.map((j) => j.jobUrl));
    const newJobs = [];

    for (const proposal of pendingProposals) {
      if (!existingUrls.has(proposal.jobUrl)) {
        const job = jobsMap.get(proposal.jobUrl);
        if (job) {
          newJobs.push({
            jobUrl: proposal.jobUrl,
            jobTitle: job.title || proposal.jobTitle,
            addedAt: Date.now(),
          });
        }
      }
    }

    if (newJobs.length > 0) {
      const updatedQueue = [...currentQueue, ...newJobs];
      await chrome.storage.local.set({ submissionQueue: updatedQueue });
      console.log(`Added ${newJobs.length} jobs to submission queue`);

      // Start processing if queue was empty
      if (currentQueue.length === 0) {
        processNextJobInQueue();
      }
    }
  } catch (error) {
    console.error("Error adding jobs to submission queue:", error);
    logAndReportError("Error adding jobs to submission queue", error);
  }
}

/**
 * Mark job as submitted and remove from queue
 */
async function markJobAsSubmitted(jobUrl, success = true) {
  try {
    // Update proposal status
    await updateProposalStatus(jobUrl, success ? "submitted" : "failed");

    // Remove from queue
    const data = await chrome.storage.local.get(["submissionQueue"]);
    const queue = data.submissionQueue || [];
    const updatedQueue = queue.filter((j) => j.jobUrl !== jobUrl);
    await chrome.storage.local.set({ submissionQueue: updatedQueue });

    // Process next job
    const delay = (await chrome.storage.local.get("autoSubmissionDelay"))
      .autoSubmissionDelay || 5000;
    setTimeout(processNextJobInQueue, delay);
  } catch (error) {
    console.error("Error marking job as submitted:", error);
  }
}

// Export functions
globalThis.processNextJobInQueue = processNextJobInQueue;
globalThis.addJobsToSubmissionQueue = addJobsToSubmissionQueue;
globalThis.markJobAsSubmitted = markJobAsSubmitted;

