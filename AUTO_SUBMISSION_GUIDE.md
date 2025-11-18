# Auto-Submission Guide

## Overview

The extension now supports **fully automated proposal submission**. Here's how it works:

1. **Scrapes jobs** from Upwork (already working)
2. **Sends jobs to n8n** via webhook (already working)
3. **n8n generates proposals** using Gemini AI (already working)
4. **Extension fetches proposals** from n8n (already working)
5. **NEW: Automatically submits proposals** - Opens each job, fills the form, and submits!

## How It Works

### Automatic Flow

1. When new proposals are fetched from n8n, they're automatically added to a submission queue
2. The extension processes jobs one by one:
   - Opens the job page in a new tab
   - Clicks "Apply now" button
   - Fills the proposal form (cover letter, hourly rate)
   - Submits the proposal
   - Moves to the next job

### Manual Control

You can also manually start auto-submission from the settings page.

## Setup Instructions

### 1. Enable Auto-Submission

1. Open extension settings (click extension icon → Options)
2. Scroll to the **"Proposals"** section
3. Toggle **"Enable Auto-Submission"** ON
4. Set **"Delay Between Submissions"** (default: 5 seconds)
   - This prevents too many rapid submissions
   - Recommended: 5-10 seconds

### 2. Start Auto-Submission

**Option A: Automatic**
- When new proposals are fetched, they're automatically added to the queue
- Processing starts automatically if auto-submission is enabled

**Option B: Manual**
- Click **"Start Auto-Submission"** button in settings
- This will process all pending proposals in the queue

## Settings Explained

### Auto-Submission Toggle
- **ON**: Automatically submit proposals when they're available
- **OFF**: Only fetch proposals, don't submit (manual review)

### Delay Between Submissions
- Time to wait between processing each job (in seconds)
- **Minimum**: 3 seconds (to avoid being flagged)
- **Recommended**: 5-10 seconds
- **Maximum**: 60 seconds

## How It Processes Jobs

1. **Queue Management**
   - Jobs with pending proposals are added to a queue
   - Queue is processed one job at a time
   - Failed jobs are removed from queue

2. **Job Processing Steps**
   - Opens job page in a new tab
   - Waits for page to load
   - Clicks "Apply now" button
   - Waits for proposal form to load
   - Fills cover letter (proposal text from n8n)
   - Fills hourly rate (if provided by n8n)
   - Submits the proposal
   - Marks job as submitted
   - Moves to next job after delay

3. **Status Tracking**
   - **pending**: Proposal generated, waiting to be submitted
   - **submitted**: Successfully submitted
   - **failed**: Submission failed (error occurred)

## Safety Features

### Rate Limiting
- Configurable delay between submissions
- Prevents rapid-fire submissions that might trigger Upwork's anti-automation

### Error Handling
- Failed submissions are logged
- Jobs are removed from queue on error
- Processing continues with next job

### User Visibility
- Jobs open in foreground tabs (you can see what's happening)
- Activity log shows all submission attempts
- Status updates in real-time

## Troubleshooting

### Auto-Submission Not Starting

1. **Check if enabled**: Toggle "Enable Auto-Submission" ON
2. **Check for proposals**: Click "Check for Proposals Now"
3. **Check queue**: Proposals with status "pending" should be in queue
4. **Manual start**: Click "Start Auto-Submission" button

### Submissions Failing

1. **Check browser console** for errors
2. **Check activity log** in settings
3. **Verify you're logged in** to Upwork
4. **Check proposal form** - Upwork may have changed their form structure
5. **Increase delay** - Try 10-15 seconds between submissions

### Form Not Filling

- Upwork may have updated their form structure
- Check browser console for selector errors
- The extension tries multiple selectors, but may need updates

## Important Notes

⚠️ **Use with Caution**
- Auto-submission will automatically submit proposals
- Review proposals before enabling
- Start with a longer delay (10+ seconds)
- Monitor the first few submissions

⚠️ **Upwork Terms of Service**
- Make sure automated submissions comply with Upwork's ToS
- Use responsibly and ethically
- Don't submit to jobs you're not qualified for

⚠️ **Rate Limits**
- Don't set delay too low (minimum 3 seconds)
- Upwork may flag rapid submissions
- Recommended: 5-10 seconds minimum

## Monitoring

### Activity Log
- All submission attempts are logged
- Check settings page → Activity Log section
- Shows success/failure for each job

### Proposal Status
- View proposals in settings → Proposals section
- Status shows: pending, submitted, or failed
- Click to expand details

## Disabling Auto-Submission

1. Go to extension settings
2. Toggle **"Enable Auto-Submission"** OFF
3. Queue processing will stop
4. Pending jobs remain in queue but won't be processed

## Manual Review Mode

If you want to review proposals before submitting:

1. Keep **"Enable Auto-Submission"** OFF
2. Proposals will still be fetched and stored
3. Review proposals in settings
4. Manually submit through Upwork website
5. Or enable auto-submission after review

## Next Steps

1. **Test with one job first**
   - Enable auto-submission
   - Set delay to 10 seconds
   - Check for one proposal
   - Watch it process

2. **Monitor results**
   - Check activity log
   - Verify submissions on Upwork
   - Adjust delay if needed

3. **Scale up**
   - Once confident, reduce delay if desired
   - Let it process multiple jobs
   - Monitor for any issues

## Support

If you encounter issues:
1. Check browser console for errors
2. Check activity log in settings
3. Verify n8n workflow is working
4. Ensure you're logged into Upwork
5. Try increasing delay between submissions

