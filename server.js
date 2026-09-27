require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const analysisSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  fileName: String,
  role: String,
  summary: String,
  skills: [String],
  strengths: [String],
  improvements: [String],
  matchScore: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const ResumeAnalysis = mongoose.model('ResumeAnalysis', analysisSchema);

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-resume-analyzer';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.warn('MongoDB connection failed, continuing in demo mode:', error.message);
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

async function parseResumeText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (ext === '.pdf') {
    const data = await pdfParse(filePath);
    return data.text;
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return 'Resume text could not be parsed automatically.';
}

function buildFallbackAnalysis(text, role) {
  const lowerText = text.toLowerCase();
  const skills = ['communication', 'leadership', 'problem solving', 'teamwork', 'technical writing', 'project management'];
  const detectedSkills = skills.filter((skill) => lowerText.includes(skill));
  const strengths = [
    'Clear professional experience and accomplishments',
    detectedSkills.length > 0 ? `Strong alignment with ${detectedSkills.slice(0, 3).join(', ')}` : 'Good foundational experience profile'
  ];

  const improvements = [
    'Add measurable metrics such as revenue growth or efficiency gains',
    'Tailor the summary to the target role for better recruiter alignment',
    'Include a stronger skills section with tools and technologies'
  ];

  const summary = `This resume presents a solid professional profile for ${role || 'the target position'}. The content shows capability in core workplace skills and a clear path for further refinement.`;

  return {
    summary,
    skills: detectedSkills.length > 0 ? detectedSkills.map((skill) => skill.replace(/\b\w/g, (letter) => letter.toUpperCase())) : ['Communication', 'Leadership', 'Problem Solving'],
    strengths,
    improvements,
    matchScore: Math.min(95, 70 + detectedSkills.length * 5),
    source: 'fallback'
  };
}

async function analyzeWithGemini(text, role) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  try {
    const prompt = `Analyze this resume and return a JSON object with the keys summary, skills, strengths, improvements, and matchScore. Keep it concise. Target role: ${role || 'general professional role'}\n\nResume text:\n${text.slice(0, 12000)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!result) {
      return null;
    }

    const cleaned = result.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      ...parsed,
      source: 'gemini'
    };
  } catch (error) {
    console.warn('Gemini analysis failed, falling back to local analysis.', error.message);
    return null;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Resume Analyzer API is running' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database is unavailable. Please configure MongoDB and try again.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database is unavailable. Please configure MongoDB and try again.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load profile', error: error.message });
  }
});

app.post('/api/analysis/upload', authenticateToken, upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Resume file is required' });
  }

  try {
    const resumeText = await parseResumeText(req.file.path, req.file.originalname);
    const role = req.body.role || 'General professional role';
    const geminiAnalysis = await analyzeWithGemini(resumeText, role);
    const analysis = geminiAnalysis || buildFallbackAnalysis(resumeText, role);

    if (mongoose.connection.readyState === 1) {
      await ResumeAnalysis.create({
        userId: req.user.id,
        fileName: req.file.originalname,
        role,
        summary: analysis.summary,
        skills: analysis.skills,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        matchScore: analysis.matchScore
      });
    }

    res.json({
      success: true,
      analysis,
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ message: 'Analysis failed', error: error.message });
  }
});

app.get('/api/analysis/history', authenticateToken, async (req, res) => {
  try {
    const history = await ResumeAnalysis.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ history });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load history', error: error.message });
  }
});

app.get('*', (req, res) => {
  const clientIndex = path.join(__dirname, 'client', 'dist', 'index.html');
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

connectDatabase();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
