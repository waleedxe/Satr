import { useEffect, useState } from "react";

import { bootstrap } from "./app/bootstrap";
import { DialogHost } from "./components/DialogHost";
import { DocumentArea } from "./components/DocumentArea";
import { EmptyState } from "./components/EmptyState";
import { FindBar } from "./components/FindBar";
import { MenuBar } from "./components/MenuBar";
import { Panels } from "./components/Panels";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { Toasts } from "./components/Toasts";
import { useAppearance, useWindowTitle } from "./features/themes/useAppearance";
import { useDocuments } from "./stores/documentsStore";
import { useSettings } from "./stores/settingsStore";

function Workspace() {
  const hasTabs = useDocuments((s) => s.tabs.length > 0);
  const sidebarVisible = useSettings((s) => s.sidebarVisible);
  useAppearance();
  useWindowTitle();

  return (
    <div className="app">
      <header className="app-header">
        <MenuBar />
        <TabBar />
      </header>
      <div className="app-body">
        {sidebarVisible && <Sidebar />}
        <main className="workspace">
          <FindBar />
          {hasTabs ? <DocumentArea /> : <EmptyState />}
        </main>
      </div>
      <StatusBar />
      <DialogHost />
      <Panels />
      <Toasts />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="fatal" role="alert">
        <h1>Satr could not start</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!ready) return <div className="splash" aria-busy="true" />;
  return <Workspace />;
}
