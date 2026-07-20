import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface FormatSpec {
  conversion: string;
  handler_file: string;
  supported_flags: string[];
}

export interface FlagInfo {
  name: string;
  field: string;
  description: string;
}

export function parseSourceFiles(projectDir: string): string[] {
  const files = readdirSync(projectDir).filter(f => f.endsWith(".c"));
  return files.map(f => join(projectDir, f));
}

export function readSource(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

export function extractFunctionNames(source: string): string[] {
  const regex = /^(?:static\s+)?(?:int|void|char\s*\*|size_t|unsigned)\s+(ft_\w+)\s*\(/gm;
  const names: string[] = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}
