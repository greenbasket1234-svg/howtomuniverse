/**
 * authHelpers.mjs – Universe 보안 순수 함수 모음
 *
 * server.mjs 와 테스트 코드가 동일한 구현을 공유하도록
 * 부작용 없는 순수 함수만 이 파일에 모읍니다.
 */
import dns from 'node:dns';

// ── SSRF 방어 ─────────────────────────────────────────────────────────────────
export function _isPrivateIp(ip) {
  // IPv4 사설·루프백·링크로컬·메타데이터 서버 범위
  const v4Private = [
    /^127\./,                      // 127.0.0.0/8 loopback
    /^10\./,                       // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
    /^192\.168\./,                 // 192.168.0.0/16
    /^169\.254\./,                 // 169.254.0.0/16 link-local / AWS metadata
    /^0\./,                        // 0.0.0.0/8
    /^(::1|::ffff:127\.|fc|fd)/i,  // IPv6 loopback, ULA
  ];
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return v4Private.some(r => r.test(ip));
}

export const SSRF_BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', '169.254.169.254']);

export async function validateSsrfUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw Object.assign(new Error('유효한 URL 형식이 아닙니다.'), { status: 400 }); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('http/https URL만 허용됩니다.'), { status: 400 });
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (SSRF_BLOCKED_HOSTS.has(hostname)) {
    throw Object.assign(new Error('접근이 차단된 호스트입니다.'), { status: 400 });
  }
  // 순수 IP 주소로 입력된 경우도 차단
  if (_isPrivateIp(hostname)) {
    throw Object.assign(new Error('사설 IP 주소로의 요청은 허용되지 않습니다.'), { status: 400 });
  }
  // DNS 조회로 실제 IP 확인
  try {
    const addrs = await dns.promises.lookup(hostname, { all: true });
    for (const { address } of addrs) {
      if (_isPrivateIp(address)) {
        throw Object.assign(new Error('내부 네트워크 주소로 확인된 호스트입니다.'), { status: 400 });
      }
    }
  } catch (e) {
    if (e.status === 400) throw e;
    throw Object.assign(new Error(`호스트 조회에 실패했습니다: ${e.message}`), { status: 400 });
  }
  return parsed;
}

// ── BOLA/IDOR 방어 ────────────────────────────────────────────────────────────
export function canAccessAdvertiser(user, advertiserId) {
  if (!advertiserId) return true;
  return Boolean(user && (user.isOwner || !user.advertiserIds || user.advertiserIds.includes(advertiserId)));
}
