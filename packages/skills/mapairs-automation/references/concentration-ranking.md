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
python3 ~/.hermes/skills/web-automation/mapairs-automation/scripts/mapairs_dual_screenshot.py
```

Edit `CITY_NAME` variable. The script auto-resolves province via `PROVINCE_MAP`.

## Three-Level Cascader

Some regions have 3-level menus (province → city → district). Detect menu count:

```python
menu_count = safe_eval(page, """() => {
    return document.querySelectorAll('.el-cascader-panel .el-cascader-menu').length;
}""")
if menu_count and menu_count >= 3:
    select_cascader_level(page, 2, "全部")
```

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

When a cron job appears not to execute, follow this diagnostic sequence:

### 1. Check job status in jobs.json

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
- `last_delivery_error`: null = delivery succeeded (or no delivery configured)
- `repeat.completed`: increments on each successful run

### 2. Trace execution in agent.log

```bash
hermes logs | grep "cron_<job_id>" | tail -30
```

Look for:
- `conversation turn` — job started
- `API call #N` — agent making LLM calls
- `tool ... completed` — tools running (terminal, vision_analyze, etc.)
- `deliver` — message delivery attempted
- `error` / `fail` / `429` — problems

### 3. Verify output files exist

Screenshots land in `~/Desktop/mapairs_screenshots/`. Check timestamps:

```bash
ls -lt ~/Desktop/mapairs_screenshots/ | head -5
```

Files matching the cron run time confirm the agent script executed.

### 4. Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `last_status: null`, no logs | Job never triggered | Check `next_run_at`, ensure job is `enabled: true` |
| Logs show 429 errors | API rate limit (xiaomi provider) | Wait for cooldown, or reduce concurrent cron jobs |
| Screenshots exist but no WeChat message | Delivery format wrong | See WeChat delivery section above |
| `last_status: "ok"` but user sees nothing | Delivery succeeded but message hidden | Check WeChat bot is connected, chat_id is correct |
