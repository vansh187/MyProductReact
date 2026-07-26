import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  // Section-level callers (e.g. a widget inside an already-rendered page)
  // pass this to render a smaller, in-place fallback instead of the default
  // full-page one, and to decide what "reset" means (refetch vs reload).
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          style={{
            minHeight: "100vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "12px",
            background: "#0d1117", color: "#e6edf3", padding: "24px", textAlign: "center",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 700 }}>Something went wrong</div>
          <div style={{ fontSize: "13px", color: "#8b949e", maxWidth: "480px" }}>
            {this.state.error.message || "An unexpected error occurred while rendering this page."}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: "8px", padding: "10px 18px", fontSize: "13px", fontWeight: 700,
              borderRadius: "8px", background: "#238636", border: "none", color: "#fff", cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
