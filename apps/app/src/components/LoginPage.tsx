interface LoginPageProps {
  error?: string | null;
}

export function LoginPage({ error }: LoginPageProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          maxWidth: 400,
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#38bdf8",
              marginBottom: "0.5rem",
            }}
          >
            Linear Insights
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>
            Sign in with your Linear account to view your team's project health, velocity, and cycle-time metrics.
          </p>
        </div>

        <a
          href="/auth/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.75rem 1.5rem",
            background: "#5e6ad2",
            color: "white",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.95rem",
            textDecoration: "none",
            transition: "background 0.15s",
            boxShadow: "0 2px 8px rgba(94,106,210,0.35)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#4f5bbf";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#5e6ad2";
          }}
        >
          <LinearLogo />
          Sign in with Linear
        </a>

        {error && (
          <p
            style={{
              color: "#f87171",
              fontSize: "0.875rem",
              textAlign: "center",
              background: "rgba(248,113,113,0.1)",
              padding: "0.5rem 1rem",
              borderRadius: 6,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function LinearLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857l36.4637 36.4637c.6889.6889.0915 1.8188-.857 1.5963C20.0515 94.4 5.5966 79.9453 1.22541 61.5228Z"
        fill="white"
      />
      <path
        d="M.00189135 46.8891c-.01764375-1.0807 1.28120865-1.6178 2.01660865-.8424l51.9927 51.9927c.7754.7754.2383 2.0342-.8424 2.0166C37.0029 99.8168 18.7689 90.1397 7.13475 74.9942.44340135 66.6609-.0760387 57.3518.00189135 46.8891Z"
        fill="white"
      />
      <path
        d="M10.5676 32.1291c-.6297-.6298-.5416-1.6802.2173-2.1832C20.7073 23.4898 32.7184 20 45.5 20c38.66 0 70 31.34 70 70 0 12.7816-3.4898 24.7927-9.6459 34.715-.503.7589-1.5534.847-2.1832.2173L10.5676 32.1291Z"
        fill="white"
      />
    </svg>
  );
}
