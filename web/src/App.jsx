import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Pause,
  Upload,
  RotateCcw,
  Volume2,
  Info,
  ExternalLink,
  FileAudio,
  AlertCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import Plotly from 'plotly.js-dist-min'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Resilient API fetch that automatically falls back across origins (localhost vs 127.0.0.1)
async function apiFetch(endpoint, options = {}) {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const candidates = [
    import.meta.env.VITE_API_URL,
    isLocal ? `http://${window.location.hostname}:8000` : null,
    'http://127.0.0.1:8000',
    'http://localhost:8000'
  ].filter(Boolean)

  let lastError = null
  for (const host of candidates) {
    try {
      const url = `${host}${endpoint}`
      const res = await fetch(url, options)
      return { res, host }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Failed to connect to backend analytics server at http://127.0.0.1:8000')
}

// Colorblind-safe category colors
const FLAW_CATEGORY_COLORS = {
  pacing: '#E69F00',   // orange
  pauses: '#56B4E9',   // sky blue
  pitch: '#CC79A7',    // reddish purple
  energy: '#F0E442',   // yellow
  clarity: '#D55E00',  // vermilion
}

function getFlawCategory(flawType) {
  switch (flawType) {
    case 'too_fast':
    case 'too_slow':
      return 'pacing'
    case 'missing_pauses':
    case 'long_pauses':
      return 'pauses'
    case 'monotone':
    case 'pitch_spike':
      return 'pitch'
    case 'volume_drop':
      return 'energy'
    case 'stumble_filler':
      return 'clarity'
    default:
      return 'pacing'
  }
}

function getFlawColor(flawType) {
  const cat = getFlawCategory(flawType)
  return FLAW_CATEGORY_COLORS[cat] || '#E69F00'
}

function getFlawRgba(flawType, alpha = 0.25) {
  const hex = getFlawColor(flawType)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getFlawLabel(flawType) {
  switch (flawType) {
    case 'too_fast': return 'Pacing (Fast)'
    case 'too_slow': return 'Pacing (Slow)'
    case 'missing_pauses': return 'Missing Pause'
    case 'long_pauses': return 'Unnatural Pause'
    case 'monotone': return 'Monotone Pitch'
    case 'pitch_spike': return 'Pitch Excursion'
    case 'volume_drop': return 'Volume Drop'
    case 'stumble_filler': return 'Articulation / Filler'
    default: return flawType.replace('_', ' ')
  }
}

function getGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function getGradeLabel(grade) {
  switch (grade) {
    case 'A': return 'Exemplary'
    case 'B': return 'Competent'
    case 'C': return 'Acceptable'
    case 'D': return 'Noticeably Flawed'
    default: return 'Deficient'
  }
}

function getScoreColor(score) {
  if (score > 70) return '#2FBF9B'
  if (score >= 40) return '#E69F00'
  return '#EF4444'
}

function formatTime(secs) {
  if (!secs || isNaN(secs) || secs < 0) return '00:00.0'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  const ms = Math.floor((secs % 1) * 10)
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms}`
}

function formatRange(start, end) {
  const m1 = Math.floor(start / 60)
  const s1 = Math.floor(start % 60)
  const m2 = Math.floor(end / 60)
  const s2 = Math.floor(end % 60)
  return `${m1}:${s1 < 10 ? '0' : ''}${s1}-${m2}:${s2 < 10 ? '0' : ''}${s2}`
}

export const DEFAULT_BASELINES = [
  {
    id: "stay_hungry",
    title: "Stanford Commencement Address (2005)",
    speaker: "Steve Jobs",
    category: "Inspirational Keynote",
    duration: 26.16,
    transcript_path: "data/raw/stay_hungry.txt",
    audio_url: "/static/raw/stay_hungry.wav",
    transcript: "Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma, which is living with the results of other people's thinking. Don't let the noise of others' opinions drown out your own inner voice. And most important, have the courage to follow your heart and intuition. They somehow already know what you truly want to become. Stay hungry. Stay foolish."
  },
  {
    id: "dream",
    title: "I Have a Dream (1963)",
    speaker: "Martin Luther King Jr.",
    category: "Civil Rights Oratory",
    duration: 21.12,
    transcript_path: "data/raw/dream.txt",
    audio_url: "/static/raw/dream.wav",
    transcript: "I say to you today, my friends, so even though we face the difficulties of today and tomorrow, I still have a dream. It is a dream deeply rooted in the American dream. I have a dream that one day this nation will rise up and live out the true meaning of its creed: We hold these truths to be self-evident, that all men are created equal."
  },
  {
    id: "moon",
    title: "We Choose to go to the Moon (1962)",
    speaker: "John F. Kennedy",
    category: "Presidential Visionary",
    duration: 16.22,
    transcript_path: "data/raw/moon.txt",
    audio_url: "/static/raw/moon.wav",
    transcript: "We choose to go to the moon in this decade and do the other things, not because they are easy, but because they are hard, because that goal will serve to organize and measure the best of our energies and skills, because that challenge is one that we are willing to accept, one we are unwilling to postpone, and one which we intend to win."
  },
  {
    id: "beaches",
    title: "We Shall Fight on the Beaches (1940)",
    speaker: "Winston Churchill",
    category: "Wartime Address",
    duration: 21.7,
    transcript_path: "data/raw/beaches.txt",
    audio_url: "/static/raw/beaches.wav",
    transcript: "We shall go on to the end, we shall fight in France, we shall fight on the seas and oceans, we shall fight with growing confidence and growing strength in the air, we shall defend our island, whatever the cost may be. We shall fight on the beaches, we shall fight on the landing grounds, we shall fight in the fields and in the streets, we shall fight in the hills; we shall never surrender."
  }
]

export default function App() {
  const [baselines, setBaselines] = useState(DEFAULT_BASELINES)
  const [selectedBaseline, setSelectedBaseline] = useState('stay_hungry')
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [transcript, setTranscript] = useState(DEFAULT_BASELINES[0].transcript)
  const [loading, setLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [error, setError] = useState(null)
  
  // Transport & playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [hoveredFlawIndex, setHoveredFlawIndex] = useState(null)
  const [activeFlawIndex, setActiveFlawIndex] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  // Active baseline data object
  const selectedBaselineData = baselines.find(b => b.id === selectedBaseline) || DEFAULT_BASELINES.find(b => b.id === selectedBaseline) || DEFAULT_BASELINES[0]

  // DOM Refs
  const waveContainerRef = useRef(null)
  const timelineContainerRef = useRef(null)
  const wavesurferRef = useRef(null)
  const regionsPluginRef = useRef(null)
  const pitchChartRef = useRef(null)
  const energyChartRef = useRef(null)
  const rateChartRef = useRef(null)

  // Fetch baseline speeches on mount (updates dynamically from backend)
  useEffect(() => {
    apiFetch('/baselines')
      .then(({ res }) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBaselines(data)
        }
      })
      .catch(err => {
        console.warn('Backend /baselines fetch failed; using built-in reference baselines:', err)
      })
  }, [])

  const handleBaselineChange = (e) => {
    const bId = e.target.value
    setSelectedBaseline(bId)
    const found = baselines.find(b => b.id === bId) || DEFAULT_BASELINES.find(b => b.id === bId)
    if (found && found.transcript) {
      setTranscript(found.transcript)
    }
  }

  // Load sample demo with 1-click
  const handleLoadDemo = async () => {
    setLoading(true)
    setError(null)
    try {
      const { res, host } = await apiFetch('/demo')
      if (!res.ok) throw new Error('Could not load sample benchmark.')
      const data = await res.json()
      setAnalysisData(data)
      setTranscript(data.words.map(w => w.word).join(' '))
      const fullAudioUrl = `${host}${data.audio_url}?t=${Date.now()}`
      setAudioUrl(fullAudioUrl)
      setAudioFile({ name: 'demo_stay_hungry_l3.wav', size: 759862 })
    } catch (err) {
      setError(err.message.includes('fetch') || err.message.includes('Failed to')
        ? 'Cannot connect to backend server. Please verify the Python API is running on port 8000.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  // Submit audio file for analysis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!audioFile) {
      setError('Please choose an audio file first, or click "Load sample".')
      return
    }

    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('participant_audio', audioFile)
    formData.append('transcript', transcript)
    formData.append('baseline_id', selectedBaseline)

    try {
      const { res, host } = await apiFetch('/analyze', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Analysis could not be completed.')
      }
      const data = await res.json()
      setAnalysisData(data)
      if (data.audio_url) {
        const fullAudioUrl = `${host}${data.audio_url}?t=${Date.now()}`
        setAudioUrl(fullAudioUrl)
      }
    } catch (err) {
      setError(err.message.includes('fetch') || err.message.includes('Failed to')
        ? 'Cannot connect to backend server at http://127.0.0.1:8000. Please verify the Python API is running.'
        : err.message)
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
    }
  }

  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
  }, [])

  const seekToTime = useCallback((time) => {
    if (!wavesurferRef.current) return
    const d = wavesurferRef.current.getDuration() || duration || 1.0
    const ratio = Math.max(0, Math.min(1, time / d))
    wavesurferRef.current.seekTo(ratio)
    setCurrentTime(time)
    if (!isPlaying) {
      wavesurferRef.current.play()
    }
  }, [duration, isPlaying])

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate)
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(rate)
    }
  }

  const jumpFlaw = useCallback((direction) => {
    if (!analysisData || !analysisData.flaw_regions || analysisData.flaw_regions.length === 0) return
    const flaws = analysisData.flaw_regions
    let nextIdx = 0
    if (activeFlawIndex === null) {
      nextIdx = direction > 0 ? 0 : flaws.length - 1
    } else {
      nextIdx = (activeFlawIndex + direction + flaws.length) % flaws.length
    }
    setActiveFlawIndex(nextIdx)
    seekToTime(flaws[nextIdx].start)
  }, [analysisData, activeFlawIndex, seekToTime])

  // Initialize and update WaveSurfer
  useEffect(() => {
    if (!audioUrl || !waveContainerRef.current) return

    // Clean up previous instance
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy()
      } catch (err) {
        console.warn('WaveSurfer destroy warning:', err)
      }
    }

    const wsRegions = RegionsPlugin.create()
    regionsPluginRef.current = wsRegions

    const timeline = TimelinePlugin.create({
      container: timelineContainerRef.current || undefined,
      primaryColor: '#8B96A3',
      secondaryColor: '#2A333E',
      primaryFontColor: '#9AA5B1',
      secondaryFontColor: '#64748B',
      fontSize: 9,
      fontFamily: 'IBM Plex Mono, monospace',
      timeInterval: 1,
      primaryLabelInterval: 5,
    })

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: '#2A333E',
      progressColor: '#2FBF9B',
      cursorColor: '#E6EAF0',
      cursorWidth: 1.5,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 105,
      normalize: true,
      url: audioUrl,
      plugins: [timeline, wsRegions],
    })

    wavesurferRef.current = ws

    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('seeking', (t) => setCurrentTime(t))
    ws.on('ready', (d) => setDuration(d))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    // Add flaw regions overlay
    if (analysisData && analysisData.flaw_regions) {
      ws.on('ready', () => {
        analysisData.flaw_regions.forEach((flaw, idx) => {
          wsRegions.addRegion({
            id: `flaw-${idx}`,
            start: flaw.start,
            end: flaw.end,
            color: getFlawRgba(flaw.flaw_type, 0.25),
            drag: false,
            resize: false,
          })
        })
      })
    }

    wsRegions.on('region-clicked', (region, e) => {
      e.stopPropagation()
      region.play()
    })

    return () => {
      try {
        ws.destroy()
      } catch (e) {
        // cleanup safe
      }
    }
  }, [audioUrl, analysisData])

  // Update WaveSurfer region styles when hovering a flaw from the list
  useEffect(() => {
    if (!regionsPluginRef.current) return
    const regions = regionsPluginRef.current.getRegions()
    regions.forEach((r, idx) => {
      const isHovered = hoveredFlawIndex === idx
      const flaw = analysisData?.flaw_regions?.[idx]
      if (flaw) {
        r.setOptions({
          color: isHovered
            ? getFlawRgba(flaw.flaw_type, 0.45)
            : getFlawRgba(flaw.flaw_type, 0.25),
        })
      }
    })
  }, [hoveredFlawIndex, analysisData])

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        const target = Math.max(0, currentTime - 5)
        seekToTime(target)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        const target = Math.min(duration || 100, currentTime + 5)
        seekToTime(target)
      } else if (e.key === '[') {
        e.preventDefault()
        jumpFlaw(-1)
      } else if (e.key === ']') {
        e.preventDefault()
        jumpFlaw(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seekToTime, jumpFlaw, currentTime, duration])

  const maxTime = duration || analysisData?.summary?.duration || 20.0

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0E1116] overflow-hidden select-none">
      
      {/* 48px Top Bar */}
      <header className="h-12 border-b border-[#2A333E] bg-[#151A21] px-4 flex items-center justify-between shrink-0 z-30">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded bg-[#2FBF9B] flex items-center justify-center text-[#0E1116] font-bold">
            <Activity className="h-3.5 w-3.5 stroke-[2.5]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#E6EAF0]">
            SpeechFlow
          </span>
          <span className="text-[10px] font-mono text-[#9AA5B1] border-l border-[#2A333E] pl-2 hidden sm:inline">
            Acoustic Analysis & Flaw Grounding
          </span>
        </div>

        {/* Right: Load Sample & Info Popover */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleLoadDemo}
            disabled={loading}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-[#1C232C] hover:bg-[#2A333E] text-[#E6EAF0] border border-[#2A333E] transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Load sample'}
          </button>

          {/* Help Popover Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowHelp(!showHelp)}
              title="Pipeline Info & GitHub"
              className="p-1 rounded text-[#9AA5B1] hover:text-[#E6EAF0] hover:bg-[#1C232C] transition-colors cursor-pointer"
            >
              <Info className="h-4 w-4" />
            </button>

            {showHelp && (
              <div className="absolute right-0 mt-2 w-72 bg-[#151A21] border border-[#2A333E] rounded p-3 text-xs shadow-xl z-50">
                <div className="flex items-center justify-between border-b border-[#2A333E] pb-1.5 mb-2">
                  <span className="font-semibold text-[#E6EAF0]">Pipeline Details</span>
                  <button onClick={() => setShowHelp(false)} className="text-[#9AA5B1] hover:text-[#E6EAF0]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[#9AA5B1] leading-relaxed mb-2.5">
                  SpeechFlow extracts continuous acoustic features (log-F0 semitones, RMS dB, local rate) with 10ms frame hops and performs dynamic time warping (DTW) registration against reference baselines.
                </p>
                <div className="space-y-1.5 font-mono text-[11px] border-t border-[#2A333E] pt-2">
                  <a
                    href="https://github.com/priyanshu9229/Contrastive_Speech_Analytics_and_Temporal_Flaw_Grounding-"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2FBF9B] hover:underline flex items-center justify-between"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="http://127.0.0.1:8000/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#9AA5B1] hover:text-[#E6EAF0] flex items-center justify-between"
                  >
                    <span>FastAPI Swagger Docs</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="text-[10px] text-[#9AA5B1] pt-1">
                    Team: Priyanshu, Aarav, Rohan, Ananya
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main 3-Column Grid Shell (100dvh - 48px) */}
      <div className="app-grid">
        
        {/* ========================================================= */}
        {/* LEFT PANEL: Input (320px)                                */}
        {/* ========================================================= */}
        <aside className="panel-left flex flex-col h-full bg-[#151A21] border-r border-[#2A333E] p-3 gap-3 overflow-y-auto">
          
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1]">
            Audio Input
          </div>

          {/* Compact Dropzone (~112px tall) */}
          <label className="h-28 border border-dashed border-[#2A333E] hover:border-[#2FBF9B] transition-colors rounded bg-[#0E1116] flex flex-col items-center justify-center p-2.5 text-center cursor-pointer group shrink-0">
            <input
              type="file"
              accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg,.flac"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="h-5 w-5 text-[#9AA5B1] group-hover:text-[#2FBF9B] transition-colors mb-1.5" />
            <div className="text-xs text-[#E6EAF0] font-medium">
              Drop audio or browse
            </div>
            <div className="text-[10px] text-[#9AA5B1] font-mono mt-0.5">
              WAV, MP3, M4A, AAC (Universal)
            </div>
          </label>

          {/* Selected File Notice */}
          {audioFile && (
            <div className="bg-[#1C232C] border border-[#2A333E] rounded p-2 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 overflow-hidden">
                <FileAudio className="h-4 w-4 text-[#2FBF9B] shrink-0" />
                <div className="truncate">
                  <p className="text-xs text-[#E6EAF0] font-mono truncate">{audioFile.name}</p>
                  <p className="text-[10px] text-[#9AA5B1] font-mono tabular">
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {formatTime(maxTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reference Baseline Select */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1]">
              <span className="font-semibold text-[#E6EAF0]">Reference Baseline</span>
              <span className="text-[#2FBF9B] text-[10px]">4 Speeches</span>
            </div>
            <div className="relative">
              <select
                value={selectedBaseline}
                onChange={handleBaselineChange}
                className="w-full bg-[#0E1116] border border-[#2A333E] rounded px-3 py-2 text-xs text-[#E6EAF0] focus:outline-none focus:border-[#2FBF9B] cursor-pointer appearance-none pr-8 font-medium shadow-sm hover:border-[#3B4756] transition-colors"
              >
                {baselines.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#151A21] text-[#E6EAF0] py-1.5">
                    {b.speaker} — {b.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#9AA5B1]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
            {/* Active Reference Badge */}
            {selectedBaselineData && (
              <div className="flex items-center justify-between text-[11px] text-[#2FBF9B] font-mono bg-[#2FBF9B]/10 border border-[#2FBF9B]/25 rounded px-2.5 py-1.5 mt-1">
                <span className="font-semibold">{selectedBaselineData.speaker}</span>
                <span className="text-[#9AA5B1] text-[10px]">{selectedBaselineData.category}</span>
              </div>
            )}
          </div>

          {/* Transcript Textarea (Flexes to fill remaining height) */}
          <div className="flex-1 flex flex-col min-h-[140px] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1]">
              <span>Transcript</span>
              <span className="tabular">{transcript.length} chars</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              spellCheck={false}
              placeholder="Spoken text for forced alignment and word-level grounding..."
              className="w-full flex-1 bg-[#0E1116] border border-[#2A333E] rounded p-2 text-xs text-[#E6EAF0] font-mono resize-none focus:outline-none focus:border-[#2FBF9B] leading-relaxed"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] p-2 rounded text-[11px] font-mono shrink-0">
              {error}
            </div>
          )}

          {/* Pinned Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full py-2.5 px-3 bg-[#2FBF9B] hover:bg-[#28A787] text-[#0E1116] font-semibold text-xs rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-[#0E1116] border-t-transparent rounded-full animate-spin"></span>
                <span>Analyzing...</span>
              </>
            ) : (
              <span>Analyze</span>
            )}
          </button>

        </aside>

        {/* ========================================================= */}
        {/* CENTER PANEL: Fluid Waveform & Stacked Plotly Charts     */}
        {/* ========================================================= */}
        <main className="panel-center flex flex-col h-full bg-[#0E1116] overflow-y-auto">
          
          {analysisData ? (
            <>
              {/* Transport Bar */}
              <div className="h-10 border-b border-[#2A333E] bg-[#151A21] px-4 flex items-center justify-between shrink-0">
                
                {/* Play/Pause & Time */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={togglePlay}
                    className="p-1 rounded bg-[#1C232C] hover:bg-[#2A333E] text-[#E6EAF0] border border-[#2A333E] transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => seekToTime(Math.max(0, currentTime - 5))}
                    title="Seek -5s (Left Arrow)"
                    className="p-1 rounded text-[#9AA5B1] hover:text-[#E6EAF0] hover:bg-[#1C232C] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => seekToTime(Math.min(maxTime, currentTime + 5))}
                    title="Seek +5s (Right Arrow)"
                    className="p-1 rounded text-[#9AA5B1] hover:text-[#E6EAF0] hover:bg-[#1C232C] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <span className="tabular text-xs font-mono text-[#E6EAF0]">
                    {formatTime(currentTime)} <span className="text-[#9AA5B1]">/ {formatTime(maxTime)}</span>
                  </span>
                </div>

                {/* Speed Controls & Keyboard Hint */}
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-[#9AA5B1] font-mono hidden xl:inline">
                    Space: play/pause • [ ]: flaw jump
                  </span>
                  <div className="flex items-center border border-[#2A333E] rounded overflow-hidden">
                    {[0.8, 1.0, 1.2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`px-2 py-0.5 text-[11px] font-mono transition-colors cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-[#2FBF9B] text-[#0E1116] font-bold'
                            : 'bg-[#151A21] text-[#9AA5B1] hover:text-[#E6EAF0]'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Waveform Container (~150px tall, margins aligned with Plotly: px-2 container, pl-[50px] pr-[20px]) */}
              <div className="border-b border-[#2A333E] bg-[#0E1116] pt-2 pb-1 shrink-0 px-2">
                <div className="px-2 text-[11px] font-mono text-[#9AA5B1] uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Waveform & Temporal Flaw Intervals</span>
                  <span className="text-[10px] text-[#9AA5B1]">Normalized Amplitude</span>
                </div>
                
                {/* Waveform Wrapper: Pl-[50px] Pr-[20px] inside px-2 matches Plotly chart margin exactly */}
                <div className="relative w-full pl-[50px] pr-[20px]">
                  <div ref={waveContainerRef} className="w-full h-[105px]" />
                  <div ref={timelineContainerRef} className="w-full h-[22px]" />
                </div>
              </div>


              {/* Stacked Plotly Charts Container */}
              <div className="flex-1 flex flex-col px-2 pb-2 space-y-1">
                
                {/* Legend bar */}
                <div className="px-3 flex items-center justify-between text-[11px] font-mono text-[#9AA5B1] pb-1">
                  <span>Acoustic Trajectories (Synchronized Shared X-Axis)</span>
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center gap-1.5 text-[#2FBF9B]">
                      <span className="w-3 h-0.5 bg-[#2FBF9B]"></span> Participant
                    </span>
                    <span className="flex items-center gap-1.5 text-[#8B96A3]">
                      <span className="w-3 h-0.5 border-t border-dashed border-[#8B96A3]"></span> Reference ({selectedBaselineData.speaker})
                    </span>
                  </div>
                </div>

                {/* Chart 1: Pitch in Semitones */}
                <PlotlyTrackChart
                  chartRef={pitchChartRef}
                  title="Pitch (semitones)"
                  unit="semitones"
                  maxTime={maxTime}
                  currentTime={currentTime}
                  pTimes={analysisData.time_series.participant.times}
                  pSeries={analysisData.time_series.participant.pitch}
                  bTimes={analysisData.time_series.baseline.times}
                  bSeries={analysisData.time_series.baseline.pitch}
                  flaws={analysisData.flaw_regions}
                  hoveredFlawIndex={hoveredFlawIndex}
                  yMin={-8}
                  yMax={8}
                  onSeek={seekToTime}
                />

                {/* Chart 2: Energy in dB */}
                <PlotlyTrackChart
                  chartRef={energyChartRef}
                  title="Energy (dB)"
                  unit="dB z-score"
                  maxTime={maxTime}
                  currentTime={currentTime}
                  pTimes={analysisData.time_series.participant.times}
                  pSeries={analysisData.time_series.participant.energy}
                  bTimes={analysisData.time_series.baseline.times}
                  bSeries={analysisData.time_series.baseline.energy}
                  flaws={analysisData.flaw_regions}
                  hoveredFlawIndex={hoveredFlawIndex}
                  yMin={-3.0}
                  yMax={2.5}
                  onSeek={seekToTime}
                />

                {/* Chart 3: Speech Rate in syl/s */}
                <PlotlyTrackChart
                  chartRef={rateChartRef}
                  title="Speech rate (syl/s)"
                  unit="syl/s"
                  maxTime={maxTime}
                  currentTime={currentTime}
                  pTimes={analysisData.time_series.participant.times}
                  pSeries={analysisData.time_series.participant.rate}
                  bTimes={analysisData.time_series.baseline.times}
                  bSeries={analysisData.time_series.baseline.rate}
                  flaws={analysisData.flaw_regions}
                  hoveredFlawIndex={hoveredFlawIndex}
                  yMin={0.0}
                  yMax={7.5}
                  onSeek={seekToTime}
                />

              </div>
            </>
          ) : (
            /* Empty State: Dashed outline placeholder with one line of text */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-xl h-48 border border-dashed border-[#2A333E] rounded flex items-center justify-center text-[#9AA5B1] font-mono text-xs">
                Upload a recording or load a sample
              </div>
            </div>
          )}

        </main>

        {/* ========================================================= */}
        {/* RIGHT PANEL: Results (360px)                             */}
        {/* ========================================================= */}
        <aside className="panel-right flex flex-col h-full bg-[#151A21] border-l border-[#2A333E] overflow-hidden">
          
          {/* Header */}
          <div className="h-10 border-b border-[#2A333E] px-4 flex items-center justify-between shrink-0 bg-[#151A21]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1]">
              Evaluation & Flaw Grounding
            </span>
            {analysisData && (
              <span className="text-[11px] font-mono text-[#E6EAF0]">
                {analysisData.flaw_regions.length} flaw regions
              </span>
            )}
          </div>

          {analysisData ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Fixed Top Section: Overall Score + Subscores (solid bg-1 #151A21) */}
              <div className="shrink-0 bg-[#151A21] border-b border-[#2A333E]">
                {/* Overall Score & Grade Card */}
                <div className="p-4 border-b border-[#2A333E]">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1]">
                      Overall Score
                    </span>
                    <span className="text-[10px] font-mono text-[#2FBF9B] bg-[#2FBF9B]/10 px-1.5 py-0.5 rounded border border-[#2FBF9B]/20">
                      Ref: {selectedBaselineData.speaker}
                    </span>
                  </div>

                  <div className="flex items-baseline space-x-3 mt-1.5">
                    <span
                      className="text-4xl font-mono font-bold tabular tracking-tight"
                      style={{ color: getScoreColor(analysisData.scores.overall) }}
                    >
                      {Math.round(analysisData.scores.overall)}
                    </span>
                    <span className="text-sm font-mono text-[#9AA5B1]">/ 100</span>
                    
                    <span
                      className="ml-auto text-lg font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        color: getScoreColor(analysisData.scores.overall),
                        borderColor: `${getScoreColor(analysisData.scores.overall)}40`,
                        backgroundColor: `${getScoreColor(analysisData.scores.overall)}15`,
                      }}
                    >
                      Grade {getGrade(analysisData.scores.overall)}
                    </span>
                  </div>

                  <div className="text-xs text-[#9AA5B1] mt-1 font-mono">
                    {getGradeLabel(getGrade(analysisData.scores.overall))} delivery classification
                  </div>
                </div>

                {/* Five Subscore Rows */}
                <div className="p-4 space-y-2.5">
                  <SubscoreRow label="Pacing" score={analysisData.scores.pacing} weight="25%" color="#E69F00" />
                  <SubscoreRow label="Pauses" score={analysisData.scores.pauses} weight="20%" color="#56B4E9" />
                  <SubscoreRow label="Pitch variation" score={analysisData.scores.pitch_variation} weight="20%" color="#CC79A7" />
                  <SubscoreRow label="Energy" score={analysisData.scores.energy} weight="15%" color="#F0E442" />
                  <SubscoreRow label="Clarity" score={analysisData.scores.clarity} weight="20%" color="#D55E00" />
                </div>
              </div>

              {/* Scrollable Flaw Items List */}
              <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#9AA5B1] mb-1">
                  Grounded Flaw Items
                </div>

                {analysisData.flaw_regions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#9AA5B1] font-mono">
                    Zero flaw regions detected.
                  </div>
                ) : (
                  analysisData.flaw_regions.map((flaw, idx) => {
                    const color = getFlawColor(flaw.flaw_type)
                    const isHovered = hoveredFlawIndex === idx
                    const isActive = activeFlawIndex === idx

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setActiveFlawIndex(idx)
                          seekToTime(flaw.start)
                        }}
                        onMouseEnter={() => setHoveredFlawIndex(idx)}
                        onMouseLeave={() => setHoveredFlawIndex(null)}
                        className={`p-2.5 rounded border transition-colors cursor-pointer bg-[#0E1116] ${
                          isHovered || isActive
                            ? 'border-[#2FBF9B] ring-1 ring-[#2FBF9B]'
                            : 'border-[#2A333E] hover:border-[#3B4756]'
                        }`}
                      >
                        {/* Header: Dot + Type + Time Range */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-semibold text-[#E6EAF0]">
                              {getFlawLabel(flaw.flaw_type)}
                            </span>
                          </div>
                          <span className="tabular font-mono text-[11px] text-[#9AA5B1]">
                            {formatRange(flaw.start, flaw.end)}
                          </span>
                        </div>

                        {/* Words Spoken Snippet in single-line ellipsis box */}
                        {flaw.words && (
                          <div className="text-xs text-[#E6EAF0] italic bg-[#151A21] px-2 py-1 rounded border border-[#2A333E] mb-1.5 font-sans truncate">
                            "{flaw.words}"
                          </div>
                        )}

                        {/* Numeric evidence as small mono text */}
                        {flaw.evidence && (
                          <div className="text-[10px] font-mono text-[#9AA5B1] mb-1.5 tabular leading-relaxed">
                            {flaw.evidence.participant_val} vs {flaw.evidence.baseline_val} {flaw.evidence.unit} ({flaw.evidence.pct_change > 0 ? '+' : ''}{flaw.evidence.pct_change}%, z={flaw.evidence.z_score}); {flaw.evidence.detail}
                          </div>
                        )}

                        {/* Causal Explanation in text-2 color */}
                        <p className="text-xs text-[#9AA5B1] leading-relaxed mb-1.5">
                          {flaw.perceptual_impact || flaw.description}
                        </p>

                        {/* Actionable Coach Tip grouped under 'Fix' in text-2 color (not bright green) */}
                        <div className="text-[11px] text-[#9AA5B1] font-mono flex items-start gap-1">
                          <span className="shrink-0 font-bold text-[#9AA5B1]">Fix:</span>
                          <span className="text-[#9AA5B1]">{flaw.actionable_tip}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

            </div>
          ) : (
            /* Right panel empty state */
            <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-[#9AA5B1] font-mono">
              Analysis results will appear here once audio is submitted.
            </div>
          )}

        </aside>

      </div>

    </div>
  )
}

function SubscoreRow({ label, score, weight, color }) {
  const rounded = Math.round(score)
  return (
    <div title={`Weight: ${weight}`} className="group cursor-help">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#E6EAF0] group-hover:text-[#2FBF9B] transition-colors">{label}</span>
        <span className="tabular font-mono font-semibold text-[#E6EAF0]">{rounded}</span>
      </div>
      <div className="w-full h-1 bg-[#1C232C] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(4, rounded)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function PlotlyTrackChart({
  chartRef,
  title,
  unit,
  maxTime,
  currentTime,
  pTimes,
  pSeries,
  bTimes,
  bSeries,
  flaws,
  hoveredFlawIndex,
  yMin,
  yMax,
  onSeek
}) {
  const containerRef = useRef(null)

  // Initial plot and data updates
  useEffect(() => {
    if (!containerRef.current || !pTimes || !pSeries) return

    const traces = [
      {
        x: bTimes,
        y: bSeries,
        mode: 'lines',
        name: 'Baseline',
        line: { color: '#8B96A3', width: 1.5, dash: 'dash' },
        hoverinfo: 'y+name',
      },
      {
        x: pTimes,
        y: pSeries,
        mode: 'lines',
        name: 'Participant',
        line: { color: '#2FBF9B', width: 2 },
        hoverinfo: 'y+name',
      },
    ]

    const shapes = [
      // Shaded flaw region rectangles + 2px top strip in flaw color (layer: "below")
      ...flaws.flatMap((flaw, idx) => {
        const isHovered = hoveredFlawIndex === idx
        const color = getFlawColor(flaw.flaw_type)
        return [
          {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: flaw.start,
            x1: flaw.end,
            y0: 0,
            y1: 1,
            fillcolor: getFlawRgba(flaw.flaw_type, isHovered ? 0.28 : 0.14),
            line: {
              width: 0,
              color: 'transparent',
            },
            layer: 'below',
          },
          {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: flaw.start,
            x1: flaw.end,
            y0: 1,
            y1: 1,
            line: {
              color: color,
              width: 2,
            },
            layer: 'below',
          },
        ]
      }),
      // Synchronized vertical playhead line
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: currentTime,
        x1: currentTime,
        y0: 0,
        y1: 1,
        line: {
          color: '#E6EAF0',
          width: 1.5,
        },
      },
    ]

    const layout = {
      autosize: true,
      // Margin: left 50px aligns exactly with WaveSurfer pl-[50px], right 20px aligns with pr-[20px]
      margin: { l: 50, r: 20, t: 20, b: 20 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      showlegend: false,
      hovermode: 'x unified',
      title: {
        text: title,
        font: { family: 'IBM Plex Sans, sans-serif', size: 10, color: '#9AA5B1' },
        x: 0.05,
        y: 0.95,
      },
      xaxis: {
        range: [0, maxTime],
        showgrid: true,
        gridcolor: '#2A333E',
        zeroline: false,
        tickfont: { family: 'IBM Plex Mono, monospace', size: 9, color: '#9AA5B1' },
        fixedrange: true,
      },
      yaxis: {
        range: [yMin, yMax],
        showgrid: true,
        gridcolor: '#2A333E',
        zeroline: false,
        tickfont: { family: 'IBM Plex Mono, monospace', size: 9, color: '#9AA5B1' },
        fixedrange: true,
      },
      shapes,
    }

    Plotly.react(containerRef.current, traces, layout, {
      responsive: true,
      displayModeBar: false,
    })

    const el = containerRef.current
    const clickHandler = (data) => {
      if (data && data.points && data.points.length > 0) {
        onSeek(data.points[0].x)
      }
    }

    el.on('plotly_click', clickHandler)

    return () => {
      if (el && el.removeAllListeners) {
        el.removeAllListeners('plotly_click')
      }
    }
  }, [pTimes, pSeries, bTimes, bSeries, flaws, hoveredFlawIndex, maxTime, yMin, yMax, onSeek])

  // Fast playhead position update on currentTime change
  useEffect(() => {
    if (!containerRef.current || !containerRef.current.layout) return
    const shapes = containerRef.current.layout.shapes || []
    if (shapes.length > 0) {
      const playheadIdx = shapes.length - 1
      Plotly.relayout(containerRef.current, {
        [`shapes[${playheadIdx}].x0`]: currentTime,
        [`shapes[${playheadIdx}].x1`]: currentTime,
      })
    }
  }, [currentTime])

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-[140px] border border-[#2A333E] rounded bg-[#0E1116] overflow-hidden"
    />
  )
}
