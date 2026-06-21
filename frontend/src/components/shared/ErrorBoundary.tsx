"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, error.stack?.split("\n")[1], info.componentStack?.split("\n")[1]);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center rounded-xl border border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="text-sm font-semibold text-destructive">Algo salió mal</p>
          {this.state.error && (
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {this.state.error.message}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={this.handleReset}>
          Reintentar
        </Button>
      </div>
    );
  }
}

/** Hook-friendly wrapper for functional components. */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode,
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;
  return Wrapped;
}
