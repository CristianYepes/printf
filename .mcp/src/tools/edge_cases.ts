export interface EdgeCase {
  format: string;
  args: { value: string; type: "int" | "unsigned" | "string" | "pointer" | "char" }[];
  description: string;
}

export type Conversion = "c" | "s" | "p" | "d" | "i" | "u" | "x" | "X" | "percent";

export function getEdgeCases(conversion: Conversion): EdgeCase[] {
  switch (conversion) {
    case "c":
      return [
        { format: "%c", args: [{ value: "'A'", type: "char" }], description: "Basic character" },
        { format: "%c", args: [{ value: "'0'", type: "char" }], description: "Zero character (not null)" },
        { format: "%c", args: [{ value: "0", type: "int" }], description: "Null character (ascii 0)" },
        { format: "%c", args: [{ value: "127", type: "int" }], description: "DEL character (127)" },
        { format: "%c", args: [{ value: "255", type: "int" }], description: "Max unsigned char value" },
        { format: "%-5c", args: [{ value: "'x'", type: "char" }], description: "Left-justify with width" },
        { format: "%5c", args: [{ value: "'x'", type: "char" }], description: "Right-justify with width" },
        { format: "%1c", args: [{ value: "'A'", type: "char" }], description: "Width equal to content" },
        { format: "%c%c%c", args: [{ value: "'a'", type: "char" }, { value: "'b'", type: "char" }, { value: "'c'", type: "char" }], description: "Multiple chars" },
      ];

    case "s":
      return [
        { format: "%s", args: [{ value: "Hello", type: "string" }], description: "Basic string" },
        { format: "%s", args: [{ value: "", type: "string" }], description: "Empty string" },
        { format: "%s", args: [{ value: "NULL", type: "string" }], description: "NULL pointer" },
        { format: "%.3s", args: [{ value: "Hello", type: "string" }], description: "Precision truncation" },
        { format: "%.0s", args: [{ value: "Hello", type: "string" }], description: "Zero precision (empty)" },
        { format: "%.6s", args: [{ value: "NULL", type: "string" }], description: "NULL with precision >= 6" },
        { format: "%.5s", args: [{ value: "NULL", type: "string" }], description: "NULL with precision < 6" },
        { format: "%10s", args: [{ value: "hi", type: "string" }], description: "Width > string length" },
        { format: "%-10s", args: [{ value: "hi", type: "string" }], description: "Left-justify with width" },
        { format: "%2s", args: [{ value: "hello", type: "string" }], description: "Width < string length" },
        { format: "%.10s", args: [{ value: "hi", type: "string" }], description: "Precision > string length" },
        { format: "%10.3s", args: [{ value: "hello", type: "string" }], description: "Width + precision" },
        { format: "%-10.3s", args: [{ value: "hello", type: "string" }], description: "Left + width + precision" },
      ];

    case "p":
      return [
        { format: "%p", args: [{ value: "NULL", type: "pointer" }], description: "NULL pointer" },
        { format: "%p", args: [{ value: "(void *)1", type: "pointer" }], description: "Low address" },
        { format: "%p", args: [{ value: "(void *)0xdeadbeef", type: "pointer" }], description: "Typical address" },
        { format: "%p", args: [{ value: "(void *)0xffffffffffffffff", type: "pointer" }], description: "Max 64-bit address" },
        { format: "%20p", args: [{ value: "(void *)0x1234", type: "pointer" }], description: "Width > pointer" },
        { format: "%-20p", args: [{ value: "(void *)0x1234", type: "pointer" }], description: "Left-justify pointer" },
      ];

    case "d":
    case "i":
      return [
        { format: `%${conversion}`, args: [{ value: "0", type: "int" }], description: "Zero" },
        { format: `%${conversion}`, args: [{ value: "42", type: "int" }], description: "Positive number" },
        { format: `%${conversion}`, args: [{ value: "-42", type: "int" }], description: "Negative number" },
        { format: `%${conversion}`, args: [{ value: "2147483647", type: "int" }], description: "INT_MAX" },
        { format: `%${conversion}`, args: [{ value: "-2147483648", type: "int" }], description: "INT_MIN" },
        { format: `%.0${conversion}`, args: [{ value: "0", type: "int" }], description: "Zero with zero precision" },
        { format: `%.5${conversion}`, args: [{ value: "42", type: "int" }], description: "Precision > digits" },
        { format: `%10${conversion}`, args: [{ value: "42", type: "int" }], description: "Width > digits" },
        { format: `%-10${conversion}`, args: [{ value: "42", type: "int" }], description: "Left-justify" },
        { format: `%010${conversion}`, args: [{ value: "42", type: "int" }], description: "Zero-pad" },
        { format: `%010${conversion}`, args: [{ value: "-42", type: "int" }], description: "Zero-pad negative" },
        { format: `%+${conversion}`, args: [{ value: "42", type: "int" }], description: "Plus flag positive" },
        { format: `%+${conversion}`, args: [{ value: "-42", type: "int" }], description: "Plus flag negative" },
        { format: `% ${conversion}`, args: [{ value: "42", type: "int" }], description: "Space flag positive" },
        { format: `% ${conversion}`, args: [{ value: "-42", type: "int" }], description: "Space flag negative" },
        { format: `%+10${conversion}`, args: [{ value: "42", type: "int" }], description: "Plus with width" },
        { format: `%+010${conversion}`, args: [{ value: "42", type: "int" }], description: "Plus with zero-pad width" },
        { format: `% 010${conversion}`, args: [{ value: "42", type: "int" }], description: "Space with zero-pad width" },
        { format: `%10.5${conversion}`, args: [{ value: "42", type: "int" }], description: "Width + precision" },
        { format: `%-10.5${conversion}`, args: [{ value: "42", type: "int" }], description: "Left + width + precision" },
        { format: `%+10.5${conversion}`, args: [{ value: "42", type: "int" }], description: "Plus + width + precision" },
      ];

    case "u":
      return [
        { format: "%u", args: [{ value: "0", type: "unsigned" }], description: "Zero" },
        { format: "%u", args: [{ value: "42", type: "unsigned" }], description: "Basic unsigned" },
        { format: "%u", args: [{ value: "4294967295u", type: "unsigned" }], description: "UINT_MAX" },
        { format: "%.0u", args: [{ value: "0", type: "unsigned" }], description: "Zero with zero precision" },
        { format: "%.5u", args: [{ value: "42", type: "unsigned" }], description: "Precision > digits" },
        { format: "%10u", args: [{ value: "42", type: "unsigned" }], description: "Width > digits" },
        { format: "%-10u", args: [{ value: "42", type: "unsigned" }], description: "Left-justify" },
        { format: "%010u", args: [{ value: "42", type: "unsigned" }], description: "Zero-pad" },
        { format: "%10.5u", args: [{ value: "42", type: "unsigned" }], description: "Width + precision" },
        { format: "%-10.5u", args: [{ value: "42", type: "unsigned" }], description: "Left + width + precision" },
      ];

    case "x":
    case "X":
      return [
        { format: `%${conversion}`, args: [{ value: "0", type: "unsigned" }], description: "Zero" },
        { format: `%${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Basic hex" },
        { format: `%${conversion}`, args: [{ value: "4294967295u", type: "unsigned" }], description: "UINT_MAX" },
        { format: `%#${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Hash flag non-zero" },
        { format: `%#${conversion}`, args: [{ value: "0", type: "unsigned" }], description: "Hash flag with zero (no prefix)" },
        { format: `%.0${conversion}`, args: [{ value: "0", type: "unsigned" }], description: "Zero with zero precision" },
        { format: `%.5${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Precision > digits" },
        { format: `%10${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Width > digits" },
        { format: `%-10${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Left-justify" },
        { format: `%010${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Zero-pad" },
        { format: `%#10${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Hash + width" },
        { format: `%#010${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Hash + zero-pad width" },
        { format: `%#10.5${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Hash + width + precision" },
        { format: `%-#10.5${conversion}`, args: [{ value: "255", type: "unsigned" }], description: "Left + hash + width + precision" },
      ];

    case "percent":
      return [
        { format: "%%", args: [], description: "Basic percent" },
        { format: "%5%", args: [], description: "Width on percent" },
        { format: "%-5%", args: [], description: "Left-justify percent" },
        { format: "abc%%def", args: [], description: "Percent in context" },
        { format: "%%%%", args: [], description: "Double percent" },
      ];

    default:
      return [];
  }
}
