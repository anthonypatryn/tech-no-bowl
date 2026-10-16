// No router: the owner pages hang off ?view= (art, settings), the player-facing flow is a little screen state.
//   /                 Home
//   ?view=art         Art Review Board
//   ?view=settings    Settings
//   ?view=game        a game vs the computer (after the Team Picker)
//   ?view=rules       How to play;  ?view=tutorial  the guided first game;  ?view=season  a season + playoffs
//   ?view=bugs        the owner's bug list (PIN)
//   ?view=moments     Moment Lab: fire each cinematic on demand
//   ?view=sounds      the owner's sound editor (PIN to save)
//   ?view=styleguide  the style guide: every control and token, live
//   ?view=stats       career stats: record, player totals, the season's stats
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Home from './game/Home.jsx';
import TeamPicker from './game/TeamPicker.jsx';
import Settings from './game/Settings.jsx';
import GameView from './game/GameView.jsx';
import { TEXT_ZOOM, useSettings } from './game/prefs';

const ArtReview = lazy(() => import('./game/ArtReview.jsx'));
const BugList = lazy(() => import('./game/BugList.jsx'));
const Lab = lazy(() => import('./game/Lab.jsx'));
const OnlinePage = lazy(() => import('./game/OnlinePage.jsx'));
const MomentReview = lazy(() => import('./game/MomentReview.jsx'));
import MusicPlayer, { FullscreenButton } from './game/MusicPlayer.jsx';
import { musicScene } from './game/music';
const SoundEditor = lazy(() => import('./game/SoundEditor.jsx'));
const StyleGuide = lazy(() => import('./game/StyleGuide.jsx'));
const StatsPage = lazy(() => import('./game/StatsPage.jsx'));
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

  // the jukebox: menu music everywhere but in a game (the game screen takes over)
  useEffect(() => { if (!['game', 'tutorial', 'review', 'moments', 'sounds'].includes(view)) musicScene('menu'); }, [view]);

  const go = (v) => {
    const url = v === 'home' ? location.pathname : `?view=${v}`;
    history.pushState(null, '', url);
    setView(v);
    window.scrollTo(0, 0);
  };

  if (view === 'review') return <Suspense fallback={<div className="loading">Loading…</div>}><MomentReview go={go} /></Suspense>;
  if (view === 'moments') return <Suspense fallback={<div className="loading">Loading…</div>}><Lab /></Suspense>;
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
      {view === 'online' && <Suspense fallback={<div className="loading">Loading…</div>}><OnlinePage /></Suspense>}
      {view === 'season' && <SeasonPage onPlay={(m) => { setMatch(m); go('game'); }} />}
      {view === 'sounds' && <Suspense fallback={<div className="loading">Loading…</div>}><SoundEditor /></Suspense>}
      {view === 'bugs' && <Suspense fallback={<div className="loading">Loading…</div>}><BugList /></Suspense>}
      {view === 'stats' && <Suspense fallback={<div className="loading">Loading…</div>}><StatsPage /></Suspense>}
      {view === 'styleguide' && <Suspense fallback={<div className="loading">Loading…</div>}><StyleGuide /></Suspense>}
      {view === 'art' && <Suspense fallback={<div className="loading">Loading the art…</div>}><ArtReview /></Suspense>}
    </div>
  );
}

// The one nav, on every menu page: the player's pages up front, settings and the owner's tools behind "More".
// Phones get a single Menu button that opens the same list.
const MAIN = [['teams', 'Play'], ['season', 'Season'], ['online', 'Online'], ['stats', 'Stats'], ['rules', 'Rules']];
const MORE = [['tutorial', 'Tutorial'], ['settings', 'Settings']];
const TOOLS = [['art', 'Art review'], ['review', 'Moment review'], ['moments', 'Moment lab'], ['sounds', 'Sound editor'], ['bugs', 'Bug list']];

function TopBar({ view, go }) {
  const [bug, setBug] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const out = (e) => { if (!box.current?.contains(e.target)) setMenu(false); };
    const key = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', out); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', out); window.removeEventListener('keydown', key); };
  }, [menu]);
  const link = ([v, label]) => (
    <a key={v} href={v === 'home' ? '/' : `?view=${v}`} className={view === v ? 'on' : ''} aria-current={view === v ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); setMenu(false); go(v); }}>{label}</a>
  );
  const inMore = [...MORE, ...TOOLS].some(([v]) => v === view);
  return (
    <header className="topbar">
      <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('home'); }}><span className="led">TECHNO BOWL</span></a>
      <nav className="nav-main" aria-label="Main">{MAIN.map(link)}</nav>
      <span className="topbar-tools">
        <MusicPlayer small /><FullscreenButton />
        <span className="nav-more" ref={box}>
          <button className={`btn small ${menu || inMore ? 'on' : ''}`} aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)}>
            <span className="nav-more-wide">More</span><span className="nav-more-narrow">Menu</span>
          </button>
          {menu && (
            <nav className="nav-menu glass" aria-label="More">
              <div className="nav-menu-main">{[['home', 'Home'], ...MAIN].map(link)}</div>
              {MORE.map(link)}
              <a href="#bug" onClick={(e) => { e.preventDefault(); setMenu(false); setBug(true); }}>Report a bug</a>
              <h3>Owner tools</h3>
              {TOOLS.map(link)}
              {link(['styleguide', 'Style guide'])}
            </nav>
          )}
        </span>
      </span>
      {bug && <BugReport onClose={() => setBug(false)} />}
    </header>
  );
}
