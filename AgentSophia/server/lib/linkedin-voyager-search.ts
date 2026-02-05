import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { decryptToken } from './encryption';
import { Pool } from 'pg';
import { getOrAllocateProxy } from './proxy-orchestration';

const linkedInPool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '',
  ssl: process.env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : false,
  max: 5,
});

interface VoyagerSearchResult {
  success: boolean;
  results: any[];
  totalCount: number;
  error?: string;
}

interface CookieData {
  name: string;
  value: string;
}

async function getSessionCookies(workspaceId: string, accountId: string): Promise<CookieData[] | null> {
  try {
    console.log(`[Voyager API] Looking for session - workspace: ${workspaceId}, account: ${accountId}`);
    
    const result = await linkedInPool.query(
      `SELECT session_cookies_encrypted, is_active, session_source
       FROM linkedin_puppeteer_settings 
       WHERE workspace_id = $1 AND session_cookies_encrypted IS NOT NULL
       ORDER BY session_captured_at DESC NULLS LAST
       LIMIT 1`,
      [workspaceId]
    );
    
    console.log(`[Voyager API] Query returned ${result.rows.length} rows`);
    
    if (result.rows.length > 0 && result.rows[0].session_cookies_encrypted) {
      console.log(`[Voyager API] Found session - is_active: ${result.rows[0].is_active}, source: ${result.rows[0].session_source}`);
      const decrypted = decryptToken(result.rows[0].session_cookies_encrypted);
      const parsed = JSON.parse(decrypted);
      const cookies = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
      console.log(`[Voyager API] Parsed ${cookies.length} cookies`);
      return cookies;
    }
    
    console.log('[Voyager API] No session found in linkedin_puppeteer_settings');
    return null;
  } catch (err) {
    console.error('[Voyager API] Failed to get session cookies:', err);
    return null;
  }
}

function buildCookieHeader(cookies: CookieData[]): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

function extractCsrfToken(cookies: CookieData[]): string | null {
  const jsessionid = cookies.find(c => c.name === 'JSESSIONID');
  if (jsessionid) {
    let token = jsessionid.value;
    token = token.replace(/^"/, '').replace(/"$/, '');
    console.log(`[Voyager API] JSESSIONID value: ${token.substring(0, 30)}...`);
    console.log(`[Voyager API] CSRF token (full JSESSIONID): ${token}`);
    return token;
  }
  console.log('[Voyager API] No JSESSIONID cookie found');
  return null;
}

