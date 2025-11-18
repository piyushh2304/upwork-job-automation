# Setting Up Google Gemini API in n8n

Since the Google Gemini node is not available in your n8n installation, we're using HTTP Request nodes instead. Here's how to set it up:

## Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key (it will look like: `AIzaSy...`)

## Step 2: Create HTTP Header Auth Credential in n8n

1. In n8n, go to **Settings** → **Credentials**
2. Click **"Add Credential"**
3. Search for **"Header Auth"** or **"HTTP Header Auth"**
4. Create a new credential with:
   - **Name**: "Google Gemini API"
   - **Name**: `apiKey` (this is the header name, but we'll use it as a query parameter)
   - **Value**: Your Gemini API key from Step 1
5. Click **"Save"**

## Step 3: Update the HTTP Request Nodes

The workflow has been updated to use HTTP Request nodes instead of the Gemini node. However, you need to configure the credential:

### For "Generate Proposal Text (Gemini)" node:
1. Click on the node
2. In **"Authentication"** dropdown, select **"Generic Credential Type"**
3. In **"Credential Type"** dropdown, select **"Header Auth"**
4. Select your "Google Gemini API" credential
5. The API key will be passed as a query parameter automatically

### For "Suggest Bid Amount (Gemini)" node:
1. Do the same as above

## Alternative: Use Query Parameter Directly

If the credential setup doesn't work, you can hardcode the API key directly in the nodes:

1. Click on **"Generate Proposal Text (Gemini)"** node
2. In the **"Query Parameters"** section, find the `key` parameter
3. Replace `={{ $credentials.apiKey }}` with your actual API key: `YOUR_API_KEY_HERE`
4. Do the same for **"Suggest Bid Amount (Gemini)"** node

**Note**: Hardcoding API keys is less secure but will work if credentials don't work.

## Step 4: Test the Workflow

1. Activate the workflow
2. Use the Chrome extension's "Test Webhook" button
3. Check the execution logs in n8n to see if the Gemini API calls are successful

## Troubleshooting

### Error: "API key not valid"
- Make sure your API key is correct
- Check that you're using the query parameter `key` (not in headers)
- Verify the API key has access to Gemini Pro model

### Error: "Model not found"
- The workflow uses `gemini-pro` model
- If this doesn't work, try `gemini-1.5-pro` or `gemini-1.5-flash` in the URL:
  - Change: `models/gemini-pro:generateContent`
  - To: `models/gemini-1.5-pro:generateContent`

### Error: "Rate limit exceeded"
- You've hit the API quota
- Check your usage in Google AI Studio
- Consider upgrading your plan or adding rate limiting

## API Endpoint Details

The workflow uses:
- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
- **Method**: POST
- **Query Parameter**: `key` (your API key)
- **Body**: JSON with prompt and generation config

## Security Note

For production use:
- Don't hardcode API keys in the workflow
- Use n8n credentials or environment variables
- Consider adding authentication to your webhooks
- Monitor API usage to avoid unexpected costs

