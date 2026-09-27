const state = { token: localStorage.getItem('token') || '', user: null };

function setStatus(message, type = 'info') {
  const box = document.getElementById('statusMessage');
  if (!box) return;
  box.textContent = message;
  box.style.background = type === 'error' ? 'rgba(255, 93, 93, 0.16)' : 'rgba(76, 201, 240, 0.14)';
  box.style.color = type === 'error' ? '#ffd2d2' : '#bcecff';
}

function renderUserStatus() {
  const label = document.getElementById('userStatus');
  if (!label) return;
  label.textContent = state.user ? `Signed in as ${state.user.name}` : 'Not signed in yet';
}

function renderHistory(history) {
  const container = document.getElementById('historyList');
  if (!container) return;
  if (!history.length) {
    container.innerHTML = '<p class="muted">No analyses yet.</p>';
    return;
  }

  container.innerHTML = history
    .map(
      (item) => `
        <div class="history-item">
          <strong>${item.fileName}</strong>
          <div class="muted">Role: ${item.role || 'General'}</div>
          <div class="muted">Match score: ${item.matchScore || 'N/A'}</div>
        </div>`
    )
    .join('');
}

async function request(path, options = {}) {
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

async function loadProfile() {
  if (!state.token) {
    renderUserStatus();
    return;
  }

  try {
    const data = await request('/api/auth/me');
    state.user = data.user;
    renderUserStatus();
    await loadHistory();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function loadHistory() {
  try {
    const data = await request('/api/analysis/history');
    renderHistory(data.history || []);
  } catch (error) {
    console.warn(error.message);
  }
}

document.getElementById('registerForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.token = result.token;
    localStorage.setItem('token', result.token);
    state.user = result.user;
    renderUserStatus();
    setStatus(`Welcome ${result.user.name}!`);
    await loadHistory();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.token = result.token;
    localStorage.setItem('token', result.token);
    state.user = result.user;
    renderUserStatus();
    setStatus(`Signed in as ${result.user.name}`);
    await loadHistory();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

document.getElementById('analysisForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.token) {
    setStatus('Please sign in before analyzing a resume.', 'error');
    return;
  }

  const fileInput = document.getElementById('resumeInput');
  const roleInput = document.getElementById('roleInput');
  const file = fileInput.files[0];
  if (!file) {
    setStatus('Please select a resume file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('resume', file);
  formData.append('role', roleInput.value);

  try {
    setStatus('Analyzing your resume...');
    const result = await request('/api/analysis/upload', {
      method: 'POST',
      body: formData
    });

    const resultCard = document.getElementById('resultCard');
    resultCard.innerHTML = `
      <h3>${result.analysis.summary}</h3>
      <p><strong>Skills:</strong> ${result.analysis.skills.join(', ')}</p>
      <p><strong>Strengths:</strong> ${result.analysis.strengths.join(' • ')}</p>
      <p><strong>Improvements:</strong> ${result.analysis.improvements.join(' • ')}</p>
      <p><strong>Match score:</strong> ${result.analysis.matchScore}%</p>
    `;
    setStatus('Analysis complete.');
    await loadHistory();
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

loadProfile();
