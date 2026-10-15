// No router: the owner pages hang off ?view= (art, settings), the player-facing flow is a little screen state.
//   /                 Home
//   ?view=art         Art Review Board
//   ?view=settings    Settings
import { lazy, Suspense, useEffect, useState } from 'react';
import Home from './game/Home.jsx';
import TeamPicker from './game/TeamPicker.jsx';
import Settings from './game/Settings.jsx';
import Preview from './game/Preview.jsx';
import { TEXT_ZOOM, useSettings } from './game/prefs';

const ArtReview = lazy(() => import('./game/ArtReview.jsx'));

const viewFromUrl = () => new URLSearchParams(location.search).get('view') || 'home';

export default function App() {
  const s = useSettings();
  const [view, setView] = useState(viewFromUrl);
  const [match, setMatch] = useState(null);

  useEffect(() => {
    const pop = () => setView(viewFromUrl());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { document.documentElement.style.setProperty('--ui', TEXT_ZOOM[s.text] ?? 1); }, [s.text]);
  useEffect(() => { document.documentElement.classList.toggle('calm', !!s.calm); }, [s.calm]);

  const go = (v) => {
    const url = v === 'home' ? location.pathname : `?view=${v}`;
    history.pushState(null, '', url);
    setView(v);
    window.scrollTo(0, 0);
  };

  if (view === 'preview' && match) return <Preview match={match} onExit={() => go('teams')} />;

  return (
    <div className="app">
      <TopBar view={view} go={go} />
      {view === 'home' && <Home go={go} />}
      {(view === 'teams' || (view === 'preview' && !match)) && <TeamPicker onStart={(m) => { setMatch(m); go('preview'); }} />}
      {view === 'settings' && <Settings />}
      {view === 'art' && <Suspense fallback={<div className="loading">Loading the art…</div>}><ArtReview /></Suspense>}
    </div>
  );
}

function TopBar({ view, go }) {
  const link = (v, label) => <a href={v === 'home' ? '/' : `?view=${v}`} className={view === v ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(v); }}>{label}</a>;
  return (
    <header className="topbar">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('home'); }}><span className="led">TECHNO BOWL</span></a>
      <nav>{link('home', 'Home')}{link('teams', 'Play')}{link('art', 'Art Review')}{link('settings', 'Settings')}</nav>
    </header>
  );
}
