// Signal Meadow style: the app shell is intentionally minimal; the full-screen game is the primary interface.
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
export default function App() { return <ErrorBoundary><Switch><Route path="/" component={Home} /><Route component={Home} /></Switch></ErrorBoundary>; }
