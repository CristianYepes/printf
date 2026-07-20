import { execSync, spawnSync } from "child_process";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface CompileResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
}

export function compileAndRun(
  sourceCode: string,
  projectDir: string,
  extraFlags: string[] = [],
  timeout: number = 5000,
  stdin?: string
): CompileResult {
  const tmp = mkdtempSync(join(tmpdir(), "mcp-printf-"));
  const srcFile = join(tmp, "test.c");
  const binFile = join(tmp, "test");

  try {
    writeFileSync(srcFile, sourceCode);

    const compileCmd = [
      "cc", "-Wall", "-Wextra", "-Werror",
      ...extraFlags,
      srcFile,
      "-o", binFile,
      `-I${projectDir}/src`,
      `-I${projectDir}/libft/src`,
      `${projectDir}/libftprintf.a`,
    ].join(" ");

    try {
      execSync(compileCmd, { cwd: projectDir, timeout, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      return {
        success: false,
        error: `Compilation failed:\n${err.stderr?.toString() || err.message}`,
        exitCode: err.status || 1,
      };
    }

    const result = spawnSync(binFile, [], {
      timeout,
      encoding: "utf-8",
      input: stdin,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      success: result.status === 0,
      output: result.stdout?.toString() || "",
      error: result.stderr?.toString() || "",
      exitCode: result.status ?? 1,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      exitCode: err.status || 1,
    };
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

export function ensureLibBuilt(projectDir: string): string | null {
  try {
    execSync("make", { cwd: projectDir, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
    return null;
  } catch (err: any) {
    return `Make failed:\n${err.stderr?.toString() || err.message}`;
  }
}
