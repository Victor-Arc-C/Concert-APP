/** Streams RFC 4180 records (quoted fields, doubled quotes, line breaks inside quotes). */
export async function* csvRecords(
  chunks: Iterable<string> | AsyncIterable<string>,
): AsyncGenerator<string[]> {
  let field = '';
  let record: string[] = [];
  let quoted = false;
  // A quote inside a quoted field either closes it or starts an escaped quote: the next
  // character decides, and it may arrive in the next chunk.
  let quoteSeen = false;
  for await (const chunk of chunks) {
    for (const char of chunk) {
      if (quoted) {
        if (!quoteSeen) {
          if (char === '"') quoteSeen = true;
          else field += char;
          continue;
        }
        quoteSeen = false;
        if (char === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }
      if (char === '"' && field === '') quoted = true;
      else if (char === ',') {
        record.push(field);
        field = '';
      } else if (char === '\n') {
        record.push(field);
        field = '';
        yield record;
        record = [];
      } else if (char !== '\r') field += char;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    yield record;
  }
}
