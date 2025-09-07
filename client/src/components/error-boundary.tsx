import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("UI error boundary caught error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Une erreur est survenue</h1>
            <p className="text-slate-600 mb-4">Veuillez recharger la page. Si le problème persiste, contactez le support.</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


