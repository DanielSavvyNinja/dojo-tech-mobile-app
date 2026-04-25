import React, { useState, useCallback, useMemo } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import {
  MapPin, Phone, Clock, Camera, CheckCircle2, AlertCircle, Navigation, Play, Pause,
  Square, ChevronRight, ChevronLeft, User, ClipboardList, Settings, Home, Star,
  FileText, Wrench, X, Check, Timer, DollarSign, MessageSquare, ArrowRight,
  Zap, Truck, Coffee, Calendar
} from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────

const TECH = { id: 't1', name: 'Mike Johnson', avatar: 'MJ', color: '#3b82f6', phone: '(555) 123-4567' }

const SERVICE_TYPES = {
  'standard-clean': { label: 'Standard Cleaning', duration: 60, price: 139 },
  'deep-clean': { label: 'Deep Clean (20+ ft)', duration: 90, price: 219 },
  'roof-clean': { label: 'Roof-Level Cleaning', duration: 90, price: 249 },
  'inspection': { label: 'Inspection Only', duration: 30, price: 69 },
  'bird-guard': { label: 'Bird Guard Install', duration: 45, price: 125 },
  'vent-cap': { label: 'Vent Cap Replace', duration: 45, price: 135 },
  'reroute': { label: 'Vent Re-Route', duration: 180, price: 500 },
  'commercial': { label: 'Commercial (per unit)', duration: 30, price: 99 },
}

const CHECKLIST_ITEMS = [
  { id: 'c1', label: 'Confirm customer is home / access available', required: true },
  { id: 'c2', label: 'Locate exterior vent termination', required: true },
  { id: 'c3', label: 'Disconnect dryer from vent', required: true },
  { id: 'c4', label: 'Take BEFORE photo of lint buildup', required: true },
  { id: 'c5', label: 'Run rotary brush through full vent length', required: true },
  { id: 'c6', label: 'Blow out debris with high-pressure air', required: true },
  { id: 'c7', label: 'Inspect for damage, kinks, or code violations', required: true },
  { id: 'c8', label: 'Check exterior flap/cap operation', required: true },
  { id: 'c9', label: 'Reconnect dryer and verify airflow', required: true },
  { id: 'c10', label: 'Take AFTER photo of clean vent', required: true },
  { id: 'c11', label: 'Run dryer test cycle — confirm proper exhaust', required: true },
  { id: 'c12', label: 'Show customer before/after photos', required: false },
  { id: 'c13', label: 'Leave maintenance sticker with next service date', required: false },
]

const today = new Date()

const DEMO_JOBS = [
  {
    id: 'JOB-1001', customerName: 'Robert Thompson', phone: '(530) 555-0101',
    address: '123 Oak Lane', city: 'Placerville', serviceType: 'standard-clean',
    status: 'scheduled', scheduledTime: '08:00',
    notes: 'Regular customer, annual cleaning. Dog in backyard — ring bell first.',
    checklist: CHECKLIST_ITEMS.map(c => ({ ...c, checked: false })),
    photos: [], clockIn: null, clockOut: null,
  },
  {
    id: 'JOB-1002', customerName: 'Lisa Martinez', phone: '(916) 555-0202',
    address: '456 Pine St', city: 'El Dorado Hills', serviceType: 'deep-clean',
    status: 'scheduled', scheduledTime: '10:00',
    notes: 'Long vent run through attic. Needs 20ft snake. Also wants bird guard quote.',
    checklist: CHECKLIST_ITEMS.map(c => ({ ...c, checked: false })),
    photos: [], clockIn: null, clockOut: null,
  },
  {
    id: 'JOB-1003', customerName: 'Karen White', phone: '(530) 555-1111',
    address: '345 Sunset Dr', city: 'Placerville', serviceType: 'roof-clean',
    status: 'scheduled', scheduledTime: '13:00',
    notes: '2-story house, roof access needed. Bring ladder. Customer will be home after 12:30.',
    checklist: CHECKLIST_ITEMS.map(c => ({ ...c, checked: false })),
    photos: [], clockIn: null, clockOut: null,
  },
  {
    id: 'JOB-1004', customerName: 'David Park', phone: '(530) 555-0303',
    address: '789 Elm Ave', city: 'Cameron Park', serviceType: 'inspection',
    status: 'scheduled', scheduledTime: '15:00',
    notes: 'New customer from Google. Dryer taking 3 cycles to dry. Inspect and recommend.',
    checklist: CHECKLIST_ITEMS.map(c => ({ ...c, checked: false })),
    photos: [], clockIn: null, clockOut: null,
  },
]

// ─── COMPONENTS ───────────────────────────────────────────────

