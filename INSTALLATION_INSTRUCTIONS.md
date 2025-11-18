# How to Install the Upwork Job Scraper Extension

## Step-by-Step Installation Guide

### Method 1: Load Unpacked Extension (For Development)

1. **Open Chrome Extensions Page**
   - Open Google Chrome browser
   - Go to `chrome://extensions/` (type this in the address bar and press Enter)
   - OR click the three dots menu (⋮) → **More tools** → **Extensions**

2. **Enable Developer Mode**
   - Toggle the **"Developer mode"** switch in the top-right corner (it should turn blue/on)

3. **Load the Extension**
   - Click the **"Load unpacked"** button (appears after enabling Developer mode)
   - Navigate to the extension folder: `C:\Users\piyus\Downloads\Upwork-Job-Scraper-main\upwork-job-scraper`
   - **Important**: Select the `upwork-job-scraper` folder (not the parent folder)
   - Click **"Select Folder"** or **"Select"**

4. **Verify Installation**
   - The extension should now appear in your extensions list
   - You should see the extension icon in your Chrome toolbar
   - If you see any errors, check the console (click "Errors" or "Service worker" link)

5. **Access Settings**
   - Click the extension icon in the toolbar
   - OR right-click the icon → **"Options"**
   - This opens the settings page where you can configure the extension

### Method 2: Using Chrome's Extension Management

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click **"Load unpacked"**
4. Select the `upwork-job-scraper` folder
5. Done!

## Troubleshooting

### Error: "Manifest file is missing or unreadable"
- **Solution**: Make sure you selected the `upwork-job-scraper` folder, not the parent folder
- The folder should contain `manifest.json` directly inside it

### Error: "This extension may have been corrupted"
- **Solution**: 
  1. Remove the extension
  2. Make sure all files are present in the `upwork-job-scraper` folder
  3. Try loading again

### Extension icon doesn't appear
- **Solution**: 
  1. Click the puzzle piece icon (🧩) in Chrome toolbar
  2. Find "Upwork Job Scraper + Webhook" in the list
  3. Click the pin icon to pin it to the toolbar

### Extension not working
- **Solution**:
  1. Check for errors: Go to `chrome://extensions/` → Find the extension → Click "Errors" or "Service worker"
  2. Make sure all required files are present
  3. Try reloading the extension (click the reload icon on the extension card)

## First-Time Setup

After installing:

1. **Click the extension icon** to open settings
2. **Configure your webhook**:
   - Add a Search-Webhook Pair
   - Enter your Upwork search URL
   - Enter your n8n webhook URL (from the n8n workflow)
   - Enable the pair

3. **Enable Proposal Polling** (in the Proposals section):
   - Toggle "Enable Proposal Polling" ON
   - Set polling frequency (default: 10 minutes)

4. **Set Job Check Frequency**:
   - Configure how often to check for new jobs
   - Set active days and hours

5. **Test the Setup**:
   - Click "Test Webhook" to verify connection
   - Click "Manually Scrape Jobs" to test job scraping
   - Click "Check for Proposals Now" to test proposal fetching

## Updating the Extension

If you make changes to the code:

1. Go to `chrome://extensions/`
2. Find "Upwork Job Scraper + Webhook"
3. Click the **reload icon** (circular arrow) on the extension card
4. This reloads the extension with your changes

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Upwork Job Scraper + Webhook"
3. Click **"Remove"**
4. Confirm removal

## File Structure

Make sure your `upwork-job-scraper` folder contains:
- `manifest.json`
- `background.js`
- `settings.html`
- `settings.js`
- `settings.css`
- `jobScraping.js`
- `webhook.js`
- `proposalManager.js`
- `proposalAutoFill.js`
- `storage.js`
- `utils.js`
- `errorHandling.js`
- `activityLog.js`
- `notifications.js`
- `sentry.js`
- `sentry-init.js`
- `icon48.png`
- `icon128.png`

## Next Steps

After installation:
1. Configure the extension with your n8n webhook URLs
2. Set up your Upwork search URLs
3. Enable proposal polling
4. Start scraping jobs and generating proposals automatically!

