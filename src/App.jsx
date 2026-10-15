// No router: the owner pages hang off ?view= (art, settings), the player-facing flow is a little screen state.
//   /                 Home
//   ?view=art         Art Review Board
//   ?view=settings    Settings
//   ?view=game        a game vs the computer (after the Team Picker)
//   ?view=rules       How to play;  ?view=tutorial  the guided first game;  ?view=season  a season + playoffs
//   ?view=bugs        the owner's bug list (PIN)
//   ?view=moments     Moment Lab: fire each cinematic on demand
//   ?view=sounds      the owner's sound editor (PIN to save)
import { lazy, Suspense, useEffect, useState } from 'react';
import Home from './game/Home.jsx';
import TeamPicker from './game/TeamPicker.jsx';
import Settings from './game/Settings.jsx';
import GameView from './game/GameView.jsx';
import { TEXT_ZOOM, useSettings } from './game/prefs';

const ArtReview = lazy(() => import('./game/ArtReview.jsx'));
const BugList = lazy(() => import('./game/BugList.jsx'));
const Lab = lazy(() => import('./game/Lab.jsx'));
const OnlinePage = lazy(() => import('./game/OnlinePage.jsx'));
const SoundEditor = lazy(() => import('./game/SoundEditor.jsx'));
import BugReport from './game/BugReport.jsx';
import { RulesPage } from './game/RulesDrawer.jsx';
import SeasonPage from './game/SeasonPage.jsx';

const viewFromUrl = () => new URLSearchParams(location.search).get('view') || 'home';

export default function App() {
  const s = useSettings();
  const [view, setView] = useState(viewFromUrl);
  const [match, setMatch] = useState(null);
  const [tut, setTut] = useState(null); // the tutorial after an undo

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

  if (view === 'sounds') return <Suspense fallback={<div className="loading">Loading…</div>}><SoundEditor /></Suspense>;
  if (view === 'moments') return <Suspense fallback={<div className="loading">Loading…</div>}><Lab /></Suspense>;
  if (view === 'bugs') return <Suspense fallback={<div className="loading">Loading…</div>}><BugList /></Suspense>;
  // the tutorial: a set game vs the Rookie with the coach's tips on
  if (view === 'tutorial') return <GameView key={tut?.key ?? 'tutorial'} match={tut ?? { you: { team: 'bighorns', uni: 'home', picks: {} }, cpu: { team: 'kittens', uni: 'home', picks: {} }, level: 'rookie', mode: 'techno', seed: 2026, tutorial: true }} onRestart={setTut} onExit={() => { setTut(null); go('home'); }} onRematch={() => { setTut(null); go('teams'); }} />;
  if (view === 'game' && match) return <GameView key={match.key ?? match.seed} match={match} onRestart={(m) => setMatch(m)} onExit={() => go(match.season ? 'season' : 'teams')} onRematch={() => setMatch({ ...match, seed: Date.now() })} />;

  return (
    <div className="app">
      <TopBar view={view} go={go} />
      {view === 'home' && <Home go={go} onResume={(m) => { setMatch(m); go('game'); }} />}
      {(view === 'teams' || (view === 'game' && !match)) && <TeamPicker onStart={(m) => { setMatch({ ...m, seed: Date.now() }); go('game'); }} />}
      {view === 'settings' && <Settings />}
      {view === 'rules' && <RulesPage go={go} />}
      {view === 'online' && <Suspense fallback={<div className="loading">Loading…</div>}><OnlinePage go={go} /></Suspense>}
      {view === 'season' && <SeasonPage onPlay={(m) => { setMatch(m); go('game'); }} />}
      {view === 'art' && <Suspense fallback={<div className="loading">Loading the art…</div>}><ArtReview /></Suspense>}
    </div>
  );
}

function TopBar({ view, go }) {
  const [bug, setBug] = useState(false);
  const link = (v, label) => <a href={v === 'home' ? '/' : `?view=${v}`} className={view === v ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(v); }}>{label}</a>;
  return (
    <header className="topbar">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('home'); }}><span className="led">TECHNO BOWL</span></a>
      <nav>{link('home', 'Home')}{link('teams', 'Play')}{link('season', 'Season')}{link('online', 'Online')}{link('rules', 'Rules')}{link('art', 'Art Review')}{link('settings', 'Settings')}
        <a href="#bug" onClick={(e) => { e.preventDefault(); setBug(true); }}>Report a bug</a></nav>
      {bug && <BugReport onClose={() => setBug(false)} />}
    </header>
  );
}
