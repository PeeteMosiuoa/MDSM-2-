// lib/session.js
const { cookies } = require('next/headers');

function setUserSession(user) {
  cookies().set('user_session', JSON.stringify({
    id: user.id,
    role_id: user.role_id,
    full_name: user.full_name || '',
    email: user.email,
    // Add kyc_status later if you add the column
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

function getUserSession() {
  const cookie = cookies().get('user_session')?.value;
  return cookie ? JSON.parse(cookie) : null;
}

module.exports = { setUserSession, getUserSession };