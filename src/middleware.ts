export { default } from 'next-auth/middleware';
// Require authentication for app pages
export const config = {
  matcher: [
    '/',
    '/calendar/:path*',
    '/courses/:path*',
    '/projects/:path*',
    '/settings/:path*',
    '/stats/:path*',
    '/tasks/:path*',
  ],
};
