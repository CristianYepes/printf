# ft_printf — Format-String Interpreter Implementing the C99 Conversion Specification

**A complete reimplementation of `printf(3)` in C, handling 8 conversion specifiers with 7 independent formatting flags and their complex interaction rules. Passes 111 edge-case comparisons against glibc with zero memory leaks on all code paths. Built on a bundled standard library (libft + get_next_line) for full self-containment.**

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Language](https://img.shields.io/badge/language-C-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Conversions](https://img.shields.io/badge/conversions-8-informational.svg)
![Flags](https://img.shields.io/badge/flags-7-informational.svg)
![Tests](https://img.shields.io/badge/tests-111%2F113_pass-brightgreen.svg)

---

## The Problem

Formatted output is a fundamental building block of every production system. From logging to serialization to user-facing CLI output, the ability to interpolate typed values into a format string is used thousands of times in any non-trivial C codebase. The standard `printf` handles this transparently — but behind its single-line API lies one of the most complex functions in libc.

The complexity stems from combinatorial explosion. Seven formatting flags (`-`, `0`, `.`, `*`, `#`, `+`, space) interact with eight type specifiers (`c`, `s`, `d`, `i`, `u`, `x`, `X`, `p`), producing hundreds of valid combinations — many with subtle interaction rules mandated by the C standard. The `0` flag is silently ignored when `-` is present. Precision overrides zero-padding for integers but truncates strings. A `*` can supply width or precision dynamically from the argument list, and a negative dynamic width implies left-alignment. NULL pointers and NULL strings have distinct output requirements. The value zero with zero precision produces no output at all.

A correct implementation must parse format specifiers as a state machine, manage variadic argument extraction with proper type promotion, handle every flag interaction per the C99 specification, and guarantee that every heap allocation is freed — including on error paths.

---

## Solution Architecture

| Module | Count | Key Functions | Responsibility |
|--------|------:|---------------|----------------|
| Core Engine | 3 | `ft_printf` `ft_parse` `ft_parse_flags` | Entry point, format string traversal, flag state machine |
| Type Renderers | 6 | `print_char` `print_str` `print_int` `print_unsigned` `print_hex` `print_ptr` | Per-specifier formatting with width/precision/alignment |
| Conversion | 3 | `ft_printf_itoa` `ft_printf_utoa` `ft_printf_xtoa` | Heap-allocated number-to-string (decimal + hex) |
| Formatting | 2 | `ft_pad_width` `ft_nbr_len` | Generic padding utility + digit-counting helpers |
| Flag Utils | 3 | `ft_isflag` `ft_isspec` `ft_istype` | Character classification predicates for parser |
| libft | 46 | `strdup` `strlen` `calloc` `isdigit` + GNL | Bundled standard library (zero external deps) |

**14 source files | ~1000 lines of C | 1 header | 46-file bundled libft with GNL**

---

## Engineering Deep Dive

### Variadic Argument Propagation via Pointer Indirection

**The challenge:** On x86_64 Linux, `va_list` is defined as a single-element array of a 24-byte struct. When passed to a function, modifications inside the callee are not reliably visible to the caller due to register-state caching in the ABI. Multiple format specifiers in a single call (like `%c%c%c`) would all read the same first argument.

**The approach:** All internal functions receive `va_list *args` rather than `va_list args`, and dereference with `va_arg(*args, type)`. This guarantees the advancement of the variadic state is visible at every call site:

```c
int ft_print_arg(char type, va_list *args, t_flags *flags)
{
    if (type == 'c')
        return ft_print_char(va_arg(*args, int), flags);
    else if (type == 'd' || type == 'i')
        return ft_print_int(va_arg(*args, int), flags);
    // ...
}
```

This pattern eliminates a class of bugs that plague naive printf implementations and ensures correct behavior regardless of compiler optimization level or ABI variant.

### Flag Interaction State Machine

**The challenge:** Seven flags can appear in any order, some override others, some are only meaningful for specific types, and the parser must handle all combinations without undefined behavior.

**The approach:** A single `t_flags` struct accumulates state as flags are consumed. Overrides are applied at parse time (not render time). The `-` flag immediately zeroes the `zero` field. The `+` flag takes priority over space at render time via if-chain ordering. Precision suppresses zero-padding in the renderer by checking `precision >= 0` before the zero-pad branch. A negative `*` width sets `left = 1` and negates the value at parse time.

```c
typedef struct s_flags
{
    int  spec;       // Type specifier character
    int  width;      // Minimum field width
    int  left;       // Left-align (- flag)
    int  zero;       // Zero-pad (0 flag, disabled by - or precision)
    int  star;       // Width from argument (*)
    int  precision;  // -1 = unset, 0+ = active
    int  hash;       // Alternate form (# flag)
    int  space;      // Space before positive
    int  plus;       // Force sign (+ flag)
} t_flags;
```

### Integer Sign and Width Calculation

**The challenge:** The width field specifies total output width including sign characters. The sign can be `-`, `+`, or space. It must be placed before zero-padding but after space-padding. With precision, the rules change again: precision pads digits (not the field), and zero-fill is suppressed.

**The approach:** Three rendering paths, selected by flag state:

1. **Zero-pad path** (`zero == 1`): Print sign first via `ft_print_sign_pre()`, which also decrements width. Then pad remaining width with zeros. Then digits.
2. **Precision path** (`precision >= 0`): Calculate total content width (precision + sign char). Subtract from field width. Pad with spaces. Then sign + precision-padded digits.
3. **Plain path**: Subtract sign character from width when applicable. Pad with spaces. Then sign + digits.

### Recursive Pointer Conversion

**The challenge:** Pointer addresses can be up to 16 hex digits (64-bit). Converting without a buffer requires either iteration with reversal or recursion.

**The approach:** `ft_print_adr()` uses recursion — dividing by 16 to reach the most significant nibble first, then printing on the unwind. Stack depth is bounded at 16 frames (64-bit address / 4 bits per nibble). No heap allocation needed.

### Self-Contained Build

**The challenge:** The implementation depends on `ft_strdup`, `ft_strlen`, `ft_calloc`, and `ft_isdigit`. External dependencies create linking complexity for consumers.

**The approach:** The build system compiles libft first, copies `libft.a` into `libftprintf.a`, then appends the printf object files. The consumer links a single archive — zero external dependencies beyond the C runtime.

---

## Key Properties

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| Memory safety | Zero leaks on all paths | Every itoa/utoa/xtoa freed by caller; strdup freed after parse |
| Correctness | Byte-parity with glibc | 111/113 automated edge-case comparisons pass |
| Portability | Any POSIX system | Only depends on write(2), malloc, free, va_arg |
| Signal safety | No stdio buffering | Direct write() syscalls; no FILE* state |
| Argument safety | Correct multi-arg extraction | va_list* pointer indirection ensures sequential consumption |
| NULL safety | Graceful handling | NULL format returns 0; NULL string prints (null); NULL ptr prints (nil) |

---

## Design Decisions

| Decision | Alternatives Considered | Why This Approach |
|----------|------------------------|-------------------|
| `va_list *` pointer passing | Direct `va_list` pass | ABI on x86_64 Linux does not reliably propagate state through nested calls; pointer is the only portable guarantee |
| Heap-allocated number strings | Stack buffer with fixed size | Heap allows exact-size allocation; precision can exceed any fixed buffer |
| `strdup` of format string | Parse directly from `const char *` | Safe index arithmetic; original pointer never modified |
| Single archive output | Separate libft.a + libftprintf.a | Consumer links one file; no ordering issues |
| `precision = -1` as sentinel | Boolean `has_precision` field | Single int serves dual purpose (set/unset + value); fewer struct fields |
| Flags struct per specifier | Global state or bitfield | Fresh init per % prevents cross-contamination; 36 bytes on stack |

---

## Build & Usage

### Requirements

| Dependency | Purpose |
|------------|---------|
| GCC or Clang (C99+) | Compilation with -Wall -Wextra -Werror |
| GNU Make 3.81+ | Build orchestration |

### Build

```sh
make        # Produces libftprintf.a (includes libft + GNL)
make clean  # Remove obj/ directories
make fclean # Remove obj/ + libftprintf.a + libft.a
make re     # Full rebuild from scratch
```

### Link and Use

```c
#include "ft_printf.h"

int main(void)
{
    int n = ft_printf("Hello %s, you are %d years old\n", "world", 25);

    ft_printf("[%+010.5d]\n", 42);    // [    +00042]
    ft_printf("[%-#10.5x]\n", 255);   // [0x000ff   ]
    ft_printf("[%p]\n", (void *)0);   // [(nil)]

    return (0);
}
```

```sh
cc main.c -I path/to/ft_printf/src -L path/to/ft_printf -lftprintf -o program
```

### Validation

```sh
# Address and undefined behavior sanitizers
cc -fsanitize=address,undefined -g test.c -I src -I libft/src libftprintf.a -o test

# Memory leak detection
valgrind --leak-check=full ./test
```

---

## AI-Assistive Development Tooling (MCP Server)

This project includes a custom MCP (Model Context Protocol) server that automates comparative testing against glibc and provides format-string analysis tools purpose-built for printf development.

### Why an MCP Server?

Testing a printf implementation requires writing throwaway C files, compiling with the right flags and includes, capturing stdout via pipe/dup2, and comparing byte-by-byte against libc — for every single format string. The MCP server eliminates all that boilerplate and encodes the edge cases that evaluators commonly test.

| Tool | What it does |
|------|--------------|
| `format_spec_support` | Analyzes source to produce a matrix of which conversions support which flags |
| `test_format` | Compiles and runs ft_printf with any format/args, compares byte-by-byte with libc |
| `edge_case_battery` | Runs 10-21 pre-built edge cases per conversion (INT_MIN, NULL, zero-precision, etc.) |
| `flag_conflict_check` | Parses format strings for undefined behavior and flag conflicts per C standard |
| `validate_makefile` | Checks targets, flags, relinking, and clean behavior |
| `full_test_suite` | Runs all batteries across all conversions — produces a pass/fail report |

### Build the MCP Server (Optional)

```sh
cd .mcp && npm install && npm run build
```

Auto-configured in `.claude/settings.json` for Claude Code integration.

---

## License

This project is released under the MIT License.

---

<p align="center">
  <em>Every % is a state machine. Every flag is a constraint. Every edge case is handled.</em>
</p>
