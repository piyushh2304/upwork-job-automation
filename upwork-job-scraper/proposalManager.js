// Proposal management module for handling proposals from n8n

/**
 * Fetch proposals from n8n webhook endpoint
 * @param {string} webhookUrl - The n8n webhook URL to fetch proposals from
 * @returns {Promise<Array>} Array of proposals
 */
async function fetchProposalsFromN8n(webhookUrl) {
  const opId = startOperation("fetchProposalsFromN8n");
  try {
    if (!webhookUrl || !isValidUrl(webhookUrl)) {
      throw new Error("Invalid webhook URL for fetching proposals");
    }

    addOperationBreadcrumb("Fetching proposals from n8n", {
      url: webhookUrl,
    });

    // Use the webhook URL directly (should be the GET proposals endpoint)
    // e.g., https://primary-production-01db.up.railway.app/webhook/upwork-proposals
    const url = new URL(webhookUrl);

    console.log("Fetching proposals from n8n:", url.toString());

    // Send GET request to fetch proposals
    // n8n should return proposals in format: { proposals: [...] }
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to fetch proposals: HTTP ${response.status} - ${response.statusText}`;
      
      if (response.status === 404) {
        errorMessage += "\n\nPossible causes:\n" +
          "1. The n8n workflow is not active. Please activate it in n8n.\n" +
          "2. The webhook URL is incorrect. Verify the URL in n8n.\n" +
          "3. The workflow path 'upwork-proposals' doesn't match the webhook configuration.";
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const proposals = data.proposals || data || [];

    addOperationBreadcrumb("Proposals fetched successfully", {
      count: proposals.length,
    });

    console.log(`Fetched ${proposals.length} proposals from n8n`);
    return proposals;
  } catch (error) {
    addOperationBreadcrumb("Error fetching proposals", {
      error: error.message,
    }, "error");
    console.error("Error fetching proposals from n8n:", error);
    logAndReportError("Error fetching proposals from n8n", error, {
      webhookUrl,
    });
    throw error;
  } finally {
    endOperation();
  }
}

/**
 * Store proposals in chrome.storage.local
 * @param {Array} proposals - Array of proposal objects
 */
async function storeProposals(proposals) {
  try {
    const data = await chrome.storage.local.get(["storedProposals"]);
    const existingProposals = data.storedProposals || [];

    // Create a map of existing proposals by jobUrl for quick lookup
    const existingMap = new Map(
      existingProposals.map((p) => [p.jobUrl, p])
    );

    let newProposalsCount = 0;
    const updatedProposals = [...existingProposals];

    // Process each new proposal
    for (const proposal of proposals) {
      // Validate proposal structure
      if (!proposal.jobUrl || !proposal.proposalText) {
        console.warn("Invalid proposal structure:", proposal);
        continue;
      }

      // Check if proposal already exists
      const existingProposal = existingMap.get(proposal.jobUrl);

      if (existingProposal) {
        // Update existing proposal
        const index = updatedProposals.findIndex(
          (p) => p.jobUrl === proposal.jobUrl
        );
        if (index !== -1) {
          updatedProposals[index] = {
            ...updatedProposals[index],
            ...proposal,
            updatedAt: Date.now(),
            updatedAtHuman: new Date().toLocaleString(),
          };
        }
      } else {
        // Add new proposal
        updatedProposals.push({
          ...proposal,
          storedAt: Date.now(),
          storedAtHuman: new Date().toLocaleString(),
          status: "pending", // pending, filled, failed
        });
        newProposalsCount++;
      }
    }

    // Keep only the last 200 proposals
    const sortedProposals = updatedProposals
      .sort((a, b) => (b.storedAt || b.updatedAt || 0) - (a.storedAt || a.updatedAt || 0))
      .slice(0, 200);

    await chrome.storage.local.set({ storedProposals: sortedProposals });

    if (newProposalsCount > 0) {
      addToActivityLog(
        `Stored ${newProposalsCount} new proposal(s). Total: ${sortedProposals.length}`
      );
      console.log(
        `Stored ${newProposalsCount} new proposals. Total: ${sortedProposals.length}`
      );
    }

    return {
      newCount: newProposalsCount,
      totalCount: sortedProposals.length,
    };
  } catch (error) {
    console.error("Error storing proposals:", error);
    logAndReportError("Error storing proposals", error);
    throw error;
  }
}

/**
 * Get all stored proposals
 * @returns {Promise<Array>} Array of stored proposals
 */
async function getAllStoredProposals() {
  try {
    const data = await chrome.storage.local.get(["storedProposals"]);
    return data.storedProposals || [];
  } catch (error) {
    console.error("Error getting stored proposals:", error);
    return [];
  }
}

/**
 * Get proposal for a specific job URL
 * @param {string} jobUrl - The job URL to get proposal for
 * @returns {Promise<Object|null>} Proposal object or null if not found
 */
async function getProposalForJob(jobUrl) {
  try {
    const proposals = await getAllStoredProposals();
    return proposals.find((p) => p.jobUrl === jobUrl) || null;
  } catch (error) {
    console.error("Error getting proposal for job:", error);
    return null;
  }
}

/**
 * Update proposal status
 * @param {string} jobUrl - The job URL
 * @param {string} status - New status (pending, filled, failed)
 * @param {string} errorMessage - Optional error message
 */
async function updateProposalStatus(jobUrl, status, errorMessage = null) {
  try {
    const proposals = await getAllStoredProposals();
    const index = proposals.findIndex((p) => p.jobUrl === jobUrl);

    if (index !== -1) {
      proposals[index].status = status;
      proposals[index].statusUpdatedAt = Date.now();
      if (errorMessage) {
        proposals[index].errorMessage = errorMessage;
      }
      await chrome.storage.local.set({ storedProposals: proposals });
      console.log(`Updated proposal status for ${jobUrl} to ${status}`);
    }
  } catch (error) {
    console.error("Error updating proposal status:", error);
    logAndReportError("Error updating proposal status", error, {
      jobUrl,
      status,
    });
  }
}

/**
 * Check for new proposals from all configured n8n webhooks
 * @returns {Promise<Object>} Result object with counts
 */
async function checkForNewProposals() {
  try {
    console.log("Checking for new proposals from n8n...");
    addToActivityLog("Checking for new proposals from n8n");

    // Get all enabled pairs with webhook URLs
    const enabledPairs = await getEnabledPairs();
    const pairsWithWebhooks = enabledPairs.filter(
      (pair) => pair.webhookUrl && pair.webhookUrl.trim()
    );

    if (pairsWithWebhooks.length === 0) {
      console.log("No webhook URLs configured for proposal fetching");
      return { newCount: 0, totalCount: 0 };
    }

    let totalNewCount = 0;
    let totalCount = 0;

    // Fetch proposals from each webhook
    // Note: We assume n8n exposes a GET endpoint at the same URL or a related endpoint
    // For now, we'll use the webhook URL with a query parameter to indicate we want proposals
    for (const pair of pairsWithWebhooks) {
      try {
        const proposalUrl = pair.webhookUrl;

        const proposals = await fetchProposalsFromN8n(proposalUrl);
        const result = await storeProposals(proposals);
        totalNewCount += result.newCount;
        totalCount = result.totalCount;

        if (result.newCount > 0) {
          addToActivityLog(
            `Fetched ${result.newCount} new proposal(s) from ${pair.name}`
          );
        }
      } catch (error) {
        console.error(
          `Error fetching proposals from ${pair.name}:`,
          error
        );
        addToActivityLog(
          `Failed to fetch proposals from ${pair.name}: ${error.message}`
        );
      }
    }

    const result = {
      newCount: totalNewCount,
      totalCount: totalCount,
    };

    // If new proposals were found, add jobs to submission queue
    if (totalNewCount > 0 && typeof addJobsToSubmissionQueue === "function") {
      addJobsToSubmissionQueue();
    }

    return result;
  } catch (error) {
    console.error("Error checking for new proposals:", error);
    logAndReportError("Error checking for new proposals", error);
    throw error;
  }
}

// Export functions using globalThis
globalThis.fetchProposalsFromN8n = fetchProposalsFromN8n;
globalThis.storeProposals = storeProposals;
globalThis.getAllStoredProposals = getAllStoredProposals;
globalThis.getProposalForJob = getProposalForJob;
globalThis.updateProposalStatus = updateProposalStatus;
globalThis.checkForNewProposals = checkForNewProposals;

