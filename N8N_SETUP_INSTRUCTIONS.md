# n8n Workflow Setup Instructions

## Overview
This n8n workflow receives jobs from the Chrome extension, generates proposals using Google Gemini AI, and serves them back to the extension when requested.

## Step 1: Import the Workflow

1. Open your n8n instance
2. Click on **"Workflows"** in the left sidebar
3. Click the **"+"** button to create a new workflow
4. Click the **three dots menu** (⋮) in the top right
5. Select **"Import from File"** or **"Import from URL"**
6. Upload the `n8n-workflow-upwork-proposals.json` file

## Step 2: Configure Google Gemini API Credentials

1. Get your Google Gemini API key:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click **"Create API Key"**
   - Copy the API key

2. In n8n:
   - Click on the **"Generate Proposal Text (Gemini)"** node
   - Click on **"Credential to connect with"** dropdown
   - Click **"Create New Credential"**
   - Select **"Google Gemini API"**
   - Enter your API key
   - Click **"Save"**

3. Repeat for **"Suggest Bid Amount (Gemini)"** node:
   - Click on the node
   - Select the same credential you just created from the dropdown

## Step 3: Customize Your Profile Information

1. Click on the **"Prepare Gemini Prompt"** node
2. Find the `userProfile` object in the code
3. Replace the placeholder values with your actual information:

```javascript
const userProfile = {
  name: 'John Doe', // Your name
  skills: ['JavaScript', 'React', 'Node.js', 'Python'], // Your actual skills
  experience: '5+ years of full-stack development experience...', // Your experience summary
  portfolio: 'https://yourportfolio.com', // Your portfolio URL (optional)
  hourlyRate: '$50-75/hour', // Your hourly rate (optional)
  availability: '40 hours/week' // Your availability (optional)
};
```

## Step 4: Activate the Workflow

1. Click the **"Active"** toggle in the top right to activate the workflow
2. The workflow must be active to receive webhooks

## Step 5: Get Your Webhook URLs

After activating the workflow, you'll see webhook URLs for each webhook node:

1. **"Receive Jobs from Extension"** node:
   - Click on the node
   - Copy the **"Production URL"** (it will look like: `https://your-n8n-instance.com/webhook/upwork-jobs`)
   - This is the URL you'll use in the Chrome extension's webhook settings

2. **"Get Proposals (Extension Polls)"** node:
   - Click on the node
   - Copy the **"Production URL"** (it will look like: `https://your-n8n-instance.com/webhook/upwork-proposals`)
   - The extension will automatically append `?action=getProposals` to this URL

## Step 6: Configure Chrome Extension

1. Open the Chrome extension settings
2. Add a new **Search-Webhook Pair**:
   - **Name**: "Upwork Jobs with Proposals"
   - **Search URL**: Your Upwork search URL
   - **Webhook URL**: The URL from "Receive Jobs from Extension" node (Step 5.1)
3. Enable the pair
4. Enable **Proposal Polling** in the Proposals section
5. Set polling frequency (default: 10 minutes)

## How It Works

### Flow 1: Receiving Jobs
1. Chrome extension scrapes jobs and sends them to the webhook
2. Workflow processes the job data
3. Checks if a proposal already exists for this job
4. If new, generates a proposal using Gemini
5. Stores the proposal
6. Responds to the extension

### Flow 2: Serving Proposals
1. Chrome extension polls the webhook (every 10 minutes by default)
2. Workflow retrieves all stored proposals
3. Returns proposals in JSON format
4. Extension stores proposals locally
5. When user opens a proposal page, extension auto-fills the form

## Proposal Data Structure

The workflow generates proposals in this format:

```json
{
  "jobUrl": "https://www.upwork.com/jobs/...",
  "jobTitle": "Job Title",
  "proposalText": "Generated proposal text...",
  "bidAmount": 50,
  "estimatedHours": null,
  "screeningAnswers": ["Answer 1", "Answer 2"],
  "generatedAt": 1234567890,
  "generatedAtHuman": "2024-01-01T00:00:00.000Z",
  "status": "pending"
}
```

## Customization Options

### 1. Change Proposal Style
Edit the prompt in **"Prepare Gemini Prompt"** node to change how proposals are written.

### 2. Add Database Storage
Currently, proposals are stored in n8n's workflow static data (in-memory). For production:
- Replace **"Store Proposal"** and **"Retrieve Stored Proposals"** nodes
- Use a database node (PostgreSQL, MySQL, MongoDB, etc.)
- This ensures data persistence across workflow restarts

### 3. Add Email Notifications
Add an email node after **"Store Proposal"** to get notified when new proposals are generated.

### 4. Add Proposal Review
Add a manual approval step before storing proposals if you want to review them first.

### 5. Enhance Bid Amount Logic
Modify the **"Suggest Bid Amount (Gemini)"** node to consider:
- Your minimum rate
- Project complexity
- Client budget range
- Your experience level

## Troubleshooting

### Issue: "Credential not found"
- Make sure you've created the Google Gemini API credential
- Ensure both Gemini nodes use the same credential

### Issue: "Webhook not receiving requests"
- Check that the workflow is **Active**
- Verify the webhook URL is correct in extension settings
- Check n8n execution logs for errors

### Issue: "Proposals not being generated"
- Check the **"Should Generate Proposal?"** node - it might be filtering out jobs
- Verify Gemini API key is valid and has quota
- Check execution logs for Gemini API errors

### Issue: "Extension can't fetch proposals"
- Verify the GET webhook URL is correct
- Check that `?action=getProposals` is being appended
- Ensure workflow is active

## Testing

1. **Test Job Reception**:
   - Use the extension's "Test Webhook" button
   - Check n8n execution logs to see if job was received

2. **Test Proposal Generation**:
   - Manually trigger the workflow with test job data
   - Verify proposal is generated and stored

3. **Test Proposal Retrieval**:
   - Use the extension's "Check for Proposals Now" button
   - Or manually visit: `https://your-n8n-instance.com/webhook/upwork-proposals?action=getProposals`
   - Should return JSON with proposals array

## Notes

- **Storage Limit**: Currently stores max 500 proposals in memory. For more, use a database.
- **API Costs**: Google Gemini API has usage limits. Monitor your usage.
- **Rate Limiting**: Consider adding rate limiting to prevent abuse.
- **Security**: For production, add authentication to webhooks.

## Support

If you encounter issues:
1. Check n8n execution logs
2. Check Chrome extension console (F12)
3. Verify all credentials are set correctly
4. Ensure workflow is active

