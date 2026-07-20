import { compileAndRun, ensureLibBuilt } from "../helpers/compile.js";

interface TestArg {
  value: string;
  type: "int" | "unsigned" | "string" | "pointer" | "char";
}

interface FormatTestResult {
  ft_printf_output: string;
  ft_printf_return: number;
  libc_output?: string;
  libc_return?: number;
  match?: boolean;
  differences?: string[];
  error?: string;
}

export function generateTestSource(
  formatString: string,
  args: TestArg[],
  compareLibc: boolean
): string {
  const includes = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "ft_printf.h"
`;

  const argDeclarations = args.map((arg, i) => {
    switch (arg.type) {
      case "int": return `    int arg${i} = ${arg.value};`;
      case "unsigned": return `    unsigned int arg${i} = ${arg.value};`;
      case "string": return arg.value === "NULL"
        ? `    char *arg${i} = NULL;`
        : `    char *arg${i} = ${JSON.stringify(arg.value)};`;
      case "pointer": return arg.value === "NULL"
        ? `    void *arg${i} = NULL;`
        : `    void *arg${i} = (void *)${arg.value};`;
      case "char": return `    char arg${i} = ${arg.value};`;
      default: return `    int arg${i} = ${arg.value};`;
    }
  }).join("\n");

  const argList = args.map((_, i) => `arg${i}`).join(", ");
  const fmtArgs = argList ? `, ${argList}` : "";

  const escapedFmt = formatString.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  let mainBody = `
int main(void) {
${argDeclarations}

    // Capture ft_printf output
    int pipefd1[2];
    pipe(pipefd1);
    int saved1 = dup(1);
    dup2(pipefd1[1], 1);
    close(pipefd1[1]);

    int ft_ret = ft_printf("${escapedFmt}"${fmtArgs});

    fflush(stdout);
    dup2(saved1, 1);
    close(saved1);
    char ft_buf[4096] = {0};
    int ft_n = read(pipefd1[0], ft_buf, sizeof(ft_buf) - 1);
    if (ft_n < 0) ft_n = 0;
    ft_buf[ft_n] = '\\0';
    close(pipefd1[0]);
`;

  if (compareLibc) {
    mainBody += `
    // Capture printf output
    int pipefd2[2];
    pipe(pipefd2);
    int saved2 = dup(1);
    dup2(pipefd2[1], 1);
    close(pipefd2[1]);

    int libc_ret = printf("${escapedFmt}"${fmtArgs});

    fflush(stdout);
    dup2(saved2, 1);
    close(saved2);
    char libc_buf[4096] = {0};
    int libc_n = read(pipefd2[0], libc_buf, sizeof(libc_buf) - 1);
    if (libc_n < 0) libc_n = 0;
    libc_buf[libc_n] = '\\0';
    close(pipefd2[0]);

    // Output results
    fprintf(stderr, "FT_RET=%d\\n", ft_ret);
    fprintf(stderr, "FT_OUT=");
    write(2, ft_buf, ft_n);
    fprintf(stderr, "\\nLIBC_RET=%d\\n", libc_ret);
    fprintf(stderr, "LIBC_OUT=");
    write(2, libc_buf, libc_n);
    fprintf(stderr, "\\nMATCH=%d\\n", (ft_ret == libc_ret && ft_n == libc_n && memcmp(ft_buf, libc_buf, ft_n) == 0));
`;
  } else {
    mainBody += `
    fprintf(stderr, "FT_RET=%d\\n", ft_ret);
    fprintf(stderr, "FT_OUT=");
    write(2, ft_buf, ft_n);
    fprintf(stderr, "\\n");
`;
  }

  mainBody += `
    return 0;
}`;

  return includes + mainBody;
}

export function parseTestOutput(stderr: string, compareLibc: boolean): FormatTestResult {
  const lines = stderr.split("\n");
  const result: FormatTestResult = {
    ft_printf_output: "",
    ft_printf_return: -1,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("FT_RET=")) {
      result.ft_printf_return = parseInt(line.slice(7));
    } else if (line.startsWith("FT_OUT=")) {
      result.ft_printf_output = line.slice(7);
    } else if (line.startsWith("LIBC_RET=")) {
      result.libc_return = parseInt(line.slice(9));
    } else if (line.startsWith("LIBC_OUT=")) {
      result.libc_output = line.slice(9);
    } else if (line.startsWith("MATCH=")) {
      result.match = line.slice(6) === "1";
    }
  }

  if (compareLibc && result.match === false) {
    result.differences = [];
    if (result.ft_printf_return !== result.libc_return) {
      result.differences.push(`Return value: ft_printf=${result.ft_printf_return}, printf=${result.libc_return}`);
    }
    if (result.ft_printf_output !== result.libc_output) {
      result.differences.push(`Output: ft_printf="${result.ft_printf_output}", printf="${result.libc_output}"`);
    }
  }

  return result;
}