export async function searchPeopleViaVoyager(
  workspaceId: string,
  accountId: string,
  keywords: string,
  location?: string,
  maxResults: number = 25
): Promise<VoyagerSearchResult> {
  console.log('[Voyager API] Starting search via Voyager API');
  console.log('[Voyager API] Keywords:', keywords, 'Location:', location || 'any', 'MaxResults:', maxResults);
  
  const cookies = await getSessionCookies(workspaceId, accountId);
  if (!cookies || cookies.length === 0) {
    return { success: false, results: [], totalCount: 0, error: 'No LinkedIn session found' };
  }
  
  const liAt = cookies.find(c => c.name === 'li_at');
  if (!liAt) {
    return { success: false, results: [], totalCount: 0, error: 'Missing li_at cookie' };
  }
  
  const csrfToken = extractCsrfToken(cookies);
  if (!csrfToken) {
    console.log('[Voyager API] Warning: No CSRF token found, will try without it');
  }
  
  const cookieHeader = buildCookieHeader(cookies);
  
  const proxyResult = await getOrAllocateProxy(workspaceId, accountId);
  let agent: HttpsProxyAgent<string> | undefined;
  
  if (proxyResult.success && proxyResult.proxy) {
    const { host, port, username, password } = proxyResult.proxy;
    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    agent = new HttpsProxyAgent(proxyUrl);
    console.log('[Voyager API] Using proxy:', host, port);
  } else {
    console.log('[Voyager API] No proxy available, using direct connection');
  }
  
  const searchQuery = location ? `${keywords} ${location}` : keywords;
  const encodedQuery = encodeURIComponent(searchQuery);
  
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': cookieHeader,
    'x-li-lang': 'en_US',
    'x-li-track': '{"clientVersion":"1.13.22941","mpVersion":"1.13.22941","osName":"web","timezoneOffset":-5,"timezone":"America/New_York","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
    'x-restli-protocol-version': '2.0.0',
    'Referer': `https://www.linkedin.com/search/results/people/?keywords=${encodedQuery}`,
    'Origin': 'https://www.linkedin.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
  
  if (csrfToken) {
    headers['csrf-token'] = csrfToken;
  }
  
  // Pagination: LinkedIn returns ~10 results per page
  const PAGE_SIZE = 10;
  const allResults: any[] = [];
  let start = 0;
  let consecutiveEmptyPages = 0;
  const MAX_EMPTY_PAGES = 2;
  
  console.log(`[Voyager API] Fetching up to ${maxResults} results with pagination...`);
  
  while (allResults.length < maxResults && consecutiveEmptyPages < MAX_EMPTY_PAGES) {
    const searchUrl = `https://www.linkedin.com/voyager/api/graphql?variables=(start:${start},origin:GLOBAL_SEARCH_HEADER,query:(keywords:${encodedQuery},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`;
    
    try {
      console.log(`[Voyager API] Fetching page ${Math.floor(start / PAGE_SIZE) + 1} (start=${start})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers,
        agent,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 401 || response.status === 403) {
        console.log('[Voyager API] Session issue on page', Math.floor(start / PAGE_SIZE) + 1);
        if (allResults.length > 0) break;
        return { success: false, results: [], totalCount: 0, error: 'Session expired or unauthorized' };
      }
      
      if (response.status === 429) {
        console.log('[Voyager API] Rate limited, returning partial results');
        break;
      }
      
      if (!response.ok) {
        console.log('[Voyager API] Error on page', Math.floor(start / PAGE_SIZE) + 1, 'status:', response.status);
        if (allResults.length > 0) break;
        return { success: false, results: [], totalCount: 0, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json() as any;
      const pageResults = parseVoyagerSearchResults(data, PAGE_SIZE);
      console.log(`[Voyager API] Page ${Math.floor(start / PAGE_SIZE) + 1}: ${pageResults.length} results`);
      
      if (pageResults.length === 0) {
        consecutiveEmptyPages++;
        console.log(`[Voyager API] Empty page (${consecutiveEmptyPages}/${MAX_EMPTY_PAGES})`);
      } else {
        consecutiveEmptyPages = 0;
        allResults.push(...pageResults);
      }
      
      start += PAGE_SIZE;
      
      // Add delay between pages to avoid rate limiting (1-2 seconds)
      if (allResults.length < maxResults && consecutiveEmptyPages < MAX_EMPTY_PAGES) {
        const delay = 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
      
    } catch (err: any) {
      console.error('[Voyager API] Page fetch failed:', err.message);
      if (allResults.length > 0) break;
      return { success: false, results: [], totalCount: 0, error: err.message };
    }
  }
  
  const finalResults = allResults.slice(0, maxResults);
  console.log(`[Voyager API] Total results collected: ${finalResults.length}`);
  
  return {
    success: finalResults.length > 0,
    results: finalResults,
    totalCount: finalResults.length,
  };
}

function parseVoyagerSearchResults(data: any, maxResults: number): any[] {
  const results: any[] = [];
  
  try {
    const included = data.included || [];
    console.log(`[Voyager API] Included items: ${included.length}`);
    
    if (included.length > 0) {
      console.log(`[Voyager API] Sample included types: ${included.slice(0, 5).map((i: any) => i.$type || 'unknown').join(', ')}`);
    }
    
    let elements = data.data?.searchDashClustersByAll?.elements || 
                   data.data?.searchDashClusters?.elements ||
                   data.data?.elements || [];
    
    if (elements.length === 0 && data.data?.data) {
      console.log(`[Voyager API] Checking nested data.data`);
      elements = data.data.data.searchDashClustersByAll?.elements || 
                 data.data.data.searchDashClusters?.elements ||
                 data.data.data.elements || [];
    }
    
    console.log(`[Voyager API] Elements found: ${elements.length}`);
    if (data.data) {
      console.log(`[Voyager API] Data keys: ${Object.keys(data.data).join(', ')}`);
      if (data.data.data && typeof data.data.data === 'object') {
        console.log(`[Voyager API] Nested data.data keys: ${Object.keys(data.data.data).join(', ')}`);
      }
    }
    
    const profileMap = new Map<string, any>();
    for (const item of included) {
      if (item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile' ||
          item.$type?.includes('Profile') ||
          item.publicIdentifier) {
        profileMap.set(item.entityUrn || item.$id, item);
      }
    }
    
    for (const cluster of elements) {
      const items = cluster.items || [];
      for (const item of items) {
        if (results.length >= maxResults) break;
        
        const itemType = item.template || item.itemUnion?.$type;
        if (itemType === 'UNIVERSAL' || itemType?.includes('search')) {
          const entity = item.itemUnion?.entityResult || item.entity;
          if (entity) {
            const profileUrn = entity.entityUrn || entity.urn;
            const profile = profileMap.get(profileUrn) || {};
            
            const profileUrl = entity.navigationUrl || 
                              `https://www.linkedin.com/in/${profile.publicIdentifier || ''}`;
            
            const headline = entity.primarySubtitle?.text || profile.headline || '';
            const location = entity.secondarySubtitle?.text || profile.locationName || '';
            
            let name = entity.title?.text || '';
            if (!name && profile.firstName) {
              name = `${profile.firstName} ${profile.lastName || ''}`.trim();
            }
            
            let imageUrl = '';
            if (entity.image?.attributes?.[0]?.detailDataUnion?.nonEntityProfilePicture?.vectorImage?.artifacts) {
              const artifacts = entity.image.attributes[0].detailDataUnion.nonEntityProfilePicture.vectorImage.artifacts;
              const largestImage = artifacts[artifacts.length - 1];
              imageUrl = largestImage?.fileIdentifyingUrlPathSegment || '';
            }
            
            if (name) {
              results.push({
                name,
                headline,
                location,
                profileUrl,
                imageUrl,
                publicIdentifier: profile.publicIdentifier || extractPublicId(profileUrl),
              });
            }
          }
        }
      }
    }
    
    if (results.length === 0 && included.length > 0) {
      console.log('[Voyager API] Falling back to included array parsing');
      
      const typeCount: Record<string, number> = {};
      for (const item of included) {
        const type = item.$type || 'unknown';
        typeCount[type] = (typeCount[type] || 0) + 1;
      }
      console.log(`[Voyager API] Included types breakdown:`, JSON.stringify(typeCount));
      
      for (const item of included) {
        if (results.length >= maxResults) break;
        
        const type = item.$type || '';
        
        if (type.includes('EntityResultViewModel') || type.includes('EntityResult')) {
          const title = item.title?.text || '';
          const primarySubtitle = item.primarySubtitle?.text || '';
          const secondarySubtitle = item.secondarySubtitle?.text || '';
          const navigationUrl = item.navigationUrl || '';
          
          const publicId = extractPublicId(navigationUrl);
          
          if (title || publicId) {
            console.log(`[Voyager API] Found EntityResult: ${title}, headline: ${primarySubtitle?.substring(0, 30)}`);
            results.push({
              name: title || 'LinkedIn User',
              headline: primarySubtitle || '',
              location: secondarySubtitle || '',
              profileUrl: navigationUrl || '',
              imageUrl: '',
              publicIdentifier: publicId || '',
            });
          }
        }
      }
      
      if (results.length === 0) {
        console.log('[Voyager API] No EntityResults found, falling back to profiles');
        for (const item of included) {
          if (results.length >= maxResults) break;
          const type = item.$type || '';
          if (type.includes('Profile')) {
            const entityUrn = item.entityUrn || '';
            const fsdId = entityUrn.replace('urn:li:fsd_profile:', '');
            if (fsdId) {
              results.push({
                name: 'LinkedIn User',
                headline: '',
                location: '',
                profileUrl: `https://www.linkedin.com/in/${fsdId}`,
                imageUrl: '',
                publicIdentifier: fsdId,
                entityUrn: entityUrn,
              });
            }
          }
        }
      }
      
      console.log(`[Voyager API] Extracted ${results.length} results`);
    }
  } catch (err) {
    console.error('[Voyager API] Failed to parse results:', err);
  }
  
  return results;
}

