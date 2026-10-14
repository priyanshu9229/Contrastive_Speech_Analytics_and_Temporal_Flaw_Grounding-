import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  Play,
  Pause,
  RotateCcw,
  Upload,
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
  Info
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const FLAW_COLORS = {
  too_fast: { bg: 'rgba(244, 63, 94, 0.25)', border: '#f43f5e', text: '#fda4af', label: 'Too Fast' },
  too_slow: { bg: 'rgba(249, 115, 22, 0.25)', border: '#f97316', text: '#fdba74', label: 'Too Slow' },
  missing_pauses: { bg: 'rgba(236, 72, 153, 0.25)', border: '#ec4899', text: '#f9a8d4', label: 'Missing Pauses' },
  long_pauses: { bg: 'rgba(234, 179, 8, 0.25)', border: '#eab308', text: '#fde047', label: 'Long Pause' },
  monotone: { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', text: '#c4b5fd', label: 'Monotone' },
  volume_drop: { bg: 'rgba(6, 182, 212, 0.25)', border: '#06b6d4', text: '#67e8f9', label: 'Volume Drop' },
  pitch_spike: { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', text: '#fca5a5', label: 'Pitch Spike' },
  stumble_filler: { bg: 'rgba(20, 184, 166, 0.25)', border: '#14b8a6', text: '#5eead4', label: 'Stumble / Filler' },
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
      // Set audio url to static demo audio
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
    e.preventDefault()
    if (!audioFile) {
      setError('Please select an audio file to analyze, or click "Load Demo".')
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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs % 1) * 10)
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`
  }

  const maxTime = analysisData?.summary?.duration || duration || 25.0

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0c1220]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                SpeechFlaw
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono">
                  Track C
                </span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">Contrastive Speech Analytics & Temporal Flaw Grounding</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>FastAPI DTW Engine Online</span>
            </div>

            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-all flex items-center space-x-1.5 shadow-sm shadow-sky-500/5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Load Demo Sample</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6">
        
        {/* Error Toast */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">✕</button>
          </div>
        )}

        {/* Input & Upload Header Bar */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* Audio Upload */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Participant Audio Recording</label>
              <label className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-600 transition-all cursor-pointer text-xs text-slate-300 truncate">
                <Upload className="h-4 w-4 mr-2 text-sky-400 shrink-0" />
                <span className="truncate">{audioFile ? audioFile.name : 'Choose audio (.wav, .mp3)'}</span>
                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* Baseline Reference Picker */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Reference Gold Standard</label>
              <select
                value={selectedBaseline}
                onChange={handleBaselineChange}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {baselines.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.speaker} — {b.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Transcript Input */}
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Spoken Transcript</label>
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speech transcript for forced alignment..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500 truncate"
              />
            </div>

            {/* Analyze Button */}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all flex items-center justify-center space-x-2 shadow-md shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    <span>Analyze Delivery</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Hidden HTML Audio element for playback */}
        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Dashboard Workspace */}
        {analysisData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Cols: Audio Waveform & Multi-Track Acoustic Charts */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Playback & Waveform Timeline Card */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={togglePlay}
                      className="h-10 w-10 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-md shadow-sky-500/25"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Participant Audio Timeline</h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {formatTime(currentTime)} / {formatTime(maxTime)}
                      </p>
                    </div>
                  </div>

                  {/* Flaw Type Legend Tags */}
                  <div className="hidden sm:flex flex-wrap gap-1.5 items-center justify-end max-w-sm">
                    {Object.entries(FLAW_COLORS).slice(0, 4).map(([key, item]) => (
                      <span
                        key={key}
                        className="text-[10px] font-medium px-2 py-0.5 rounded border"
                        style={{ backgroundColor: item.bg, borderColor: item.border, color: item.text }}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Timeline Scrubber with Grounded Flaw Regions */}
                <div className="relative w-full h-16 bg-[#090d16] rounded-xl border border-slate-800 overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickX = e.clientX - rect.left
                    const targetSec = (clickX / rect.width) * maxTime
                    seekToTime(targetSec)
                  }}
                >
                  {/* Pseudo waveform bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 opacity-30 pointer-events-none">
                    {Array.from({ length: 90 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-slate-400"
                        style={{ height: `${20 + Math.sin(i * 0.4) * 25 + Math.cos(i * 0.7) * 15}%` }}
                      ></div>
                    ))}
                  </div>

                  {/* Flaw Bounding Shaded Intervals */}
                  {analysisData.flaw_regions.map((flaw, idx) => {
                    const leftPct = (flaw.start / maxTime) * 100
                    const widthPct = Math.max(1.5, ((flaw.end - flaw.start) / maxTime) * 100)
                    const color = FLAW_COLORS[flaw.flaw_type] || { bg: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', text: '#fff' }
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
                        className={`absolute top-0 bottom-0 border-x transition-all flex flex-col justify-between p-1 z-10 ${isHovered ? 'ring-2 ring-white/60 brightness-125' : ''}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: color.bg,
                          borderColor: color.border,
                        }}
                      >
                        <span className="text-[9px] font-bold truncate" style={{ color: color.text }}>
                          {color.label}
                        </span>
                        <span className="text-[8px] font-mono opacity-80" style={{ color: color.text }}>
                          {flaw.start}s
                        </span>
                      </div>
                    )
                  })}

                  {/* Playhead Vertical Bar */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-20 shadow-[0_0_8px_rgba(56,189,248,0.8)] pointer-events-none"
                    style={{ left: `${(currentTime / maxTime) * 100}%` }}
                  >
                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-sky-400 -mt-0.5"></div>
                  </div>
                </div>
              </div>

              {/* Stacked Time-Series Acoustic Contours */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-sky-400" />
                      Acoustic Time-Series Footprint (Participant vs. Reference)
                    </h3>
                    <p className="text-xs text-slate-400">DTW non-linear aligned continuous feature trajectories</p>
                  </div>
                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <span className="h-2 w-4 rounded-full bg-sky-400"></span> Participant
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-2 w-4 rounded-full bg-emerald-400"></span> Baseline Reference
                    </span>
                  </div>
                </div>

                {/* Track 1: Pitch Dynamic Contour (Semitones) */}
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

                {/* Track 2: RMS Energy Projection (Z-Scored) */}
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

                {/* Track 3: Local Speech Rate (Syllables/sec) */}
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

            </div>

            {/* Right 4 Cols: Rubric Scores & Grounded Flaw Diagnosis Cards */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Overall Score & Rubric Breakdown Card */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Evaluative Rubric Scoring</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Weights Sum = 1.00
                  </span>
                </div>

                {/* Overall Score Dial */}
                <div className="flex items-center justify-between bg-[#090d16] p-4 rounded-xl border border-slate-800/80 mb-5">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Overall Score</span>
                    <div className="text-3xl font-extrabold text-white mt-0.5 tracking-tight flex items-baseline gap-1">
                      {analysisData.scores.overall}
                      <span className="text-xs font-normal text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      analysisData.scores.overall >= 88 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                      analysisData.scores.overall >= 70 ? 'bg-sky-500/10 text-sky-300 border-sky-500/30' :
                      analysisData.scores.overall >= 50 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                      'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}>
                      {analysisData.scores.overall >= 88 ? 'Near Perfect' :
                       analysisData.scores.overall >= 70 ? 'Competent' :
                       analysisData.scores.overall >= 50 ? 'Noticeably Flawed' : 'Egregious Delivery'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">{analysisData.flaw_regions.length} grounded flaw regions</p>
                  </div>
                </div>

                {/* 5 Subscore Progress Meters */}
                <div className="space-y-3.5">
                  <SubscoreMeter label="Pacing (Tempo Stability)" score={analysisData.scores.pacing} weight="25%" color="bg-rose-500" />
                  <SubscoreMeter label="Pauses (Syntactic Cadence)" score={analysisData.scores.pauses} weight="20%" color="bg-amber-500" />
                  <SubscoreMeter label="Pitch Variation (Inflection)" score={analysisData.scores.pitch_variation} weight="20%" color="bg-violet-500" />
                  <SubscoreMeter label="Energy (Projection Dynamics)" score={analysisData.scores.energy} weight="15%" color="bg-cyan-500" />
                  <SubscoreMeter label="Clarity (Articulation & HNR)" score={analysisData.scores.clarity} weight="20%" color="bg-emerald-500" />
                </div>
              </div>

              {/* Grounded Flaws & Causal Explanations Card List */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    <h3 className="text-sm font-semibold text-white">Causal Flaw Diagnoses</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {analysisData.flaw_regions.length} Detected
                  </span>
                </div>

                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {analysisData.flaw_regions.map((flaw, idx) => {
                    const color = FLAW_COLORS[flaw.flaw_type] || { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5', label: flaw.flaw_type }
                    const isHovered = activeFlawHover === idx

                    return (
                      <div
                        key={idx}
                        onClick={() => seekToTime(flaw.start)}
                        onMouseEnter={() => setActiveFlawHover(idx)}
                        onMouseLeave={() => setActiveFlawHover(null)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-slate-900/80 hover:bg-slate-900 ${
                          isHovered ? 'ring-2 ring-sky-400 border-sky-400 shadow-md' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                            style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                          >
                            {flaw.title || color.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {flaw.time_span}
                          </span>
                        </div>

                        {flaw.words && (
                          <p className="text-xs text-slate-300 italic mb-2 bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                            "{flaw.words}"
                          </p>
                        )}

                        <div className="text-xs text-slate-200 mb-2 leading-relaxed">
                          <span className="text-sky-300 font-mono font-medium">{flaw.mathematical_rationale}</span>{' '}
                          <span className="text-slate-400">{flaw.perceptual_impact}</span>
                        </div>

                        <div className="bg-sky-950/30 border border-sky-800/40 p-2 rounded-lg text-[11px] text-sky-200 flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span><strong>Coach Tip:</strong> {flaw.actionable_tip}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Empty Initial State */
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center my-8 shadow-xl">
            <div className="h-16 w-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
              <Mic className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready for Contrastive Speech Evaluation</h2>
            <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
              Upload a spoken audio file above or click <span className="text-sky-400 font-semibold">"Load Demo Sample"</span> to inspect acoustic stress points, DTW contour alignment, and grounded flaw explanations.
            </p>
            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all flex items-center space-x-2 shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Load Steve Jobs Keynote Demo</span>
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Multimodal AI Hackathon 2026 — Track C: Contrastive Speech Analytics</span>
          <span className="font-mono text-slate-400">Team: Priyanshu Singh, Aarav Sharma, Rohan Verma, Ananya Iyer</span>
        </div>
      </footer>
    </div>
  )
}

function SubscoreMeter({ label, score, weight, color }) {
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[10px]">{weight}</span>
          <span className="font-mono font-bold text-white">{score}</span>
        </div>
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
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
    <div className="bg-[#090d16] border border-slate-800/90 rounded-xl p-3">
      <div className="flex justify-between items-center text-xs text-slate-400 mb-2 font-mono">
        <span className="text-slate-200 font-sans font-medium text-[11px]">{title}</span>
        <span>[{unit}]</span>
      </div>

      <div
        className="relative w-full h-[85px] cursor-pointer overflow-hidden rounded bg-[#0b101d]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const sec = (clickX / rect.width) * maxTime
          onSeek(sec)
        }}
      >
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#1e293b" strokeDasharray="3 3" />
          
          {/* Shaded Flaw Regions on this chart */}
          {flaws.map((flaw, idx) => {
            const rx = scaleX(flaw.start)
            const rw = Math.max(3, scaleX(flaw.end) - rx)
            const color = FLAW_COLORS[flaw.flaw_type] || { border: '#ef4444' }
            const isHovered = activeFlawHover === idx

            return (
              <rect
                key={idx}
                x={rx}
                y="0"
                width={rw}
                height={chartHeight}
                fill={isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)'}
                stroke={color.border}
                strokeWidth={isHovered ? '1.5' : '0.8'}
                strokeDasharray="2 2"
              />
            )
          })}

          {/* Baseline Reference Curve (Emerald) */}
          <path d={bPath} fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />

          {/* Participant Trajectory Curve (Sky Blue) */}
          <path d={pPath} fill="none" stroke="#38bdf8" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />

          {/* Playhead vertical line */}
          <line
            x1={scaleX(currentTime)}
            y1="0"
            x2={scaleX(currentTime)}
            y2={chartHeight}
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="2 1"
          />
        </svg>
      </div>
    </div>
  )
}
