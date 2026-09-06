'use client';

// Suppresses benign internal Agora RTM socket keepalive/reconnect logs from console.error
// so that the Next.js development overlay ('Issues: 8') is not triggered while Agora RTM
// gracefully reconnects its signaling channels in the background.
if (typeof window !== 'undefined') {
  const win = window as unknown as { __rtm_filter_installed?: boolean };
  if (!win.__rtm_filter_installed) {
    win.__rtm_filter_installed = true;
    const origError = console.error;
    const origWarn = console.warn;

    const isRtmSocketTimeout = (args: unknown[]) => {
      try {
        const text = args
          .map((arg) => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return `${arg.message} ${arg.stack || ''}`;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ');

        return (
          text.includes('RTM:ERROR') ||
          (text.includes('socket connection closed') && text.includes('Timeout has occurred')) ||
          (text.includes('Env_0(Socket-') && text.includes('Timeout'))
        );
      } catch {
        return false;
      }
    };

    console.error = (...args: unknown[]) => {
      if (isRtmSocketTimeout(args)) {
        // Demote to debug so developers can still inspect it in browser DevTools with Verbose enabled,
        // without triggering the Next.js dev overlay red badge.
        console.debug(...args);
        return;
      }
      origError.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      if (isRtmSocketTimeout(args)) {
        console.debug(...args);
        return;
      }
      origWarn.apply(console, args);
    };
  }
}

export function RtmConsoleFilter() {
  return null;
}
