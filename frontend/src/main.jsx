import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Upload, Search, FileText, Sparkles, ShieldCheck, ArrowRight, CheckCircle2, CircleAlert, X, RotateCcw } from 'lucide-react';
import './styles.css';

const API = 'http://localhost:8000/api';

function App() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetch(`${API}/profiles?limit=12`).then(r => r.json()).then(d => setProfiles(d.profiles || [])).catch(() => setError('Start the Python API to load the dataset.')); }, []);
  useEffect(() => {
    const timer = setTimeout(() => fetch(`${API}/profiles?q=${encodeURIComponent(query)}&limit=12`).then(r => r.json()).then(d => setProfiles(d.profiles || [])).catch(() => {}), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const chooseFile = e => { const picked = e.target.files?.[0]; if (picked) { setFile(picked); setResult(null); setError(''); } };
  const analyze = async () => {
    if (!file || !selected) return setError('Add a resume and choose a target profile first.');
    setLoading(true); setError('');
    const form = new FormData(); form.append('resume', file); form.append('job_id', selected.id);
    try { const response = await fetch(`${API}/analyze`, { method: 'POST', body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Analysis failed'); setResult(data); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const reset = () => { setFile(null); setSelected(null); setResult(null); setQuery(''); setError(''); };

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><span>matchly</span></div><div className="header-note"><span className="live-dot"/> AI-powered career fit</div></header>
    <main>
      <section className="hero"><div className="eyebrow">RESUME INTELLIGENCE <span>•</span> 01</div><h1>Know where you<br/><em>stand.</em></h1><p>Compare your resume against real job requirements from the supplied dataset and get a clear, actionable path forward.</p></section>
      {!result ? <>
        <div className="stepper"><div className="step active"><b>01</b><span>Upload resume</span></div><div className="line"/><div className={`step ${file ? 'active' : ''}`}><b>02</b><span>Choose a profile</span></div><div className="line"/><div className={`step ${selected ? 'active' : ''}`}><b>03</b><span>Get your readout</span></div></div>
        <section className="workspace">
          <div className="panel upload-panel"><div className="panel-kicker">STEP 01</div><h2>Bring your resume</h2><p className="muted">PDF, DOCX or TXT · up to 10 MB</p><label className={`dropzone ${file ? 'has-file' : ''}`}><input type="file" accept=".pdf,.docx,.txt" onChange={chooseFile}/>{file ? <><CheckCircle2 size={28}/><strong>{file.name}</strong><small>Ready to analyze · click to replace</small></> : <><div className="upload-icon"><Upload size={22}/></div><strong>Drop your resume here</strong><small>or click to browse files</small></>}</label>{file && <div className="file-meta"><FileText size={16}/><span>{(file.size / 1024).toFixed(0)} KB</span><button onClick={() => setFile(null)}><X size={15}/></button></div>}</div>
          <div className="panel profile-panel"><div className="panel-kicker">STEP 02</div><h2>Pick a target</h2><p className="muted">Search the roles in your dataset</p><div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Try “data”, “engineer”, “HR”…"/></div><div className="profile-list">{profiles.map(p => <button className={`profile-option ${selected?.id === p.id ? 'selected' : ''}`} key={p.id} onClick={() => setSelected(p)}><div className="profile-avatar">{p.category.slice(0,1)}</div><div><strong>{p.title}</strong><small>{p.category} · {p.skills.slice(0,3).join(' · ') || 'Requirements extracted'}</small></div>{selected?.id === p.id && <CheckCircle2 className="selected-check" size={18}/>}</button>)}{!profiles.length && <div className="empty">No matching profiles yet.</div>}</div><div className="dataset-note"><ShieldCheck size={15}/><span>Profiles are derived from <b>all_job_post.csv</b>. The source contains roles, not named companies.</span></div></div>
        </section>
        {error && <div className="error"><CircleAlert size={17}/>{error}</div>}
        <button className="primary-cta" onClick={analyze} disabled={loading}>{loading ? 'Reading your resume…' : <>Analyze my fit <ArrowRight size={18}/></>}</button>
      </> : <Result result={result} reset={reset}/>} 
    </main><footer><span>matchly / resume intelligence</span><span>Built for better next steps.</span></footer>
  </div>
}

function Result({ result, reset }) { const circumference = 2 * Math.PI * 51; return <section className="result-wrap"><div className="result-head"><div><div className="eyebrow">YOUR READOUT <span>•</span> COMPLETE</div><h2>{result.verdict}</h2><p>For <b>{result.profile.title}</b> · {result.profile.category}</p></div><button className="reset" onClick={reset}><RotateCcw size={15}/> New analysis</button></div><div className="result-grid"><div className="score-card"><div className="score-ring"><svg viewBox="0 0 120 120"><circle className="track" cx="60" cy="60" r="51"/><circle className="progress" cx="60" cy="60" r="51" style={{strokeDasharray: circumference, strokeDashoffset: circumference - (circumference * result.score / 100)}}/></svg><div><strong>{result.score}</strong><span>/ 100</span></div></div><h3>Overall fit score</h3><p>Based on skill overlap between your resume and this role profile.</p><div className="mini-stats"><span><b>{result.matched.length}</b> matched</span><span><b>{result.missing.length}</b> to build</span></div></div><div className="insights"><div className="insight-card good"><div className="insight-title"><CheckCircle2 size={18}/> What you bring</div><div className="chips">{result.matched.length ? result.matched.map(x => <span key={x}>{x}</span>) : <small>No mapped skills found yet</small>}</div></div><div className="insight-card gap"><div className="insight-title"><CircleAlert size={18}/> Your growth areas</div><div className="chips">{result.missing.length ? result.missing.map(x => <span key={x}>{x}</span>) : <small>Great coverage — keep sharpening your edge.</small>}</div></div><div className="next-card"><div><Sparkles size={18}/><b>Your next moves</b></div>{result.recommendations.map(x => <p key={x}>↗ {x}</p>)}</div></div></div><div className="disclaimer"><ShieldCheck size={15}/>{result.disclaimer} Resume parsed: {result.resume_word_count} words.</div></section> }

createRoot(document.getElementById('root')).render(<App/>);
