import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple Single-Password Officer Authentication API
 *
 * NOTE: This is intentionally simple — a single shared password gate for demonstration
 * purposes, not a real multi-user authentication system. There is no user database,
 * no signup, and no multi-role access control.
 */

const SESSION_COOKIE_NAME = 'officer_session';
const SESSION_COOKIE_VALUE = 'authenticated';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    const expectedPassword =
      process.env.OFFICER_DASHBOARD_PASSWORD || 'officer2026';

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 },
      );
    }

    if (password.trim() !== expectedPassword.trim()) {
      return NextResponse.json(
        { success: false, error: 'Incorrect officer password. Please try again.' },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Officer authenticated successfully',
    });

    // Set simple session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: SESSION_COOKIE_VALUE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error('[officer-auth] Login error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication request failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = sessionCookie?.value === SESSION_COOKIE_VALUE;

  return NextResponse.json({
    authenticated: isAuthenticated,
  });
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Officer logged out successfully',
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
