import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  UploadCloud,
  Clock,
  Volume2,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle,
  FileAudio,
  ExternalLink,
  Mic,
  RotateCcw,
  BarChart3,
  ListFilter,
  LineChart,
  Github
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Friendly human labels and clean styling for flaws
const FLAW_TYPES = {
  too_fast: {
    label: 'Speaking Too Fast',
    badge: 'bg-red-50 text-red-700 border-red-200',
    color: '#EF4444',
    bg: '#FEF2F2',
    simpleExplain: 'You rushed through this sentence faster than the standard pace.',
    simpleTip: 'Take a calm breath and give key words extra space to land.'
  },
  too_slow: {
    label: 'Speaking Too Slow',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    color: '#F97316',
    bg: '#FFF7ED',
    simpleExplain: 'Your delivery dragged down here, making the sentence lose momentum.',
    simpleTip: 'Pick up your cadence slightly to keep the listener engaged.'
  },
  missing_pauses: {
    label: 'No Break Between Sentences',
    badge: 'bg-pink-50 text-pink-700 border-pink-200',
    color: '#EC4899',
    bg: '#FDF2F8',
    simpleExplain: 'Clauses ran together without natural punctuation pauses.',
    simpleTip: 'Insert a 0.5-second pause at commas and full stops.'
  },
  long_pauses: {
    label: 'Unusually Long Pause',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    color: '#EAB308',
    bg: '#FEFCE8',
    simpleExplain: 'There was a prolonged hesitation or silence here.',
    simpleTip: 'Keep pauses intentional (0.5s to 1.2s) so the flow stays intact.'
  },
  monotone: {
    label: 'Monotone Pitch',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    color: '#8B5CF6',
    bg: '#FAF5FF',
    simpleExplain: 'Your voice stayed flat without pitch inflection or enthusiasm.',
    simpleTip: 'Raise your pitch slightly on key nouns and emphasized verbs.'
  },
  volume_drop: {
    label: 'Sudden Volume Drop',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    color: '#0284C7',
    bg: '#F0F9FF',
    simpleExplain: 'Your voice dropped in volume toward the end of the phrase.',
    simpleTip: 'Maintain steady breath support all the way through the end of the sentence.'
  },
  pitch_spike: {
    label: 'Sharp Pitch Spike',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    color: '#DC2626',
    bg: '#FFF1F2',
    simpleExplain: 'There was an abrupt jump in vocal pitch, sounding strained.',
    simpleTip: 'Keep your vocal chords relaxed to avoid sudden strained jumps.'
  },
  stumble_filler: {
    label: 'Hesitation or Stumble',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    color: '#0D9488',
    bg: '#F0FDFA',
    simpleExplain: 'Slight stumble, filler sound, or repeated syllable detected.',
    simpleTip: 'It is okay to pause silently instead of using filler sounds.'
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
  const [activeTab, setActiveTab] = useState('scores') // 'scores' | 'flaws' | 'charts'
  const [playbackRate, setPlaybackRate] = useState(1.0)
  
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

  // Load sample demo with 1-click
  const handleLoadDemo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/demo`)
      if (!res.ok) throw new Error('Could not load sample recording.')
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

  // Submit audio file for analysis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!audioFile) {
      setError('Please choose an audio file first, or click "Try Sample Audio".')
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
        throw new Error(errJson.detail || 'Analysis could not be completed.')
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
    if (!secs || isNaN(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const maxTime = analysisData?.summary?.duration || duration || 20.0

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      
      {/* Simple, Human Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Project Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#5B4DFB] flex items-center justify-center text-white shadow-sm">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                SpeechFlaw
              </span>
              <span className="text-xs text-slate-500 block -mt-0.5">
                Speech & Delivery Analyzer
              </span>
            </div>
          </div>

          {/* Simple Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <span className="text-[#5B4DFB]">Analyzer</span>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#team" className="hover:text-slate-900 transition-colors">Team</a>
            <a
              href="https://github.com/priyanshu9229/Contrastive_Speech_Analytics_and_Temporal_Flaw_Grounding-"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 flex items-center gap-1 transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </nav>

          {/* Action button */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F0EFFF] text-[#5B4DFB] hover:bg-[#E4E1FF] transition-colors cursor-pointer disabled:opacity-50"
            >
              Try Sample Audio
            </button>
          </div>
        </div>
      </header>

      {/* Simple, Human Hero Section */}
      <section className="pt-8 pb-5 px-4 text-center max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
          Analyze Your Speech in Seconds
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
          Upload any speech recording to get clear feedback on your pacing, pauses, pitch variation, and volume.
        </p>

        {/* Clean, simple benefit tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-slate-600 font-medium">
          <span className="bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
            🎧 Supports .m4a, .mp3, .wav
          </span>
          <span className="bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
            ⚡ Instant pacing & rhythm check
          </span>
          <span className="bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
            🎯 Timeline playback & tips
          </span>
        </div>
      </section>

      {/* Main 2-Column Application Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 pb-14 flex-1 w-full">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl mb-5 flex items-center justify-between text-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-3">✕</button>
          </div>
        )}

        {/* Hidden Audio Player */}
        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* The 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ======================================================= */}
          {/* LEFT: Simple Upload Card                                */}
          {/* ======================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
              
              <h2 className="font-bold text-slate-900 text-base">
                1. Upload Speech Audio
              </h2>

              {/* Clean Upload Drop Area */}
              <label className="border-2 border-dashed border-slate-300 hover:border-[#5B4DFB] bg-slate-50 hover:bg-[#F0EFFF]/30 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                <input
                  type="file"
                  accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.flac"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 group-hover:border-[#5B4DFB] text-[#5B4DFB] flex items-center justify-center mb-2.5 shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Click to browse, or drag audio here
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Works with iPhone Voice Memos (.m4a), MP3, WAV
                </p>
              </label>

              {/* Selected File Card */}
              {audioFile && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <FileAudio className="w-5 h-5 text-[#5B4DFB] shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 truncate">{audioFile.name}</p>
                      <p className="text-[11px] text-slate-500">{(audioFile.size / (1024 * 1024)).toFixed(1)} MB • Ready to analyze</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Selected
                  </span>
                </div>
              )}

              {/* Step 2: Compare against reference */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-800">
                  2. Compare against reference speech:
                </label>
                <select
                  value={selectedBaseline}
                  onChange={handleBaselineChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#5B4DFB] cursor-pointer"
                >
                  {baselines.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.speaker} — {b.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Transcript (Simple / Collapsible) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  3. Spoken text (optional):
                </label>
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Transcript for word-by-word alignment..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#5B4DFB] resize-none"
                />
              </div>

              {/* Main Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#5B4DFB] hover:bg-[#4A3CE5] text-white transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Analyzing your recording...</span>
                  </>
                ) : (
                  <span>Analyze Speech</span>
                )}
              </button>

              {/* Demo Sample Link */}
              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={handleLoadDemo}
                  disabled={loading}
                  className="text-xs font-semibold text-[#5B4DFB] hover:underline cursor-pointer"
                >
                  No audio on hand? Click here to test sample audio
                </button>
              </div>

            </div>

            {/* Simple "How it Works" Card */}
            <div id="how-it-works" className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs text-xs">
              <h3 className="font-bold text-slate-900 mb-2">How It Works</h3>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#5B4DFB] font-bold">1.</span>
                  <span>Aligns your recording with the standard speech using non-linear audio warping.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#5B4DFB] font-bold">2.</span>
                  <span>Measures tempo shifts, silence gaps, pitch range, and volume consistency.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#5B4DFB] font-bold">3.</span>
                  <span>Pinpoints exact seconds where delivery drifted and provides coaching advice.</span>
                </li>
              </ul>
            </div>

          </div>

          {/* ======================================================= */}
          {/* RIGHT: Results & Feedback Card                          */}
          {/* ======================================================= */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {analysisData ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-5">
                
                {/* 1. Audio Player Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {audioFile ? audioFile.name : 'Sample_Recording.wav'}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {formatTime(currentTime)} / {formatTime(maxTime)}
                      </p>
                    </div>

                    {/* Speed Selector */}
                    <div className="flex items-center space-x-1 bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
                      {[0.8, 1.0, 1.2].map(rate => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                            playbackRate === rate ? 'bg-[#5B4DFB] text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Play/Pause & Scrubber */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 rounded-full bg-[#5B4DFB] hover:bg-[#4A3CE5] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm transition-transform active:scale-95"
                    >
                      {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                    </button>

                    {/* Timeline Scrubber */}
                    <div
                      className="relative flex-1 h-8 bg-white border border-slate-200 rounded-lg overflow-hidden cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const clickX = e.clientX - rect.left
                        const targetSec = (clickX / rect.width) * maxTime
                        seekToTime(targetSec)
                      }}
                    >
                      {/* Flaw highlights on the timeline */}
                      {analysisData.flaw_regions.map((flaw, idx) => {
                        const leftPct = (flaw.start / maxTime) * 100
                        const widthPct = Math.max(2.5, ((flaw.end - flaw.start) / maxTime) * 100)
                        const cfg = FLAW_TYPES[flaw.flaw_type] || { bg: '#FEF2F2', color: '#EF4444' }
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
                            className={`absolute top-0 bottom-0 border-x transition-all z-10 ${
                              isHovered ? 'ring-2 ring-[#5B4DFB]' : ''
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: cfg.bg,
                              borderColor: cfg.color
                            }}
                            title={`Jump to ${flaw.start}s`}
                          />
                        )
                      })}

                      {/* Playhead */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-[#5B4DFB] z-20 pointer-events-none"
                        style={{ left: `${(currentTime / maxTime) * 100}%` }}
                      >
                        <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-[#5B4DFB] -mt-0.5"></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    💡 Colored sections on the timeline indicate moments where your delivery drifted. Click any color to listen.
                  </p>
                </div>

                {/* 2. Simple Tabs (Scores vs Flaws vs Charts) */}
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('scores')}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'scores'
                        ? 'border-[#5B4DFB] text-[#5B4DFB]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Overall Scores
                  </button>

                  <button
                    onClick={() => setActiveTab('flaws')}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'flaws'
                        ? 'border-[#5B4DFB] text-[#5B4DFB]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    Moments to Improve ({analysisData.flaw_regions.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('charts')}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'charts'
                        ? 'border-[#5B4DFB] text-[#5B4DFB]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    Pitch & Pace Curves
                  </button>
                </div>

                {/* TAB 1: OVERALL SCORES */}
                {activeTab === 'scores' && (
                  <div className="flex flex-col gap-4">
                    {/* Big Score Card */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-xl bg-white border-2 border-[#5B4DFB] flex flex-col items-center justify-center shrink-0 shadow-2xs">
                          <span className="text-2xl font-black text-[#5B4DFB] leading-none">
                            {analysisData.scores.overall}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">/ 100</span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            Overall Delivery Rating
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900">
                            {analysisData.scores.overall >= 88 ? 'Near Perfect Delivery' :
                             analysisData.scores.overall >= 70 ? 'Competent Delivery' :
                             analysisData.scores.overall >= 50 ? 'Needs Attention' : 'Noticeably Flawed'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {analysisData.flaw_regions.length === 0
                              ? 'Smooth cadence and natural pauses throughout.'
                              : `${analysisData.flaw_regions.length} area(s) detected where delivery drifted.`}
                          </p>
                        </div>
                      </div>

                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        analysisData.scores.overall >= 70
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        Grade {analysisData.scores.overall >= 88 ? 'A' : analysisData.scores.overall >= 70 ? 'B+' : 'C'}
                      </span>
                    </div>

                    {/* 5 Simple Metric Bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <SimpleScoreBar
                        title="Pacing & Speed"
                        score={analysisData.scores.pacing}
                        hint="Consistency in words per minute"
                        color="bg-rose-500"
                      />
                      <SimpleScoreBar
                        title="Pauses & Silence"
                        score={analysisData.scores.pauses}
                        hint="Natural breaks between thoughts"
                        color="bg-amber-500"
                      />
                      <SimpleScoreBar
                        title="Pitch & Melody"
                        score={analysisData.scores.pitch_variation}
                        hint="Vocal inflection and emphasis"
                        color="bg-purple-500"
                      />
                      <SimpleScoreBar
                        title="Vocal Projection"
                        score={analysisData.scores.energy}
                        hint="Steadiness in speech volume"
                        color="bg-sky-500"
                      />
                      <div className="sm:col-span-2">
                        <SimpleScoreBar
                          title="Articulation & Clarity"
                          score={analysisData.scores.clarity}
                          hint="Clean speech without slurring"
                          color="bg-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: MOMENTS TO IMPROVE */}
                {activeTab === 'flaws' && (
                  <div className="space-y-3">
                    {analysisData.flaw_regions.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        🎉 No major flaws detected! Your delivery aligns well with the reference speaker.
                      </div>
                    ) : (
                      analysisData.flaw_regions.map((flaw, idx) => {
                        const cfg = FLAW_TYPES[flaw.flaw_type] || {
                          label: flaw.title || flaw.flaw_type,
                          badge: 'bg-red-50 text-red-700 border-red-200',
                          simpleExplain: flaw.perceptual_impact,
                          simpleTip: flaw.actionable_tip
                        }
                        const isHovered = activeFlawHover === idx

                        return (
                          <div
                            key={idx}
                            onClick={() => seekToTime(flaw.start)}
                            onMouseEnter={() => setActiveFlawHover(idx)}
                            onMouseLeave={() => setActiveFlawHover(null)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-slate-50 hover:bg-white ${
                              isHovered ? 'ring-2 ring-[#5B4DFB] border-[#5B4DFB]' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono text-slate-500">
                                  {flaw.time_span}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    seekToTime(flaw.start)
                                  }}
                                  className="text-xs font-bold text-[#5B4DFB] hover:underline"
                                >
                                  ▶ Listen
                                </button>
                              </div>
                            </div>

                            {flaw.words && (
                              <p className="text-xs text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200 mb-2">
                                "{flaw.words}"
                              </p>
                            )}

                            <p className="text-xs text-slate-600 mb-2">
                              {cfg.simpleExplain || flaw.perceptual_impact}
                            </p>

                            <div className="bg-[#F0EFFF] border border-indigo-100 p-2.5 rounded-lg text-xs text-indigo-900 flex items-start gap-1.5">
                              <span className="font-bold text-[#5B4DFB]">Tip:</span>
                              <span>{cfg.simpleTip || flaw.actionable_tip}</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {/* TAB 3: PITCH & PACE CURVES */}
                {activeTab === 'charts' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                      <span className="text-slate-500">Compare your trajectory against the reference:</span>
                      <div className="flex items-center space-x-3 font-semibold">
                        <span className="flex items-center gap-1 text-[#5B4DFB]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#5B4DFB]"></span> You
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Reference
                        </span>
                      </div>
                    </div>

                    {/* Chart 1: Pitch */}
                    <SimpleChart
                      title="Pitch Variation (Inflection & Tone)"
                      unit="semitones"
                      maxTime={maxTime}
                      currentTime={currentTime}
                      pSeries={analysisData.time_series.participant.pitch}
                      bSeries={analysisData.time_series.baseline.pitch}
                      pTimes={analysisData.time_series.participant.times}
                      bTimes={analysisData.time_series.baseline.times}
                      yMin={-8}
                      yMax={8}
                      onSeek={seekToTime}
                    />

                    {/* Chart 2: Volume */}
                    <SimpleChart
                      title="Speaking Volume & Energy"
                      unit="loudness"
                      maxTime={maxTime}
                      currentTime={currentTime}
                      pSeries={analysisData.time_series.participant.energy}
                      bSeries={analysisData.time_series.baseline.energy}
                      pTimes={analysisData.time_series.participant.times}
                      bTimes={analysisData.time_series.baseline.times}
                      yMin={-3.0}
                      yMax={2.5}
                      onSeek={seekToTime}
                    />

                    {/* Chart 3: Cadence */}
                    <SimpleChart
                      title="Speaking Speed Over Time"
                      unit="syllables / sec"
                      maxTime={maxTime}
                      currentTime={currentTime}
                      pSeries={analysisData.time_series.participant.rate}
                      bSeries={analysisData.time_series.baseline.rate}
                      pTimes={analysisData.time_series.participant.times}
                      bTimes={analysisData.time_series.baseline.times}
                      yMin={0.0}
                      yMax={7.0}
                      onSeek={seekToTime}
                    />
                  </div>
                )}

              </div>
            ) : (
              /* Simple Initial Empty State */
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center flex flex-col items-center justify-center min-h-[420px] shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#F0EFFF] text-[#5B4DFB] flex items-center justify-center mb-4">
                  <Mic className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Ready to listen!
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                  Upload an audio file on the left or try our sample speech to see your delivery score, timeline flaws, and coach tips.
                </p>
                <button
                  onClick={handleLoadDemo}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#5B4DFB] text-white hover:bg-[#4A3CE5] transition-colors cursor-pointer"
                >
                  Load Sample Speech
                </button>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Clean Human Footer */}
      <footer id="team" className="border-t border-slate-200 bg-white py-5 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-800">SpeechFlaw</span> • Multimodal AI Hackathon 2026 (Track C)
          </div>
          <div>
            Built with ❤️ by <span className="font-semibold text-slate-700">Priyanshu Singh, Aarav Sharma, Rohan Verma, and Ananya Iyer</span>
          </div>
        </div>
      </footer>

    </div>
  )
}

function SimpleScoreBar({ title, score, hint, color }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-bold text-slate-800">{title}</span>
        <span className="font-extrabold text-slate-900">{score}/100</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{hint}</p>
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(5, score)}%` }}
        />
      </div>
    </div>
  )
}

function SimpleChart({
  title,
  unit,
  maxTime,
  currentTime,
  pSeries,
  bSeries,
  pTimes,
  bTimes,
  yMin,
  yMax,
  onSeek
}) {
  const chartHeight = 70
  const chartWidth = 600

  const scaleX = (t) => (t / maxTime) * chartWidth
  const scaleY = (v) => {
    if (v === null || isNaN(v)) return null
    const clamped = Math.max(yMin, Math.min(yMax, v))
    const ratio = (clamped - yMin) / (yMax - yMin)
    return chartHeight - ratio * chartHeight
  }

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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5 font-medium">
        <span className="text-slate-800 font-bold">{title}</span>
        <span className="text-[10px] text-slate-400">[{unit}]</span>
      </div>

      <div
        className="relative w-full h-[70px] cursor-pointer overflow-hidden rounded bg-white border border-slate-200"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const sec = (clickX / rect.width) * maxTime
          onSeek(sec)
        }}
      >
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Subtle center line */}
          <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#F1F5F9" />

          {/* Reference Curve (Green) */}
          <path d={bPath} fill="none" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

          {/* You Curve (Purple) */}
          <path d={pPath} fill="none" stroke="#5B4DFB" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />

          {/* Playhead */}
          <line
            x1={scaleX(currentTime)}
            y1="0"
            x2={scaleX(currentTime)}
            y2={chartHeight}
            stroke="#1E293B"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  )
}
