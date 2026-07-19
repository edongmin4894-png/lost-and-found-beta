/**
 * auth.js
 * 학교 구글 계정(Workspace 도메인)으로만 로그인할 수 있게 하는 공통 로그인 게이트입니다.
 * index.html, search.html 양쪽에서 공통으로 사용하고, HTML의 #authGate / #appContent /
 * #googleSignInBtn 요소와 짝을 이뤄서 동작해요.
 *
 * ⚠️ 사용 전 아래 두 값을 꼭 채워주세요.
 */

// 1. 구글 클라우드 콘솔 > API 및 서비스 > 사용자 인증 정보에서 만든
//    "OAuth 클라이언트 ID(웹 애플리케이션)" 값을 넣으세요.
const GOOGLE_CLIENT_ID = '991899529515-0qvmu4aikul4thdaqqskga9a18q9koto.apps.googleusercontent.com';

// 2. 학생들에게 발급된 학교 구글 계정의 도메인을 넣으세요. (예: 'schoolname.hs.kr')
//    apps-script.js의 SCHOOL_DOMAIN과 반드시 같은 값이어야 해요.
const SCHOOL_DOMAIN = 'gudeok.hs.kr';

const AUTH_STORAGE_KEY = 'lostfound_auth';

/**
 * sessionStorage에 저장된 로그인 세션을 읽어옵니다. 없거나 만료됐으면 null.
 * (브라우저 탭을 닫으면 로그아웃되도록 localStorage 대신 sessionStorage를 씁니다)
 */
function getAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.idToken || !session.expiresAt || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function getIdToken() {
  const session = getAuthSession();
  return session ? session.idToken : null;
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * 구글 로그인 버튼을 누른 뒤 호출되는 콜백입니다. (google.accounts.id가 자동으로 호출)
 */
function handleCredentialResponse(response) {
  const payload = decodeJwt(response.credential);
  const errorEl = document.getElementById('authError');

  if (!payload) {
    if (errorEl) errorEl.textContent = '로그인 처리 중 문제가 발생했어요. 다시 시도해주세요.';
    return;
  }

  const emailDomain = (payload.email || '').split('@')[1];
  const isSchoolAccount = payload.hd === SCHOOL_DOMAIN || emailDomain === SCHOOL_DOMAIN;

  if (!isSchoolAccount) {
    if (errorEl) errorEl.textContent = `학교 계정(@${SCHOOL_DOMAIN})으로만 로그인할 수 있어요.`;
    if (window.google) google.accounts.id.disableAutoSelect();
    return;
  }

  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    idToken: response.credential,
    email: payload.email,
    name: payload.name || '',
    expiresAt: payload.exp * 1000
  }));

  showAppContent();
}

function logout() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  if (window.google) google.accounts.id.disableAutoSelect();
  location.reload();
}

function showAppContent() {
  const gate = document.getElementById('authGate');
  const content = document.getElementById('appContent');
  const userBadge = document.getElementById('userBadge');
  const session = getAuthSession();

  if (gate) gate.style.display = 'none';
  if (content) content.style.display = 'block';
  if (userBadge && session) userBadge.textContent = `${session.name || session.email} 님`;

  // 페이지별로 로그인 완료 후 실행할 게 있으면 onAuthReady()를 정의해두면 됩니다. (search.js에서 사용)
  if (typeof window.onAuthReady === 'function') window.onAuthReady();
}

function showAuthGate() {
  const gate = document.getElementById('authGate');
  const content = document.getElementById('appContent');
  if (gate) gate.style.display = 'block';
  if (content) content.style.display = 'none';
}

function initAuthGate() {
  const session = getAuthSession();
  if (session) {
    showAppContent();
    return;
  }

  showAuthGate();

  if (!window.google) {
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.textContent = '구글 로그인 스크립트를 불러오지 못했어요. 새로고침해보세요.';
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    hosted_domain: SCHOOL_DOMAIN,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'ko' }
  );
}

// 이 스크립트는 body 맨 아래, 구글 로그인 스크립트 다음 줄에 둬서
// 로드되자마자 바로 초기화하면 됩니다.
initAuthGate();