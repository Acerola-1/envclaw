# WeChat (iLink) Cron Delivery Reference

## Background

Hermes connects to WeChat personal accounts via Tencent's iLink Bot API (`ilinkai.weixin.qq.com`). The chat_id format from iLink is `xxxx@im.wechat`, which differs from native WeChat `wxid_xxxxx` format.

## Chat ID Formats

| Format | Source | Example |
|--------|--------|---------|
| `xxxx@im.wechat` | iLink API (Hermes WeChat adapter) | `o9cq805Sb0RjMzwijBZ-r_5CLvbc@im.wechat` |
| `wxid_xxxxx` | Native WeChat | `wxid_abc123def456` |
| `xxxx@chatroom` | WeChat group | `12345678@chatroom` |

## How Cron Delivery Works

In `cron/scheduler.py`, `_resolve_single_delivery_target()` processes the deliver value:

1. Splits `weixin:CHAT_ID` into platform + rest
2. Calls `_parse_target_ref("weixin", CHAT_ID)` which runs `_WEIXIN_TARGET_RE` regex
3. **If regex matches** (`is_explicit=True`): uses parsed chat_id
4. **If regex doesn't match** (`is_explicit=False`): uses raw `rest` value as chat_id ← **this is why `@im.wechat` works**

The regex in `send_message_tool.py` line 32:
```python
_WEIXIN_TARGET_RE = re.compile(
    r"^\s*((?:wxid|gh|v\d+|wm|wb)_[A-Za-z0-9_-]+"
    r"|[A-Za-z0-9._-]+@chatroom"
    r"|filehelper)\s*$"
)
```

This regex does NOT include `@im.wechat` format, but it doesn't matter because the fallback path uses the raw value.

## Common Failure: `deliver: "weixin"` (no chat_id)

When deliver is just `weixin` without a chat_id:
1. Code calls `_get_home_target_chat_id("weixin")`
2. This reads `WEIXIN_HOME_CHANNEL` env var
3. If env var is not set → returns empty string
4. `_resolve_single_delivery_target` returns None
5. Error: `"no delivery target resolved for deliver=weixin"`

**Fix**: Always use `weixin:CHAT_ID` format.

## Finding the Correct chat_id

From `~/.hermes/channel_directory.json`:
```json
{
  "platforms": {
    "weixin": [
      {
        "id": "o9cq805Sb0RjMzwijBZ-r_5CLvbc@im.wechat",
        "name": "o9cq805Sb0RjMzwijBZ-r_5CLvbc@im.wechat",
        "type": "dm"
      }
    ]
  }
}
```

## Third-Party WebUI Considerations

Tasks created from a third-party WebUI have `origin: null` because there's no originating conversation. This means:
- `deliver: "origin"` → fails (no origin to resolve)
- `deliver: "weixin"` → fails (no chat_id, no env var)
- `deliver: "weixin:CHAT_ID"` → works ✅

The WebUI must populate the deliver field with the full `weixin:CHAT_ID` format.

## Verification

Check delivery status:
```bash
# List jobs and check last_delivery_error
hermes cron list

# Check gateway logs for delivery errors
grep "no delivery target" ~/.hermes/logs/errors.log

# Check channel directory for available chat_ids
cat ~/.hermes/channel_directory.json
```
