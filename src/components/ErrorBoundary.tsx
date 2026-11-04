// Filet de sécurité : une erreur d'affichage ne doit jamais laisser une page blanche. Message clair + rechargement ; réinitialisé à chaque changement de page.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ margin: 24, padding: 20, borderRadius: 12, border: "1px solid #E4B4B4", background: "#FEF5F5", color: "#7A1F1F", maxWidth: 760, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Cette page n'a pas pu s'afficher</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>
          Une erreur est survenue à l'affichage. Rechargez la page (Ctrl+Maj+R). Si le message revient juste après une mise à jour, le serveur (API) n'est peut-être pas encore redémarré
          sur la même version que l'interface.
        </p>
        <pre style={{ margin: "0 0 12px", padding: 10, background: "#fff", borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{String(this.state.error.message || this.state.error)}</pre>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #C98A8A", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Recharger la page</button>
      </div>
    );
  }
}

/** Boundary réinitialisée à chaque navigation (la barre latérale reste utilisable après une erreur). */
export function RouteErrorBoundary({ children }: Props) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
