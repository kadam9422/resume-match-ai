import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';

const API = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('Ready to analyze your next resume.');
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', resume: null });

  const request = async (path, options = {}) => {
    const headers = {};
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const loadProfile = async () => {
    if (!token) return;
    try {
      const data = await request(`${API}/auth/me`);
      setUser(data.user);
      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await request(`${API}/analysis/history`);
      setHistory(data.history || []);
    } catch (error) {
      console.warn(error.message);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    try {
      const data = await request(`${API}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setMessage(`Welcome ${data.user.name}!`);
      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const data = await request(`${API}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setMessage(`Signed in as ${data.user.name}`);
      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!token) {
      setMessage('Please sign in first.');
      return;
    }

    const file = form.resume;
    if (!file) {
      setMessage('Please select a resume file.');
      return;
    }

    const payload = new FormData();
    payload.append('resume', file);
    payload.append('role', form.role);

    try {
      setMessage('Analyzing your resume...');
      const data = await request(`${API}/analysis/upload`, {
        method: 'POST',
        body: payload
      });
      setResult(data.analysis);
      setMessage('Analysis complete.');
      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="brand">AI Resume Analyzer</div>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <div className="hero-grid">
              <section className="card hero-card">
                <p className="eyebrow">Advanced full-stack experience</p>
                <h1>Turn resumes into recruiter-ready insights.</h1>
                <p>Upload a document, analyze it with AI, and review your match score, skills, strengths, and improvements.</p>
                <form className="stack" onSubmit={handleUpload}>
                  <input type="text" placeholder="Target role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                  <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setForm({ ...form, resume: e.target.files?.[0] || null })} />
                  <button type="submit">Analyze Resume</button>
                </form>
                <div className="message-box">{message}</div>
              </section>

              <section className="card auth-card">
                <h2>{user ? `Welcome ${user.name}` : 'Get started'}</h2>
                <form className="stack" onSubmit={handleRegister}>
                  <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="submit">Register</button>
                </form>
                <form className="stack" onSubmit={handleLogin}>
                  <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="submit">Login</button>
                </form>
              </section>
            </div>
          }
        />

        <Route
          path="/dashboard"
          element={
            <div className="dashboard-grid">
              <section className="card">
                <h2>Latest analysis</h2>
                {result ? (
                  <div>
                    <p><strong>Summary:</strong> {result.summary}</p>
                    <p><strong>Skills:</strong> {result.skills?.join(', ')}</p>
                    <p><strong>Strengths:</strong> {result.strengths?.join(' • ')}</p>
                    <p><strong>Improvements:</strong> {result.improvements?.join(' • ')}</p>
                    <p><strong>Match score:</strong> {result.matchScore}%</p>
                  </div>
                ) : (
                  <p>No analysis yet.</p>
                )}
              </section>

              <section className="card">
                <h2>Recent history</h2>
                {history.length ? history.map((item) => (
                  <div key={item._id} className="history-item">
                    <strong>{item.fileName}</strong>
                    <div>Role: {item.role}</div>
                    <div>Score: {item.matchScore}%</div>
                  </div>
                )) : <p>No saved analyses.</p>}
              </section>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
