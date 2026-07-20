# ft_printf MCP Server

Development tools for ft_printf that provide comparative testing against libc and format specification analysis.

## Tools

| Tool | Description |
|------|-------------|
| `format_spec_support` | Analyze source to produce a matrix of supported conversions, flags, and interaction rules |
| `test_format` | Compile and run ft_printf with given format/args, compare byte-by-byte with libc printf |
| `edge_case_battery` | Run pre-built edge cases for a specific conversion (%c, %s, %d, %x, etc.) |
| `flag_conflict_check` | Parse format strings for undefined behavior, flag conflicts, and C standard rules |
| `validate_makefile` | Check Makefile against 42 requirements: targets, flags, relinking, clean behavior |
| `full_test_suite` | Run all edge case batteries and produce a comprehensive pass/fail report |

## Build

```bash
cd .mcp && npm run build
```

## Configure in Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ft-printf-tools": {
      "command": "node",
      "args": ["/home/cristian/Desktop/ft_printf/.mcp/build/index.js"]
    }
  }
}
```
