import { SentryError } from './types';

/**
 * Extracts the Sentry issue ID from either a full URL or a standalone ID.
 * 
 * @param issueIdOrUrl A Sentry issue ID or URL
 * @returns The extracted numeric issue ID
 * @throws SentryError if the input is invalid
 */
export function extractIssueId(issueIdOrUrl: string): string {
  if (!issueIdOrUrl) {
    throw new SentryError('Missing issue_id_or_url argument');
  }

  let issueId: string;

  if (issueIdOrUrl.startsWith('http://') || issueIdOrUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(issueIdOrUrl);

      // Extract issue ID from path
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2 || pathParts[pathParts.length - 2] !== 'issues') {
        throw new SentryError('Invalid Sentry issue URL. Path must contain \'/issues/{issue_id}\'');
      }

      issueId = pathParts[pathParts.length - 1];
    } catch (error) {
      if (error instanceof SentryError) {
        throw error;
      }
      throw new SentryError(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    issueId = issueIdOrUrl;
  }

  // Validate that issue ID is numeric
  if (!/^\d+$/.test(issueId)) {
    throw new SentryError('Invalid Sentry issue ID. Must be a numeric value.');
  }

  return issueId;
}

/**
 * Creates a formatted stacktrace string from the latest Sentry event.
 * 
 * @param latestEvent The latest event data from Sentry
 * @returns A formatted string containing stacktrace information
 */
export function createStacktrace(latestEvent: any): string {
  const stacktraces: string[] = [];
  
  for (const entry of latestEvent.entries || []) {
    if (entry.type !== 'exception') {
      continue;
    }

    const exceptionData = entry.data.values;
    for (const exception of exceptionData) {
      const exceptionType = exception.type || 'Unknown';
      const exceptionValue = exception.value || '';
      const stacktrace = exception.stacktrace;

      let stacktraceText = `Exception: ${exceptionType}: ${exceptionValue}\n\n`;
      
      if (stacktrace) {
        stacktraceText += 'Stacktrace:\n';
        
        for (const frame of stacktrace.frames || []) {
          const filename = frame.filename || 'Unknown';
          const lineno = frame.lineNo || '?';
          const func = frame.function || 'Unknown';

          stacktraceText += `${filename}:${lineno} in ${func}\n`;

          if (frame.context) {
            for (const ctx_line of frame.context) {
              stacktraceText += `    ${ctx_line[1]}\n`;
            }
          }

          stacktraceText += '\n';
        }
      }
      
      stacktraces.push(stacktraceText);
    }
  }

  return stacktraces.length > 0 ? stacktraces.join('\n') : 'No stacktrace found';
}

/**
 * Extracts organization and project ID from a Sentry URL and returns a standardized API URL
 * 
 * @param url A Sentry URL in any format (API, web interface)
 * @returns A standardized Sentry API URL for issues
 * @throws SentryError if required parameters can't be extracted
 */
export function extractIssuesApiUrl(url: string): string {
  if (!url) {
    throw new SentryError("Missing URL argument");
  }

  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    
    // Extract organization from URL
    let organization: string | null = null;
    let project: string | null = null;
    
    // Try to extract parameters from path segments
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    
    // Check if URL contains "/organizations/{org}" segment
    const orgIndex = pathSegments.indexOf('organizations');
    if (orgIndex !== -1 && orgIndex + 1 < pathSegments.length) {
      organization = pathSegments[orgIndex + 1];
    }
    
    // Look for project ID in path or query parameters
    const projectQuery = parsedUrl.searchParams.get('project');
    if (projectQuery) {
      project = projectQuery;
    } else {
      // Try to find project in path for web interface URLs
      const projectsIndex = pathSegments.indexOf('projects');
      if (projectsIndex !== -1 && projectsIndex + 1 < pathSegments.length) {
        project = pathSegments[projectsIndex + 1];
      }
    }
    
    // Ensure we have the required parameters
    if (!organization) {
      throw new SentryError("Could not extract organization from URL");
    }
    
    if (!project) {
      throw new SentryError("Could not extract project ID from URL");
    }
    
    // Build standardized API URL
    const apiUrl = `${baseUrl}/api/0/organizations/${organization}/issues/`;
    
    // Create URL with query parameters
    const finalUrl = new URL(apiUrl);
    
    // Add parameters
    finalUrl.searchParams.set('project', project);
    finalUrl.searchParams.set('limit', '5');
    finalUrl.searchParams.set('sort', 'freq');
    finalUrl.searchParams.set('statsPeriod', '14d');
    
    // Check if query parameter exists in the original URL, if so, preserve it
    const origQuery = parsedUrl.searchParams.get('query');
    if (origQuery) {
      finalUrl.searchParams.set('query', origQuery);
    } else {
      // Default query to show unresolved & unhandled errors
      finalUrl.searchParams.set('query', 'error.unhandled:true is:unresolved');
    }
    
    return finalUrl.toString();
  } catch (error) {
    if (error instanceof SentryError) {
      throw error;
    }
    throw new SentryError(`Invalid URL or URL format: ${error instanceof Error ? error.message : String(error)}`);
  }
}
