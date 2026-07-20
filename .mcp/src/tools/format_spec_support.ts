import { readFileSync, readdirSync } from "fs";
import { join } from "path";

interface ConversionInfo {
  specifier: string;
  handler_file: string;
  flags_supported: string[];
  has_precision: boolean;
  has_width: boolean;
  notes: string[];
}

interface SpecMatrix {
  conversions: ConversionInfo[];
  flags: { flag: string; field: string; description: string; applicable_to: string[] }[];
  interactions: string[];
}

export function analyzeFormatSpecs(projectDir: string): SpecMatrix {
  const srcDir = join(projectDir, "src");
  const handlerFiles = readdirSync(srcDir)
    .filter(f => f.startsWith("ft_print_") && f.endsWith(".c"));

  const conversions: ConversionInfo[] = [];
  const flagApplicability: Record<string, string[]> = {
    "-": [], "0": [], ".": [], "#": [], "+": [], " ": [], "*": []
  };

  for (const file of handlerFiles) {
    const source = readFileSync(join(srcDir, file), "utf-8");

    const specs = detectSpecifiers(file, source);
    for (const spec of specs) {
      const flags = detectFlagsInHandler(source);
      conversions.push({
        specifier: spec,
        handler_file: file,
        flags_supported: flags,
        has_precision: source.includes("precision") || source.includes(".precision"),
        has_width: source.includes("width") || source.includes(".width"),
        notes: extractNotes(spec, source),
      });
      for (const flag of flags) {
        if (flagApplicability[flag]) {
          flagApplicability[flag].push(spec);
        }
      }
    }
  }

  const flags = [
    { flag: "-", field: "left", description: "Left-justify within field width", applicable_to: flagApplicability["-"] },
    { flag: "0", field: "zero", description: "Zero-pad instead of space-pad", applicable_to: flagApplicability["0"] },
    { flag: ".", field: "precision", description: "Precision (truncate strings, min digits for numbers)", applicable_to: flagApplicability["."] },
    { flag: "#", field: "hash", description: "Alternate form (0x/0X prefix for hex)", applicable_to: flagApplicability["#"] },
    { flag: "+", field: "plus", description: "Force sign display for positive numbers", applicable_to: flagApplicability["+"] },
    { flag: " ", field: "space", description: "Space before positive numbers (overridden by +)", applicable_to: flagApplicability[" "] },
    { flag: "*", field: "star", description: "Width from argument", applicable_to: flagApplicability["*"] },
  ];

  const interactions = [
    "'-' overrides '0': if both specified, zero-padding is ignored",
    "'+' overrides ' ': if both specified, space is ignored",
    "'#' only applies to x/X: adds 0x/0X prefix for non-zero values",
    "'.' with 0 and value 0: number conversions print nothing (empty)",
    "'0' with '.' on integers: precision overrides zero-padding",
    "Negative width via '*': treated as '-' flag + positive width",
  ];

  return { conversions, flags, interactions };
}

function detectSpecifiers(filename: string, source: string): string[] {
  const map: Record<string, string[]> = {
    "ft_print_char.c": ["c", "%"],
    "ft_print_str.c": ["s"],
    "ft_print_int.c": ["d", "i"],
    "ft_print_unsigned.c": ["u"],
    "ft_print_hex.c": ["x", "X"],
    "ft_print_ptr.c": ["p"],
  };
  return map[filename] || [];
}

function detectFlagsInHandler(source: string): string[] {
  const flags: string[] = [];
  if (source.includes(".left") || source.includes("flags.left") || source.includes("flags->left")) flags.push("-");
  if (source.includes(".zero") || source.includes("flags.zero") || source.includes("flags->zero")) flags.push("0");
  if (source.includes(".precision") || source.includes("flags.precision") || source.includes("flags->precision")) flags.push(".");
  if (source.includes(".hash") || source.includes("flags.hash") || source.includes("flags->hash")) flags.push("#");
  if (source.includes(".plus") || source.includes("flags.plus") || source.includes("flags->plus")) flags.push("+");
  if (source.includes(".space") || source.includes("flags.space") || source.includes("flags->space")) flags.push(" ");
  if (source.includes(".width") || source.includes("flags.width") || source.includes("flags->width")) flags.push("*");
  return flags;
}

function extractNotes(spec: string, source: string): string[] {
  const notes: string[] = [];
  if (spec === "s" && source.includes("(null)")) notes.push("NULL string prints '(null)'");
  if (spec === "s" && source.includes("precision")) notes.push("Precision truncates string output");
  if (spec === "p" && (source.includes("(nil)") || source.includes("PTRNULL"))) notes.push("NULL pointer prints '(nil)'");
  if ((spec === "d" || spec === "i") && source.includes("precision")) notes.push("Precision sets minimum digits");
  if ((spec === "x" || spec === "X") && source.includes("hash")) notes.push("# flag adds 0x/0X prefix for non-zero");
  return notes;
}
