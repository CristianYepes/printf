#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { analyzeFormatSpecs } from "./tools/format_spec_support.js";
import { generateTestSource, parseTestOutput } from "./tools/test_format.js";
import { getEdgeCases, type Conversion } from "./tools/edge_cases.js";
import { analyzeFormatString } from "./tools/flag_conflict.js";
import { compileAndRun, ensureLibBuilt } from "./helpers/compile.js";

const PROJECT_DIR = resolve("/home/cristian/Desktop/ft_printf");

const server = new McpServer({
  name: "ft-printf-tools",
  version: "1.0.0",
});

// Tool 1: format_spec_support
server.tool(
  "format_spec_support",
  "Analyze ft_printf source to produce a matrix of supported conversions and flags with their interaction rules",
  {},
  async () => {
    try {
      const matrix = analyzeFormatSpecs(PROJECT_DIR);

      let output = "# ft_printf Format Specification Matrix\n\n";

      output += "## Supported Conversions\n\n";
      output += "| Specifier | Handler File | Flags Supported | Width | Precision | Notes |\n";
      output += "|-----------|-------------|-----------------|-------|-----------|-------|\n";
      for (const conv of matrix.conversions) {
        output += `| %${conv.specifier} | ${conv.handler_file} | ${conv.flags_supported.join(" ")} | ${conv.has_width ? "Yes" : "No"} | ${conv.has_precision ? "Yes" : "No"} | ${conv.notes.join("; ") || "-"} |\n`;
      }

      output += "\n## Flag Details\n\n";
      output += "| Flag | Struct Field | Description | Applies To |\n";
      output += "|------|-------------|-------------|------------|\n";
      for (const flag of matrix.flags) {
        output += `| '${flag.flag}' | ${flag.field} | ${flag.description} | ${flag.applicable_to.map(s => `%${s}`).join(", ") || "none detected"} |\n`;
      }

      output += "\n## Flag Interactions\n\n";
      for (const interaction of matrix.interactions) {
        output += `- ${interaction}\n`;
      }

      return { content: [{ type: "text", text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: test_format
server.tool(
  "test_format",
  "Compile and run ft_printf with given format string and args; optionally compare byte-by-byte with libc printf",
  {
    format_string: z.string().describe("The format string to test (e.g., '%+010d')"),
    args: z.array(z.object({
      value: z.string().describe("The value (e.g., '42', 'NULL', \"hello\")"),
      type: z.enum(["int", "unsigned", "string", "pointer", "char"]).describe("C type of the argument"),
    })).describe("Arguments to pass to printf"),
    compare_libc: z.boolean().default(true).describe("Compare output with libc printf"),
  },
  async ({ format_string, args, compare_libc }) => {
    const buildErr = ensureLibBuilt(PROJECT_DIR);
    if (buildErr) {
      return { content: [{ type: "text", text: `Build error:\n${buildErr}` }], isError: true };
    }

    const source = generateTestSource(format_string, args, compare_libc);
    const result = compileAndRun(source, PROJECT_DIR, [], 10000);

    if (!result.success && !result.error?.includes("FT_RET=")) {
      return { content: [{ type: "text", text: `Error:\n${result.error}` }], isError: true };
    }

    const stderr = result.error || "";
    const parsed = parseTestOutput(stderr, compare_libc);

    let output = `# Test: ft_printf("${format_string}"${args.length ? ", " + args.map(a => a.value).join(", ") : ""})\n\n`;
    output += `**ft_printf output**: "${parsed.ft_printf_output}"\n`;
    output += `**ft_printf return**: ${parsed.ft_printf_return}\n`;

    if (compare_libc) {
      output += `\n**libc printf output**: "${parsed.libc_output}"\n`;
      output += `**libc printf return**: ${parsed.libc_return}\n`;
      output += `\n**Match**: ${parsed.match ? "PASS" : "FAIL"}\n`;
      if (parsed.differences && parsed.differences.length > 0) {
        output += "\n**Differences**:\n";
        for (const diff of parsed.differences) {
          output += `- ${diff}\n`;
        }
      }
    }

    return { content: [{ type: "text", text: output }] };
  }
);

// Tool 3: edge_case_battery
server.tool(
  "edge_case_battery",
  "Run a pre-built set of edge cases for a specific conversion specifier, comparing with libc printf",
  {
    conversion: z.enum(["c", "s", "p", "d", "i", "u", "x", "X", "percent"]).describe("The conversion to test"),
  },
  async ({ conversion }) => {
    const buildErr = ensureLibBuilt(PROJECT_DIR);
    if (buildErr) {
      return { content: [{ type: "text", text: `Build error:\n${buildErr}` }], isError: true };
    }

    const cases = getEdgeCases(conversion as Conversion);
    let output = `# Edge Case Battery: %${conversion === "percent" ? "%" : conversion}\n\n`;
    output += `Running ${cases.length} test cases...\n\n`;
    output += "| # | Description | Format | Result | ft_ret | libc_ret |\n";
    output += "|---|-------------|--------|--------|--------|----------|\n";

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i];
      const source = generateTestSource(tc.format, tc.args, true);
      const result = compileAndRun(source, PROJECT_DIR, [], 10000);

      if (!result.success && !result.error?.includes("FT_RET=")) {
        output += `| ${i + 1} | ${tc.description} | \`${tc.format}\` | COMPILE_ERR | - | - |\n`;
        failed++;
        continue;
      }

      const parsed = parseTestOutput(result.error || "", true);
      const status = parsed.match ? "PASS" : "FAIL";
      if (parsed.match) passed++;
      else failed++;

      output += `| ${i + 1} | ${tc.description} | \`${tc.format}\` | ${status} | ${parsed.ft_printf_return} | ${parsed.libc_return} |\n`;

      if (!parsed.match && parsed.differences) {
        for (const diff of parsed.differences) {
          output += `| | | | | ↳ ${diff} | |\n`;
        }
      }
    }

    output += `\n## Summary: ${passed}/${cases.length} passed, ${failed} failed\n`;

    return { content: [{ type: "text", text: output }] };
  }
);

// Tool 4: flag_conflict_check
server.tool(
  "flag_conflict_check",
  "Parse a format string and report undefined behavior combinations, flag conflicts, and what the C standard says",
  {
    format_string: z.string().describe("The format string to analyze (e.g., '%+010.5d %-#20x')"),
  },
  async ({ format_string }) => {
    const result = analyzeFormatString(format_string);

    let output = `# Flag Conflict Analysis: "${format_string}"\n\n`;
    output += `Found ${result.specifiers_found.length} format specifier(s), ${result.total_issues} issue(s)\n\n`;

    for (const spec of result.specifiers_found) {
      output += `## \`${spec.raw}\` (position ${spec.position})\n\n`;
      output += `- **Conversion**: %${spec.conversion}\n`;
      output += `- **Flags**: ${spec.flags.length ? spec.flags.map(f => `'${f}'`).join(", ") : "none"}\n`;
      output += `- **Width**: ${spec.width || "none"}\n`;
      output += `- **Precision**: ${spec.precision !== null ? spec.precision : "none"}\n`;

      if (spec.conflicts.length > 0) {
        output += "\n**Conflicts** (flag overrides):\n";
        for (const c of spec.conflicts) {
          output += `- ⚠️  ${c}\n`;
        }
      }

      if (spec.warnings.length > 0) {
        output += "\n**Warnings** (undefined/no effect):\n";
        for (const w of spec.warnings) {
          output += `- ${w}\n`;
        }
      }

      if (spec.behavior.length > 0) {
        output += "\n**Expected behavior**:\n";
        for (const b of spec.behavior) {
          output += `- ${b}\n`;
        }
      }
      output += "\n";
    }

    return { content: [{ type: "text", text: output }] };
  }
);

// Tool 5: validate_makefile
server.tool(
  "validate_makefile",
  "Check the Makefile against 42 requirements: correct targets, flags, no relinking, bonus handling",
  {},
  async () => {
    let output = "# Makefile Validation\n\n";
    const issues: string[] = [];
    const passes: string[] = [];

    // Check Makefile exists
    if (!existsSync(`${PROJECT_DIR}/Makefile`)) {
      return { content: [{ type: "text", text: "Error: No Makefile found in project directory" }], isError: true };
    }

    // Read Makefile
    let makefile: string;
    try {
      makefile = execSync(`cat ${PROJECT_DIR}/Makefile`, { encoding: "utf-8" });
    } catch {
      return { content: [{ type: "text", text: "Error: Cannot read Makefile" }], isError: true };
    }

    // Check required flags
    if (makefile.includes("-Wall") && makefile.includes("-Wextra") && makefile.includes("-Werror")) {
      passes.push("Compilation flags: -Wall -Wextra -Werror present");
    } else {
      issues.push("Missing required compilation flags (-Wall -Wextra -Werror)");
    }

    // Check required targets
    const requiredTargets = ["all", "clean", "fclean", "re"];
    for (const target of requiredTargets) {
      const regex = new RegExp(`^${target}\\s*:`, "m");
      if (regex.test(makefile)) {
        passes.push(`Target '${target}' found`);
      } else {
        issues.push(`Required target '${target}' not found`);
      }
    }

    // Check bonus target
    if (/^bonus\s*:/m.test(makefile)) {
      passes.push("Target 'bonus' found");
    } else {
      issues.push("Target 'bonus' not found (required for bonus part)");
    }

    // Check library name
    if (makefile.includes("libftprintf.a")) {
      passes.push("Output library name: libftprintf.a (correct)");
    } else {
      issues.push("Output library name should be 'libftprintf.a'");
    }

    // Check for forbidden functions in linking (system, forbidden libs)
    if (makefile.includes("-lm") || makefile.includes("-lc")) {
      issues.push("Potentially forbidden library linking detected (-lm or -lc)");
    }

    // Check relink
    output += "## Static Checks\n\n";
    for (const pass of passes) {
      output += `- PASS: ${pass}\n`;
    }
    for (const issue of issues) {
      output += `- FAIL: ${issue}\n`;
    }

    // Dynamic relink test
    output += "\n## Relink Test\n\n";
    try {
      execSync("make fclean", { cwd: PROJECT_DIR, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
      const firstBuild = execSync("make 2>&1", { cwd: PROJECT_DIR, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      const secondBuild = execSync("make 2>&1", { cwd: PROJECT_DIR, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });

      if (secondBuild.includes("cc ") || secondBuild.includes("gcc ") || secondBuild.includes("ar ")) {
        output += "- FAIL: Relinking detected (make called twice produces compilation output)\n";
        output += `  Second make output: \`${secondBuild.trim().slice(0, 200)}\`\n`;
      } else {
        output += "- PASS: No relinking (second make produces no compilation)\n";
      }
    } catch (err: any) {
      output += `- ERROR: Could not run relink test: ${err.message}\n`;
    }

    // Clean test
    output += "\n## Clean Test\n\n";
    try {
      execSync("make", { cwd: PROJECT_DIR, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
      execSync("make clean", { cwd: PROJECT_DIR, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
      const oFiles = execSync(`find ${PROJECT_DIR} -name "*.o" -not -path "*/.mcp/*" 2>/dev/null`, { encoding: "utf-8" });
      if (oFiles.trim()) {
        output += `- FAIL: Object files remain after 'make clean': ${oFiles.trim()}\n`;
      } else {
        output += "- PASS: 'make clean' removes all object files\n";
      }

      execSync("make fclean", { cwd: PROJECT_DIR, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
      const lib = execSync(`find ${PROJECT_DIR} -name "libftprintf.a" 2>/dev/null`, { encoding: "utf-8" });
      if (lib.trim()) {
        output += `- FAIL: Library remains after 'make fclean'\n`;
      } else {
        output += "- PASS: 'make fclean' removes the library\n";
      }
    } catch (err: any) {
      output += `- ERROR: Could not run clean test: ${err.message}\n`;
    }

    output += `\n## Summary: ${issues.length === 0 ? "All checks passed" : `${issues.length} issue(s) found`}\n`;

    return { content: [{ type: "text", text: output }] };
  }
);

// Tool 6: full_test_suite
server.tool(
  "full_test_suite",
  "Run edge case batteries for ALL conversions and produce a comprehensive pass/fail report",
  {},
  async () => {
    const buildErr = ensureLibBuilt(PROJECT_DIR);
    if (buildErr) {
      return { content: [{ type: "text", text: `Build error:\n${buildErr}` }], isError: true };
    }

    const conversions: Conversion[] = ["c", "s", "p", "d", "i", "u", "x", "X", "percent"];
    let output = "# Full ft_printf Test Suite\n\n";
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const conv of conversions) {
      const cases = getEdgeCases(conv);
      let convPassed = 0;
      let convFailed = 0;

      for (const tc of cases) {
        const source = generateTestSource(tc.format, tc.args, true);
        const result = compileAndRun(source, PROJECT_DIR, [], 10000);

        if (!result.success && !result.error?.includes("FT_RET=")) {
          convFailed++;
          continue;
        }

        const parsed = parseTestOutput(result.error || "", true);
        if (parsed.match) convPassed++;
        else convFailed++;
      }

      totalPassed += convPassed;
      totalFailed += convFailed;
      totalTests += cases.length;

      const icon = convFailed === 0 ? "PASS" : "FAIL";
      output += `| %${conv === "percent" ? "%" : conv} | ${icon} | ${convPassed}/${cases.length} | ${convFailed > 0 ? `${convFailed} failed` : "all passed"} |\n`;
    }

    const header = `| Conversion | Status | Score | Details |\n|------------|--------|-------|---------|\n`;
    output = "# Full ft_printf Test Suite\n\n" + header + output.split("\n").filter(l => l.startsWith("|")).join("\n") + "\n";
    output += `\n## Total: ${totalPassed}/${totalTests} passed (${((totalPassed / totalTests) * 100).toFixed(1)}%)\n`;

    if (totalFailed > 0) {
      output += `\nUse \`edge_case_battery\` with specific conversion to see detailed failures.\n`;
    }

    return { content: [{ type: "text", text: output }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
