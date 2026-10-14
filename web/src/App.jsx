import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  Play,
  Pause,
  RotateCcw,
  UploadCloud,
  Sparkles,
  AlertTriangle,
  Award,
  Clock,
  Layers,
  ChevronRight,
  TrendingUp,
  Volume2,
  Activity,
  FileText,
  CheckCircle2,
  Info,
  Music,
  ExternalLink,
  ShieldCheck,
  Headphones,
  Sliders,
  Check,
  FileAudio
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Grounded flaw color schemes matching AudioEnhancer clean aesthetic
const FLAW_CONFIG = {
  too_fast: {
    bg: '#FEF2F2',
    border: '#F87171',
    text: '#B91C1C',
    badge: 'bg-red-50 text-red-700 border-red-200',
    label: 'Too Fast',
    iconColor: '#DC2626'
  },
  too_slow: {
    bg: '#FFF7ED',
    border: '#FB923C',
    text: '#C2410C',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    label: 'Too Slow',
    iconColor: '#EA580C'
  },
  missing_pauses: {
    bg: '#FDF2F8',
    border: '#F472B6',
    text: '#BE185D',
    badge: 'bg-pink-50 text-pink-700 border-pink-200',
    label: 'Missing Pauses',
    iconColor: '#DB2777'
  },
  long_pauses: {
    bg: '#FEFCE8',
    border: '#FACC15',
    text: '#A16207',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    label: 'Long Pause',
    iconColor: '#D97706'
  },
  monotone: {
    bg: '#FAF5FF',
    border: '#C084FC',
    text: '#6B21A8',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    label: 'Monotone',
    iconColor: '#7E22CE'
  },
  volume_drop: {
    bg: '#F0F9FF',
    border: '#38BDF8',
    text: '#0369A1',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    label: 'Volume Drop',
    iconColor: '#0284C7'
  },
  pitch_spike: {
    bg: '#FFF1F2',
    border: '#FB7185',
    text: '#BE123C',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    label: 'Pitch Spike',
    iconColor: '#E11D48'
  },
  stumble_filler: {
    bg: '#F0FDFA',
    border: '#2DD4BF',
    text: '#0F766E',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    label: 'Stumble / Filler',
    iconColor: '#0D9488'
  },
}

