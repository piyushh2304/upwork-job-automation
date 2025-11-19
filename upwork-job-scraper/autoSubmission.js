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

// Track if a job is currently being processed
let isProcessingJob = false;

/**
 * Process the next job in the queue for auto-submission
 */
async function processNextJobInQueue() {
  try {
    // Prevent multiple jobs from being processed simultaneously
    if (isProcessingJob) {
      console.log("Already processing a job, waiting...");
      return;
    }

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
      isProcessingJob = false;
      return;
    }

    // Mark that we're processing a job
    isProcessingJob = true;

    // Get the next job from queue
    const nextJob = queue[0];
    console.log("Processing job from queue:", nextJob.jobUrl);
    console.log("Queue job details:", JSON.stringify(nextJob, null, 2));

    // Check if proposal exists for this job
    const proposals = await getAllStoredProposals();
    console.log(`Found ${proposals.length} stored proposal(s)`);
    
    // Try to find proposal by exact jobUrl match first
    let proposal = proposals.find((p) => {
      const normalizedQueueUrl = normalizeUrl(nextJob.jobUrl);
      const normalizedProposalUrl = normalizeUrl(p.jobUrl);
      return normalizedQueueUrl === normalizedProposalUrl || p.jobUrl === nextJob.jobUrl;
    });
    
    // If not found, try matching by jobId
    if (!proposal && nextJob.jobId) {
      proposal = proposals.find((p) => p.jobId === nextJob.jobId);
    }
    
    // If still not found, try partial URL match
    if (!proposal) {
      const queueUrlParts = nextJob.jobUrl.split('/').filter(p => p);
      proposal = proposals.find((p) => {
        if (!p.jobUrl) return false;
        const proposalUrlParts = p.jobUrl.split('/').filter(part => part);
        // Check if they share the job ID part
        const queueJobId = queueUrlParts.find(part => part.includes('~'));
        const proposalJobId = proposalUrlParts.find(part => part.includes('~'));
        return queueJobId && proposalJobId && queueJobId === proposalJobId;
      });
    }

    if (!proposal) {
      console.error("No proposal found for job!");
      console.error("Queue job URL:", nextJob.jobUrl);
      console.error("Queue job ID:", nextJob.jobId);
      console.error("Available proposal URLs:", proposals.map(p => p.jobUrl).slice(0, 5));
      
      // Try to fetch proposals from n8n one more time
      console.log("Attempting to fetch proposals from n8n...");
      try {
        const proposalsGetUrl = "https://primary-production-01db.up.railway.app/webhook/upwork-proposals";
        
        // Check if functions are available (they should be from proposalManager.js)
        if (typeof fetchProposalsFromN8n === 'function' && typeof storeProposals === 'function') {
          const fetchedProposals = await fetchProposalsFromN8n(proposalsGetUrl);
          if (fetchedProposals && fetchedProposals.length > 0) {
            await storeProposals(fetchedProposals);
            console.log(`Fetched and stored ${fetchedProposals.length} proposals`);
            
            // Try to find again
            const updatedProposals = await getAllStoredProposals();
            proposal = updatedProposals.find((p) => {
              const normalizedQueueUrl = normalizeUrl(nextJob.jobUrl);
              const normalizedProposalUrl = normalizeUrl(p.jobUrl);
              return normalizedQueueUrl === normalizedProposalUrl || p.jobUrl === nextJob.jobUrl;
            });
          }
        } else {
          console.warn("fetchProposalsFromN8n or storeProposals not available, skipping refresh");
        }
      } catch (error) {
        console.error("Error fetching proposals:", error);
      }
    }

    if (!proposal) {
      console.error("Still no proposal found after refresh, skipping:", nextJob.jobUrl);
      // Remove from queue
      const updatedQueue = queue.slice(1);
      await chrome.storage.local.set({ submissionQueue: updatedQueue });
      isProcessingJob = false;
      // Process next job after delay
      setTimeout(processNextJobInQueue, delay);
      return;
    }
    
    console.log("✓ Found proposal for job!");
    console.log("Proposal details:", {
      jobUrl: proposal.jobUrl,
      jobId: proposal.jobId,
      hasProposalText: !!proposal.proposalText,
      proposalTextLength: proposal.proposalText?.length || 0,
      status: proposal.status
    });

    // Check if already submitted
    if (proposal.status === "submitted") {
      console.log("Proposal already submitted for this job");
      const updatedQueue = queue.slice(1);
      await chrome.storage.local.set({ submissionQueue: updatedQueue });
      isProcessingJob = false;
      setTimeout(processNextJobInQueue, delay);
      return;
    }

    // Extract job ID and construct apply URL
    function extractJobIdFromUrl(jobUrl) {
      try {
        const match = jobUrl.match(/~[0-9]+/);
        return match ? match[0] : null;
      } catch (error) {
        return null;
      }
    }
    
    const jobId = extractJobIdFromUrl(nextJob.jobUrl) || proposal.jobId;
    let targetUrl = nextJob.jobUrl;
    
    if (jobId) {
      targetUrl = `https://www.upwork.com/nx/proposals/job/${jobId}/apply/`;
      console.log("Opening apply URL directly:", targetUrl);
    } else {
      console.log("Could not extract job ID, opening job page:", targetUrl);
    }
    
    // Open the apply page (or job page if job ID not found) in a new tab
    const tab = await chrome.tabs.create({
      url: targetUrl,
      active: true, // Open in foreground so user can see
    });

    // Wait for page to load, then inject script to handle submission
    setTimeout(async () => {
      try {
        // Wait for tab to be ready and URL to match
        let attempts = 0;
        const maxAttempts = 30; // 15 seconds max wait
        
        await new Promise((resolve, reject) => {
          const checkTab = () => {
            attempts++;
            chrome.tabs.get(tab.id, (tabInfo) => {
              if (chrome.runtime.lastError) {
                if (attempts >= maxAttempts) {
                  reject(new Error("Tab not accessible"));
                  return;
                }
                setTimeout(checkTab, 500);
                return;
              }
              
              // Check if page is loaded and URL is correct
              if (tabInfo.status === "complete" && 
                  (tabInfo.url.includes("/proposals/") || tabInfo.url.includes("/jobs/"))) {
                resolve();
              } else if (attempts >= maxAttempts) {
                reject(new Error("Page did not load in time"));
              } else {
                setTimeout(checkTab, 500);
              }
            });
          };
          checkTab();
        });

        // Additional wait for page to fully render and content script to initialize
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify the page is ready by checking if the script is loaded
        // (proposalAutoSubmit.js is already loaded as a content script)
        const checkScript = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return typeof autoSubmitProposal !== 'undefined' || window.proposalAutoSubmitListenerSetup === true;
          }
        });
        
        if (checkScript[0]?.result) {
          console.log("✓ Content script is ready");
        } else {
          console.warn("Content script may not be fully loaded, but proceeding anyway...");
          // Wait a bit more
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Send message to start auto-submission process
        console.log("Sending startAutoSubmission message to tab:", tab.id);
        console.log("Proposal being sent:", {
          jobUrl: proposal.jobUrl,
          jobId: proposal.jobId,
          hasProposalText: !!proposal.proposalText,
          proposalTextPreview: proposal.proposalText?.substring(0, 100) + "..."
        });
        
        chrome.tabs.sendMessage(tab.id, {
          type: "startAutoSubmission",
          jobUrl: nextJob.jobUrl,
          proposal: proposal,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            // Try again after a delay
            setTimeout(() => {
              console.log("Retrying message send...");
              chrome.tabs.sendMessage(tab.id, {
                type: "startAutoSubmission",
                jobUrl: nextJob.jobUrl,
                proposal: proposal,
              }, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  console.error("Retry also failed:", chrome.runtime.lastError.message);
                  isProcessingJob = false;
                  markJobAsSubmitted(nextJob.jobUrl, false);
                } else {
                  console.log("✓ Auto-submission started for job:", nextJob.jobUrl);
                }
              });
            }, 3000);
          } else {
            console.log("✓ Auto-submission message sent successfully for job:", nextJob.jobUrl);
            if (response) {
              console.log("Response:", response);
            }
          }
        });
      } catch (error) {
        console.error("Error starting auto-submission:", error);
        // Remove from queue on error
        isProcessingJob = false;
        await markJobAsSubmitted(nextJob.jobUrl, false);
      }
    }, 3000); // Wait 3 seconds initially for page to start loading
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
    console.log(`Marking job as ${success ? 'submitted' : 'failed'}:`, jobUrl);
    
    // Update proposal status
    await updateProposalStatus(jobUrl, success ? "submitted" : "failed");

    // Remove from queue
    const data = await chrome.storage.local.get(["submissionQueue"]);
    const queue = data.submissionQueue || [];
    const updatedQueue = queue.filter((j) => j.jobUrl !== jobUrl);
    await chrome.storage.local.set({ submissionQueue: updatedQueue });

    // Mark that we're done processing this job
    isProcessingJob = false;

    // Wait a bit before processing next job to ensure cleanup is complete
    const delay = (await chrome.storage.local.get("autoSubmissionDelay"))
      .autoSubmissionDelay || 5000;
    
    console.log(`Job ${success ? 'submitted' : 'failed'}. Waiting ${delay}ms before processing next job...`);
    setTimeout(() => {
      processNextJobInQueue();
    }, delay);
  } catch (error) {
    console.error("Error marking job as submitted:", error);
    isProcessingJob = false;
  }
}

// Export functions
globalThis.processNextJobInQueue = processNextJobInQueue;
globalThis.addJobsToSubmissionQueue = addJobsToSubmissionQueue;
globalThis.markJobAsSubmitted = markJobAsSubmitted;

