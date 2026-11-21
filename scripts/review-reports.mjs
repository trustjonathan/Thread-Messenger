// Owner-only script. Never expose the service-role key in the client or commit it.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Error: Missing required environment variables.\n' +
    'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.\n' +
    'Example:\n' +
    '  SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/review-reports.mjs [--limit N]'
  );
  process.exit(1);
}

// Parse --limit flag (default 20)
function parseLimitArg() {
  const args = process.argv.slice(2);
  let limit = 20;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
      i++;
    } else if (arg.startsWith('--limit=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
    }
  }

  return limit;
}

const limit = parseLimitArg();

// Initialize Supabase admin client (service-role bypasses RLS for reports review)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  try {
    // 1. Fetch latest reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, reporter_id, message_id, user_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (reportsError) {
      console.error(`Failed to fetch reports: ${reportsError.message}`);
      process.exit(1);
    }

    if (!reports || reports.length === 0) {
      console.log('No reports found.');
      return;
    }

    // 2. Collect unique message IDs & user IDs
    const userIds = new Set();
    const messageIds = new Set();

    for (const r of reports) {
      if (r.reporter_id) userIds.add(r.reporter_id);
      if (r.user_id) userIds.add(r.user_id);
      if (r.message_id) messageIds.add(r.message_id);
    }

    // 3. Batch fetch messages
    const messageMap = new Map();
    if (messageIds.size > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, body, sender_id')
        .in('id', Array.from(messageIds));

      if (!messagesError && messages) {
        for (const m of messages) {
          messageMap.set(m.id, m);
          if (m.sender_id) userIds.add(m.sender_id);
        }
      }
    }

    // 4. Batch fetch profiles
    const profileMap = new Map();
    if (userIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', Array.from(userIds));

      if (!profilesError && profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, p.username);
        }
      }
    }

    // 5. Format rows
    const tableRows = reports.map((r) => {
      const reporterUsername = profileMap.get(r.reporter_id) || '[unknown]';
      const msg = r.message_id ? messageMap.get(r.message_id) : null;

      // Determine reported username: either direct target user or sender of reported message
      let reportedUsername = r.user_id ? profileMap.get(r.user_id) : null;
      if (!reportedUsername && msg?.sender_id) {
        reportedUsername = profileMap.get(msg.sender_id);
      }
      reportedUsername = reportedUsername || '[none]';

      // Truncate message text to 120 characters
      let reportedText = '[no message]';
      if (msg?.body) {
        reportedText =
          msg.body.length > 120 ? `${msg.body.slice(0, 117)}...` : msg.body;
      } else if (r.message_id) {
        reportedText = '[deleted message]';
      }

      return {
        'created_at': new Date(r.created_at).toISOString(),
        'reporter username': `@${reporterUsername}`,
        'reported username': `@${reportedUsername}`,
        'reported message text': reportedText,
        'reason': r.reason,
      };
    });

    console.log(`\nLatest ${tableRows.length} report(s) (limit: ${limit}):\n`);
    console.table(tableRows);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected error while querying reports: ${errorMsg}`);
    process.exit(1);
  }
}

main();
