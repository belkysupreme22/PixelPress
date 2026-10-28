export async function POST(request) {
  try {
    const data = await request.json();
    const { timestamp, tag, message } = data;

    // Terminal ANSI colors for clean VS Code display:
    // Green for DONE/SUCCESS, Cyan for CODEC, Yellow for WARN/OPTIMAL, Red for ERROR, Magenta for STAGE/CONFIG
    let tagColor = '\x1b[32m'; // green default
    if (tag === 'CODEC') tagColor = '\x1b[36m'; // cyan
    else if (tag === 'WARN' || tag === 'OPTIMAL') tagColor = '\x1b[33m'; // yellow
    else if (tag === 'ERROR') tagColor = '\x1b[31m'; // red
    else if (tag === 'STAGE' || tag === 'CONFIG') tagColor = '\x1b[35m'; // magenta
    else if (tag === 'INIT') tagColor = '\x1b[34m'; // blue
    else if (tag === 'ARCHIVE' || tag === 'EXPORT') tagColor = '\x1b[35m'; // purple

    console.log(`\x1b[90m[${timestamp}]\x1b[0m ${tagColor}[${tag}]\x1b[0m ${message}`);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
}