function JobQueue({ jobs, activeJobId, onSelectJob }) {
  const upcoming = jobs.filter(j => j.status === 'scheduled')
  const inProgress = jobs.filter(j => j.status === 'in-progress')
  const completed = jobs.filter(j => j.status === 'completed')

  const totalRevenue = jobs.reduce((s, j) => s + (SERVICE_TYPES[j.serviceType]?.price || 0), 0)
  const completedRevenue = completed.reduce((s, j) => s + (SERVICE_TYPES[j.serviceType]?.price || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Today's Stats */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-xl font-bold">{jobs.length}</div>
            <div className="text-[10px] text-gray-400">Total Jobs</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xl font-bold text-green-600">{completed.length}</div>
            <div className="text-[10px] text-gray-400">Completed</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xl font-bold text-green-600">${completedRevenue}</div>
            <div className="text-[10px] text-gray-400">Earned</div>
          </div>
        </div>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="px-4 mb-4">
          <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1"><Zap size={12} />In Progress</h3>
          {inProgress.map(job => (
            <JobListItem key={job.id} job={job} isActive={job.id === activeJobId} onSelect={onSelectJob} />
          ))}
        </div>
      )}

      {/* Upcoming */}
      <div className="px-4 mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Calendar size={12} />Upcoming ({upcoming.length})</h3>
        {upcoming.map(job => (
          <JobListItem key={job.id} job={job} isActive={job.id === activeJobId} onSelect={onSelectJob} />
        ))}
        {upcoming.length === 0 && <div className="card p-6 text-center text-gray-400 text-sm">No more jobs today!</div>}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="px-4">
          <h3 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1"><CheckCircle2 size={12} />Completed ({completed.length})</h3>
          {completed.map(job => (
            <JobListItem key={job.id} job={job} isActive={job.id === activeJobId} onSelect={onSelectJob} />
          ))}
        </div>
      )}
    </div>
  )
}

function JobListItem({ job, isActive, onSelect }) {
  const svc = SERVICE_TYPES[job.serviceType]
  const statusColors = {
    'scheduled': 'border-l-blue-500',
    'in-progress': 'border-l-amber-500',
    'completed': 'border-l-green-500',
  }

  return (
    <button className={`card w-full text-left p-4 mb-2 border-l-4 ${statusColors[job.status]} ${isActive ? 'ring-2 ring-dojo-500' : ''}`} onClick={() => onSelect(job)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm">{job.customerName}</span>
            {job.status === 'in-progress' && <span className="badge bg-amber-100 text-amber-700">Active</span>}
            {job.status === 'completed' && <span className="badge bg-green-100 text-green-700">Done</span>}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1 mb-0.5"><Clock size={10} />{job.scheduledTime} · {svc?.duration}min</div>
          <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10} />{job.address}, {job.city}</div>
        </div>
        <div className="text-right ml-3">
          <div className="font-bold text-green-600 text-sm">${svc?.price}</div>
          <div className="text-[10px] text-gray-400">{svc?.label}</div>
        </div>
      </div>
    </button>
  )
}