function extractPublicId(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1] : '';
}

function extractPublicIdFromUrn(urn: string): string {
  if (!urn) return '';
  const match = urn.match(/urn:li:(?:member|fs_miniProfile):(.+)/);
  return match ? match[1] : '';
}

export async function searchPeopleViaVoyagerSimple(
  workspaceId: string,
  accountId: string,
  keywords: string,
  location?: string,
  maxResults: number = 25
): Promise<VoyagerSearchResult> {
  console.log('[Voyager API Simple] Starting search');
  
  const cookies = await getSessionCookies(workspaceId, accountId);
  if (!cookies) {
    return { success: false, results: [], totalCount: 0, error: 'No session cookies' };
  }
  
  const liAt = cookies.find(c => c.name === 'li_at');
  const jsessionid = cookies.find(c => c.name === 'JSESSIONID');
  
  if (!liAt) {
    return { success: false, results: [], totalCount: 0, error: 'Missing li_at cookie' };
  }
  
  const searchQuery = location ? `${keywords} ${location}` : keywords;
  const encodedKeywords = encodeURIComponent(searchQuery);
  
  const searchUrl = `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-175&origin=GLOBAL_SEARCH_HEADER&q=all&query=(keywords:${encodedKeywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)))&start=0&count=${maxResults}`;
  
  const proxyResult = await getOrAllocateProxy(workspaceId, accountId);
  let agent: HttpsProxyAgent<string> | undefined;
  
  if (proxyResult.success && proxyResult.proxy) {
    const { host, port, username, password } = proxyResult.proxy;
    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    agent = new HttpsProxyAgent(proxyUrl);
    console.log('[Voyager API Simple] Using proxy:', host, port);
  }
  
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const csrfToken = jsessionid ? jsessionid.value.replace(/^"?ajax:/, '').replace(/"$/, '') : '';
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': cookieHeader,
    'csrf-token': csrfToken,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-li-page-instance': 'urn:li:page:d_flagship3_search_srp_all;' + Math.random().toString(36).substring(2),
    'x-restli-protocol-version': '2.0.0',
    'Referer': `https://www.linkedin.com/search/results/people/?keywords=${encodedKeywords}`,
  };
  
  try {
    console.log('[Voyager API Simple] Making request...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      agent,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('[Voyager API Simple] Status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[Voyager API Simple] Error:', text.substring(0, 300));
      return { success: false, results: [], totalCount: 0, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json() as any;
    const results = parseVoyagerSearchResults(data, maxResults);
    
    return {
      success: true,
      results,
      totalCount: results.length,
    };
  } catch (err: any) {
    console.error('[Voyager API Simple] Error:', err.message);
    return { success: false, results: [], totalCount: 0, error: err.message };
  }
}

interface ConnectionStatusResult {
  success: boolean;
  isConnected: boolean;
  isPending: boolean;
  connectionDegree?: string;
  error?: string;
}

/**
 * Check connection status via Voyager API - much lighter than browser navigation
 * Uses LinkedIn's profile API to get relationship status
 */
export async function checkConnectionStatusViaVoyager(
  workspaceId: string,
  accountId: string,
  profileUrl: string
): Promise<ConnectionStatusResult> {
  console.log('[Voyager API] Checking connection status for:', profileUrl);
  
  // Extract profile ID from URL (e.g., /in/john-doe/ -> john-doe)
  const profileMatch = profileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (!profileMatch) {
    return { success: false, isConnected: false, isPending: false, error: 'Invalid profile URL' };
  }
  const profileId = profileMatch[1];
  console.log('[Voyager API] Profile ID:', profileId);
  
  // Get session cookies
  const cookies = await getSessionCookies(workspaceId, accountId);
  if (!cookies || cookies.length === 0) {
    return { success: false, isConnected: false, isPending: false, error: 'No session cookies available' };
  }
  
  // Get CSRF token (JSESSIONID value)
  const jsessionCookie = cookies.find(c => c.name === 'JSESSIONID');
  if (!jsessionCookie) {
    return { success: false, isConnected: false, isPending: false, error: 'No JSESSIONID cookie found' };
  }
  
  // Remove quotes if present
  const csrfToken = jsessionCookie.value.replace(/^"|"$/g, '');
  
  // Get proxy
  const proxyResult = await getOrAllocateProxy(accountId, workspaceId);
  if (!proxyResult.success || !proxyResult.proxy) {
    return { success: false, isConnected: false, isPending: false, error: 'No proxy available' };
  }
  
  const proxy = proxyResult.proxy;
  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  const agent = new HttpsProxyAgent(proxyUrl);
  
  // Build cookie string
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  // LinkedIn Voyager API endpoint for profile with relationship data
  const profileApiUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${profileId}/profileContactInfo`;
  
  const headers = {
    'accept': 'application/vnd.linkedin.normalized+json+2.1',
    'csrf-token': csrfToken,
    'cookie': cookieString,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    // First, get profile data which includes connection info
    const profileDataUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-16`;
    
    console.log('[Voyager API] Fetching profile data...');
    const response = await fetch(profileDataUrl, {
      method: 'GET',
      headers,
      agent,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('[Voyager API] Profile response status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[Voyager API] Error response:', text.substring(0, 200));
      return { success: false, isConnected: false, isPending: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json() as any;
    
    // Parse connection status from response
    // LinkedIn includes connection degree in the profile data
    const elements = data.elements || data.included || [];
    let connectionDegree = 'OUT_OF_NETWORK';
    let isConnected = false;
    let isPending = false;
    
    // Look for connection info in the response
    for (const item of (Array.isArray(elements) ? elements : [elements])) {
      // Check for distance/connection degree
      if (item.distance || item.connectionDistance) {
        connectionDegree = item.distance || item.connectionDistance;
      }
      
      // Check for memberRelationship
      if (item.memberRelationship) {
        const rel = item.memberRelationship;
        if (rel.connectionStatus === 'CONNECTED' || rel.distance === 'DISTANCE_1') {
          isConnected = true;
          connectionDegree = '1st';
        } else if (rel.invitationStatus === 'PENDING' || rel.connectionStatus === 'PENDING') {
          isPending = true;
        }
      }
      
      // Alternative: check for connection in profile data
      if (item['*memberRelationship']) {
        const relUrn = item['*memberRelationship'];
        // If we have a relationship URN, we need to find it in included
        if (data.included) {
          const relData = data.included.find((inc: any) => inc.entityUrn === relUrn);
          if (relData) {
            if (relData.distance === 'DISTANCE_1') {
              isConnected = true;
              connectionDegree = '1st';
            } else if (relData.invitationStatus === 'PENDING') {
              isPending = true;
            }
          }
        }
      }
    }
    
    // Also check included array for relationship data
    if (data.included && Array.isArray(data.included)) {
      for (const item of data.included) {
        if (item.$type?.includes('MemberRelationship') || item.$type?.includes('memberRelationship')) {
          console.log('[Voyager API] Found relationship data:', JSON.stringify(item).substring(0, 200));
          
          // NEW FORMAT: Check memberRelationshipUnion for connection status
          // *connection key means 1st degree connected
          // noConnection means not connected (includes pending invitations)
          if (item.memberRelationshipUnion) {
            const union = item.memberRelationshipUnion;
            if (union['*connection'] || union.connection) {
              console.log('[Voyager API] ✅ CONNECTED via memberRelationshipUnion.*connection');
              isConnected = true;
              connectionDegree = '1st';
            } else if (union.noConnection) {
              // Check if there's a pending invitation
              if (union.noConnection.invitationUnion?.['*invitation']) {
                console.log('[Voyager API] ⏳ PENDING via memberRelationshipUnion.noConnection.invitationUnion');
                isPending = true;
              }
            }
          }
          
          // OLD FORMAT: distance-based check
          if (item.distance === 'DISTANCE_1' || item.connectionStatus === 'CONNECTED') {
            isConnected = true;
            connectionDegree = '1st';
          } else if (item.invitationStatus === 'PENDING' || item.invitationType) {
            isPending = true;
          }
        }
      }
    }
    
    console.log(`[Voyager API] Connection status: connected=${isConnected}, pending=${isPending}, degree=${connectionDegree}`);
    
    return {
      success: true,
      isConnected,
      isPending,
      connectionDegree,
    };
  } catch (err: any) {
    console.error('[Voyager API] Connection check error:', err.message);
    return { success: false, isConnected: false, isPending: false, error: err.message };
  }
}
