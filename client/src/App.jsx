import { useState } from 'react'
import './App.css'

const pages = ['Home', 'Create Mystery', 'Investigation Room', 'Accusation', 'Results']
const levels = { Easy: ['3 suspects', '5 clues', '2 hints'], Medium: ['4 suspects', '7 clues', '3 hints'], Hard: ['5 suspects', '9 clues', '3 hints'] }
const people = [
  { name: 'Dr. Evelyn Reed', role: 'The curator', color: 'rose', icon: 'ER', detail: 'Had access to the east gallery before closing.' },
  { name: 'Marcus Bell', role: 'The security chief', color: 'blue', icon: 'MB', detail: 'His patrol log has a curious ten-minute gap.' },
  { name: 'Nadia Okafor', role: 'The restorationist', color: 'gold', icon: 'NO', detail: 'Was working near the display case that evening.' },
  { name: 'Felix Ward', role: 'The donor', color: 'green', icon: 'FW', detail: 'Insisted on a private viewing after hours.' },
]

function App() {
  const [page, setPage] = useState('Home')
  const [difficulty, setDifficulty] = useState('Medium')
  const [caseData, setCaseData] = useState(null)
  const [clues, setClues] = useState([])
  const [hints, setHints] = useState(0)
  const [lastHint, setLastHint] = useState('')
  const [accused, setAccused] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function api(path, body) {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const response = await fetch(`${apiBaseUrl}/api${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Something went wrong.')
    return data
  }
  async function createMystery() {
    setBusy(true); setError('')
    try { const data = await api('/cases', { difficulty }); setCaseData(data.case || data); setClues([]); setHints(0); setLastHint(''); setAccused(''); setResult(null); setPage('Investigation Room') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function discoverClue() {
    if (!caseData?._id) return setError('Create a mystery first to investigate it.')
    setBusy(true); setError('')
    try { const data = await api(`/cases/${caseData._id}/clues/${clues.length + 1}/discover`, {}); setClues(data.discoveredClues || data.clues || [...clues, data.clue].filter(Boolean)) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function getHint() {
    if (!caseData?._id) return setError('Create a mystery first to request a hint.')
    setBusy(true); setError('')
    try { const data = await api(`/cases/${caseData._id}/hints`, {}); setHints(data.hintsUsed ?? hints + 1); setLastHint(data.hint || 'Look again at the details that do not fit the timeline.'); setClues(data.discoveredClues || clues) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function submitAccusation() {
    if (!caseData?._id || !accused) return setError('Create a mystery and select a suspect first.')
    setBusy(true); setError('')
    try { await api(`/cases/${caseData._id}/accuse`, { suspectId: accused }); const data = await api(`/cases/${caseData._id}/result`); setResult(data); setPage('Results') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const nav = (next) => { setError(''); setPage(next) }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => nav('Home')}><span className="brand-mark">M</span><span>MYSTERY<br/><b>ROOM</b></span></button>
      <div className="side-label">YOUR DESK</div>
      <nav>{pages.map((item, i) => <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => nav(item)}><span className="nav-icon">{['⌂', '＋', '◉', '⚑', '▤'][i]}</span>{item}{item === 'Investigation Room' && caseData && <i/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="case-stamp">✳</div><p>Every mystery has<br/>a loose thread.</p><span>Pull carefully.</span><div className="side-rule"/> <div className="profile"><div className="avatar-small">DR</div><span><b>Detective Riley</b><small>Lead investigator</small></span><span className="more">···</span></div></div>
    </aside>
    <main className="main-content flex min-h-screen flex-col">
      <header className="topbar"><div className="breadcrumb">MYSTERY ROOM <span>/</span> <b>{page.toUpperCase()}</b></div><div className="top-actions"><span className="case-status"><i/> CASE FILE {caseData ? 'OPEN' : 'READY'}</span><button className="icon-button" aria-label="Notifications">♧</button><div className="avatar-small">DR</div></div></header>
      <div className="page-wrap">
        {error && <div className="notice">{error}<button onClick={() => setError('')}>×</button></div>}
        {page === 'Home' && <section className="home-page"><div className="eyebrow"><span/> THE CITY NEVER SLEEPS</div><div className="hero-grid"><div><h1>Some stories<br/>don't <em>add up.</em></h1><p className="hero-copy">A priceless artifact. A locked room. A handful of people with something to hide. The truth is in the details.</p><button className="primary-button" onClick={() => nav('Create Mystery')}>Start investigating <span>↗</span></button><div className="home-foot"><span>01 / THE CASE OF THE MISSING MOONSTONE</span><span>EST. 1894</span></div></div><div className="hero-art"><div className="art-glow"/><div className="moon">✦</div><div className="artifact">◈</div><div className="art-label">EVIDENCE NO. 01 <b>THE MOONSTONE</b></div><div className="orbit orbit-a"/><div className="orbit orbit-b"/><span className="art-star star-a">✳</span><span className="art-star star-b">✦</span></div></div><div className="stats-row"><div><b>01</b><span>UNSOLVED CASE</span></div><div><b>04</b><span>PEOPLE OF INTEREST</span></div><div><b>∞</b><span>WAYS TO GET IT WRONG</span></div><span className="stats-note">A good detective knows<br/>when to look closer.</span></div></section>}
        {page === 'Create Mystery' && <section className="form-page"><div className="eyebrow"><span/> OPEN A NEW CASE</div><h1>Set the <em>scene.</em></h1><p className="section-copy">Choose how deep you want to dig. Your case is built around the details you uncover.</p><div className="create-layout"><div className="form-card"><label className="field-label">CASE DIFFICULTY</label><div className="difficulty-grid">{Object.keys(levels).map((level, i) => <button className={`difficulty-card ${difficulty === level ? 'selected' : ''}`} onClick={() => setDifficulty(level)} key={level}><span className="level-icon">{['◌', '◉', '✳'][i]}</span><b>{level}</b><small>{['A little misdirection', 'Read between the lines', 'Trust no one'][i]}</small>{difficulty === level && <i className="check">✓</i>}</button>)}</div><label className="field-label">YOUR CASE INCLUDES</label><div className="includes">{levels[difficulty].map((v) => <span key={v}>✦ &nbsp;{v}</span>)}</div><button className="primary-button full" disabled={busy} onClick={createMystery}>{busy ? 'Preparing your case…' : 'Create my mystery'} <span>↗</span></button><small className="fine-print">A fresh, original case is generated for every investigation.</small></div><aside className="case-note"><span className="note-icon">✳</span><h3>Every detail<br/>means something.</h3><p>Interview the suspects. Examine the evidence. Follow the contradictions.</p><div className="note-line"/><span className="note-small">THE GAME IS AFOOT.</span></aside></div></section>}
        {page === 'Investigation Room' && <section className="investigation-page"><div className="room-head"><div><div className="eyebrow"><span/> ACTIVE INVESTIGATION</div><h1>{caseData?.title || 'The Moonstone Affair'}</h1><p className="section-copy">{caseData?.setting || 'The Westbridge Museum • Last night, 11:42 PM'}</p></div><span className="difficulty-tag">{caseData?.difficulty || difficulty} CASE</span></div><div className="progress-track"><div><span>CASE PROGRESS</span><b>{clues.length} <small>/ {caseData?.clueCount || levels[difficulty][1].split(' ')[0]} clues discovered</small></b></div><div className="track"><i style={{ width: `${Math.min(100, clues.length / Number(caseData?.clueCount || levels[difficulty][1].split(' ')[0]) * 100)}%` }}/></div></div><div className="investigation-grid"><div><div className="subhead"><h2>People of interest</h2><span>{caseData?.suspects?.length || levels[difficulty][0].split(' ')[0]} SUSPECTS</span></div><div className="suspect-grid">{(caseData?.suspects || people.slice(0, Number(levels[difficulty][0].split(' ')[0]))).map((person, i) => <article className="suspect-card" key={person._id || person.name}><div className={`suspect-avatar ${person.color || ['rose','blue','gold','green'][i%4]}`}>{person.initials || person.icon || person.name?.split(' ').map(x=>x[0]).join('')}</div><div><b>{person.name}</b><small>{person.role || person.occupation || 'Person of interest'}</small></div><p>{person.description || person.detail || 'Their story may hold an important clue.'}</p><span className="suspect-number">0{i+1}</span></article>)}</div><div className="subhead clues-head"><h2>Evidence board</h2><span>{clues.length} FOUND</span></div><div className="clue-list">{clues.length ? clues.map((c,i) => <div className="clue-row" key={c._id || i}><span className="clue-number">0{i+1}</span><span><b>{c.title || `Evidence ${i+1}`}</b><small>{c.description || c.text || c.content}</small></span><span className="clue-points">+5 PTS</span></div>) : <div className="empty-clues"><span>⌕</span><p>No evidence collected yet.</p><small>Search the scene for something that doesn't belong.</small></div>}<button className="secondary-button" disabled={busy} onClick={discoverClue}>⌕ &nbsp; {busy ? 'Searching…' : 'Search for a clue'}</button></div></div><aside className="case-sidebar"><div className="case-sidebar-top"><span className="mini-label">INVESTIGATOR'S NOTE</span><p>{caseData?.story || 'The gallery doors were locked from the inside. The moonstone is gone. Four people were still in the building.'}</p><div className="scribble">— R.</div></div><div className="hint-box"><div className="hint-head"><span>✦ &nbsp; A NUDGE, PERHAPS?</span><span>{hints}/{caseData?.hintLimit || levels[difficulty][2].split(' ')[0]}</span></div><p>{lastHint || "Stuck on a detail? Ask for a hint. It may cost you points."}</p><button className="hint-button" disabled={busy || hints >= Number(caseData?.hintLimit || levels[difficulty][2].split(" ")[0])} onClick={getHint}>Request a hint <span>−10 pts</span></button></div><button className="primary-button full" onClick={() => nav('Accusation')}>Make an accusation <span>↗</span></button><div className="score-note">CLUE DISCOVERED <b>+5 PTS</b><br/>HINT TAKEN <b>−10 PTS</b></div></aside></div></section>}
        {page === 'Accusation' && <section className="form-page accusation-page"><div className="eyebrow"><span/> THE MOMENT OF TRUTH</div><h1>Who did <em>it?</em></h1><p className="section-copy">Review the evidence. Trust your instincts. Once you name your suspect, there's no taking it back.</p><div className="accuse-panel"><div className="accuse-top"><span>YOUR ACCUSATION</span><span>CASE: {caseData?.title || 'THE MOONSTONE AFFAIR'}</span></div><div className="accuse-list">{(caseData?.suspects || people.slice(0, Number(levels[difficulty][0].split(' ')[0]))).map((person,i)=><button className={`accuse-choice ${accused === (person._id || person.name) ? 'picked' : ''}`} key={person._id || person.name} onClick={()=>setAccused(person._id || person.name)}><span className={`suspect-avatar ${person.color || ['rose','blue','gold','green'][i%4]}`}>{person.initials || person.icon || person.name?.split(' ').map(x=>x[0]).join('')}</span><span><b>{person.name}</b><small>{person.role || person.occupation || 'Person of interest'}</small></span><i>{accused === (person._id || person.name) ? '✓' : ''}</i></button>)}</div><button className="primary-button full" disabled={!accused || busy} onClick={submitAccusation}>{busy ? 'Submitting…' : 'Lock in my accusation'} <span>↗</span></button><p className="fine-print">Your score is calculated from the evidence you found and hints you used.</p></div></section>}
        {page === 'Results' && <section className="results-page"><div className="result-seal">{result?.correct ? '✓' : '✕'}</div><div className="eyebrow centered"><span/> CASE CLOSED <span/></div><h1>{result?.correct ? 'Well, well.' : 'A clever culprit.'}<br/><em>{result?.correct ? 'You saw it.' : 'The truth escapes.'}</em></h1><p className="section-copy">{result?.message || (result?.correct ? 'You followed the clues and found the truth.' : 'The evidence told another story. Every detail was there.')}</p><div className="score-card"><span>YOUR FINAL SCORE</span><b>{result?.score ?? 0}</b><small>POINTS</small><div className="score-breakdown"><span>Correct accusation <b>{result?.correct ? `+${result?.basePoints || 150}` : '+0'}</b></span><span>Clues discovered <b>+{result?.cluePoints ?? clues.length * 5}</b></span><span>Hints used <b>−{result?.hintPenalty ?? hints * 10}</b></span></div></div>{result?.culprit && <div className="solution-card"><span>THE CULPRIT</span><b>{result.culprit.name}</b><p>{result.solution}</p></div>}<div className="result-actions"><button className="primary-button" onClick={()=>nav('Create Mystery')}>Open a new case <span>↗</span></button><button className="secondary-button" onClick={()=>nav('Investigation Room')}>Review investigation</button></div></section>}
      </div><footer className="footer"><span>MR. &nbsp; MYSTERY ROOM • EST. 1894</span><span>THE TRUTH IS IN THE DETAILS.</span></footer>
    </main>
  </div>
}
export default App
