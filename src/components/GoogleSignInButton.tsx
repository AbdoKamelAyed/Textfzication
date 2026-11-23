import type { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';

interface Props {
  user: User | null;
  hasDriveToken: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function GoogleSignInButton({
  user,
  hasDriveToken,
  isSigningIn,
  onSignIn,
  onSignOut,
}: Props) {
  if (user) {
    return (
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex flex-col items-end text-right">
          <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
            {user.displayName || user.email}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {hasDriveToken ? 'Drive connected' : 'Signed in'}
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSignIn}
      disabled={isSigningIn}
      className="gsi-material-button shrink-0"
      aria-label="Sign in with Google"
    >
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ display: 'block' }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
        </div>
        <span className="gsi-material-button-contents">
          {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </div>
    </button>
  );
}
