const dns = require('dns');
const net = require('net');
const path = require('path');

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const cleanIp = ip.trim();

  // IPv4 Checks
  if (net.isIPv4(cleanIp)) {
    // 127.0.0.0/8 (Loopback)
    if (cleanIp.startsWith('127.')) return true;
    // 10.0.0.0/8 (Private)
    if (cleanIp.startsWith('10.')) return true;
    // 192.168.0.0/16 (Private)
    if (cleanIp.startsWith('192.168.')) return true;
    // 169.254.0.0/16 (Link-local)
    if (cleanIp.startsWith('169.254.')) return true;
    // 0.0.0.0/8 (Broadcast/this host)
    if (cleanIp.startsWith('0.')) return true;
    // 172.16.0.0/12 (Private)
    const match172 = cleanIp.match(/^172\.(\d+)\./);
    if (match172) {
      const octet = parseInt(match172[1], 10);
      if (octet >= 16 && octet <= 31) return true;
    }
    // 100.64.0.0/10 (Carrier-grade NAT)
    const match100 = cleanIp.match(/^100\.(\d+)\./);
    if (match100) {
      const octet = parseInt(match100[1], 10);
      if (octet >= 64 && octet <= 127) return true;
    }
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    const firstOctet = parseInt(cleanIp.split('.')[0], 10);
    if (firstOctet >= 224) return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique local address fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    // IPv4-mapped IPv6
    if (lower.startsWith('::ffff:')) {
      const v4Part = cleanIp.substring(7);
      return isPrivateIp(v4Part);
    }
    return false;
  }

  return false;
}

async function validateSafeUrl(urlString) {
  try {
    if (!urlString || typeof urlString !== 'string') return { valid: false, error: 'URL required' };
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return { valid: false, error: 'Malformed URL' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are permitted' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { valid: false, error: 'Access to internal or private hosts is forbidden' };
    }

    if ((net.isIPv4(hostname) || net.isIPv6(hostname)) && isPrivateIp(hostname)) {
      return { valid: false, error: 'Access to internal or private hosts is forbidden' };
    }

    // DNS Resolution Check
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: 'Could not resolve domain name' };
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return { valid: false, error: 'Domain points to forbidden private network' };
      }
    }

    return { valid: true, parsed };
  } catch (err) {
    return { valid: false, error: err.message || 'SSRF verification failed' };
  }
}

function safeResolveUpload(targetPath, uploadsDir) {
  if (!targetPath || typeof targetPath !== 'string') return null;
  const baseUploads = path.resolve(uploadsDir);
  const cleanSub = targetPath.replace(/^\/?uploads\/?/i, '').replace(/^[\\\/]+/, '');
  const resolved = path.resolve(baseUploads, cleanSub);
  if (!resolved.startsWith(baseUploads)) {
    return null; // Path traversal attempt detected!
  }
  return resolved;
}

function sanitizeText(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/[<>]/g, '') // Strip HTML brackets
    .trim();
}

module.exports = {
  isPrivateIp,
  validateSafeUrl,
  safeResolveUpload,
  sanitizeText
};
