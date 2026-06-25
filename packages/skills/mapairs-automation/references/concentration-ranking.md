# Concentration Ranking Workflow (浓度排名)

## Dual Screenshot Mode

| Screenshot | Level 1 | Level 2 | Purpose |
|------------|---------|---------|---------|
| Screenshot 1 | Province (e.g., 浙江省) | **全部** | All cities in province |
| Screenshot 2 | Province → City (e.g., 杭州市) | **全部** | All districts in city |

## Time Type

Use **日累计** (daily cumulative), NOT 实时 (real-time). Switch before screenshot.

## Output

- 2 PNG screenshots
- 300-char text summary

## Quick Run

```bash
python3 ~/.hermes/skills/mapairs-automation/scripts/pingdingshan_ranking.py
```

需要先安装 agent-browser：`npm install -g agent-browser`

脚本使用 agent-browser CLI 操作浏览器，支持 Windows 平台。

## Three-Level Cascader

Some regions have 3-level menus (province → city → district). The cascader actually has **4 panels** (index 0-3), where panel 3 is always empty. Detect menu count and target the correct panel:

```python
menu_count = safe_eval(page, """() => {
    return document.querySelectorAll('.el-cascader-panel .el-cascader-menu').length;
}""")
if menu_count and menu_count >= 3:
    # Panel index 2 = districts (NOT the last panel, which is empty)
    select_cascader_level(page, 2, "全部")
```

⚠️ **Critical**: Do NOT use `menu_count - 1` to target the last panel. Panel 3 is always empty. Always use index 2 for districts.

## Screenshot Flow

1. `reset_and_navigate(page)` — fresh page load
2. `wait_for_page(page)` — wait for table data
3. `clear_all_selections(page)` — clear cascader
4. Open cascader → select province → select "全部" or city
5. Press Escape to close panel
6. `setup_daily_cumulative(page)` — select 日累计
7. `click_query(page)` — click query button
8. `cdp_ss(page, context, path)` — CDP screenshot

## Debugging Cron Runs

When a cron job appears not to execute, follow this diagnostic sequence.

### 0. CRITICAL: Distinguish "scheduler not running" from "job failed"

This is the most important diagnostic step. Look at these two fields:

- **`last_run_at: null` + `last_status: null`** → The job has **never been picked up** by the scheduler. The scheduler process itself is likely not running. Do NOT investigate model errors or API keys first — check the scheduler first.
- **`last_run_at` IS set** → The scheduler ran the job but something went wrong during execution. Investigate model, tools, and scripts.

### 1. Check scheduler is running (do this FIRST)

```bash
hermes cron status
```

If no scheduler is active, start it:
```bash
hermes cron schedule            # Foreground daemon
# or via gateway service:
hermes gateway restart          # Gateway auto-starts the scheduler
```

**"立即执行" (Execute Now) button won't work** if the scheduler process isn't alive — clicking it sends a trigger to a process that isn't listening. Same symptom: `last_run_at` stays null after clicking.

### 2. Check job status in jobs.json (only after confirming scheduler is up)

```bash
cat ~/.hermes/cron/jobs.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
for j in d['jobs']:
    print(f\"{j['id'][:12]}  {j['last_status'] or 'never'}  {j['last_run_at'] or 'never'}  err={j['last_error']}  deliver_err={j['last_delivery_error']}  completed={j['repeat']['completed']}\")
"
```

Key fields:
- `last_status`: "ok" = agent finished, null = never ran
- **TRAP: `last_status: "ok"` does NOT mean screenshots were taken** — it only means the Hermes agent completed its conversation loop. The actual agent-browser screenshot commands may have failed silently inside a tool call.
- `last_delivery_error`: null = delivery succeeded (or no delivery configured)
- `repeat.completed`: increments on each successful run

### 3. Trace execution in agent.log

```bash
hermes logs | grep "cron_<job_id>" | tail -30
```

Look for:
- `conversation turn` — job started
- `API call #N` — agent making LLM calls
- `tool ... completed` — tools running (terminal, vision_analyze, etc.)
- `deliver` — message delivery attempted
- `error` / `fail` / `429` — problems
- `agent-browser` / `not found` — agent-browser not installed

### 4. Verify output files exist

Screenshots land in `~/Desktop/mapairs_screenshots/`. Check timestamps:

```bash
ls -lt ~/Desktop/mapairs_screenshots/ | head -5
```

Files matching the cron run time confirm the agent script executed. **If no files exist at the expected time, agent-browser may not be installed.**

### 5. Verify agent-browser is installed

```bash
agent-browser --version
```

If this fails, install:
```bash
npm install -g agent-browser
```

### 6. Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `last_run_at: null`, scheduler not running | Scheduler daemon isn't alive | `hermes cron schedule` or restart gateway |
| `last_run_at: null`, scheduler IS running | Job might be paused, or next_run_at far in future | Check `paused_at`, verify `enabled: true`, check `next_run_at` |
| Logs show 429 errors | API rate limit | Wait for cooldown, or reduce concurrent cron jobs |
| Screenshots exist but no WeChat message | Delivery format wrong | See WeChat delivery section above |
| `last_status: "ok"` but user sees nothing | Delivery succeeded but message hidden | Check WeChat bot is connected, chat_id is correct |
| `last_status: "ok"` but user reports "截图不可用" | agent-browser not installed | Run `npm install -g agent-browser` |
| MEDIA: tag shows file path instead of image | Windows backslash path in MEDIA: tag | Script should use forward slashes: `path.replace("\\", "/")` |
| User says "already changed provider" but errors persist | API key missing in `.env` even though provider name is correct | Check `hermes auth` or verify env has the correct API key |
