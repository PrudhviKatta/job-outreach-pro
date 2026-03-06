# Cron Setup for Job Outreach Pro

## System Cron (replaces Vercel cron)

Edit crontab:
```bash
crontab -e
```

Add these entries:
```
# Process email campaigns daily at 9 AM
0 9 * * * curl -s -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/process-emails

# Cleanup old data weekly on Sunday at 2 AM
0 2 * * 0 curl -s -H "x-cron-secret: YOUR_CRON_SECRET" -X POST http://localhost:3000/api/cleanup
```

Replace `YOUR_CRON_SECRET` with the value from your `.env` file.

## Verify Cron Is Working

```bash
# List active cron jobs
crontab -l

# Check cron logs
grep CRON /var/log/syslog | tail -20
```