function JobDetail({ job, onUpdate, onBack }) {
  const [activeTab, setActiveTab] = useState('info')
  const svc = SERVICE_TYPES[job.serviceType]
  const checkedCount = job.checklist?.filter(c => c.checked).length || 0
  const totalChecks = job.checklist?.length || 0
  const allRequiredDone = job.checklist?.filter(c => c.required).every(c => c.checked) || false

  const startJob = () => onUpdate({ ...job, status: 'in-progress', clockIn: format(new Date(), 'HH:mm') })
  const completeJob = () => onUpdate({ ...job, status: 'completed', clockOut: format(new Date(), 'HH:mm') })

  const toggleChecklist = (checkId) => {
    const updatedChecklist = job.checklist.map(c => c.id === checkId ? { ...c, checked: !c.checked } : c)
    onUpdate({ ...job, checklist: updatedChecklist })
  }

  const addPhoto = (type) => {
    const photoName = `${type}_${Date.now()}.jpg`
    onUpdate({ ...job, photos: [...(job.photos || []), { name: photoName, type, timestamp: format(new Date(), 'HH:mm') }] })
  }

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'checklist', label: `Checklist (${checkedCount}/${totalChecks})` },
    { id: 'photos', label: `Photos (${job.photos?.length || 0})` },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden pb-20">
      {/* Job Header */}
      <div className="bg-navy text-white p-4">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 mb-2"><ChevronLeft size={14} />Back to queue</button>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 font-mono">{job.id}</div>
            <h2 className="font-bold text-lg">{job.customerName}</h2>
            <div className="flex items-center gap-1 text-sm text-gray-300 mt-1"><Wrench size={12} />{svc?.label} · {svc?.duration}min</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-green-400">${svc?.price}</div>
            {job.clockIn && <div className="text-xs text-gray-400 mt-1">Clocked in: {job.clockIn}</div>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3">
          <a href={`tel:${job.phone}`} className="flex-1 bg-white/10 rounded-xl py-2.5 text-center text-sm flex items-center justify-center gap-1.5"><Phone size={14} />Call</a>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address + ', ' + job.city)}`} target="_blank" rel="noopener" className="flex-1 bg-white/10 rounded-xl py-2.5 text-center text-sm flex items-center justify-center gap-1.5"><Navigation size={14} />Navigate</a>
          <a href={`sms:${job.phone}`} className="flex-1 bg-white/10 rounded-xl py-2.5 text-center text-sm flex items-center justify-center gap-1.5"><MessageSquare size={14} />Text</a>
        </div>
      </div>

      {/* Status Actions */}
      <div className="p-4 bg-white border-b border-gray-200">
        {job.status === 'scheduled' && (
          <button className="btn-primary flex items-center justify-center gap-2 text-base" onClick={startJob}>
            <Play size={18} /> Start Job — Clock In
          </button>
        )}
        {job.status === 'in-progress' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-amber-600"><Timer size={14} />In Progress since {job.clockIn}</span>
              <span className="text-xs text-gray-400">Checklist: {checkedCount}/{totalChecks}</span>
            </div>
            <button className={`btn-success flex items-center justify-center gap-2 text-base ${!allRequiredDone ? 'opacity-50' : ''}`}
              onClick={completeJob} disabled={!allRequiredDone}>
              <CheckCircle2 size={18} /> Complete Job — Clock Out
            </button>
            {!allRequiredDone && <p className="text-xs text-red-500 text-center">Complete all required checklist items first</p>}
          </div>
        )}
        {job.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-500 mx-auto mb-1" />
            <div className="font-bold text-green-700">Job Complete</div>
            <div className="text-xs text-green-600">{job.clockIn} — {job.clockOut}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map(t => (
          <button key={t.id} className={`flex-1 py-3 text-xs font-medium text-center border-b-2 ${activeTab === t.id ? 'border-dojo-600 text-dojo-600' : 'border-transparent text-gray-400'}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' && (
          <div className="p-4 space-y-3">
            <div className="card p-4">
              <div className="text-xs text-gray-400 mb-1">Address</div>
              <div className="font-medium text-sm">{job.address}, {job.city}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-400 mb-1">Phone</div>
              <a href={`tel:${job.phone}`} className="font-medium text-sm text-dojo-600">{job.phone}</a>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-400 mb-1">Service</div>
              <div className="font-medium text-sm">{svc?.label} — {svc?.duration} minutes</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-400 mb-1">Notes</div>
              <div className="text-sm whitespace-pre-wrap">{job.notes || 'No notes'}</div>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="p-4 space-y-1">
            {job.checklist?.map(item => (
              <button key={item.id} className={`card w-full text-left p-4 flex items-start gap-3 ${item.checked ? 'bg-green-50 border-green-200' : ''}`}
                onClick={() => job.status === 'in-progress' && toggleChecklist(item.id)} disabled={job.status !== 'in-progress'}>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                  {item.checked && <Check size={14} />}
                </div>
                <div className="flex-1">
                  <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : ''}`}>{item.label}</span>
                  {item.required && !item.checked && <span className="ml-1 text-[10px] text-red-400">*Required</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="p-4">
            {/* Photo Capture Buttons */}
            {job.status === 'in-progress' && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button className="btn-secondary flex flex-col items-center gap-1 py-3" onClick={() => addPhoto('before')}>
                  <Camera size={20} /><span className="text-xs">Before</span>
                </button>
                <button className="btn-secondary flex flex-col items-center gap-1 py-3" onClick={() => addPhoto('during')}>
                  <Camera size={20} /><span className="text-xs">During</span>
                </button>
                <button className="btn-secondary flex flex-col items-center gap-1 py-3" onClick={() => addPhoto('after')}>
                  <Camera size={20} /><span className="text-xs">After</span>
                </button>
              </div>
            )}
            {/* Photo Grid */}
            {job.photos?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {job.photos.map((photo, i) => (
                  <div key={i} className="card p-2">
                    <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Camera size={28} className="mx-auto mb-1" />
                        <div className="text-[10px]">{photo.type}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-400 text-center">{photo.type.toUpperCase()} · {photo.timestamp}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Camera size={36} className="mx-auto mb-2" />
                <p className="text-sm">No photos yet</p>
                <p className="text-xs mt-1">{job.status === 'in-progress' ? 'Tap buttons above to capture' : 'Start job to take photos'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TimeTracker({ jobs }) {
  const totalMinutes = jobs.filter(j => j.clockIn && j.clockOut).reduce((total, j) => {
    const [inH, inM] = j.clockIn.split(':').map(Number)
    const [outH, outM] = j.clockOut.split(':').map(Number)
    return total + (outH * 60 + outM) - (inH * 60 + inM)
  }, 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const earnings = completedJobs.reduce((s, j) => s + (SERVICE_TYPES[j.serviceType]?.price || 0), 0)

  return (
    <div className="flex-1 overflow-y-auto pb-20 p-4">
      <div className="card p-6 text-center mb-4">
        <div className="text-4xl font-bold">{hours}h {mins}m</div>
        <div className="text-sm text-gray-400 mt-1">Total Time Today</div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">${earnings}</div>
          <div className="text-xs text-gray-400">Revenue Generated</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{completedJobs.length}</div>
          <div className="text-xs text-gray-400">Jobs Completed</div>
        </div>
      </div>
      <h3 className="font-bold text-sm mb-2">Time Log</h3>
      {completedJobs.map(j => {
        const svc = SERVICE_TYPES[j.serviceType]
        return (
          <div key={j.id} className="card p-4 mb-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{j.customerName}</div>
                <div className="text-xs text-gray-400">{svc?.label}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-sm">{j.clockIn} — {j.clockOut}</div>
                <div className="text-xs text-green-600">${svc?.price}</div>
              </div>
            </div>
          </div>
        )
      })}
      {completedJobs.length === 0 && <div className="card p-6 text-center text-gray-400 text-sm">No completed jobs yet today</div>}
    </div>
  )
}

function ProfileScreen() {
  return (
    <div className="flex-1 overflow-y-auto pb-20 p-4">
      <div className="card p-6 text-center mb-4">
        <div className="w-16 h-16 rounded-full bg-dojo-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-3">{TECH.avatar}</div>
        <h2 className="font-bold text-lg">{TECH.name}</h2>
        <p className="text-sm text-gray-500">{TECH.phone}</p>
        <span className="badge bg-green-100 text-green-700 mt-2">Active</span>
      </div>
      <div className="space-y-2">
        {['Notification Settings', 'Vehicle Info', 'Certifications', 'Availability Schedule', 'Help & Support', 'Sign Out'].map(item => (
          <button key={item} className="card w-full text-left p-4 flex items-center justify-between">
            <span className="text-sm">{item}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────

export default function App() {
  const [jobs, setJobs] = useState(DEMO_JOBS)
  const [activeTab, setActiveTab] = useState('jobs')
  const [selectedJob, setSelectedJob] = useState(null)

  const handleUpdateJob = useCallback((updated) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))
    setSelectedJob(updated)
  }, [])

  const navItems = [
    { id: 'jobs', icon: ClipboardList, label: 'Jobs' },
    { id: 'time', icon: Timer, label: 'Time' },
    { id: 'profile', icon: User, label: 'Profile' },
  ]

  return (
    <div className="h-screen flex flex-col overflow-hidden max-w-md mx-auto bg-gray-50">
      {/* Header */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-dojo-600 rounded-lg flex items-center justify-center font-bold text-xs">🥋</div>
          <div>
            <h1 className="font-bold text-sm">DVS Tech App</h1>
            <p className="text-[10px] text-gray-400">{format(today, 'EEEE, MMMM d')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-dojo-600 text-white text-xs font-bold flex items-center justify-center">{TECH.avatar}</div>
        </div>
      </header>

      {/* Content */}
      {activeTab === 'jobs' && !selectedJob && (
        <JobQueue jobs={jobs} activeJobId={null} onSelectJob={setSelectedJob} />
      )}
      {activeTab === 'jobs' && selectedJob && (
        <JobDetail job={selectedJob} onUpdate={handleUpdateJob} onBack={() => setSelectedJob(null)} />
      )}
      {activeTab === 'time' && <TimeTracker jobs={jobs} />}
      {activeTab === 'profile' && <ProfileScreen />}

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 flex justify-around py-2 px-4 flex-shrink-0 safe-area-bottom">
        {navItems.map(item => (
          <button key={item.id} className={`mobile-nav-item ${activeTab === item.id ? 'text-dojo-600' : 'text-gray-400'}`}
            onClick={() => { setActiveTab(item.id); if (item.id !== 'jobs') setSelectedJob(null) }}>
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
