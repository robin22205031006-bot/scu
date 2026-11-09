import { Component, type ReactNode } from "react";

/** Contains a crash to one Archive panel so the rest of the page keeps working. */
export class SectionBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(`Archive section "${this.props.label}" failed:`, error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="glass grid place-items-center gap-3 rounded-2xl p-10 text-center">
        <p className="text-sm text-muted-foreground">{this.props.label} couldn't be displayed right now.</p>
        <button
          onClick={() => this.setState({ failed: false })}
          className="rounded-full bg-secondary px-4 py-1.5 text-xs hover:text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
}
