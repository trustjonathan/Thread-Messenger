// Owner-only script. Never expose the service-role key in the client or commit it.

const DEFAULT_LIMIT = 20;
const USAGE = 'Usage: node scripts/review-reports.mjs [--limit <positive integer>]';

function parseArgs(args) {
  let limit = DEFAULT_LIMIT;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return null;
    }

    if (arg === '--limit') {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error('Missing value for --limit.\n' + USAGE);
      }
      index += 1;
      limit = Number(value);
    } else if (arg.startsWith('--limit=')) {
      limit = Number(arg.slice('--limit='.length));
    } else {
      throw new Error('Unknown argument.\n' + USAGE);
    }

    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error('--limit must be a positive integer.\n' + USAGE);
    }
  }

  return limit;
}

function firstRelation(value) {
  return Array.isArray(value) ? value[0] : value;
}

function textOrEmpty(...values) {
  const value = values.find((candidate) => typeof candidate === 'string');
  return value ?? '';
}

function redactSecret(value, secret) {
  return secret ? value.split(secret).join('[REDACTED]') : value;
}

function truncate(value, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + '...';
}

function mapReport(row, serviceRoleKey) {
  const reporter = firstRelation(row.reporter);
  const reportedUser = firstRelation(row.reported_user);
  const message = firstRelation(row.message);
  const messageSender = firstRelation(message?.sender);

  return {
    created_at: redactSecret(textOrEmpty(row.created_at), serviceRoleKey),
    'reporter username': redactSecret(textOrEmpty(reporter?.username), serviceRoleKey),
    'reported username': redactSecret(
      textOrEmpty(messageSender?.username, reportedUser?.username),
      serviceRoleKey,
    ),
    'reported message text': truncate(
      redactSecret(textOrEmpty(message?.body), serviceRoleKey),
    ),
    reason: redactSecret(textOrEmpty(row.reason), serviceRoleKey),
  };
}

async function fetchReports(supabaseUrl, serviceRoleKey, limit) {
  const url = new URL('/rest/v1/reports', supabaseUrl);
  url.search = new URLSearchParams({
    select: 'created_at,reason,reporter:profiles!reports_reporter_id_fkey(username),reported_user:profiles!reports_user_id_fkey(username),message:messages!reports_message_id_fkey(body,sender:profiles!messages_sender_id_fkey(username))',
    order: 'created_at.desc',
    limit: String(limit),
  }).toString();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      'Supabase returned HTTP ' + response.status + '. Check the reports table, relationships, and service-role permissions.',
    );
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error('Supabase returned an unexpected reports response.');
  }
  return rows.map((row) => mapReport(row, serviceRoleKey));
}

async function main() {
  const limit = parseArgs(process.argv.slice(2));
  if (limit === null) return;

  const supabaseUrlValue = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (!supabaseUrlValue) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error('Missing required environment variable(s): ' + missing.join(', ') + '.');
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(supabaseUrlValue);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }
  if (supabaseUrl.protocol !== 'https:' && supabaseUrl.protocol !== 'http:') {
    throw new Error('SUPABASE_URL must use HTTP or HTTPS.');
  }

  const reports = await fetchReports(supabaseUrl, serviceRoleKey, limit);
  if (reports.length === 0) {
    console.log('No reports found.');
    return;
  }
  console.table(reports);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Could not load reports.');
  process.exitCode = 1;
});