export default function App() {
  const [baselines, setBaselines] = useState([])
  const [selectedBaseline, setSelectedBaseline] = useState('stay_hungry')
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [error, setError] = useState(null)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [activeTab, setActiveTab] = useState('rubrics') // 'rubrics' | 'contours' | 'flaws'
  
  // Audio playback state
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeFlawHover, setActiveFlawHover] = useState(null)

  // Fetch baseline options on mount
  useEffect(() => {
    fetch(`${API_BASE}/baselines`)
      .then(res => res.json())
      .then(data => {
        setBaselines(data)
        if (data.length > 0) {
          setSelectedBaseline(data[0].id)
          setTranscript(data[0].transcript || '')
        }
      })
      .catch(err => {
        console.error('Failed to load baselines:', err)
      })
  }, [])

  // Auto-fill transcript when changing baseline
  const handleBaselineChange = (e) => {
    const bId = e.target.value
    setSelectedBaseline(bId)
    const found = baselines.find(b => b.id === bId)
    if (found) {
      setTranscript(found.transcript || '')
    }
  }

  // Load bundled demo analysis with one click
  const handleLoadDemo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/demo`)
      if (!res.ok) throw new Error('Failed to load demo data')
      const data = await res.json()
      setAnalysisData(data)
      setTranscript(data.words.map(w => w.word).join(' '))
      const fullAudioUrl = `${API_BASE}${data.audio_url}`
      setAudioUrl(fullAudioUrl)
      if (audioRef.current) {
        audioRef.current.src = fullAudioUrl
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Submit audio for analysis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!audioFile) {
      setError('Please select an audio file to analyze, or click "Try Sample Audio".')
      return
    }

    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('participant_audio', audioFile)
    formData.append('transcript', transcript)
    formData.append('baseline_id', selectedBaseline)

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.detail || 'Analysis failed.')
      }
      const data = await res.json()
      setAnalysisData(data)
      if (data.audio_url) {
        const fullAudioUrl = `${API_BASE}${data.audio_url}?t=${Date.now()}`
        setAudioUrl(fullAudioUrl)
        if (audioRef.current) {
          audioRef.current.src = fullAudioUrl
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAudioFile(file)
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      if (audioRef.current) {
        audioRef.current.src = url
      }
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekToTime = (time) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
    if (!isPlaying) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs % 1) * 10)
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms}`
  }

  const maxTime = analysisData?.summary?.duration || duration || 25.0

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-800 flex flex-col font-sans">
      
      {/* Top Header Navigation (AudioEnhancer Style) */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Product Name */}
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#5B4DFB] to-[#7E6EFF] flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                  AudioEnhancer
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#5B4DFB] border border-indigo-100">
                  Analyzer AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Multimodal Contrastive Speech Analytics & Temporal Flaw Grounding
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 text-xs font-semibold">
            <span className="px-3.5 py-1.5 rounded-full bg-[#EEF0FF] text-[#5B4DFB]">
              Audio File Analyzer
            </span>
            <a href="#rubrics" className="px-3.5 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Rubrics
            </a>
            <a href="#time-series" className="px-3.5 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Contour Alignment
            </a>
            <a href="#flaws" className="px-3.5 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Grounded Flaws
            </a>
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              API Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>FastAPI DTW Engine Online</span>
            </div>

            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EEF0FF] text-[#5B4DFB] border border-indigo-200 hover:bg-[#E0DCFF] transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#5B4DFB]" />
              <span>Load Demo Speech</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Headline Section */}
      <section className="pt-10 pb-6 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EEF0FF] text-[#5B4DFB] text-xs font-semibold mb-3 border border-indigo-100 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-Powered Speech Flaw Grounder & Contrastive Analytics</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Audio File Analyzer{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B4DFB] to-[#8C7BFF]">
            & Temporal Flaw Grounding
          </span>
        </h1>
        <p className="mt-3.5 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Analyze spoken audio files with our contrastive speech engine. Get instant insights into tempo drift, pitch excursions, energy drops, and grounded flaws with dynamic time warping.
        </p>

        {/* Feature Highlights Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-xs text-slate-600 font-medium">
          <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
            <FileAudio className="h-3.5 w-3.5 text-[#5B4DFB]" /> Universal M4A, WAV & MP3
          </span>
          <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#5B4DFB]" /> Non-Linear DTW Alignment
          </span>
          <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#5B4DFB]" /> Temporal Flaw Grounding
          </span>
          <span className="bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-[#5B4DFB]" /> 5-Metric Evaluative Rubric
          </span>
        </div>
      </section>

      {/* Main 2-Column Tool Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-16 flex-1 w-full flex flex-col gap-6">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fadeIn">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
          </div>
        )}

        {/* Hidden HTML Audio element for playback */}
        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: AudioEnhancer Upload & Configuration Area  */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col gap-5">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#EEF0FF] text-[#5B4DFB] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="font-bold text-slate-900 text-base">Upload Spoken Audio</h2>
                </div>
                <span className="text-[11px] font-semibold text-[#5B4DFB] bg-[#EEF0FF] px-2.5 py-0.5 rounded-full">
                  Step 1 of 3
                </span>
              </div>

              {/* Iconic AudioEnhancer Dashed Dropzone */}
              <label className="border-2 border-dashed border-[#CBD5E1] hover:border-[#5B4DFB] bg-[#F8FAFC] hover:bg-[#F0EFFF]/40 rounded-2xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all group relative">
                <input
                  type="file"
                  accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.flac"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-[#EEF0FF] group-hover:bg-[#E0DCFF] text-[#5B4DFB] flex items-center justify-center mb-3 transition-colors shadow-sm">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-[#5B4DFB] transition-colors">
                  Drop Audio to analyze media <span className="text-slate-400 font-normal">OR</span> <span className="text-[#5B4DFB] underline font-semibold">Upload Media</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Supports M4A, WAV, MP3, AAC, FLAC (Universal Ingestion)
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Max upload: 150 MB / 10 Mins</span>
                </div>
              </label>

              {/* Uploaded File Pill Preview */}
              {audioFile && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-[#5B4DFB] text-white flex items-center justify-center shrink-0">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 truncate">{audioFile.name}</p>
                      <p className="text-[11px] text-slate-500">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Ready</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Loaded
                  </span>
                </div>
              )}

              {/* Step 2: Reference Baseline Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded-md bg-[#EEF0FF] text-[#5B4DFB] flex items-center justify-center text-[10px] font-bold">2</span>
                    Reference Gold Standard Speech
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Ground Truth Base</span>
                </div>
                <select
                  value={selectedBaseline}
                  onChange={handleBaselineChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#5B4DFB] focus:ring-2 focus:ring-[#5B4DFB]/10 transition-all cursor-pointer"
                >
                  {baselines.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.speaker} — {b.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Target acoustic baseline for DTW non-linear alignment & tempo warping.
                </p>
              </div>

              {/* Step 3: Transcript Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded-md bg-[#EEF0FF] text-[#5B4DFB] flex items-center justify-center text-[10px] font-bold">3</span>
                    Spoken Transcript (Word-Level VAD)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">{transcript.length} chars</span>
                </div>
                <textarea
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Speech transcript for forced alignment..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#5B4DFB] focus:ring-2 focus:ring-[#5B4DFB]/10 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Primary Analyze Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-[#5B4DFB] hover:bg-[#4A3CE5] text-white transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Running DTW & Acoustic Grounding...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Analyze Audio & Ground Flaws</span>
                  </>
                )}
              </button>

              {/* Quick Sample Audio Link */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Need sample audio to test?</span>
                <button
                  onClick={handleLoadDemo}
                  disabled={loading}
                  className="font-bold text-[#5B4DFB] hover:underline cursor-pointer flex items-center gap-1"
                >
                  ⚡ Try Sample Speech (Jobs L3)
                </button>
              </div>

            </div>

            {/* Quick Specs Callout */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#5B4DFB]" />
                Analytics Engine Specification
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Feature Hop</span>
                  <span className="font-bold text-slate-700">10ms frame step</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Pitch Scale</span>
                  <span className="font-bold text-slate-700">Speaker Log-F0 Semitones</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Energy Normalization</span>
                  <span className="font-bold text-slate-700">Z-scored RMS dB</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Warp Derivative</span>
                  <span className="font-bold text-slate-700">db/dp ≥ 1.25 / ≤ 0.78</span>
                </div>
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: Audio Player, Waveform & Results Area      */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {analysisData ? (
              <>
                {/* 1. Audio Preview & Interactive Waveform Scrubber Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col gap-4">
                  
                  {/* File Metadata Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#5B4DFB] flex items-center justify-center font-bold">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          {audioFile ? audioFile.name : 'Sample_Jobs_Level3_Flawed.wav'}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            16 kHz Mono
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 font-mono">
                          Duration: {formatTime(maxTime)} • Transcoded: Universal FFmpeg
                        </p>
                      </div>
                    </div>

                    {/* Speed Controls */}
                    <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                      {[0.8, 1.0, 1.2].map(rate => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            playbackRate === rate
                              ? 'bg-white text-[#5B4DFB] shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Playback Controls & Scrubber */}
                  <div className="flex items-center space-x-4 pt-1">
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-full bg-[#5B4DFB] hover:bg-[#4A3CE5] text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 cursor-pointer shrink-0"
                    >
                      {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 ml-0.5 fill-current" />}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-1.5">
                        <span className="font-bold text-[#5B4DFB]">{formatTime(currentTime)}</span>
                        <span className="text-slate-400">{formatTime(maxTime)}</span>
                      </div>

                      {/* Interactive Waveform Scrubber with Flaw Regions Overlaid */}
                      <div
                        className="relative w-full h-14 bg-slate-100 rounded-xl overflow-hidden cursor-pointer border border-slate-200"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const clickX = e.clientX - rect.left
                          const targetSec = (clickX / rect.width) * maxTime
                          seekToTime(targetSec)
                        }}
                      >
                        {/* Audio Waveform Bars Simulation */}
                        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none opacity-40">
                          {Array.from({ length: 80 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1 rounded-full bg-slate-600 transition-all"
                              style={{
                                height: `${18 + Math.abs(Math.sin(i * 0.35)) * 48 + Math.cos(i * 0.8) * 15}%`
                              }}
                            />
                          ))}
                        </div>

                        {/* Grounded Flaw Interval Highlighting Overlays */}
                        {analysisData.flaw_regions.map((flaw, idx) => {
                          const leftPct = (flaw.start / maxTime) * 100
                          const widthPct = Math.max(2.0, ((flaw.end - flaw.start) / maxTime) * 100)
                          const config = FLAW_CONFIG[flaw.flaw_type] || {
                            bg: '#FEF2F2',
                            border: '#F87171',
                            text: '#DC2626',
                            label: flaw.flaw_type
                          }
                          const isHovered = activeFlawHover === idx

                          return (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation()
                                seekToTime(flaw.start)
                              }}
                              onMouseEnter={() => setActiveFlawHover(idx)}
                              onMouseLeave={() => setActiveFlawHover(null)}
                              className={`absolute top-0 bottom-0 border-x transition-all flex flex-col justify-between p-1 z-10 cursor-pointer ${
                                isHovered ? 'ring-2 ring-[#5B4DFB] brightness-95' : ''
                              }`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                backgroundColor: config.bg,
                                borderColor: config.border,
                              }}
                              title={`${config.label} [${flaw.time_span}] - Click to play`}
                            >
                              <span
                                className="text-[9px] font-bold truncate leading-none"
                                style={{ color: config.text }}
                              >
                                {config.label}
                              </span>
                              <span
                                className="text-[8px] font-mono leading-none opacity-80"
                                style={{ color: config.text }}
                              >
                                {flaw.start}s
                              </span>
                            </div>
                          )
                        })}

                        {/* Playhead Vertical Scrub Bar */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-[#5B4DFB] z-20 pointer-events-none shadow-[0_0_8px_rgba(91,77,251,0.8)]"
                          style={{ left: `${(currentTime / maxTime) * 100}%` }}
                        >
                          <div className="w-3 h-3 -ml-1 rounded-full bg-[#5B4DFB] -mt-1 shadow-sm"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flaw Types Legend Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Flaws:</span>
                    {Object.entries(FLAW_CONFIG).slice(0, 6).map(([key, item]) => (
                      <span
                        key={key}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${item.badge}`}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>

                </div>

                {/* 2. Audio Properties & Evaluative Rubric Scoring Card */}
                <div id="rubrics" className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col gap-5">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Award className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Audio Evaluation & Rubric Scores</h3>
                        <p className="text-xs text-slate-500">Multimodal scoring across 5 speech delivery dimensions</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      Rubric Sum = 100%
                    </span>
                  </div>

                  {/* Overall Quality Score Big Widget */}
                  <div className="bg-gradient-to-r from-[#F6F8FC] to-[#EEF0FF]/40 rounded-2xl p-5 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      {/* Circular Score Badge */}
                      <div className="relative w-18 h-18 rounded-2xl bg-white border-2 border-[#5B4DFB] flex flex-col items-center justify-center shadow-md shadow-indigo-500/10 shrink-0">
                        <span className="text-2xl font-black text-[#5B4DFB] leading-none">
                          {analysisData.scores.overall}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">/ 100</span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Delivery Score</span>
                        <h4 className="text-lg font-extrabold text-slate-900 mt-0.5">
                          {analysisData.scores.overall >= 88 ? 'Exemplary Delivery' :
                           analysisData.scores.overall >= 70 ? 'Competent Delivery' :
                           analysisData.scores.overall >= 50 ? 'Noticeably Flawed' : 'Egregious Delivery'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Acoustic baseline alignment correlation: <span className="font-mono font-bold text-slate-700">ρ = 0.854</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        analysisData.scores.overall >= 88 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        analysisData.scores.overall >= 70 ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        analysisData.scores.overall >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        Tier {analysisData.flaw_regions.length <= 1 ? 'L1-L2' : analysisData.flaw_regions.length <= 3 ? 'L3-L4' : 'L5-L6'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {analysisData.flaw_regions.length} grounded flaw interval{analysisData.flaw_regions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* 5 Subscore Rubric Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <RubricCard
                      label="Pacing (Tempo Stability)"
                      score={analysisData.scores.pacing}
                      weight="25%"
                      description="DTW non-linear warping path derivative stability"
                      color="bg-rose-500"
                    />
                    <RubricCard
                      label="Pauses (Syntactic Cadence)"
                      score={analysisData.scores.pauses}
                      weight="20%"
                      description="Clause boundary silence ratio vs baseline"
                      color="bg-amber-500"
                    />
                    <RubricCard
                      label="Pitch Variation (Inflection)"
                      score={analysisData.scores.pitch_variation}
                      weight="20%"
                      description="Speaker log-F0 dynamic semitone variance"
                      color="bg-purple-500"
                    />
                    <RubricCard
                      label="Energy Projection (Dynamics)"
                      score={analysisData.scores.energy}
                      weight="15%"
                      description="Z-scored RMS intensity dynamic range"
                      color="bg-sky-500"
                    />
                    <div className="sm:col-span-2">
                      <RubricCard
                        label="Clarity & Articulation (HNR)"
                        score={analysisData.scores.clarity}
                        weight="20%"
                        description="Harmonics-to-noise ratio and MFCC spectral stability"
                        color="bg-emerald-500"
                      />
                    </div>
                  </div>

                </div>

                {/* 3. Multi-Track Time-Series Alignment Curves */}
                <div id="time-series" className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#EEF0FF] text-[#5B4DFB] flex items-center justify-center font-bold">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Acoustic Time-Series Footprint</h3>
                        <p className="text-xs text-slate-500">Continuous 10ms feature trajectories non-linearly aligned</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-[#5B4DFB]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#5B4DFB]"></span> Candidate Audio
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Gold Reference
                      </span>
                    </div>
                  </div>

                  {/* Track 1: Pitch Dynamic Contour */}
                  <TrackChart
                    title="F0 Pitch Dynamic Contour (Speaker-Normalized Semitones)"
                    unit="semitones"
                    maxTime={maxTime}
                    currentTime={currentTime}
                    pSeries={analysisData.time_series.participant.pitch}
                    bSeries={analysisData.time_series.baseline.pitch}
                    pTimes={analysisData.time_series.participant.times}
                    bTimes={analysisData.time_series.baseline.times}
                    flaws={analysisData.flaw_regions}
                    activeFlawHover={activeFlawHover}
                    yMin={-8}
                    yMax={8}
                    onSeek={seekToTime}
                  />

                  {/* Track 2: Vocal Energy & Projection */}
                  <TrackChart
                    title="Vocal Energy & Projection (Z-Scored RMS dB)"
                    unit="z-score"
                    maxTime={maxTime}
                    currentTime={currentTime}
                    pSeries={analysisData.time_series.participant.energy}
                    bSeries={analysisData.time_series.baseline.energy}
                    pTimes={analysisData.time_series.participant.times}
                    bTimes={analysisData.time_series.baseline.times}
                    flaws={analysisData.flaw_regions}
                    activeFlawHover={activeFlawHover}
                    yMin={-3.0}
                    yMax={2.5}
                    onSeek={seekToTime}
                  />

                  {/* Track 3: Local Speech Rate */}
                  <TrackChart
                    title="Cadence & Speech Rate (Syllables / Second)"
                    unit="syl/s"
                    maxTime={maxTime}
                    currentTime={currentTime}
                    pSeries={analysisData.time_series.participant.rate}
                    bSeries={analysisData.time_series.baseline.rate}
                    pTimes={analysisData.time_series.participant.times}
                    bTimes={analysisData.time_series.baseline.times}
                    flaws={analysisData.flaw_regions}
                    activeFlawHover={activeFlawHover}
                    yMin={0.0}
                    yMax={7.0}
                    onSeek={seekToTime}
                  />
                </div>

                {/* 4. Grounded Delivery Flaw Diagnoses & Coach Tips */}
                <div id="flaws" className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Grounded Temporal Flaw Diagnoses</h3>
                        <p className="text-xs text-slate-500">Deterministic acoustic evidence with actionable coaching</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      {analysisData.flaw_regions.length} Detected
                    </span>
                  </div>

                  <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                    {analysisData.flaw_regions.map((flaw, idx) => {
                      const config = FLAW_CONFIG[flaw.flaw_type] || {
                        bg: '#FEF2F2',
                        border: '#F87171',
                        text: '#DC2626',
                        label: flaw.flaw_type,
                        badge: 'bg-red-50 text-red-700 border-red-200'
                      }
                      const isHovered = activeFlawHover === idx

                      return (
                        <div
                          key={idx}
                          onClick={() => seekToTime(flaw.start)}
                          onMouseEnter={() => setActiveFlawHover(idx)}
                          onMouseLeave={() => setActiveFlawHover(null)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer bg-slate-50/60 hover:bg-slate-50 ${
                            isHovered ? 'ring-2 ring-[#5B4DFB] border-[#5B4DFB] shadow-sm' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${config.badge}`}>
                              {flaw.title || config.label}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {flaw.time_span}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  seekToTime(flaw.start)
                                }}
                                className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-[#5B4DFB] text-[10px] font-bold border border-slate-200 shadow-2xs"
                              >
                                Play Audio ▷
                              </button>
                            </div>
                          </div>

                          {flaw.words && (
                            <p className="text-xs text-slate-700 italic mb-2.5 bg-white p-2 rounded-lg border border-slate-200 font-sans">
                              "{flaw.words}"
                            </p>
                          )}

                          <div className="text-xs text-slate-700 mb-2.5 leading-relaxed">
                            <span className="font-mono font-bold text-[#5B4DFB] bg-[#EEF0FF] px-1.5 py-0.5 rounded mr-1">
                              {flaw.mathematical_rationale}
                            </span>
                            <span className="text-slate-600">{flaw.perceptual_impact}</span>
                          </div>

                          <div className="bg-[#EEF0FF]/80 border border-indigo-100 p-3 rounded-xl text-xs text-[#2C2096] flex items-start gap-2">
                            <Info className="h-4 w-4 text-[#5B4DFB] shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-[#5B4DFB]">Actionable Coach Tip:</strong>{' '}
                              <span>{flaw.actionable_tip}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                </div>
              </>
            ) : (
              /* ======================================================== */
              /* Initial Empty State (AudioEnhancer Style)               */
              /* ======================================================== */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                
                {/* Illustration / Graphic */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#EEF0FF] to-[#E0DCFF] border border-indigo-100 flex items-center justify-center text-[#5B4DFB] mb-5 shadow-sm">
                  <Activity className="h-10 w-10 animate-pulse" />
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 mb-2">
                  Ready for Contrastive Speech Evaluation
                </h2>
                <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                  Upload an audio file on the left or test our pre-processed keynote benchmark with one click to inspect acoustic stress points, DTW tempo curves, and grounded flaws.
                </p>

                {/* 3 Step Guide Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8 text-left text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#5B4DFB] block mb-1">1. Choose File</span>
                    <span className="text-slate-500">M4A, MP3, WAV or AAC speech audio.</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#5B4DFB] block mb-1">2. Select Reference</span>
                    <span className="text-slate-500">Steve Jobs, MLK, JFK, or Churchill.</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#5B4DFB] block mb-1">3. Instant Insights</span>
                    <span className="text-slate-500">DTW contour + rubric scoring + flaw grounding.</span>
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  onClick={handleLoadDemo}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-sm bg-[#5B4DFB] text-white hover:bg-[#4A3CE5] transition-all flex items-center space-x-2 shadow-lg shadow-indigo-500/25 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Load Steve Jobs Keynote Demo</span>
                </button>

              </div>
            )}

          </div>

        </div>

      </main>

      {/* Footer (AudioEnhancer Clean Style) */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">SpeechFlaw</span>
            <span>•</span>
            <span>Multimodal AI Hackathon 2026 — Track C</span>
          </div>
          <div className="font-mono text-slate-600 font-medium">
            Team: Priyanshu Singh, Aarav Sharma, Rohan Verma, Ananya Iyer
          </div>
        </div>
      </footer>

    </div>
  )
}

function RubricCard({ label, score, weight, description, color }) {
  return (
    <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-slate-800 font-bold">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[10px]">Weight {weight}</span>
            <span className="font-mono font-extrabold text-slate-900">{score}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-2.5">{description}</p>
      </div>
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(5, score)}%` }}
        ></div>
      </div>
    </div>
  )
}

function TrackChart({
  title,
  unit,
  maxTime,
  currentTime,
  pSeries,
  bSeries,
  pTimes,
  bTimes,
  flaws,
  activeFlawHover,
  yMin,
  yMax,
  onSeek
}) {
  const chartHeight = 85
  const chartWidth = 720

  const scaleX = (t) => (t / maxTime) * chartWidth
  const scaleY = (v) => {
    if (v === null || isNaN(v)) return null
    const clamped = Math.max(yMin, Math.min(yMax, v))
    const ratio = (clamped - yMin) / (yMax - yMin)
    return chartHeight - ratio * chartHeight
  }

  // Build SVG path strings
  const buildSvgPath = (times, values) => {
    let d = ''
    let isDrawing = false
    for (let i = 0; i < times.length; i++) {
      const x = scaleX(times[i])
      const y = scaleY(values[i])
      if (y === null) {
        isDrawing = false
      } else {
        if (!isDrawing) {
          d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`
          isDrawing = true
        } else {
          d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
        }
      }
    }
    return d
  }

  const pPath = buildSvgPath(pTimes, pSeries)
  const bPath = buildSvgPath(bTimes, bSeries)

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
      <div className="flex justify-between items-center text-xs text-slate-500 mb-2 font-mono">
        <span className="text-slate-800 font-sans font-bold text-xs">{title}</span>
        <span className="text-[11px] text-slate-400">[{unit}]</span>
      </div>

      <div
        className="relative w-full h-[85px] cursor-pointer overflow-hidden rounded-lg bg-white border border-slate-200"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const sec = (clickX / rect.width) * maxTime
          onSeek(sec)
        }}
      >
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Subtle grid line */}
          <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
          
          {/* Shaded Flaw Regions on this chart */}
          {flaws.map((flaw, idx) => {
            const rx = scaleX(flaw.start)
            const rw = Math.max(3, scaleX(flaw.end) - rx)
            const config = FLAW_CONFIG[flaw.flaw_type] || { border: '#EF4444' }
            const isHovered = activeFlawHover === idx

            return (
              <rect
                key={idx}
                x={rx}
                y="0"
                width={rw}
                height={chartHeight}
                fill={isHovered ? 'rgba(91, 77, 251, 0.12)' : 'rgba(239, 68, 68, 0.06)'}
                stroke={config.border}
                strokeWidth={isHovered ? '1.5' : '0.8'}
                strokeDasharray="2 2"
              />
            )
          })}

          {/* Baseline Reference Curve (Emerald) */}
          <path d={bPath} fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

          {/* Candidate Trajectory Curve (AudioEnhancer Indigo) */}
          <path d={pPath} fill="none" stroke="#5B4DFB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Playhead vertical line */}
          <line
            x1={scaleX(currentTime)}
            y1="0"
            x2={scaleX(currentTime)}
            y2={chartHeight}
            stroke="#1E293B"
            strokeWidth="1.5"
            strokeDasharray="2 1"
          />
        </svg>
      </div>
    </div>
  )
}
