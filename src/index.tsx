import React from "react";
import { render } from "@semos-labs/glyph";
import { App } from "./ui/App.tsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";

// Start the app
render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
