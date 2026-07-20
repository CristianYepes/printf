export interface FlagConflictResult {
  format_string: string;
  specifiers_found: SpecifierAnalysis[];
  total_issues: number;
}

export interface SpecifierAnalysis {
  raw: string;
  position: number;
  conversion: string;
  flags: string[];
  width: string | null;
  precision: string | null;
  conflicts: string[];
  warnings: string[];
  behavior: string[];
}

export function analyzeFormatString(format: string): FlagConflictResult {
  const specifiers: SpecifierAnalysis[] = [];
  const regex = /%([-+0 #]*)?(\*|\d+)?(?:\.(\*|\d+))?([cspdiuxX%])/g;
  let match;

  while ((match = regex.exec(format)) !== null) {
    const [raw, flagStr, width, precision, conversion] = match;
    const flags = flagStr ? [...flagStr] : [];
    const position = match.index;

    const analysis: SpecifierAnalysis = {
      raw,
      position,
      conversion,
      flags,
      width: width || null,
      precision: precision || null,
      conflicts: [],
      warnings: [],
      behavior: [],
    };

    // Check flag conflicts
    if (flags.includes("-") && flags.includes("0")) {
      analysis.conflicts.push("'-' and '0' together: '0' is ignored (C standard 7.21.6.1p6)");
      analysis.behavior.push("Will left-justify with space padding (zero-pad ignored)");
    }

    if (flags.includes("+") && flags.includes(" ")) {
      analysis.conflicts.push("'+' and ' ' together: ' ' is ignored (C standard 7.21.6.1p6)");
      analysis.behavior.push("Will show '+' for positive numbers (space ignored)");
    }

    // Check flag applicability
    if (flags.includes("#")) {
      if (!["x", "X"].includes(conversion)) {
        analysis.warnings.push(`'#' flag has no effect on '%${conversion}' conversion`);
      }
    }

    if (flags.includes("+") || flags.includes(" ")) {
      if (!["d", "i"].includes(conversion)) {
        analysis.warnings.push(`'+'/'' ' flags have no effect on unsigned '%${conversion}' conversion`);
      }
    }

    if (flags.includes("0")) {
      if (["c", "s", "p"].includes(conversion)) {
        analysis.warnings.push(`'0' flag is undefined behavior for '%${conversion}' conversion`);
      }
      if (precision !== null && precision !== undefined && ["d", "i", "u", "x", "X"].includes(conversion)) {
        analysis.conflicts.push("'0' flag with precision on integer: '0' is ignored (C standard 7.21.6.1p6)");
        analysis.behavior.push("Precision takes precedence over zero-padding for minimum digits");
      }
    }

    // Check precision applicability
    if (precision !== null && precision !== undefined) {
      if (conversion === "c") {
        analysis.warnings.push("Precision has no effect on '%c' conversion (undefined behavior)");
      }
      if (conversion === "%") {
        analysis.warnings.push("Precision has no effect on '%%'");
      }
    }

    // Width with specific conversions
    if (conversion === "%" && (flags.length > 0 || width || precision)) {
      analysis.warnings.push("Flags/width/precision on '%%' are implementation-defined");
    }

    // Zero value with zero precision
    if (precision === "0") {
      if (["d", "i", "u", "x", "X"].includes(conversion)) {
        analysis.behavior.push("If value is 0, no digits will be printed (empty output for the number)");
      }
    }

    // Describe expected behavior
    if (analysis.conflicts.length === 0 && analysis.warnings.length === 0) {
      analysis.behavior.push("No conflicts detected - standard behavior applies");
    }

    specifiers.push(analysis);
  }

  return {
    format_string: format,
    specifiers_found: specifiers,
    total_issues: specifiers.reduce((sum, s) => sum + s.conflicts.length + s.warnings.length, 0),
  };
}
