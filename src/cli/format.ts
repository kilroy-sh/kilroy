const isTTY = process.stdout.isTTY;

export function output(data: any, opts: { json?: boolean; formatter: (data: any) => { tty: string; piped: string } }) {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const { tty, piped } = opts.formatter(data);
  console.log(isTTY ? tty : piped);
}

export function formatBrowse(data: any): { tty: string; piped: string } {
  const lines: string[] = [];
  const ids: string[] = [];

  // Subtopics
  if (data.subtopics?.length) {
    for (const st of data.subtopics) {
      const count = st.post_count === 1 ? "1 post" : `${st.post_count} posts`;
      lines.push(`  ${st.name}/\t${count}`);
    }
    if (data.posts?.length) lines.push("");
  }

  // Posts
  for (const p of data.posts || []) {
    const date = p.updated_at?.slice(0, 10) || "";
    const shortId = p.id.length > 12 ? p.id.slice(0, 12) + "..." : p.id;
    lines.push(`  ${padRight(p.title, 36)} ${padRight(p.status, 10)} ${date}   ${shortId}`);
    ids.push(p.id);
  }

  if (!data.subtopics?.length && !data.posts?.length) {
    lines.push("  (empty)");
  }

  if (data.has_more) {
    lines.push(`\n  --cursor ${data.next_cursor} for more`);
  }

  return { tty: lines.join("\n"), piped: ids.join("\n") };
}

export function formatPost(data: any): { tty: string; piped: string } {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);

  const meta: string[] = [];
  if (data.topic) meta.push(`topic: ${data.topic}`);
  meta.push(`status: ${data.status}`);
  if (data.author) meta.push(`by: ${data.author}`);
  lines.push(meta.join(" | "));

  if (data.tags?.length) lines.push(`tags: ${data.tags.join(", ")}`);
  if (data.files?.length) lines.push(`files: ${data.files.join(", ")}`);
  if (data.commit_sha) lines.push(`commit_sha: ${data.commit_sha}`);

  const created = data.created_at?.slice(0, 10) || "";
  const updated = data.updated_at?.slice(0, 10) || "";
  lines.push(`created: ${created}  updated: ${updated}`);
  lines.push("");
  lines.push(data.body || "");

  if (data.comments?.length) {
    for (const c of data.comments) {
      lines.push("");
      lines.push("---");
      const cDate = c.created_at?.slice(0, 10) || "";
      lines.push(`**${c.author || "anonymous"}** \u00b7 ${cDate}`);
      lines.push(c.body || "");
    }
  }

  // Piped: body + comments as plain markdown
  const piped = [data.body || ""];
  for (const c of data.comments || []) {
    piped.push("");
    piped.push(c.body || "");
  }

  return { tty: lines.join("\n"), piped: piped.join("\n") };
}

export function formatSearch(data: any): { tty: string; piped: string } {
  const lines: string[] = [];
  const ids: string[] = [];

  for (const r of data.results || []) {
    const shortId = r.post_id.length > 12 ? r.post_id.slice(0, 12) + "..." : r.post_id;
    lines.push(`${r.topic}: ${r.title}   ${shortId}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
    lines.push("");
    ids.push(r.post_id);
  }

  if (!data.results?.length) {
    lines.push("No results found.");
  }

  if (data.has_more) {
    lines.push(`--cursor ${data.next_cursor} for more`);
  }

  return { tty: lines.join("\n"), piped: ids.join("\n") };
}

export function formatCreated(data: any, label: string): { tty: string; piped: string } {
  const ttyLine = `${label}: ${data.id}`;
  return { tty: ttyLine, piped: data.id };
}

export function formatStatus(data: any): { tty: string; piped: string } {
  return {
    tty: `${data.id}: ${data.status}`,
    piped: data.id,
  };
}

export function formatDeleted(data: any): { tty: string; piped: string } {
  return {
    tty: `Deleted ${data.post_id}`,
    piped: data.post_id,
  };
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
