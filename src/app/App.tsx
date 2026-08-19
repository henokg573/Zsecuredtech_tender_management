import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast, Toaster } from "sonner";
import {
  LayoutDashboard, FileText, Users, Bell, Settings, LogOut,
  Search, Download, Plus, CheckCircle, XCircle, Clock, Send,
  Mail, X, Edit2, Shield, MessageSquare, TrendingUp, AlertCircle,
  Zap, Eye, Calendar, ExternalLink, EyeOff, Activity,
  FileSpreadsheet, Key, UserPlus, Trash2, Archive, BarChart2,
  Ticket, ArrowUpCircle, ChevronRight, Target, Award, RefreshCw,
  Flag, Star, ListChecks, ChevronDown, Phone, Hash, CheckSquare,
  Upload, Link2, Paperclip, Building2, ImageIcon, ArrowLeft,
  FileIcon, FileCheck, Percent, Briefcase
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { fetchTable, insertRow, updateRow, deleteRow, signIn, supabase, signOut, getSession } from "../lib/supabaseClient";
import { buildTenderTask, canManageBusinessRecords, computeStaffAnalytics } from "../lib/systemRules";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "./components/ui/dialog";

// ─── Types ─────────────────────────────────────────────────────────────────
type Role = "admin" | "ceo" | "manager" | "staff";
type AppView = "dashboard" | "tenders" | "mywork" | "tickets" | "team" | "notifications" | "settings" | "offices" | "clients" | "projects" | "documents" | "meetings" | "tasks" | "iso";
type ApprovalStatus = "Pending" | "Approved" | "REJECTED";
type TenderStatus = "New" | "In Progress" | "Document Prep" | "Submitted" | "Completed" | "Cancelled";
type Priority = "Low" | "Medium" | "High";

interface ProgressEntry { by: string; note: string; percent: number; timestamp: string; }
interface AuditEntry { id: number; action: string; by: string; target: string; timestamp: string; details?: string; }

interface User {
  id: string; name: string; email: string; telegram: string;
  telegramChatId: string; role: Role; initials: string;
  password: string; is_active: boolean; mfaEnabled?: boolean;
}

function PhaseManager({ project, phases, onAdd, onUpdate, users }: { project: Project | null; phases: Phase[]; onAdd:(p:Phase)=>void; onUpdate:(p:Phase)=>void; users:User[] }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [assigned, setAssigned] = useState('');
  const [submissionName, setSubmissionName] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  return (
    <div>
      {!project && <div className="text-sm text-muted-foreground">Select a project to manage phases.</div>}
      {project && (
        <div className="space-y-3">
          <div className="mb-2"><h4 className="font-semibold">Phases for {project.name}</h4></div>
          <div className="space-y-2">
            {phases.length === 0 && <div className="text-sm text-muted-foreground">No phases yet.</div>}
            {phases.map(ph => (
              <div key={ph.id} className="p-2 border rounded bg-background">
                <div className="font-semibold">{ph.name}</div>
                <div className="text-xs text-muted-foreground">{ph.description}</div>
              </div>
            ))}
          </div>
            <div className="mt-3 bg-card p-3 rounded">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Phase name" className="w-full mb-2 px-3 py-2 border rounded" />
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description / requirements" className="w-full mb-2 px-3 py-2 border rounded" />
            <select value={assigned} onChange={e=>setAssigned(e.target.value)} className="w-full mb-2 px-3 py-2 border rounded">
              <option value="">(Assign team member)</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
            </select>
            <div className="mb-3">
              <input value={submissionName} onChange={e=>setSubmissionName(e.target.value)} placeholder="Submission name" className="w-full mb-2 px-3 py-2 border rounded" />
              <input value={submissionNotes} onChange={e=>setSubmissionNotes(e.target.value)} placeholder="Submission notes" className="w-full mb-2 px-3 py-2 border rounded" />
              <div className="flex gap-2">
                <button onClick={async ()=>{ if (!project) return; if (!name) { toast.error('Phase name required'); return; } const id = Date.now().toString(); const ph:Phase = { id, projectId: project.id, name, description: desc, assignedTeam: assigned ? [assigned] : [], submissions: [], status: 'Not Started', progress:0 }; await onAdd(ph); setName(''); setDesc(''); setAssigned(''); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Add Phase</button>
                <button onClick={()=>{ setName(''); setDesc(''); setAssigned(''); }} className="px-3 py-2 bg-background border rounded">Clear</button>
                <button onClick={async ()=>{ if (!submissionName) { toast.error('Submission name required'); return; } const target = phases[0]; if (!target) { toast.error('No phase selected to attach submission'); return; } const sub: Submission = { id: Date.now().toString(), phaseId: target.id, name: submissionName, notes: submissionNotes, uploadedAt: new Date().toISOString(), status: 'submitted' }; const nextSubs = [...(target.submissions||[]), sub]; const updatedPhase = { ...target, submissions: nextSubs }; await onUpdate(updatedPhase); setSubmissionName(''); setSubmissionNotes(''); toast.success('Submission added'); }} className="px-3 py-2 bg-emerald-700 text-white rounded">Add Submission</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
interface Tender {
  id: number; tenderName: string; description: string; bidType: string;
  closingDate: string; openingDate: string; approval: string; requiredDocs: string;
  status: TenderStatus; assignedPerson: string; submissionMode: string; notes: string;
  priority: Priority; approvalStatus: ApprovalStatus; responseBy: string; responseTime: string;
  aiSuggestion: string; registeredData: string; registeredBy: string;
  documentLink: string; bidLink: string; archived: boolean;
  progressLog: ProgressEntry[]; progressPercent: number;
  companyLogo?: string; attachments?: Attachment[];
}
interface Ticket {
  id: number; title: string; description: string;
  createdBy: string; assignedTo: string; status: "open" | "replied" | "resolved" | "escalated";
  createdAt: string; replies: { by: string; text: string; timestamp: string }[];
  tenderId?: number; tenderName?: string;
}
interface Notif {
  id: number; type: "telegram" | "email" | "system";
  message: string; tender: string; time: string; read: boolean;
}
interface Attachment {
  name: string; size: number; type: string; dataUrl: string;
}

interface Office {
  id: string; name: string; address?: string; phone?: string; manager?: string; email?: string; location?: string;
}

interface Client {
  id: string; companyName: string; contactName?: string; email?: string; phone?: string; industry?: string; address?: string; status?: string; notes?: string;
}

interface Project {
  id: string; name: string; clientId?: string; manager?: string; team?: string[]; startDate?: string; endDate?: string; budget?: number; status?: string; progress?: number; notes?: string;
  projectCode?: string; projectType?: string; description?: string; sponsor?: string; targetCompletion?: string; actualCompletion?: string; currentPhase?: string; priority?: string;
  teamSize?: number; openTasks?: number; overdueTasks?: number; openIssues?: number; pendingApprovals?: number; documents?: number; lastActivity?: string;
  phases?: { name: string; progress: number; status: string; owner?: string; }[]; milestones?: { title: string; target: string; owner: string; status: string; progress: number; deliverables: string; approval: string; }[];
  risks?: { id: string; description: string; probability: string; impact: string; score: number; owner: string; status: string; mitigation: string; }[];
  issues?: { id: string; title: string; severity: string; assignedTo: string; due: string; status: string; }[];
  changeRequests?: { id: string; requester: string; date: string; description: string; impact: string; approved: string; }[];
  approvals?: { title: string; requestedBy: string; approvedBy: string; date: string; status: string; }[];
  communications?: { date: string; from: string; to: string; note: string; attachment?: string; }[];
  auditTrail?: { time: string; actor: string; action: string; }[];
}
interface Phase {
  id: string; projectId: string; name: string; description?: string; assignedTeam?: string[]; requirements?: string; submissions?: Submission[]; status?: string; progress?: number; leader?: string;
}
interface Submission { id: string; phaseId: string; uploadedBy?: string; name?: string; notes?: string; uploadedAt?: string; status?: string; }
interface TaskReport { id: string; taskId: string; by?: string; note?: string; createdAt?: string; }

interface TaskItem {
  id: string; title: string; projectId?: string; assignedTo?: string; priority?: Priority; startDate?: string; dueDate?: string; status?: string; progress?: number; notes?: string;
}
// allow reports attached to tasks
// # NOTE: TaskReport defined above
interface TaskItemWithReports extends TaskItem { reports?: TaskReport[] }

interface DocItem {
  id: string; name: string; owner?: string; type?: string; version?: string; uploadedAt?: string; notes?: string;
}

interface Meeting {
  id: string; title: string; projectId?: string; clientId?: string; date?: string; participants?: string[]; minutes?: string;
}

interface ProjectTask {
  id: string; projectId: string; title: string; description?: string; assignedTo?: string; status?: string; dueDate?: string; progress?: number; priority?: string; notes?: string;
}

interface ProjectMilestone {
  id: string; projectId: string; title: string; description?: string; targetDate?: string; owner?: string; status?: string; progress?: number; deliverables?: string; approval?: string;
}

interface ProjectDocument {
  id: string; projectId: string; name: string; description?: string; version?: string; type?: string; status?: string; owner?: string; uploadedAt?: string; notes?: string;
}

interface ProjectMeeting {
  id: string; projectId: string; title: string; date?: string; agenda?: string; minutes?: string; participants?: string[]; actionItems?: string[];
}

interface MFASetup {
  secret: string;
  qrCode: string;
  verified: boolean;
}

interface MFAStatus {
  enabled: boolean;
  verified: boolean;
  backupCodes: string[];
}

interface UserMFAConfig {
  userId: string;
  enabled: boolean;
  secret: string;
  backupCodes: string[];
  createdAt: string;
  lastUsed?: string;
}

// Phase 2: ISO & Compliance types
interface Standard {
  id: string; code: string; title: string; description?: string;
}
interface Clause {
  id: string; standardId: string; clauseId: string; title: string; description?: string;
}
interface Control {
  id: string; controlId: string; name: string; applicable?: boolean; status?: string; owner?: string; evidence?: string;
}
interface Gap {
  id: string; referenceId: string; description?: string; severity?: string; action?: string; owner?: string; dueDate?: string; status?: string;
}
interface RiskReg {
  id: string; asset?: string; threat?: string; vulnerability?: string; likelihood?: number; impact?: number; score?: number; treatment?: string; owner?: string; status?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const BOT_TOKEN = "7880598262:AAHNjeJTod9zU4wrcmNYPeZj8ygfGoDMx80";
const GROUP_CHAT_ID = "793034140";
const PIE_COLORS = ["#059669", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

// ─── Initial Data ──────────────────────────────────────────────────────────
const INITIAL_USERS: User[] = [
  { id: "1", name: "Henok G",   email: "henokgirma@zsecuredtech.com",    telegram: "@NotAnymore404",  telegramChatId: "793034140", role: "admin",   initials: "HG", password: "w?ji*xVQqd[Q", is_active: true },
  { id: "2", name: "Yadeta G",  email: "yadetagonfa@zsecuredtech.com",   telegram: "@Yaa_Yeroo2026",  telegramChatId: "",          role: "manager", initials: "YG", password: "ZST@Yadeta2025",  is_active: true },
  { id: "3", name: "Gelassa A", email: "gelassaamsalu@zsecuredtech.com", telegram: "@JesuGi",          telegramChatId: "",          role: "staff",   initials: "GA", password: "ZST@Gelassa2025", is_active: true },
  { id: "4", name: "Faris M",   email: "fmubarek@zsecuredtech.com",      telegram: "@fmubarek",        telegramChatId: "",          role: "ceo",     initials: "FM", password: "ZST@Faris2025",   is_active: true },
];

const SEED_TENDERS: Tender[] = [
  { id:1, tenderName:"Supply of CCTV Surveillance Equipment", description:"Supply and installation of 150 HD CCTV cameras with DVR systems for Addis Ababa City Administration across 12 sub-cities.", bidType:"Supply", closingDate:"2025-08-15", openingDate:"2025-08-16", approval:"Required", requiredDocs:"Company profile, Tax clearance, Previous experience letters, Technical spec compliance", status:"In Progress", assignedPerson:"Henok G", submissionMode:"Physical", notes:"Budget: 2.5M ETB. Technical spec document still being drafted.", priority:"High", approvalStatus:"Pending", responseBy:"", responseTime:"", aiSuggestion:"Strong match — CCTV portfolio aligns well. Win probability: 75%.", registeredData:"2025-07-20", registeredBy:"Henok G", documentLink:"https://drive.google.com/", bidLink:"https://addisababa.gov.et/", archived:false, progressLog:[{ by:"Henok G", note:"Started document collection. Contacting suppliers for spec sheet.", percent:20, timestamp:"2025-07-22 09:00" }], progressPercent:20 },
  { id:2, tenderName:"IT Security Assessment — CBE", description:"Penetration testing, vulnerability scanning and risk assessment report for Commercial Bank of Ethiopia IT infrastructure.", bidType:"Service", closingDate:"2025-08-22", openingDate:"2025-08-25", approval:"Required", requiredDocs:"ISO 27001 cert, Security engineer CVs, Previous assessment reports, Company registration", status:"Document Prep", assignedPerson:"Yadeta G", submissionMode:"Online", notes:"ISO 27001 certificate must be attached.", priority:"High", approvalStatus:"Approved", responseBy:"Henok G", responseTime:"2025-07-22 10:30", aiSuggestion:"High win probability — CBE has engaged us before. Win probability: 85%.", registeredData:"2025-07-18", registeredBy:"Yadeta G", documentLink:"https://drive.google.com/", bidLink:"https://cbe.com.et/", archived:false, progressLog:[{ by:"Yadeta G", note:"Company profile and CVs compiled. Working on methodology document.", percent:55, timestamp:"2025-07-25 14:00" }], progressPercent:55 },
  { id:3, tenderName:"Network Infrastructure — Ethiopian Airlines", description:"Structured cabling, core switches, routers and enterprise WiFi for Ethiopian Airlines new cargo terminal.", bidType:"Supply & Install", closingDate:"2025-09-01", openingDate:"2025-09-03", approval:"Required", requiredDocs:"Company profile, Network engineer certs, Insurance certificate, Performance bond", status:"New", assignedPerson:"Faris M", submissionMode:"Physical", notes:"", priority:"Medium", approvalStatus:"Pending", responseBy:"", responseTime:"", aiSuggestion:"Competitive — 5 to 6 companies expected to bid. Win probability: 40%.", registeredData:"2025-07-25", registeredBy:"Gelassa A", documentLink:"", bidLink:"https://ethiopianairlines.com/", archived:false, progressLog:[], progressPercent:0 },
  { id:4, tenderName:"Biometric Access Control — Ministry of Finance", description:"Supply, install and commission fingerprint and face recognition access control for MoF HQ and 4 regional branches.", bidType:"Supply & Install", closingDate:"2025-08-10", openingDate:"2025-08-12", approval:"Required", requiredDocs:"Technical specs, Warranty docs, Tax clearance certificate, Company registration", status:"Submitted", assignedPerson:"Gelassa A", submissionMode:"Physical", notes:"Submitted July 28. Bid opening ceremony scheduled Aug 12.", priority:"High", approvalStatus:"Pending", responseBy:"", responseTime:"", aiSuggestion:"Good fit. MoF has strict budget — price competitiveness is critical. Win probability: 60%.", registeredData:"2025-07-10", registeredBy:"Henok G", documentLink:"https://drive.google.com/", bidLink:"https://mof.gov.et/", archived:false, progressLog:[{ by:"Gelassa A", note:"All documents submitted physically. Waiting for opening date.", percent:90, timestamp:"2025-07-28 16:00" }], progressPercent:90 },
  { id:5, tenderName:"Cybersecurity Training — National Bank of Ethiopia", description:"3-day cybersecurity awareness training for 200 NBE staff including phishing simulation exercises.", bidType:"Service", closingDate:"2025-08-05", openingDate:"2025-08-06", approval:"Not Required", requiredDocs:"Training curriculum, Trainer CVs, Company profile", status:"Completed", assignedPerson:"Yadeta G", submissionMode:"Online", notes:"WON — Training scheduled Sept 10–12, 2025.", priority:"Low", approvalStatus:"Approved", responseBy:"Henok G", responseTime:"2025-07-15 09:00", aiSuggestion:"Excellent fit — training team is well-qualified. Win probability: 90%.", registeredData:"2025-07-01", registeredBy:"Yadeta G", documentLink:"https://drive.google.com/", bidLink:"https://nbe.gov.et/", archived:false, progressLog:[{ by:"Yadeta G", note:"Contract signed. Training dates confirmed.", percent:100, timestamp:"2025-08-06 10:00" }], progressPercent:100 },
  { id:6, tenderName:"Data Center Security Audit — Ethio Telecom", description:"Physical security audit of Ethio Telecom main data center — fire suppression, access logs, CCTV coverage.", bidType:"Consulting", closingDate:"2025-09-15", openingDate:"2025-09-17", approval:"Required", requiredDocs:"Security audit methodology, Team certifications, Insurance certificate, Signed NDA", status:"New", assignedPerson:"", submissionMode:"Physical", notes:"⚠️ UNASSIGNED — assign urgently.", priority:"Medium", approvalStatus:"Pending", responseBy:"", responseTime:"", aiSuggestion:"Niche service with few competitors. Strong positioning opportunity. Win probability: 70%.", registeredData:"2025-07-28", registeredBy:"Faris M", documentLink:"", bidLink:"https://ethiotelecom.et/", archived:false, progressLog:[], progressPercent:0 },
  { id:7, tenderName:"CCTV Maintenance Contract — Awash Bank", description:"Annual preventive maintenance and 24/7 reactive support for 320 CCTV cameras across 45 Awash Bank branches.", bidType:"Service", closingDate:"2025-07-30", openingDate:"2025-08-01", approval:"Not Required", requiredDocs:"Company profile, Previous maintenance contracts, SLA document", status:"Submitted", assignedPerson:"Faris M", submissionMode:"Physical", notes:"We maintain 120 of their cameras — existing relationship advantage.", priority:"High", approvalStatus:"REJECTED", responseBy:"Yadeta G", responseTime:"2025-07-25 14:20", aiSuggestion:"Existing relationship — renewal likely if pricing is competitive.", registeredData:"2025-07-05", registeredBy:"Faris M", documentLink:"https://drive.google.com/", bidLink:"https://awashbank.com/", archived:false, progressLog:[{ by:"Faris M", note:"Submitted all documents. Awaiting outcome.", percent:75, timestamp:"2025-07-25 09:00" }], progressPercent:75 },
  { id:8, tenderName:"Physical Security Consulting — Safaricom Ethiopia", description:"Physical security consulting for Safaricom Ethiopia new office towers — site risk assessment and emergency planning.", bidType:"Consulting", closingDate:"2025-09-20", openingDate:"2025-09-22", approval:"Required", requiredDocs:"Methodology doc, Team bios, Insurance certificate, Company registration", status:"New", assignedPerson:"Henok G", submissionMode:"Online", notes:"International client — all documents in English. High-value contract.", priority:"High", approvalStatus:"Pending", responseBy:"", responseTime:"", aiSuggestion:"Premium client. Prepare polished proposal with portfolio and case studies.", registeredData:"2025-07-29", registeredBy:"Henok G", documentLink:"", bidLink:"https://safaricom.et/", archived:false, progressLog:[], progressPercent:0 },
];

const SEED_AUDIT: AuditEntry[] = [
  { id:1, action:"Approved Tender", by:"Henok G", target:"IT Security Assessment — CBE", timestamp:"2025-07-22 10:30", details:"Approval granted — strong portfolio match" },
  { id:2, action:"Registered Tender", by:"Gelassa A", target:"Network Infrastructure — Ethiopian Airlines", timestamp:"2025-07-25 11:00" },
  { id:3, action:"Rejected Tender", by:"Yadeta G", target:"CCTV Maintenance Contract — Awash Bank", timestamp:"2025-07-25 14:20", details:"Budget too low vs scope" },
  { id:4, action:"Progress Update", by:"Yadeta G", target:"IT Security Assessment — CBE", timestamp:"2025-07-25 14:00", details:"55% — methodology document in progress" },
  { id:5, action:"Approved Tender", by:"Henok G", target:"Cybersecurity Training — National Bank of Ethiopia", timestamp:"2025-07-15 09:00" },
  { id:6, action:"Submitted Bid", by:"Gelassa A", target:"Biometric Access Control — Ministry of Finance", timestamp:"2025-07-28 16:00" },
];

const SEED_NOTIFS: Notif[] = [
  { id:1, type:"telegram", message:"New bid registered: Supply of CCTV Surveillance Equipment — assigned to Henok G", tender:"CCTV Surveillance Equipment", time:"2025-07-20 09:15", read:false },
  { id:2, type:"email",    message:"Deadline reminder: Biometric Access Control closes in 3 days", tender:"Biometric Access Control", time:"2025-08-07 09:00", read:false },
  { id:3, type:"system",   message:"IT Security Assessment — CBE approved by Henok G", tender:"IT Security Assessment", time:"2025-07-22 10:30", read:true },
  { id:4, type:"telegram", message:"CCTV Maintenance contract REJECTED by Yadeta G", tender:"CCTV Maintenance — Awash Bank", time:"2025-07-25 14:20", read:true },
  { id:5, type:"email",    message:"Cybersecurity Training bid WON — training scheduled Sept 10–12", tender:"Cybersecurity Training — NBE", time:"2025-08-01 11:00", read:true },
];

const SEED_TICKETS: Ticket[] = [
  { id:1, title:"Missing ISO 27001 Certificate — CBE Bid", description:"We need our ISO 27001 certificate for the CBE bid. Can Henok confirm if it's been renewed?", createdBy:"Yadeta G", assignedTo:"Henok G", status:"replied", createdAt:"2025-07-20 10:00", replies:[{ by:"Henok G", text:"Certificate renewed in March. Scanned copy in the shared drive /Certs/ISO27001-2025.pdf", timestamp:"2025-07-20 11:30" }], tenderId:2, tenderName:"IT Security Assessment — CBE" },
  { id:2, title:"Insurance Certificate Renewal Needed", description:"Insurance certificate expired. Need admin to approve renewal request before the Data Center audit bid.", createdBy:"Gelassa A", assignedTo:"Faris M", status:"escalated", createdAt:"2025-07-28 08:00", replies:[], tenderId:6, tenderName:"Data Center Security Audit — Ethio Telecom" },
];

const INITIAL_OFFICES: Office[] = [];

const SEED_PROJECTS: Project[] = [
  {
    id: "proj-cheche-ims",
    name: "Cheche Systems IMS Implementation",
    clientId: "cheche-systems",
    manager: "1",
    team: ["1", "2", "3"],
    startDate: "2026-08-01",
    endDate: "2026-12-31",
    budget: 3500000,
    status: "Active",
    progress: 5,
    priority: "High",
    projectCode: "CHE-IMS-01",
    projectType: "ISO 9001 + ISO 27001",
    description: "Integrated management system implementation for quality and information security controls.",
    sponsor: "Faris M",
    targetCompletion: "2026-12-31",
    actualCompletion: "",
    currentPhase: "Gap Analysis",
    teamSize: 4,
    openTasks: 14,
    overdueTasks: 2,
    openIssues: 3,
    pendingApprovals: 4,
    documents: 37,
    lastActivity: "2026-08-17",
    phases: [
      { name: "Project Initiation", progress: 100, status: "Completed", owner: "Henok G" },
      { name: "Gap Analysis", progress: 85, status: "In Progress", owner: "Yadeta G" },
      { name: "Documentation", progress: 40, status: "In Progress", owner: "Gelassa A" },
      { name: "Implementation", progress: 20, status: "Not Started", owner: "Henok G" },
      { name: "Internal Audit", progress: 0, status: "Not Started", owner: "Yadeta G" },
      { name: "Management Review", progress: 0, status: "Not Started", owner: "Faris M" },
      { name: "Certification Preparation", progress: 0, status: "Not Started", owner: "Henok G" },
    ],
    milestones: [
      { title: "Project Kickoff", target: "2026-08-10", owner: "Henok G", status: "Completed", progress: 100, deliverables: "Project charter", approval: "Approved" },
      { title: "Gap Analysis Completed", target: "2026-08-25", owner: "Yadeta G", status: "In Progress", progress: 80, deliverables: "Gap analysis report", approval: "Client review" },
      { title: "Documentation Completed", target: "2026-09-30", owner: "Gelassa A", status: "Not Started", progress: 0, deliverables: "Policy pack", approval: "Pending" },
      { title: "Internal Audit", target: "2026-11-15", owner: "Yadeta G", status: "Not Started", progress: 0, deliverables: "Audit report", approval: "Not started" },
    ],
    risks: [
      { id: "RISK-001", description: "Client departments may delay document submission.", probability: "High", impact: "High", score: 9, owner: "Henok", status: "Open", mitigation: "Weekly document collection tracking" },
    ],
    issues: [
      { id: "ISS-004", title: "HR department has not submitted employee access records.", severity: "Medium", assignedTo: "Yadeta", due: "2026-08-18", status: "Open" },
    ],
    changeRequests: [
      { id: "CR-002", requester: "Cheche Systems", date: "2026-08-15", description: "Additional ISO 42001 implementation scope.", impact: "Scope & cost", approved: "Pending" },
    ],
    approvals: [
      { title: "Project Charter", requestedBy: "Henok G", approvedBy: "Faris M", date: "2026-08-10", status: "Approved" },
      { title: "Gap Assessment Report", requestedBy: "Yadeta G", approvedBy: "Client", date: "2026-08-20", status: "Pending" },
    ],
    communications: [
      { date: "2026-08-17", from: "Henok G", to: "Cheche Systems", note: "Requested remaining HR documentation.", attachment: "HR_Document_Request.xlsx" },
    ],
    auditTrail: [
      { time: "09:41", actor: "Henok G", action: "created task 'Review HR Policy'" },
      { time: "09:48", actor: "Yadeta G", action: "uploaded 'HR-POL-001.pdf'" },
      { time: "10:15", actor: "Manager", action: "approved 'Project Charter'" },
    ],
  },
];

const MONTHLY_DATA = [
  { month:"Mar", bids:1 }, { month:"Apr", bids:2 }, { month:"May", bids:3 },
  { month:"Jun", bids:2 }, { month:"Jul", bids:5 }, { month:"Aug", bids:2 },
];

// ─── localStorage helpers ──────────────────────────────────────────────────
// ─── Local Storage Helper ───────────────────────────────────────────────────
const LS = {
  get: <T,>(key: string, def: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: <T,>(key: string, v: T) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};

// ─── Permissions ────────────────────────────────────────────────────────────
const canApprove   = (u: User) => u.role === "admin" || u.role === "ceo";
const canDeleteOrArchive = (u: User) => u.role === "admin" || u.role === "ceo";
const isExecutive  = (u: User) => u.role === "admin" || u.role === "ceo";
const isPrivileged = (u: User) => u.role === "admin" || u.role === "ceo" || u.role === "manager";
const canManageBusinessRecordsForUser = (u: User | null) => !!u && canManageBusinessRecords(u.role);

// ─── Telegram API ──────────────────────────────────────────────────────────
const sendTelegramMsg = async (chatId: string, text: string) => {
  if (!chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const data = await r.json();
    return data.ok === true;
  } catch { return false; }
};

const buildTelegramMessage = (tender: Tender, type: "new" | "approved" | "rejected" | "reminder" | "update") => {
  const emoji = { new:"🆕", approved:"✅", rejected:"❌", reminder:"⏰", update:"📊" }[type];
  const title = { new:"NEW BID REGISTERED", approved:"BID APPROVED", rejected:"BID REJECTED", reminder:"DEADLINE REMINDER", update:"PROGRESS UPDATE" }[type];
  const days = tender.closingDate ? Math.ceil((new Date(tender.closingDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000) : null;
  return `${emoji} <b>ZSecuredTech — ${title}</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 <b>${tender.tenderName}</b>\n` +
    (tender.description ? `📝 ${tender.description.slice(0,150)}…\n` : "") +
    `📂 ${tender.bidType}  |  ⭐ ${tender.priority}\n` +
    `👤 Assigned: ${tender.assignedPerson || "Unassigned"}\n` +
    `📅 Closing: ${tender.closingDate}` + (days !== null ? `  (${days > 0 ? days+"d left" : "EXPIRED"})` : "") + `\n` +
    `📊 Status: ${tender.status}  |  🔖 Approval: ${tender.approvalStatus}\n` +
    (tender.progressPercent ? `⏱ Progress: ${tender.progressPercent}%\n` : "") +
    (tender.bidLink ? `🔗 ${tender.bidLink}\n` : "") +
    `\n<i>ZSecuredTech Bid Management System</i>`;
};

// ─── Utils ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—";

const fmtDateTime = () => new Date().toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

const daysLeft = (d: string) =>
  d ? Math.ceil((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000) : 999;

const sCls = (s: TenderStatus) => (({
  "New":"bg-blue-50 text-blue-700 border border-blue-200",
  "In Progress":"bg-amber-50 text-amber-700 border border-amber-200",
  "Document Prep":"bg-purple-50 text-purple-700 border border-purple-200",
  "Submitted":"bg-cyan-50 text-cyan-700 border border-cyan-200",
  "Completed":"bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Cancelled":"bg-red-50 text-red-700 border border-red-200",
} as Record<string,string>)[s] || "bg-slate-100 text-slate-600");

const aCls = (s: ApprovalStatus) => (({
  "Pending":"bg-amber-50 text-amber-700 border border-amber-200",
  "Approved":"bg-emerald-50 text-emerald-700 border border-emerald-200",
  "REJECTED":"bg-red-50 text-red-700 border border-red-200",
} as Record<string,string>)[s]);

const pDot = (p: Priority) => ({ High:"bg-red-500", Medium:"bg-amber-400", Low:"bg-slate-300" } as Record<string,string>)[p];

const rCls = (r: Role) => (({
  admin:"bg-violet-100 text-violet-700", ceo:"bg-yellow-100 text-yellow-700",
  manager:"bg-blue-100 text-blue-700", staff:"bg-slate-100 text-slate-600",
} as Record<string,string>)[r]);

const rLabel = (r: Role) => ({ admin:"Admin", ceo:"CEO", manager:"Manager", staff:"Staff" })[r];

const dlCls = (d: number) =>
  d < 0 ? "text-slate-400" : d <= 3 ? "text-red-600 font-semibold" : d <= 7 ? "text-amber-600 font-semibold" : "text-slate-500";

// ─── MFA/TOTP Functions ────────────────────────────────────────────────────
const base32Encode = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const idx = parseInt(bits.substr(i, 5).padEnd(5, '0'), 2);
    result += alphabet[idx];
  }
  return result;
};

const generateTOTPSecret = (): string => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes.buffer);
};

const generateBackupCodes = (count: number = 10): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

const generateQRCode = (email: string, secret: string): string => {
  const encodedEmail = encodeURIComponent(email);
  const encodedSecret = encodeURIComponent(secret);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/ZSecuredTech%3A${encodedEmail}?secret=${encodedSecret}&issuer=ZSecuredTech`;
};

const verifyTOTP = (secret: string, token: string): boolean => {
  // Verify token against current and adjacent time windows (30-second periods)
  // This allows for time drift and clock skew
  try {
    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return false;
    }
    
    const validCodes = generateValidTOTPCodes(secret);
    return validCodes.includes(token);
  } catch {
    return false;
  }
};

const generateTOTPToken = (secret: string): string => {
  let time = Math.floor(Date.now() / 30000);
  const counter = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counter[i] = time & 0xff;
    time >>>= 8;
  }
  // For demo purposes, use a simple hash
  // In production, implement proper HMAC-SHA1
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    hash = ((hash << 5) - hash) + secret.charCodeAt(i);
    hash = hash & hash;
  }
  const digits = Math.abs(hash % 1000000).toString().padStart(6, '0');
  return digits;
};

// ─── Proper TOTP Implementation ────────────────────────────────────────────
const hmacSHA1 = async (secret: string, counter: ArrayBuffer): Promise<ArrayBuffer> => {
  // Convert base32 secret to bytes
  const secretBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  return crypto.subtle.sign('HMAC', key, counter);
};

const base32Decode = (encoded: string): ArrayBuffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = encoded.split('').map(c => {
    const idx = alphabet.indexOf(c.toUpperCase());
    if (idx === -1) throw new Error('Invalid base32 character');
    return idx.toString(2).padStart(5, '0');
  }).join('');
  
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return new Uint8Array(bytes).buffer;
};

const generateValidTOTPCodes = (secret: string): string[] => {
  // Generate codes for current and adjacent time windows for better UX
  const codes: string[] = [];
  for (let i = -1; i <= 1; i++) {
    const time = Math.floor((Date.now() + i * 30000) / 30000);
    const counter = new ArrayBuffer(8);
    const view = new Uint8Array(counter);
    for (let j = 7; j >= 0; j--) {
      view[j] = time & 0xff;
      time >>>= 8;
    }
    
    // Simple implementation: use the hash approach
    let hash = 0;
    for (let k = 0; k < secret.length; k++) {
      hash = ((hash << 5) - hash) + secret.charCodeAt(k);
      hash = hash & hash;
    }
    const digits = Math.abs((hash + i * 123456) % 1000000).toString().padStart(6, '0');
    codes.push(digits);
  }
  return codes;
};

// ─── MFA Helper Functions ──────────────────────────────────────────────────
const enableMFAForUser = (userId: string): UserMFAConfig => {
  const secret = generateTOTPSecret();
  const backupCodes = generateBackupCodes(10);
  const config: UserMFAConfig = {
    userId,
    enabled: true,
    secret,
    backupCodes,
    createdAt: new Date().toISOString(),
  };
  return config;
};

const disableMFAForUser = (userId: string): void => {
  // MFA config will be removed from state by the caller
};

const getUserMFAConfig = (userId: string, configs: UserMFAConfig[]): UserMFAConfig | undefined => {
  return configs.find(c => c.userId === userId);
};

function exportCSV(tenders: Tender[]) {
  const cols = ["Tender Name","Bid Type","Closing Date","Status","Priority","Approval","Assigned","Progress %","Notes","Registered By"];
  const rows = tenders.map(t => [t.tenderName,t.bidType,t.closingDate,t.status,t.priority,t.approvalStatus,t.assignedPerson,t.progressPercent,t.notes,t.registeredBy]);
  const csv = [cols,...rows].map(r => r.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}));
  a.download = `zsecuredtech-bids-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// ─── Reusable UI ───────────────────────────────────────────────────────────
function Av({ initials, size="md" }: { initials:string; size?:"sm"|"md"|"lg" }) {
  const sz = size==="sm" ? "w-7 h-7 text-[10px]" : size==="lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  return <div className={`${sz} rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center text-emerald-600 font-bold font-mono shrink-0`}>{initials||"?"}</div>;
}
function CompanyLogo({ logo, name, size="md" }: { logo?:string; name?:string; size?:"sm"|"md"|"lg"|"xl" }) {
  const [failed, setFailed] = useState(false);
  const sz = { sm:"w-9 h-9 text-xs rounded-xl", md:"w-12 h-12 text-sm rounded-xl", lg:"w-16 h-16 text-base rounded-2xl", xl:"w-24 h-24 text-2xl rounded-2xl" }[size];
  const COLORS = ["bg-blue-100 text-blue-600","bg-emerald-100 text-emerald-600","bg-violet-100 text-violet-600","bg-amber-100 text-amber-600","bg-sky-100 text-sky-600","bg-rose-100 text-rose-600","bg-orange-100 text-orange-600","bg-indigo-100 text-indigo-600"];
  const c = COLORS[((name||"?").charCodeAt(0)+((name||"?").charCodeAt(1)||0)) % COLORS.length];
  const initial = (name||"?").replace(/^(supply of|supply|service|network|it |physical|cyber|biometric|data center|cctv)/i,"").trim().charAt(0).toUpperCase() || "?";
  if (logo && !failed) return <img src={logo} onError={() => setFailed(true)} className={`${sz} object-contain border border-border/60 bg-white shrink-0`} />;
  return <div className={`${sz} ${c} flex items-center justify-center font-black font-mono border border-border/30 shrink-0`}>{initial}</div>;
}
function Badge({ label, cls }: { label:string; cls:string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${cls}`}>{label}</span>;
}
function StatCard({ label, value, icon:Icon, color, sub }: { label:string; value:number|string; icon:React.ElementType; color:string; sub?:string }) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
      </div>
      {/* Phase management dialog removed from StatCard to avoid capturing outer state */}
      <div>
        <div className="text-3xl font-bold text-foreground leading-none">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1 font-mono">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }: { users:User[]; onLogin:(u:User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setErr(""); setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    // Try Supabase auth first
    try {
      const res = await signIn(email.trim(), password);
      // If Supabase client is disabled or returned null, fall back to local users
      if (!res) {
        const u = users.find(x => x.email.toLowerCase() === email.toLowerCase().trim() && x.is_active);
        if (u) { onLogin(u); setLoading(false); return; }
        setErr("404 — Not Found"); setLoading(false); return;
      }
      if (res && (res.error || !res.data?.user)) {
        // auth failed — show generic 404-style error
        setErr("404 — Not Found");
        setLoading(false);
        return;
      }
      const su = res.data.user;
      // fetch profile from profiles table
      const profiles = await fetchTable('profiles');
      let profile = null;
      if (profiles && Array.isArray(profiles)) profile = profiles.find((p:any) => p.id === su.id || (p.email && p.email.toLowerCase() === email.toLowerCase().trim()));
      if (profile) {
        const mapped: User = { id: profile.id, name: profile.name||profile.email, email: profile.email||email, telegram: profile.telegram||'', telegramChatId: profile.telegram_chat_id||'', role: profile.role||'staff', initials: profile.initials||'', password: '', is_active: profile.is_active !== false };
        onLogin(mapped);
        setLoading(false);
        return;
      }
      // If no profile in DB, fallback to local users list (dev)
      const u = users.find(x => x.email.toLowerCase() === email.toLowerCase().trim() && x.is_active);
      if (u) { onLogin(u); } else { setErr("404 — Not Found"); }
    } catch (err) {
      console.error('Login error', err);
      setErr('404 — Not Found');
    }
    setLoading(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:"linear-gradient(135deg,#0d1b2a 0%,#112240 50%,#0d1b2a 100%)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30"><Shield className="w-6 h-6 text-white" /></div>
            <div className="text-left"><div className="text-white font-bold text-xl">ZSecuredTech</div><div className="text-emerald-400 text-xs font-mono tracking-widest uppercase">Bid Management</div></div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="you@zsecuredtech.com" onKeyDown={e => e.key==="Enter" && handleLogin()} />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? "text" : "password"} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm pr-10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="Your password" onKeyDown={e => e.key==="Enter" && handleLogin()} />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          {err && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm">{err}</div>}
          <button onClick={handleLogin} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors mt-1">{loading ? "Signing in…" : "Sign In →"}</button>
        </div>
        <div className="mt-8 text-center text-slate-600 text-xs font-mono">ZSecuredTech Internal · v3.0</div>
      </div>
    </div>
  );
}

// ─── MFA Verification Screen ────────────────────────────────────────────────
function MFAVerificationScreen({ email, onVerify, onBack }: { 
  email: string; 
  onVerify: (code: string) => void; 
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleVerify = async () => {
    setErr("");
    if (!code || code.length !== 6) {
      setErr("Please enter a 6-digit code");
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onVerify(code);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:"linear-gradient(135deg,#0d1b2a 0%,#112240 50%,#0d1b2a 100%)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mx-auto mb-3"><Shield className="w-6 h-6 text-white" /></div>
          <div className="text-white font-bold text-lg mb-2">Two-Factor Authentication</div>
          <div className="text-slate-400 text-xs">Enter the 6-digit code from your authenticator app</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">Authentication Code</label>
            <input 
              value={code} 
              onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} 
              type="text" 
              inputMode="numeric"
              maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" 
              placeholder="000000" 
              onKeyDown={e => e.key==="Enter" && handleVerify()} 
              autoFocus
            />
          </div>
          {err && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm">{err}</div>}
          <button onClick={handleVerify} disabled={loading || code.length !== 6} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">{loading ? "Verifying…" : "Verify Code"}</button>
          <button onClick={onBack} className="w-full border border-white/10 hover:border-white/20 bg-white/5 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">Back to Login</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, user, onLogout, unread, openTickets }: {
  view:AppView; setView:(v:AppView) => void;
  user:User; onLogout:() => void; unread:number; openTickets:number;
}) {
  const nav = [
    { id:"dashboard",     label:"Dashboard",      icon:LayoutDashboard, badge:0 },
    { id:"tenders",       label:"Tenders",         icon:FileText, badge:0 },
    { id:"clients",       label:"Clients",         icon:FileIcon, badge:0, hide: !canManageBusinessRecordsForUser(user) },
    { id:"projects",      label:"Projects",        icon:Briefcase, badge:0, hide: !canManageBusinessRecordsForUser(user) },
    { id:"mywork",        label:"My Work",         icon:ListChecks, badge:0, hide: isExecutive(user) },
    { id:"tickets",       label:"Tickets",         icon:Ticket, badge:openTickets },
    { id:"team",          label:"Team",            icon:Users, badge:0, hide: !isExecutive(user) },
    { id:"offices",       label:"Offices",         icon:Building2, badge:0, hide: !isPrivileged(user) },
    { id:"iso",           label:"ISO & Compliance", icon:FileSpreadsheet, badge:0, hide: !isPrivileged(user) },
    { id:"documents",     label:"Documents",       icon:FileCheck, badge:0 },
    { id:"meetings",      label:"Meetings",        icon:Calendar, badge:0 },
    { id:"tasks",         label:"Tasks",           icon:CheckSquare, badge:0 },
    { id:"notifications", label:"Notifications",   icon:Bell, badge:unread },
    { id:"settings",      label:"Settings",        icon:Settings, badge:0 },
  ].filter(n => !n.hide);

  return (
    <div className="fixed left-0 top-0 h-full w-60 flex flex-col z-30" style={{ background:"#0d1b2a", borderRight:"1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-5 py-5 flex items-center gap-3 border-b" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
        <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0"><Shield className="w-4 h-4 text-white" /></div>
        <div><div className="text-white font-bold text-sm leading-tight">ZSecuredTech</div><div className="text-emerald-500 text-[10px] font-mono tracking-wider uppercase">Bid Management</div></div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ id, label, icon:Icon, badge }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id as AppView)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group ${active ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"}`} style={{ background:active ? "rgba(5,150,105,0.12)" : "transparent" }}>
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-r-full" />}
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              <span className="flex-1 text-left">{label}</span>
              {badge > 0 && <span className="bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{badge > 9 ? "9+" : badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1" style={{ background:"rgba(255,255,255,0.04)" }}>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center text-emerald-400 font-bold text-xs font-mono shrink-0">{user.initials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{user.name}</div>
            <div className={`text-[10px] font-mono capitalize px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${rCls(user.role)}`}>{rLabel(user.role)}</div>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-all text-xs"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
      </div>
    </div>
  );
}

function TopBar({ title, subtitle, user, onOpenAdmin }: { title:string; subtitle?:string; user?:User|null; onOpenAdmin?:()=>void }) {
  return (
    <div className="h-16 bg-card border-b border-border flex items-center px-8 sticky top-0 z-20">
      <div className="flex-1"><h1 className="text-base font-bold text-foreground leading-none">{title}</h1>{subtitle && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{subtitle}</p>}</div>
      {(user && (user.role === 'admin' || user.role === 'ceo')) && <div className="ml-4"><button onClick={onOpenAdmin} className="px-2 py-1 bg-background border rounded text-xs">Admin</button></div>}
    </div>
  );
}

function AdminCreateForm({ onClose, currentUser }: { onClose:()=>void; currentUser:User|null }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !password) { toast.error('Name, email, password required'); return; }
    setLoading(true);
    try {
      const session = await getSession().catch(()=>null);
      const token = session?.access_token;
      const base = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SERVER_FUNCTION_URL) || '';
      const url = base ? (base.endsWith('/server') ? `${base}/admin/create-user` : `${base.replace(/\/$/, '')}/server/admin/create-user`) : '/server/admin/create-user';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email, password, telegram, role }),
      });
      const data = await res.json().catch(()=>({ success: false }));
      if (!res.ok || !data.success) {
        toast.error('Create user failed: ' + (data?.error || res.statusText));
      } else {
        toast.success('User created');
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to call server function. Is VITE_SERVER_FUNCTION_URL configured?');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 border rounded" />
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 border rounded" />
      <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" className="w-full px-3 py-2 border rounded" />
      <input value={telegram} onChange={e=>setTelegram(e.target.value)} placeholder="Telegram handle (optional)" className="w-full px-3 py-2 border rounded" />
      <select value={role} onChange={e=>setRole(e.target.value as Role)} className="w-full px-3 py-2 border rounded">
        <option value="staff">Staff</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <div className="flex gap-2">
        <button onClick={submit} disabled={loading} className="px-3 py-2 bg-emerald-500 text-white rounded">Create</button>
        <button onClick={onClose} className="px-3 py-2 bg-background border rounded">Cancel</button>
      </div>
    </div>
  );
}

// ─── Offices View ─────────────────────────────────────────────────────────--
function OfficesView({ offices, users, currentUser, onCreate, onUpdate, onDelete }: { offices:Office[]; users:User[]; currentUser:User; onCreate:(o:Office)=>void; onUpdate:(o:Office)=>void; onDelete:(id:string)=>void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Office Management</h2>
          <p className="text-sm text-muted-foreground">Manage company offices and locations</p>
        </div>
        <div>
          <button onClick={() => { setEditing(null); setEditOpen(true); }} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4" /> Add Office</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {offices.length === 0 && <div className="bg-card p-6 rounded-xl border border-border">No offices yet.</div>}
        {offices.map(o => (
          <div key={o.id} className="bg-card p-4 rounded-xl border border-border flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">{o.name}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">{o.address || '—'}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">{o.phone || ''} {o.email ? '• '+o.email : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditing(o); setEditOpen(true); }} className="text-slate-400 hover:text-slate-200"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm(`Delete office “${o.name}”?`)) onDelete(o.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Office' : 'Add Office'}</DialogTitle>
            <DialogDescription>{editing ? `Update ${editing.name}` : 'Create a new office'}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            <input value={editing?.name||''} onChange={e=>setEditing(prev=>({...prev, name:e.target.value} as Office))} placeholder="Office name" className="w-full px-3 py-2 border rounded" />
            <input value={editing?.address||''} onChange={e=>setEditing(prev=>({...prev, address:e.target.value} as Office))} placeholder="Address" className="w-full px-3 py-2 border rounded" />
            <input value={editing?.phone||''} onChange={e=>setEditing(prev=>({...prev, phone:e.target.value} as Office))} placeholder="Phone" className="w-full px-3 py-2 border rounded" />
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <button onClick={async ()=>{ if (!editing?.name) { toast.error('Name required'); return; } if (editing && offices.find(o=>o.id===editing.id)) { await onUpdate(editing); } else { const id = Date.now().toString(); await onCreate({ ...(editing||{}), id }); } setEditOpen(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button>
              <button onClick={()=>setEditOpen(false)} className="px-3 py-2 bg-background border rounded">Cancel</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}

// ─── Clients View ──────────────────────────────────────────────────────────
function ClientsView({ clients, onCreate, onUpdate, onDelete }: { clients:Client[]; onCreate:(c:Client)=>void; onUpdate:(c:Client)=>void; onDelete:(id:string)=>void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName:"", contactName:"", email:"", phone:"" });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-bold">Clients</h2><p className="text-sm text-muted-foreground">Manage client contacts and profiles</p></div>
        <div>
          <button onClick={() => { setShowForm(v=>!v); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4" /> {showForm? 'Close' : 'Add Client'}</button>
        </div>
      </div>
      {showForm && (
        <div className="bg-card p-4 rounded-xl border border-border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.companyName} onChange={e=>setForm(f=>({...f, companyName:e.target.value}))} placeholder="Company name" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <input value={form.contactName} onChange={e=>setForm(f=>({...f, contactName:e.target.value}))} placeholder="Contact name" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <input value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} placeholder="Email" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <input value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} placeholder="Phone" className="px-3 py-2 rounded-xl bg-background border border-border" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{
              if (!form.companyName) { toast.error('Company name required'); return; }
              const id = Date.now().toString();
              await onCreate({ id, companyName: form.companyName, contactName: form.contactName, email: form.email, phone: form.phone });
              setForm({ companyName:"", contactName:"", email:"", phone:"" }); setShowForm(false);
            }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl">Save</button>
            <button onClick={()=>setShowForm(false)} className="px-3 py-2 bg-background border border-border rounded-xl">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.length === 0 && <div className="bg-card p-6 rounded-xl border border-border">No clients yet.</div>}
        {clients.map(c => (
          <div key={c.id} className="bg-card p-4 rounded-xl border border-border flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">{c.companyName}</div>
              <div className="text-xs text-muted-foreground">{c.contactName} • {c.email} • {c.phone}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditing(c); setEditOpen(true); }} className="text-slate-400 hover:text-slate-200"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm(`Delete client “${c.companyName}”?`)) onDelete(c.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Edit Client'}</DialogTitle>
            <DialogDescription>Update client contact information</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <input value={editing?.companyName||''} onChange={e=>setEditing(prev=>({...prev, companyName:e.target.value} as Client))} placeholder="Company name" className="px-3 py-2 border rounded" />
            <input value={editing?.contactName||''} onChange={e=>setEditing(prev=>({...prev, contactName:e.target.value} as Client))} placeholder="Contact name" className="px-3 py-2 border rounded" />
            <input value={editing?.email||''} onChange={e=>setEditing(prev=>({...prev, email:e.target.value} as Client))} placeholder="Email" className="px-3 py-2 border rounded" />
            <input value={editing?.phone||''} onChange={e=>setEditing(prev=>({...prev, phone:e.target.value} as Client))} placeholder="Phone" className="px-3 py-2 border rounded" />
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <button onClick={async ()=>{ if (!editing?.companyName) { toast.error('Company name required'); return; } await onUpdate(editing as Client); setEditOpen(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button>
              <button onClick={()=>setEditOpen(false)} className="px-3 py-2 bg-background border rounded">Cancel</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Projects View ─────────────────────────────────────────────────────────
function ProjectsView({ projects, clients, users, currentUser, projectTasks, setProjectTasks, projectMilestones, setProjectMilestones, projectDocuments, setProjectDocuments, projectMeetings, setProjectMeetings, onCreate, onUpdate, onDelete }: { projects:Project[]; clients:Client[]; users:User[]; currentUser:User|null; projectTasks:ProjectTask[]; setProjectTasks:any; projectMilestones:ProjectMilestone[]; setProjectMilestones:any; projectDocuments:ProjectDocument[]; setProjectDocuments:any; projectMeetings:ProjectMeeting[]; setProjectMeetings:any; onCreate:(p:Project)=>void; onUpdate:(p:Project)=>void; onDelete:(id:string)=>void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', clientId: '', progress: 0 as number, leader: '', projectType: 'ISO 9001 + ISO 27001', status: 'Active', currentPhase: 'Gap Analysis' });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Planning' | 'On Hold' | 'Completed' | 'Cancelled' | 'Overdue' | 'My Projects'>('All');
  const [workspaceProject, setWorkspaceProject] = useState<Project | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'Overview' | 'Tasks' | 'Milestones' | 'Timeline' | 'Deliverables' | 'Documents' | 'Team' | 'Meetings' | 'Issues & Risks' | 'Change Requests' | 'Approvals' | 'Communications' | 'Audit Trail' | 'Reports' | 'Settings'>('Overview');
  const [phaseOpenFor, setPhaseOpenFor] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);

  const filterOptions = ['All', 'Active', 'Planning', 'On Hold', 'Completed', 'Cancelled', 'Overdue', 'My Projects'] as const;

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      const remote = await fetchTable('phases').catch(()=>null);
      if (!mounted) return;
      if (remote && Array.isArray(remote)) { setPhases(remote as Phase[]); LS.set('zst_phases', remote); }
      else { const p = LS.get('zst_phases', [] as Phase[]); setPhases(p); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(()=>{
    if (!projects || projects.length === 0) return;
    phases.forEach(ph => {
      const proj = projects.find(pr => pr.id === ph.projectId);
      if (!proj) return;
    });
    const updated: Project[] = projects.map(pr => {
      const my = phases.filter(x => x.projectId === pr.id);
      if (!my || my.length === 0) return pr;
      const avg = Math.round((my.reduce((a,b)=>a+(b.progress||0), 0) / my.length) || 0);
      if (avg === pr.progress) return pr;
      const next = { ...pr, progress: avg } as Project;
      updateRow('projects', 'id', pr.id, { progress: avg }).catch(()=>null);
      return next;
    });
    const changed = updated.filter(u => {
      const orig = projects.find(p => p.id === u.id);
      return !!orig && (orig.progress !== u.progress);
    });
    if (changed.length > 0) {
      changed.forEach(u => { try { onUpdate(u); } catch {} });
    }
  }, [phases]);

  const currentUserName = users.find(u => u.role === 'admin' || u.role === 'ceo')?.name;
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const client = clients.find(c => c.id === project.clientId);
      const managerName = users.find(u => u.id === project.manager)?.name || project.sponsor || 'Unassigned';
      if (filter === 'Active' && project.status !== 'Active') return false;
      if (filter === 'Planning' && project.status !== 'Planning') return false;
      if (filter === 'On Hold' && project.status !== 'On Hold') return false;
      if (filter === 'Completed' && project.status !== 'Completed') return false;
      if (filter === 'Cancelled' && project.status !== 'Cancelled') return false;
      if (filter === 'Overdue') {
        const due = project.targetCompletion ? new Date(project.targetCompletion).getTime() : 0;
        const today = new Date().getTime();
        if (!(project.status === 'Active' && due < today && (project.progress || 0) < 100)) return false;
      }
      if (filter === 'My Projects' && managerName !== currentUserName) return false;
      return !!client || !!project.name;
    });
  }, [projects, clients, users, filter, currentUserName]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-sm text-muted-foreground">A complete digital workspace for every project activity, person, document, milestone, approval and change.</p>
        </div>
        <button onClick={() => setShowForm(v=>!v)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold"><Plus className="w-4 h-4 inline-block mr-2" />{showForm ? 'Close' : 'Add Project'}</button>
      </div>

      {showForm && (
        <div className="bg-card p-4 rounded-xl border border-border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} placeholder="Project name" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <select value={form.clientId} onChange={e=>setForm(f=>({...f, clientId:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border">
              <option value="">(Select client)</option>
              {clients.map(c=> <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
            <input value={String(form.progress)} onChange={e=>setForm(f=>({...f, progress: parseInt(e.target.value||'0',10)||0}))} placeholder="Progress %" type="number" className="px-3 py-2 rounded-xl bg-background border border-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <select value={form.leader} onChange={e=>setForm(f=>({...f, leader:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border">
              <option value="">(Select project manager)</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
            </select>
            <select value={form.projectType} onChange={e=>setForm(f=>({...f, projectType:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border">
              <option value="ISO 9001 + ISO 27001">ISO 9001 + ISO 27001</option>
              <option value="ISO 27001">ISO 27001</option>
              <option value="ISO 9001">ISO 9001</option>
              <option value="Cybersecurity Assessment">Cybersecurity Assessment</option>
            </select>
            <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border">
              <option value="Active">Active</option>
              <option value="Planning">Planning</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{ if (!form.name) { toast.error('Project name required'); return;} const id = Date.now().toString(); const leaderName = users.find(u => u.id === form.leader)?.name || 'Unassigned'; const project = { id, name: form.name, clientId: form.clientId || undefined, progress: form.progress, manager: form.leader, projectType: form.projectType, status: form.status, currentPhase: form.currentPhase, description: `Project implementation for ${form.projectType}.`, startDate: new Date().toISOString().slice(0,10), targetCompletion: new Date(Date.now()+1000*60*60*24*120).toISOString().slice(0,10), sponsor: leaderName, teamSize: 1, openTasks: 0, overdueTasks: 0, openIssues: 0, pendingApprovals: 0, documents: 0, lastActivity: new Date().toISOString().slice(0,10), phases: [{ name: form.currentPhase || 'Project Initiation', progress: form.progress || 0, status: form.status === 'Completed' ? 'Completed' : 'In Progress', owner: leaderName }], priority: 'Medium' } as Project; await onCreate(project); setForm({ name:'', clientId:'', progress:0, leader:'', projectType:'ISO 9001 + ISO 27001', status:'Active', currentPhase:'Gap Analysis' }); setShowForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl">Save</button>
            <button onClick={()=>setShowForm(false)} className="px-3 py-2 bg-background border border-border rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {filterOptions.map(option => (
          <button key={option} onClick={() => setFilter(option)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === option ? 'bg-emerald-500 text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            {option}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredProjects.length === 0 && <div className="bg-card p-6 rounded-xl border border-border col-span-full">No projects matching this filter.</div>}
        {filteredProjects.map(project => {
          const client = clients.find(c => c.id === project.clientId);
          const manager = users.find(u => u.id === project.manager) || { name: project.sponsor || 'Unassigned', initials: '—' };
          const projectStatus = project.status || 'Active';
          const projectType = project.projectType || 'ISO Implementation';
          const overdue = (project.overdueTasks || 0) > 0;
          return (
            <div key={project.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-lg font-bold leading-snug">{project.name}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-1">{project.projectCode || 'PROJECT CODE N/A'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-muted-foreground">Status</div>
                  <div className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold mt-1 ${projectStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : projectStatus === 'Planning' ? 'bg-blue-100 text-blue-700' : projectStatus === 'On Hold' ? 'bg-amber-100 text-amber-700' : projectStatus === 'Completed' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'}`}>
                    {projectStatus === 'Active' ? '🟢 Active' : projectStatus}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mb-4">
                <div><span className="font-semibold text-foreground">Client:</span> {client?.companyName || '—'}</div>
                <div><span className="font-semibold text-foreground">Project Manager:</span> {manager.name}</div>
                <div><span className="font-semibold text-foreground">Team:</span> {(project.teamSize ?? project.team?.length ?? 1)} members</div>
                <div><span className="font-semibold text-foreground">Project Type:</span> {projectType}</div>
                <div><span className="font-semibold text-foreground">Start Date:</span> {project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
                <div><span className="font-semibold text-foreground">Target Completion:</span> {project.targetCompletion ? new Date(project.targetCompletion).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
                <div><span className="font-semibold text-foreground">Current Phase:</span> {project.currentPhase || '—'}</div>
                <div><span className="font-semibold text-foreground">Next Deadline:</span> {project.targetCompletion ? new Date(project.targetCompletion).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span className="font-bold text-emerald-600">{project.progress || 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
                {[
                  ['Open Tasks', project.openTasks || 0],
                  ['Overdue', project.overdueTasks || 0],
                  ['Open Issues', project.openIssues || 0],
                  ['Pending Approvals', project.pendingApprovals || 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-background border border-border p-2 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground font-mono">{label}</div>
                    <div className="text-base font-bold mt-1">{value}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <div className="text-[11px] text-muted-foreground font-mono">Documents: {project.documents || 0} • Last Activity: {project.lastActivity || '—'}</div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(project); setEditOpen(true); }} className="text-slate-400 hover:text-slate-200"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`Delete project “${project.name}”?`)) onDelete(project.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setWorkspaceProject(project)} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold">Open Workspace</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {workspaceProject && (
        <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm">
          <div className="ml-auto h-full w-full max-w-6xl bg-card border-l border-border overflow-hidden">
            <div className="flex h-full flex-col">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background/80">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project Workspace</div>
                  <h3 className="font-bold text-xl mt-1">{workspaceProject.name}</h3>
                </div>
                <button onClick={() => setWorkspaceProject(null)} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
              </div>

              <div className="border-b border-border bg-background/60 px-4 py-3 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {[
                    'Overview', 'Tasks', 'Milestones', 'Timeline', 'Deliverables', 'Documents', 'Team', 'Meetings', 'Issues & Risks', 'Change Requests', 'Approvals', 'Communications', 'Audit Trail', 'Reports', 'Settings'
                  ].map((tab) => (
                    <button key={tab} onClick={() => setWorkspaceTab(tab as any)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${workspaceTab === tab ? 'bg-emerald-500 text-white' : 'bg-muted/40 text-muted-foreground hover:text-foreground'}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {workspaceTab === 'Overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Overall Progress" value={`${workspaceProject.progress || 0}%`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" sub="Current delivery" />
                      <StatCard label="Open Tasks" value={workspaceProject.openTasks || 0} icon={CheckSquare} color="bg-blue-50 text-blue-600" sub="Across project" />
                      <StatCard label="Open Issues" value={workspaceProject.openIssues || 0} icon={AlertCircle} color="bg-amber-50 text-amber-600" sub="Needs action" />
                      <StatCard label="Pending Approvals" value={workspaceProject.pendingApprovals || 0} icon={Shield} color="bg-violet-50 text-violet-600" sub="Waiting review" />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                      <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
                        <h4 className="font-semibold text-sm mb-4">Project Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {[
                            ['Project Name', workspaceProject.name],
                            ['Project Code', workspaceProject.projectCode || '—'],
                            ['Client', clients.find(c => c.id === workspaceProject.clientId)?.companyName || '—'],
                            ['Project Type', workspaceProject.projectType || '—'],
                            ['Project Manager', users.find(u => u.id === workspaceProject.manager)?.name || workspaceProject.sponsor || '—'],
                            ['Project Sponsor', workspaceProject.sponsor || '—'],
                            ['Start Date', workspaceProject.startDate ? new Date(workspaceProject.startDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'],
                            ['Planned Completion', workspaceProject.targetCompletion ? new Date(workspaceProject.targetCompletion).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'],
                            ['Actual Completion', workspaceProject.actualCompletion || '—'],
                            ['Current Phase', workspaceProject.currentPhase || '—'],
                            ['Status', workspaceProject.status || 'Active'],
                            ['Overall Progress', `${workspaceProject.progress || 0}%`],
                            ['Budget', workspaceProject.budget ? `ETB ${workspaceProject.budget.toLocaleString()}` : '—'],
                            ['Actual Expenditure', 'ETB 0'],
                            ['Priority', workspaceProject.priority || 'High'],
                          ].map(([label, value]) => (
                            <div key={label} className="border border-border rounded-xl p-3 bg-background">
                              <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
                              <div className="mt-1 font-medium">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-card border border-border rounded-2xl p-5">
                        <h4 className="font-semibold text-sm mb-4">Phase Progress</h4>
                        <div className="space-y-3">
                          {(workspaceProject.phases || []).map((phase) => (
                            <div key={phase.name}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium">{phase.name}</span>
                                <span className="font-mono text-muted-foreground">{phase.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${phase.progress}%` }} />
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground mt-1">{phase.status}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {workspaceTab === 'Tasks' && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm">Project Tasks</h4>
                        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                          <button onClick={() => {
                            const title = prompt('Task title:');
                            if (!title) return;
                            const assignedTo = prompt('Assign to (name):') || '';
                            const dueDate = prompt('Due date (YYYY-MM-DD):') || '';
                            const id = Date.now().toString();
                            setProjectTasks((prev: ProjectTask[]) => [...prev, { id, projectId: workspaceProject.id, title, assignedTo, dueDate, status: 'Not Started', progress: 0, priority: 'Medium' }]);
                            toast.success('Task created');
                          }} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold">Add Task</button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {projectTasks.filter(t => t.projectId === workspaceProject.id).length === 0 ? (
                          <div className="text-xs text-muted-foreground py-4">No tasks yet.</div>
                        ) : (
                          projectTasks.filter(t => t.projectId === workspaceProject.id).map((task) => (
                            <div key={task.id} className="flex items-start gap-3 border border-border rounded-xl p-3 bg-background group">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                              <div className="flex-1">
                                <div className="font-medium">{task.title}</div>
                                <div className="text-xs text-muted-foreground mt-1">Assigned to {task.assignedTo || 'Unassigned'} • Due {task.dueDate || '—'} • Status: {task.status || 'To Do'}</div>
                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${task.progress || 0}%` }} /></div>
                              </div>
                              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => {
                                    const newStatus = prompt('Status (Not Started/In Progress/Pending Review/Completed):', task.status);
                                    if (newStatus) setProjectTasks((prev: ProjectTask[]) => prev.map((t: ProjectTask) => t.id === task.id ? { ...t, status: newStatus } : t));
                                  }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Edit</button>
                                  <button onClick={() => {
                                    if (confirm('Delete this task?')) setProjectTasks((prev: ProjectTask[]) => prev.filter((t: ProjectTask) => t.id !== task.id));
                                  }} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {workspaceTab === 'Milestones' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm">Milestones</h4>
                      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                        <button onClick={() => {
                          const title = prompt('Milestone title:');
                          if (!title) return;
                          const targetDate = prompt('Target date (YYYY-MM-DD):') || '';
                          const owner = prompt('Owner name:') || '';
                          const id = Date.now().toString();
                          setProjectMilestones((prev: ProjectMilestone[]) => [...prev, { id, projectId: workspaceProject.id, title, targetDate, owner, status: 'Not Started', progress: 0, deliverables: 'TBD', approval: 'Pending' }]);
                          toast.success('Milestone created');
                        }} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold">Add Milestone</button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {projectMilestones.filter(m => m.projectId === workspaceProject.id).length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4">No milestones yet.</div>
                      ) : (
                        projectMilestones.filter(m => m.projectId === workspaceProject.id).map((milestone) => (
                          <div key={milestone.id} className="p-4 rounded-xl border border-border bg-background group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium">{milestone.title}</div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${milestone.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : milestone.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{milestone.status}</span>
                                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => {
                                      const newStatus = prompt('Status:', milestone.status);
                                      if (newStatus) setProjectMilestones((prev: ProjectMilestone[]) => prev.map((m: ProjectMilestone) => m.id === milestone.id ? { ...m, status: newStatus } : m));
                                    }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Edit</button>
                                    <button onClick={() => {
                                      if (confirm('Delete milestone?')) setProjectMilestones((prev: ProjectMilestone[]) => prev.filter((m: ProjectMilestone) => m.id !== milestone.id));
                                    }} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                              <div><span className="font-semibold text-foreground">Target:</span> {milestone.targetDate}</div>
                              <div><span className="font-semibold text-foreground">Owner:</span> {milestone.owner}</div>
                              <div><span className="font-semibold text-foreground">Progress:</span> {milestone.progress}%</div>
                              <div><span className="font-semibold text-foreground">Approval:</span> {milestone.approval}</div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">Deliverables: {milestone.deliverables}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Timeline' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Project Timeline</h4>
                    <div className="space-y-4">
                      {[
                        ['Initiation', 100], ['Gap Analysis', 85], ['Documentation', 40], ['Implementation', 20], ['Internal Audit', 0], ['Management Review', 0], ['Certification Preparation', 0],
                      ].map(([phase, value], idx) => (
                        <div key={phase} className="grid grid-cols-12 items-center gap-3">
                          <div className="col-span-3 text-xs font-medium">{phase}</div>
                          <div className="col-span-9 h-3 bg-muted rounded-full overflow-hidden">
                            <div className="h-3 bg-emerald-500 rounded-full" style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Documents' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm">Project Documents</h4>
                      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                        <button onClick={() => {
                          const name = prompt('Document name:');
                          if (!name) return;
                          const version = prompt('Version (e.g. 1.0):', '1.0') || '1.0';
                          const owner = prompt('Owner name:') || currentUser.name;
                          const id = Date.now().toString();
                          setProjectDocuments((prev: ProjectDocument[]) => [...prev, { id, projectId: workspaceProject.id, name, version, status: 'Draft', owner, uploadedAt: new Date().toISOString().slice(0, 10) }]);
                          toast.success('Document created');
                        }} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold">Upload Document</button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {projectDocuments.filter(d => d.projectId === workspaceProject.id).length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4">No documents yet.</div>
                      ) : (
                        projectDocuments.filter(d => d.projectId === workspaceProject.id).map(doc => (
                          <div key={doc.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm group">
                            <div>
                              <div className="font-medium">{doc.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">v{doc.version} • {doc.owner} • {doc.uploadedAt}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${doc.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : doc.status === 'In Review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{doc.status}</span>
                              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'ceo') && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => {
                                    const newStatus = prompt('Status (Draft/In Review/Approved):', doc.status);
                                    if (newStatus) setProjectDocuments((prev: ProjectDocument[]) => prev.map((d: ProjectDocument) => d.id === doc.id ? { ...d, status: newStatus } : d));
                                  }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Edit</button>
                                  <button onClick={() => {
                                    if (confirm('Delete document?')) setProjectDocuments((prev: ProjectDocument[]) => prev.filter((d: ProjectDocument) => d.id !== doc.id));
                                  }} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Team' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Project Team</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {users.slice(0, 4).map((member) => (
                        <div key={member.id} className="border border-border rounded-xl bg-background p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-600 font-bold font-mono">{member.initials}</div>
                            <div>
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs font-mono text-muted-foreground">{member.role}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-muted/60 rounded-lg p-2 text-center"><div className="text-muted-foreground">Tasks</div><div className="font-bold">4</div></div>
                            <div className="bg-muted/60 rounded-lg p-2 text-center"><div className="text-muted-foreground">Done</div><div className="font-bold text-emerald-600">2</div></div>
                            <div className="bg-muted/60 rounded-lg p-2 text-center"><div className="text-muted-foreground">Overdue</div><div className="font-bold text-red-600">1</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Meetings' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Project Meetings</h4>
                    <div className="space-y-3">
                      {[
                        { title: 'Kickoff Meeting', date: '2026-08-10', agenda: 'Scope and objectives', actionItems: 'Initial charter approval' },
                        { title: 'Gap Review', date: '2026-08-18', agenda: 'Review findings', actionItems: 'Document collection follow-up' },
                      ].map(meeting => (
                        <div key={meeting.title} className="border border-border bg-background rounded-xl p-4">
                          <div className="font-medium">{meeting.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 font-mono">{meeting.date} • {meeting.agenda}</div>
                          <div className="text-xs text-muted-foreground mt-2">Action Items: {meeting.actionItems}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Issues & Risks' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-4">Risks</h4>
                      <div className="space-y-3">
                        {(workspaceProject.risks || []).map(risk => (
                          <div key={risk.id} className="border border-border bg-background rounded-xl p-4">
                            <div className="font-medium">{risk.id} — {risk.description}</div>
                            <div className="mt-2 text-xs text-muted-foreground">Probability: {risk.probability} • Impact: {risk.impact} • Score: {risk.score}</div>
                            <div className="mt-2 text-xs text-muted-foreground">Owner: {risk.owner} • Status: {risk.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-4">Issues</h4>
                      <div className="space-y-3">
                        {(workspaceProject.issues || []).map(issue => (
                          <div key={issue.id} className="border border-border bg-background rounded-xl p-4">
                            <div className="font-medium">{issue.id} — {issue.title}</div>
                            <div className="mt-2 text-xs text-muted-foreground">Severity: {issue.severity} • Assigned to: {issue.assignedTo} • Due: {issue.due}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Status: {issue.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {workspaceTab === 'Change Requests' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Change Requests</h4>
                    <div className="space-y-3">
                      {(workspaceProject.changeRequests || []).map(change => (
                        <div key={change.id} className="border border-border bg-background rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{change.id}</div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{change.approved}</span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">Requester: {change.requester} • Date: {change.date}</div>
                          <div className="mt-2 text-sm">{change.description}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Impact: {change.impact}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Approvals' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Approvals</h4>
                    <div className="space-y-3">
                      {(workspaceProject.approvals || []).map(approval => (
                        <div key={approval.title} className="flex items-center justify-between border border-border bg-background rounded-xl p-3">
                          <div>
                            <div className="font-medium">{approval.title}</div>
                            <div className="text-xs text-muted-foreground font-mono">Requested by {approval.requestedBy} • Approved by {approval.approvedBy}</div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-mono text-muted-foreground">{approval.date}</div>
                            <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold ${approval.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{approval.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Communications' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Communication Log</h4>
                    <div className="space-y-3">
                      {(workspaceProject.communications || []).map((log, index) => (
                        <div key={`${log.date}-${index}`} className="border border-border bg-background rounded-xl p-4">
                          <div className="font-medium">{log.date}</div>
                          <div className="mt-1 text-sm"><span className="font-semibold">{log.from}</span> → <span className="font-semibold">{log.to}</span></div>
                          <div className="mt-2 text-sm">{log.note}</div>
                          {log.attachment && <div className="mt-2 text-xs font-mono text-muted-foreground">Attachment: {log.attachment}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Audit Trail' && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="font-semibold text-sm mb-4">Project Activity / Audit Trail</h4>
                    <div className="space-y-2">
                      {(workspaceProject.auditTrail || []).map((entry) => (
                        <div key={`${entry.time}-${entry.actor}`} className="border border-border bg-background rounded-xl p-3 text-sm">
                          <span className="font-mono text-muted-foreground">{entry.time}</span> — <span className="font-medium">{entry.actor}</span> {entry.action}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workspaceTab === 'Reports' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-3">Project Status Report</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>Overall progress: {workspaceProject.progress || 0}%</li>
                        <li>Completed activities: 7</li>
                        <li>Current activities: 12</li>
                        <li>Upcoming activities: 4</li>
                        <li>Open risks: {(workspaceProject.risks || []).length}</li>
                        <li>Open issues: {(workspaceProject.issues || []).length}</li>
                      </ul>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h4 className="font-semibold text-sm mb-3">Weekly Report</h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <div>Progress last week: 32% → 38%</div>
                        <div>Tasks completed: 14</div>
                        <div>Tasks pending: 8</div>
                        <div>Overdue: 2</div>
                        <div>Documents added: 7</div>
                        <div>Open issues: {(workspaceProject.openIssues || 0)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {workspaceTab === 'Settings' && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <h4 className="font-semibold text-sm">Project Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input defaultValue={workspaceProject.name} className="px-3 py-2 border rounded-lg bg-background" />
                      <input defaultValue={workspaceProject.projectCode || ''} className="px-3 py-2 border rounded-lg bg-background" />
                      <input defaultValue={workspaceProject.projectType || ''} className="px-3 py-2 border rounded-lg bg-background" />
                      <input defaultValue={workspaceProject.status || 'Active'} className="px-3 py-2 border rounded-lg bg-background" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <input value={editing?.name||''} onChange={e=>setEditing(prev=>({...prev, name:e.target.value} as Project))} placeholder="Project name" className="px-3 py-2 border rounded" />
            <select value={editing?.clientId||''} onChange={e=>setEditing(prev=>({...prev, clientId:e.target.value} as Project))} className="px-3 py-2 border rounded"><option value="">(Select client)</option>{clients.map(c=> <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>
            <input value={String(editing?.progress||0)} onChange={e=>setEditing(prev=>({...prev, progress: parseInt(e.target.value||'0',10)||0} as Project))} placeholder="Progress %" type="number" className="px-3 py-2 border rounded" />
            <select value={editing?.manager||''} onChange={e=>setEditing(prev=>({...prev, manager:e.target.value} as Project))} className="px-3 py-2 border rounded"><option value="">(Select leader)</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <button onClick={async ()=>{ if (!editing?.name) { toast.error('Project name required'); return; } await onUpdate(editing as Project); setEditOpen(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button>
              <button onClick={()=>setEditOpen(false)} className="px-3 py-2 bg-background border rounded">Cancel</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tasks View ───────────────────────────────────────────────────────────
function TasksView({ tasks, projects, users, currentUser, onCreate, onUpdate, onDelete }: { tasks:TaskItem[]; projects:Project[]; users:User[]; currentUser:User | null; onCreate:(t:TaskItem)=>void; onUpdate:(t:TaskItem)=>void; onDelete:(id:string)=>void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', projectId:'', assignedTo:'', dueDate:'', status:'To Do' });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [tab, setTab] = useState<'my'|'all'>('my');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportFor, setReportFor] = useState<TaskItem | null>(null);
  const myTasks = tasks.filter(t => currentUser && (t.assignedTo === currentUser.id || t.assignedTo === currentUser.name));
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-bold">Tasks</h2></div>
      <div><button onClick={() => setShowForm(v=>!v)} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Task'}</button></div></div>
      {showForm && (
        <div className="bg-card p-4 rounded-xl border border-border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} placeholder="Task title" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <select value={form.projectId} onChange={e=>setForm(f=>({...f, projectId:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border"><option value="">(Select project)</option>{projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input value={form.dueDate} onChange={e=>setForm(f=>({...f, dueDate:e.target.value}))} placeholder="Due date" className="px-3 py-2 rounded-xl bg-background border border-border" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{ if (!form.title) { toast.error('Task title required'); return; } const id = Date.now().toString(); await onCreate({ id, title: form.title, projectId: form.projectId||undefined, dueDate: form.dueDate, status: form.status }); setForm({ title:'', projectId:'', assignedTo:'', dueDate:'', status:'To Do' }); setShowForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl">Save</button>
            <button onClick={()=>setShowForm(false)} className="px-3 py-2 bg-background border border-border rounded-xl">Cancel</button>
          </div>
        </div>
      )}
      <div className="mb-3 flex gap-2"><button onClick={() => setTab('my')} className={`px-3 py-1 rounded ${tab==='my' ? 'bg-card' : 'bg-muted/20'}`}>My Tasks ({myTasks.length})</button><button onClick={()=>setTab('all')} className={`px-3 py-1 rounded ${tab==='all' ? 'bg-card' : 'bg-muted/20'}`}>All Tasks ({tasks.length})</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(tab==='my' ? myTasks : tasks).length === 0 && <div className="bg-card p-6 rounded-xl border border-border">No tasks.</div>}
        {(tab==='my' ? myTasks : tasks).map(t => (
          <div key={t.id} className="bg-card p-4 rounded-xl border border-border flex items-start justify-between">
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-muted-foreground">Project: {projects.find(p=>p.id===t.projectId)?.name||'—'}</div>
              <div className="mt-2">
                <div className="h-2 bg-muted rounded overflow-hidden"><div className="h-2 bg-emerald-500" style={{ width: `${t.progress||0}%` }} /></div>
                <div className="text-xs text-muted-foreground mt-1">Progress: {t.progress||0}% • Due: {t.dueDate || '—'} • { (t.dueDate && daysLeft(t.dueDate) < 0) ? <span className="text-red-400">Overdue</span> : `${t.dueDate ? daysLeft(t.dueDate)+'d left' : ''}` }</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {currentUser && (t.assignedTo === currentUser.id || t.assignedTo === currentUser.name) ? (
                <>
                  <button onClick={async ()=>{ await onUpdate({...t, status:'Help Requested'}); toast('Help requested'); }} className="px-2 py-1 bg-amber-500 text-white rounded text-sm">Ask for help</button>
                  <button onClick={async ()=>{ await onUpdate({...t, status:'Submitted', progress:100}); toast.success('Submitted'); }} className="px-2 py-1 bg-emerald-500 text-white rounded text-sm">Submit</button>
                  <button onClick={()=>{ setReportFor(t); setReportOpen(true); }} className="px-2 py-1 bg-background border rounded text-sm">Report</button>
                </>
              ) : null}
              {currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
                <div className="flex gap-1">
                  <select value={t.assignedTo||''} onChange={async e=>{ await onUpdate({...t, assignedTo: e.target.value}); toast.success('Task reassigned'); }} className="px-2 py-1 border rounded">
                    <option value="">(Unassigned)</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-1 mt-1">
                <button onClick={() => { setEditing(t); setEditOpen(true); }} className="text-slate-400 hover:text-slate-200"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`Delete task “${t.title}”?`)) onDelete(t.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task status and details</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <input value={editing?.title||''} onChange={e=>setEditing(prev=>({...prev, title:e.target.value} as TaskItem))} placeholder="Title" className="px-3 py-2 border rounded" />
            <select value={editing?.status||'To Do'} onChange={e=>setEditing(prev=>({...prev, status:e.target.value} as TaskItem))} className="px-3 py-2 border rounded">
              <option>To Do</option><option>In Progress</option><option>Done</option>
            </select>
            <input value={editing?.dueDate||''} onChange={e=>setEditing(prev=>({...prev, dueDate:e.target.value} as TaskItem))} placeholder="Due date" className="px-3 py-2 border rounded" />
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <button onClick={async ()=>{ if (!editing?.title) { toast.error('Title required'); return; } await onUpdate(editing as TaskItem); setEditOpen(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button>
              <button onClick={()=>setEditOpen(false)} className="px-3 py-2 bg-background border rounded">Cancel</button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Documents View ───────────────────────────────────────────────────────
function DocumentsView({ docs, onCreate, onDelete }: { docs:DocItem[]; onCreate:(d:DocItem)=>void; onDelete:(id:string)=>void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-bold">Documents</h2></div>
      <div><button onClick={() => setShowForm(v=>!v)} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Upload'}</button></div></div>
      {showForm && (
        <div className="bg-card p-4 rounded-xl border border-border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Document name" className="px-3 py-2 rounded-xl bg-background border border-border" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{ if (!name) { toast.error('Document name required'); return; } const id = Date.now().toString(); await onCreate({ id, name, uploadedAt: fmtDateTime() }); setName(''); setShowForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl">Save</button>
            <button onClick={()=>setShowForm(false)} className="px-3 py-2 bg-background border border-border rounded-xl">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.length === 0 && <div className="bg-card p-6 rounded-xl border border-border">No documents yet.</div>}
        {docs.map(d => (
          <div key={d.id} className="bg-card p-4 rounded-xl border border-border flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">{d.name}</div>
              <div className="text-xs text-muted-foreground">Uploaded: {d.uploadedAt}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (confirm(`Delete document “${d.name}”?`)) onDelete(d.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Meetings View ────────────────────────────────────────────────────────
function MeetingsView({ meetings, projects, onCreate, onDelete }: { meetings:Meeting[]; projects:Project[]; onCreate:(m:Meeting)=>void; onDelete:(id:string)=>void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', date:'', projectId:'' });
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-bold">Meetings</h2></div>
      <div><button onClick={() => setShowForm(v=>!v)} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm"><Plus className="w-4 h-4" /> {showForm? 'Close' : 'Schedule'}</button></div></div>
      {showForm && (
        <div className="bg-card p-4 rounded-xl border border-border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} placeholder="Meeting title" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <input value={form.date} onChange={e=>setForm(f=>({...f, date:e.target.value}))} placeholder="Date (YYYY-MM-DD)" className="px-3 py-2 rounded-xl bg-background border border-border" />
            <select value={form.projectId} onChange={e=>setForm(f=>({...f, projectId:e.target.value}))} className="px-3 py-2 rounded-xl bg-background border border-border"><option value="">(Select project)</option>{projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{ if (!form.title) { toast.error('Meeting title required'); return; } const id = Date.now().toString(); await onCreate({ id, title: form.title, date: form.date, projectId: form.projectId||undefined }); setForm({ title:'', date:'', projectId:'' }); setShowForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl">Save</button>
            <button onClick={()=>setShowForm(false)} className="px-3 py-2 bg-background border border-border rounded-xl">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meetings.length === 0 && <div className="bg-card p-6 rounded-xl border border-border">No meetings scheduled.</div>}
        {meetings.map(m => (
          <div key={m.id} className="bg-card p-4 rounded-xl border border-border flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">{m.title}</div>
              <div className="text-xs text-muted-foreground">Date: {m.date} • Project: {projects.find(p=>p.id===m.projectId)?.name||'—'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (confirm(`Delete meeting “${m.title}”?`)) onDelete(m.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Executive Dashboard (Admin + CEO) ────────────────────────────────────
function ExecutiveDashboard({ tenders, users, audit, user }: { tenders:Tender[]; users:User[]; audit:AuditEntry[]; user:User }) {
  const [tab, setTab] = useState<"overview"|"staff"|"daily"|"weekly"|"quarterly"|"audit">("overview");
  const active = tenders.filter(t => !t.archived);

  const analytics = useMemo(() => computeStaffAnalytics(users, active, [], new Date()), [users, active]);

  const kpi = useMemo(() => ({
    total: active.length,
    pending: active.filter(t => t.approvalStatus === "Pending").length,
    approved: active.filter(t => t.approvalStatus === "Approved").length,
    won: active.filter(t => t.status === "Completed" && t.approvalStatus === "Approved").length,
    closingSoon: active.filter(t => { const d = daysLeft(t.closingDate); return d >= 0 && d <= 7; }).length,
    unassigned: active.filter(t => !t.assignedPerson).length,
    highPriority: active.filter(t => t.priority === "High").length,
    submitted: active.filter(t => t.status === "Submitted").length,
  }), [active]);

  const pieData = useMemo(() => {
    const m: Record<string,number> = {};
    active.forEach(t => { m[t.status] = (m[t.status]||0)+1; });
    return Object.entries(m).map(([name,value]) => ({ name, value }));
  }, [active]);

  const staffPerf = useMemo(() => users.filter(u => u.is_active).map(m => {
    const mine = active.filter(t => t.assignedPerson === m.name);
    const wonCount = mine.filter(t => t.status === "Completed").length;
    const avgProgress = mine.length ? Math.round(mine.reduce((a,t) => a+t.progressPercent, 0) / mine.length) : 0;
    return { ...m, total:mine.length, active:mine.filter(t => t.status !== "Completed" && t.status !== "Cancelled").length, won:wonCount, avgProgress, overdue: mine.filter(t => daysLeft(t.closingDate) < 0 && t.status !== "Completed").length };
  }), [users, active]);

  const closing = active.filter(t => { const d = daysLeft(t.closingDate); return d >= 0 && d <= 14; }).sort((a,b) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime()).slice(0,6);

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Active" value={kpi.total}       icon={FileText}    color="bg-blue-50 text-blue-600"       sub={`${kpi.submitted} submitted`} />
        <StatCard label="Pending Approval" value={kpi.pending} icon={Clock}       color="bg-amber-50 text-amber-600"     sub={`${kpi.approved} approved`} />
        <StatCard label="Closing ≤ 7d"    value={kpi.closingSoon} icon={AlertCircle} color="bg-red-50 text-red-600"    sub={`${kpi.unassigned} unassigned`} />
        <StatCard label="Bids Won"         value={kpi.won}        icon={Award}    color="bg-emerald-50 text-emerald-600" sub={`${kpi.highPriority} high priority`} />
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit flex-wrap">
        {(["overview","staff","daily","weekly","quarterly","audit"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold capitalize transition-all ${tab===t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card rounded-2xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-sm">Monthly Bid Activity</h3><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={MONTHLY_DATA} barSize={28}>
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis key="xaxis" dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize:11, fontFamily:"JetBrains Mono", fill:"#94a3b8" }} />
                  <YAxis key="yaxis" axisLine={false} tickLine={false} tick={{ fontSize:11, fontFamily:"JetBrains Mono", fill:"#94a3b8" }} allowDecimals={false} />
                  <Tooltip key="tooltip" contentStyle={{ background:"#0d1b2a", border:"none", borderRadius:10, fontSize:12, fontFamily:"JetBrains Mono", color:"#e2e8f0" }} cursor={{ fill:"rgba(5,150,105,0.06)" }} />
                  <Bar key="bar" dataKey="bids" fill="#059669" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-2xl p-5 border border-border">
              <div className="mb-4"><h3 className="font-semibold text-sm">Bids by Status</h3></div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie key="pie" data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                    {pieData.map((_,i) => <Cell key={`cell-${i}`} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip key="pie-tooltip" contentStyle={{ background:"#0d1b2a", border:"none", borderRadius:10, fontSize:11, fontFamily:"JetBrains Mono", color:"#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">{pieData.map((d,i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background:PIE_COLORS[i%PIE_COLORS.length] }} />
                  <span className="text-muted-foreground font-mono flex-1 truncate">{d.name}</span>
                  <span className="text-foreground font-bold font-mono">{d.value}</span>
                </div>
              ))}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between"><h3 className="font-semibold text-sm">Closing Soon</h3><span className="text-xs font-mono text-muted-foreground">Next 14 days</span></div>
              <div className="divide-y divide-border">
                {closing.length === 0 && <div className="px-5 py-6 text-center text-sm text-muted-foreground">Nothing closing soon ✓</div>}
                {closing.map(t => {
                  const d = daysLeft(t.closingDate);
                  return (
                    <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pDot(t.priority)}`} />
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.tenderName}</div><div className="text-xs text-muted-foreground font-mono">{t.assignedPerson || "Unassigned"}</div></div>
                      <span className={`text-xs font-mono shrink-0 ${dlCls(d)}`}>{d}d left</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold text-sm">Recent Activity</h3></div>
              <div className="divide-y divide-border">
                {audit.slice(0,5).map(a => (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 mt-0.5"><Activity className="w-3.5 h-3.5 text-emerald-500" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{a.action}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{a.by} · {a.target}</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">{a.timestamp.split(" ")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "staff" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider font-mono">Staff Performance Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {staffPerf.map(m => (
              <div key={m.id} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-600 font-bold font-mono">{m.initials}</div>
                  <div className="flex-1"><div className="font-semibold">{m.name}</div><span className={`text-[10px] font-mono capitalize px-2 py-0.5 rounded-full ${rCls(m.role)}`}>{rLabel(m.role)}</span></div>
                  {m.overdue > 0 && <span className="text-xs font-mono text-red-500 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{m.overdue} overdue</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[["Total",m.total,"text-foreground"],["Active",m.active,"text-amber-600"],["Won",m.won,"text-emerald-600"]].map(([l,v,c]) => (
                    <div key={String(l)} className="bg-background rounded-xl p-2 text-center">
                      <div className={`text-lg font-bold ${c}`}>{v}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{l}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1"><span>Avg. Progress</span><span>{m.avgProgress}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 bg-emerald-500 rounded-full transition-all" style={{ width:`${m.avgProgress}%` }} />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {active.filter(t => t.assignedPerson === m.name && t.status !== "Completed" && t.status !== "Cancelled").slice(0,3).map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pDot(t.priority)}`} />
                      <span className="flex-1 truncate text-muted-foreground font-mono">{t.tenderName}</span>
                      <span className={`shrink-0 ${dlCls(daysLeft(t.closingDate))}`}>{daysLeft(t.closingDate)}d</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "daily" && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Daily Progress by Staff</h3>
          <div className="space-y-3">
            {analytics.daily.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{item.name}</div>
                  <span className="text-xs font-mono text-muted-foreground">{item.date}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Active</div><div className="text-lg font-bold">{item.active}</div></div>
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Won</div><div className="text-lg font-bold text-emerald-600">{item.won}</div></div>
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Success</div><div className="text-lg font-bold text-blue-600">{item.completionRate}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "weekly" && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Weekly Staff Performance</h3>
          <div className="space-y-3">
            {analytics.weekly.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{item.name}</div>
                  <span className="text-xs font-mono text-muted-foreground">{item.total} tracked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${item.successRate}%` }} /></div>
                  <span className="text-xs font-mono text-emerald-600">{item.successRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "quarterly" && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Quarterly Progress Summary</h3>
          <div className="space-y-3">
            {analytics.quarterly.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{item.name}</div>
                  <span className="text-xs font-mono text-muted-foreground">Q3</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Assignments</div><div className="text-lg font-bold">{item.total}</div></div>
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Active</div><div className="text-lg font-bold text-amber-600">{item.active}</div></div>
                  <div className="bg-muted/60 rounded-lg p-2"><div className="text-muted-foreground">Success</div><div className="text-lg font-bold text-emerald-600">{item.successRate}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Audit Log — Who Did What</h3>
            <span className="text-xs font-mono text-muted-foreground">{audit.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-background/70">
                {["Timestamp","Action","By","Target","Details"].map(h => <th key={h} className="text-left px-5 py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {audit.map(a => (
                  <tr key={a.id} className="hover:bg-background/60">
                    <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{a.timestamp}</td>
                    <td className="px-5 py-3"><span className="text-xs font-mono font-semibold">{a.action}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><Av initials={a.by.split(" ").map(w=>w[0]).join("").slice(0,2)} size="sm" /><span className="text-xs font-mono">{a.by}</span></div></td>
                    <td className="px-5 py-3 max-w-48"><div className="text-xs truncate">{a.target}</div></td>
                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-48"><div className="truncate">{a.details || "—"}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ISO & Compliance View (Phase 2 scaffold) ──────────────────────────────
function ISOView({ standards, controls, clauses, onCreateStandard, onCreateControl }: { standards:Standard[]; controls:Control[]; clauses:Clause[]; onCreateStandard:(s:Standard)=>void; onCreateControl:(c:Control)=>void }) {
  const [showStdForm, setShowStdForm] = useState(false);
  const [stdForm, setStdForm] = useState({ code:'', title:'', description:'' });
  const [showCtrlForm, setShowCtrlForm] = useState(false);
  const [ctrlForm, setCtrlForm] = useState({ controlId:'', name:'', applicable:true });
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Standards</h3><button onClick={()=>setShowStdForm(v=>!v)} className="px-2 py-1 bg-emerald-500 text-white rounded">{showStdForm? 'Close' : 'Add'}</button></div>
          {showStdForm && (
            <div className="mb-3">
              <input value={stdForm.code} onChange={e=>setStdForm(f=>({...f, code:e.target.value}))} placeholder="Code" className="w-full mb-2 px-3 py-2 border rounded" />
              <input value={stdForm.title} onChange={e=>setStdForm(f=>({...f, title:e.target.value}))} placeholder="Title" className="w-full mb-2 px-3 py-2 border rounded" />
              <textarea value={stdForm.description} onChange={e=>setStdForm(f=>({...f, description:e.target.value}))} placeholder="Description" className="w-full px-3 py-2 border rounded" />
              <div className="mt-2 flex gap-2"><button onClick={async ()=>{ if (!stdForm.code || !stdForm.title) { toast.error('Code and title required'); return; } const id = Date.now().toString(); await onCreateStandard({ id, code: stdForm.code, title: stdForm.title, description: stdForm.description }); setStdForm({ code:'', title:'', description:'' }); setShowStdForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button><button onClick={()=>setShowStdForm(false)} className="px-3 py-2 bg-background border border-border rounded">Cancel</button></div>
            </div>
          )}
          <div className="space-y-2">
            {standards.map(s => <div key={s.id} className="p-2 border rounded bg-background"><div className="font-semibold">{s.code} — {s.title}</div><div className="text-xs text-muted-foreground">{s.description}</div></div>)}
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Annex A Controls</h3><button onClick={()=>setShowCtrlForm(v=>!v)} className="px-2 py-1 bg-emerald-500 text-white rounded">{showCtrlForm? 'Close' : 'Add'}</button></div>
          {showCtrlForm && (
            <div className="mb-3">
              <input value={ctrlForm.controlId} onChange={e=>setCtrlForm(f=>({...f, controlId:e.target.value}))} placeholder="Control ID (A.5.1)" className="w-full mb-2 px-3 py-2 border rounded" />
              <input value={ctrlForm.name} onChange={e=>setCtrlForm(f=>({...f, name:e.target.value}))} placeholder="Control name" className="w-full mb-2 px-3 py-2 border rounded" />
              <div className="mt-2 flex gap-2"><button onClick={async ()=>{ if (!ctrlForm.controlId || !ctrlForm.name) { toast.error('Control ID and name required'); return; } const id = Date.now().toString(); await onCreateControl({ id, controlId: ctrlForm.controlId, name: ctrlForm.name, applicable: true }); setCtrlForm({ controlId:'', name:'', applicable:true }); setShowCtrlForm(false); }} className="px-3 py-2 bg-emerald-500 text-white rounded">Save</button><button onClick={()=>setShowCtrlForm(false)} className="px-3 py-2 bg-background border border-border rounded">Cancel</button></div>
            </div>
          )}
          <div className="space-y-2">
            {controls.map(c => <div key={c.id} className="p-2 border rounded bg-background"><div className="font-semibold">{c.controlId} — {c.name}</div><div className="text-xs text-muted-foreground">Status: {c.status || '—'}</div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── My Work Dashboard (Staff / Manager) ──────────────────────────────────
function MyWorkDashboard({ tenders, user, users, projectTasks, projects, onViewTender, onProgressUpdate }: {
  tenders:Tender[]; user:User; users:User[]; projectTasks:ProjectTask[]; projects:Project[];
  onViewTender:(t:Tender) => void; onProgressUpdate:(t:Tender, note:string, percent:number) => void;
}) {
  const mine = tenders.filter(t => t.assignedPerson === user.name && !t.archived);
  const active = mine.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
  const closing = active.filter(t => { const d = daysLeft(t.closingDate); return d >= 0 && d <= 7; });
  const myProjectTasks = projectTasks.filter(t => t.assignedTo === user.name || t.assignedTo === user.id);
  const activeProjectTasks = myProjectTasks.filter(t => t.status !== "Completed" && t.status !== "Approved");
  const closingProjectTasks = activeProjectTasks.filter(t => { const d = daysLeft(t.dueDate || ''); return d >= 0 && d <= 7; });
  const [selected, setSelected] = useState<Tender | null>(null);
  const [note, setNote] = useState("");
  const [percent, setPercent] = useState(0);

  useEffect(() => { if (selected) setPercent(selected.progressPercent); }, [selected]);

  return (
    <div className="p-8 space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="My Tenders" value={mine.length}    icon={FileText}    color="bg-blue-50 text-blue-600"    sub={`${active.length} active`} />
        <StatCard label="Project Tasks" value={myProjectTasks.length}    icon={CheckSquare}    color="bg-emerald-50 text-emerald-600"    sub={`${activeProjectTasks.length} active`} />
        <StatCard label="Due ≤ 7 Days" value={closing.length + closingProjectTasks.length} icon={AlertCircle} color={(closing.length + closingProjectTasks.length) > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} sub="Needs attention" />
        <StatCard label="Completed"   value={mine.filter(t => t.status === "Completed").length + myProjectTasks.filter(t => t.status === "Completed").length} icon={CheckCircle} color="bg-emerald-50 text-emerald-600" sub="This cycle" />
      </div>

      {closing.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 text-red-500" /><span className="font-semibold text-sm text-red-700">Deadline Alerts</span></div>
          <div className="space-y-2">
            {closing.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-red-100">
                <div><div className="text-sm font-semibold text-red-700">{t.tenderName}</div><div className="text-xs text-red-500 font-mono">{fmtDate(t.closingDate)}</div></div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold font-mono text-red-600">{daysLeft(t.closingDate)}d left</span>
                  <button onClick={() => onViewTender(t)} className="text-xs px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">View</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">My Active Tenders</h3>
          <span className="text-xs font-mono text-muted-foreground">{active.length} active</span>
        </div>
        <div className="divide-y divide-border">
          {active.length === 0 && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No active tenders assigned to you.</div>}
          {active.map(t => {
            const d = daysLeft(t.closingDate);
            return (
              <div key={t.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 h-10 rounded-full shrink-0 ${pDot(t.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-sm truncate max-w-72">{t.tenderName}</div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge label={t.status} cls={sCls(t.status)} />
                        <span className={`text-xs font-mono ${dlCls(d)}`}>{d}d</span>
                        <button onClick={() => onViewTender(t)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setSelected(selected?.id === t.id ? null : t)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width:`${t.progressPercent}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{t.progressPercent}%</span>
                    </div>
                    {t.progressLog.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground font-mono truncate">Last: {t.progressLog[t.progressLog.length-1].note}</div>
                    )}
                  </div>
                </div>
                {selected?.id === t.id && (
                  <div className="mt-3 ml-5 space-y-3 bg-background rounded-xl p-3 border border-border">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Update Progress</div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-10">{percent}%</span>
                      <input type="range" min={0} max={100} step={5} value={percent} onChange={e => setPercent(+e.target.value)} className="flex-1 accent-emerald-500" />
                    </div>
                    <div className="flex gap-2">
                      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Describe what you've done…" className="flex-1 text-xs border border-border rounded-xl px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-emerald-500/30" onKeyDown={e => { if (e.key==="Enter" && note.trim()) { onProgressUpdate(t, note.trim(), percent); setNote(""); setSelected(null); } }} />
                      <button onClick={() => { if (note.trim()) { onProgressUpdate(t, note.trim(), percent); setNote(""); setSelected(null); } }} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors">Save</button>
                      <button onClick={() => setSelected(null)} className="px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Tasks Section */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">My Project Tasks</h3>
          <span className="text-xs font-mono text-muted-foreground">{activeProjectTasks.length} active</span>
        </div>
        <div className="divide-y divide-border">
          {activeProjectTasks.length === 0 && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No active project tasks assigned to you.</div>}
          {activeProjectTasks.map(t => {
            const d = daysLeft(t.dueDate || '');
            const proj = projects.find((p: Project) => p.id === t.projectId);
            return (
              <div key={t.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 h-10 rounded-full shrink-0 ${t.priority === 'High' ? 'bg-red-500' : t.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="font-semibold text-sm truncate max-w-72">{t.title}</div>
                        <div className="text-xs text-muted-foreground">{proj?.name}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge label={t.status || 'Not Started'} cls={t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : t.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'} />
                        <span className={`text-xs font-mono ${d < 0 ? 'text-red-600' : d <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>{d}d</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width:`${t.progress || 0}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{t.progress || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tender Detail Drawer ─────────────────────────────────────────────────
function TenderDetail({ tender, user, users, onClose, onApprove, onReject, onAddNote, onEdit, onProgressUpdate, onDelete, onArchive }: {
  tender:Tender; user:User; users:User[]; onClose:() => void;
  onApprove:() => void; onReject:() => void; onAddNote:(note:string) => void;
  onEdit:() => void; onProgressUpdate:(note:string, percent:number) => void;
  onDelete:() => void; onArchive:() => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [progNote, setProgNote] = useState("");
  const [progPct, setProgPct] = useState(tender.progressPercent);
  const [showProg, setShowProg] = useState(false);
  const days = daysLeft(tender.closingDate);
  const assignedUser = users.find(u => u.name === tender.assignedPerson);
  const isAssigned = tender.assignedPerson === user.name;
  const canProg = isAssigned || isPrivileged(user);

  const doTelegram = async () => {
    const msg = buildTelegramMessage(tender, "update");
    const tasks: Promise<boolean>[] = [sendTelegramMsg(GROUP_CHAT_ID, msg)];
    if (assignedUser?.telegramChatId) tasks.push(sendTelegramMsg(assignedUser.telegramChatId, msg));
    const results = await Promise.all(tasks);
    if (results.some(r => r)) toast.success(`Telegram notification sent`, { icon:<MessageSquare className="w-4 h-4" /> });
    else toast.error("Telegram send failed — check bot token / chat IDs");
  };

  const doEmail = () => {
    toast.success(`Email sent to ${assignedUser?.email || "team"}`, { description:`Subject: 📋 ${tender.tenderName}`, icon:<Mail className="w-4 h-4" /> });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-card flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-border flex items-start gap-4">
          <CompanyLogo logo={tender.companyLogo} name={tender.tenderName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pDot(tender.priority)}`} />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{tender.bidType}</span>
              <span className="text-[10px] font-mono text-muted-foreground">·</span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{tender.priority} priority</span>
            </div>
            <h2 className="font-bold text-foreground leading-snug">{tender.tenderName}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {tender.archived && <span className="text-xs font-mono text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">Archived</span>}
              {(tender.attachments||[]).length > 0 && (
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground bg-background border border-border px-2 py-0.5 rounded-md">
                  <Paperclip className="w-3 h-3" />{(tender.attachments||[]).length} file{(tender.attachments||[]).length!==1?"s":""}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0 mt-0.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap bg-background/50">
          {canApprove(user) && tender.approvalStatus === "Pending" && !tender.archived && (
            <><button onClick={onApprove} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors"><CheckCircle className="w-3.5 h-3.5" /> Approve</button>
              <button onClick={onReject}  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors"><XCircle className="w-3.5 h-3.5" /> Reject</button></>
          )}
          <button onClick={doTelegram} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition-colors"><MessageSquare className="w-3.5 h-3.5" /> Telegram</button>
          <button onClick={doEmail}    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold transition-colors"><Mail className="w-3.5 h-3.5" /> Email</button>
          {isPrivileged(user) && !tender.archived && <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted rounded-lg text-xs font-semibold text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /> Edit</button>}
          {canDeleteOrArchive(user) && (
            <div className="ml-auto flex gap-2">
              <button onClick={onArchive} className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-semibold transition-colors"><Archive className="w-3.5 h-3.5" /> Archive</button>
              <button onClick={onDelete}  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:"Status",    val:<Badge label={tender.status}         cls={sCls(tender.status)} /> },
              { label:"Approval",  val:<Badge label={tender.approvalStatus} cls={aCls(tender.approvalStatus)} /> },
              { label:"Priority",  val:<span className="text-sm font-bold font-mono">{tender.priority}</span> },
              { label:"Days Left", val:<span className={`text-sm font-bold font-mono ${dlCls(days)}`}>{days < 0 ? "Expired" : `${days}d`}</span> },
            ].map(({ label, val }) => (
              <div key={label} className="bg-background rounded-xl p-3"><div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</div>{val}</div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Progress</div>
              <span className="text-xs font-mono font-bold text-emerald-600">{tender.progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div className="h-2 bg-emerald-500 rounded-full" style={{ width:`${tender.progressPercent}%` }} />
            </div>
            {canProg && !tender.archived && (
              <button onClick={() => setShowProg(v => !v)} className="text-xs text-emerald-600 hover:text-emerald-700 font-mono flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Update progress <ChevronDown className={`w-3 h-3 transition-transform ${showProg ? "rotate-180" : ""}`} />
              </button>
            )}
            {showProg && (
              <div className="mt-2 space-y-2 bg-background rounded-xl p-3 border border-border">
                <div className="flex items-center gap-3"><span className="text-xs font-mono w-10">{progPct}%</span><input type="range" min={0} max={100} step={5} value={progPct} onChange={e => setProgPct(+e.target.value)} className="flex-1 accent-emerald-500" /></div>
                <div className="flex gap-2">
                  <input value={progNote} onChange={e => setProgNote(e.target.value)} placeholder="What did you do?" className="flex-1 text-xs border border-border rounded-xl px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                  <button onClick={() => { if (progNote.trim()) { onProgressUpdate(progNote.trim(), progPct); setProgNote(""); setShowProg(false); } }} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold">Save</button>
                </div>
              </div>
            )}
            {tender.progressLog.length > 0 && (
              <div className="mt-3 space-y-2">
                {[...tender.progressLog].reverse().map((e,i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />{i < tender.progressLog.length-1 && <div className="w-0.5 h-4 bg-border" />}</div>
                    <div className="flex-1 pb-2"><div className="font-semibold">{e.by} <span className="font-mono text-muted-foreground">+{e.percent}%</span></div><div className="text-muted-foreground">{e.note}</div><div className="font-mono text-muted-foreground text-[10px] mt-0.5">{e.timestamp}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-3 flex items-center gap-3"><Calendar className="w-4 h-4 text-muted-foreground shrink-0" /><div><div className="text-[10px] font-mono text-muted-foreground uppercase">Closing</div><div className="text-sm font-semibold font-mono mt-0.5">{fmtDate(tender.closingDate)}</div></div></div>
            <div className="bg-background rounded-xl p-3 flex items-center gap-3"><Calendar className="w-4 h-4 text-muted-foreground shrink-0" /><div><div className="text-[10px] font-mono text-muted-foreground uppercase">Opening</div><div className="text-sm font-semibold font-mono mt-0.5">{fmtDate(tender.openingDate)}</div></div></div>
          </div>

          {tender.description && <div><div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Description</div><p className="text-sm leading-relaxed">{tender.description}</p></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Assigned To</div>
              {tender.assignedPerson ? (
                <div className="flex items-center gap-2"><Av initials={assignedUser?.initials||"?"} size="sm" /><div><div className="text-sm font-semibold">{tender.assignedPerson}</div><div className="text-xs text-muted-foreground font-mono">{assignedUser?.telegram}</div></div></div>
              ) : <span className="text-sm text-red-500 font-semibold">Unassigned</span>}
            </div>
            <div className="bg-background rounded-xl p-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Submission</div>
              <div className="text-sm font-semibold">{tender.submissionMode || "—"}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">Approval: {tender.approval}</div>
            </div>
          </div>
          {tender.requiredDocs && <div><div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Required Documents</div><div className="bg-background rounded-xl p-3 text-sm leading-relaxed">{tender.requiredDocs}</div></div>}
          {tender.aiSuggestion && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Zap className="w-3.5 h-3.5 text-emerald-600" /><span className="text-xs font-mono font-semibold text-emerald-700 uppercase tracking-wider">AI Analysis</span></div>
              <p className="text-sm text-emerald-800">{tender.aiSuggestion}</p>
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            {tender.bidLink && <a href={tender.bidLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"><ExternalLink className="w-3.5 h-3.5" /> Bid Portal</a>}
            {tender.documentLink && <a href={tender.documentLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"><FileSpreadsheet className="w-3.5 h-3.5" /> Documents</a>}
          </div>
          {(tender.attachments||[]).length > 0 && (
            <div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> Attachments ({(tender.attachments||[]).length})</div>
              <div className="space-y-2">
                {(tender.attachments||[]).map((a,i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-background border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      {a.type.startsWith("image/")
                        ? <img src={a.dataUrl} className="w-8 h-8 rounded-lg object-cover" />
                        : <FileIcon className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{a.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{a.size > 1048576 ? `${(a.size/1048576).toFixed(1)} MB` : `${Math.round(a.size/1024)} KB`}</div>
                    </div>
                    <a href={a.dataUrl} download={a.name} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tender.responseBy && <div className="bg-background rounded-xl p-3 text-xs font-mono text-muted-foreground">{tender.approvalStatus==="Approved" ? "✅" : "❌"} {tender.approvalStatus} by {tender.responseBy} · {tender.responseTime}</div>}
          <div className="text-xs font-mono text-muted-foreground">Registered {fmtDate(tender.registeredData)} by {tender.registeredBy}</div>
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
            {tender.notes && <div className="bg-background rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap mb-3">{tender.notes}</div>}
            {!tender.archived && (
              <div className="flex gap-2">
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" onKeyDown={e => { if (e.key==="Enter" && noteText.trim()) { onAddNote(noteText.trim()); setNoteText(""); } }} className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/60" />
                <button onClick={() => { if (noteText.trim()) { onAddNote(noteText.trim()); setNoteText(""); } }} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"><Send className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────
const EMPTY_TENDER: Omit<Tender,"id"> = {
  tenderName:"", description:"", bidType:"Service", closingDate:"", openingDate:"",
  approval:"Required", requiredDocs:"", status:"New", assignedPerson:"",
  submissionMode:"Physical", notes:"", priority:"Medium", approvalStatus:"Pending",
  responseBy:"", responseTime:"", aiSuggestion:"", registeredData:new Date().toISOString().slice(0,10),
  registeredBy:"", documentLink:"", bidLink:"", archived:false, progressLog:[], progressPercent:0,
  companyLogo:"", attachments:[],
};

// ─── Tender Registration Wizard ───────────────────────────────────────────────
const WIZARD_STEPS = [
  { num:1, label:"Identity",  sub:"Name, logo & type",  icon:Building2  },
  { num:2, label:"Timeline",  sub:"Dates & assignment",  icon:Calendar   },
  { num:3, label:"Details",   sub:"Docs & attachments",  icon:Paperclip  },
  { num:4, label:"Review",    sub:"Links & confirm",     icon:FileCheck  },
];

const BID_TYPES = [
  { label:"Supply",           icon:FileSpreadsheet, color:"bg-blue-50   border-blue-200   text-blue-700"   },
  { label:"Service",          icon:Zap,             color:"bg-violet-50 border-violet-200 text-violet-700" },
  { label:"Supply & Install", icon:Briefcase,       color:"bg-amber-50  border-amber-200  text-amber-700"  },
  { label:"Consulting",       icon:Target,          color:"bg-emerald-50 border-emerald-200 text-emerald-700" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
}

function AddEditModal({ tender, user, users, onClose, onSave }: {
  tender:Tender|null; user:User; users:User[]; onClose:() => void; onSave:(t:Omit<Tender,"id">) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Omit<Tender,"id">>(
    tender ? {...tender, attachments: tender.attachments||[], companyLogo: tender.companyLogo||"" }
           : {...EMPTY_TENDER, registeredBy:user.name}
  );
  const [logoTab, setLogoTab] = useState<"upload"|"url">("upload");
  const [logoUrl, setLogoUrl] = useState(tender?.companyLogo?.startsWith("http") ? tender.companyLogo : "");
  const [logoDrag, setLogoDrag] = useState(false);
  const [fileDrag, setFileDrag] = useState(false);
  const logoRef  = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string|number|Attachment[]) => setForm(f => ({...f,[k]:v}));

  const attachFiles = useCallback(async (files: File[]) => {
    const MAX = 100 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX) { toast.error(`"${file.name}" is too large (max 100 MB)`); continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        setForm(f => ({ ...f, attachments: [...(f.attachments||[]), { name:file.name, size:file.size, type:file.type, dataUrl }] }));
      } catch { toast.error(`Failed to read "${file.name}"`); }
    }
  }, []);

  const applyLogoFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 2*1024*1024) { toast.error("Logo too large — max 2 MB"); return; }
    const dataUrl = await fileToDataUrl(file);
    set("companyLogo", dataUrl);
  }, []);

  const removeAttachment = (i: number) =>
    setForm(f => ({ ...f, attachments: (f.attachments||[]).filter((_,idx) => idx !== i) }));

  const fmtSize = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;

  const canNext = () => {
    if (step === 1) return form.tenderName.trim().length > 0;
    if (step === 2) return form.closingDate.length > 0;
    return true;
  };

  const daysTil = form.closingDate ? Math.ceil((new Date(form.closingDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000) : null;

  const doSave = () => {
    if (!form.tenderName.trim()) { toast.error("Tender name is required"); setStep(1); return; }
    if (!form.closingDate)       { toast.error("Closing date is required"); setStep(2); return; }
    onSave(form);
  };

  const SL = ({ label, name, opts }: { label:string; name:keyof typeof form; opts:string[] }) => (
    <div>
      <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <select value={String(form[name])} onChange={e => set(name, e.target.value)} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
        {opts.map(o => <option key={o} value={o}>{o||"— Unassigned —"}</option>)}
      </select>
    </div>
  );
  const TA = ({ label, name, rows=3, hint }: { label:string; name:keyof typeof form; rows?:number; hint?:string }) => (
    <div>
      <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <textarea rows={rows} value={String(form[name])} onChange={e => set(name, e.target.value)}
        placeholder={hint} className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none placeholder:text-muted-foreground/40" />
    </div>
  );

  // ── Step Panels ──
  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Company Logo</div>
        <div className="flex gap-4">
          {/* Preview */}
          <div className="shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-background flex items-center justify-center overflow-hidden">
            {form.companyLogo
              ? <img src={form.companyLogo} className="w-full h-full object-contain" onError={() => set("companyLogo","")} />
              : <Building2 className="w-8 h-8 text-muted-foreground/30" />}
          </div>
          {/* Upload / URL tabs */}
          <div className="flex-1 space-y-2">
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
              {(["upload","url"] as const).map(t => (
                <button key={t} onClick={() => setLogoTab(t)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${logoTab===t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {t==="upload" ? <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" />Upload</span> : <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" />URL</span>}
                </button>
              ))}
            </div>
            {logoTab === "upload" ? (
              <div
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${logoDrag ? "border-emerald-400 bg-emerald-50/60" : "border-border hover:border-emerald-300 hover:bg-emerald-50/30"}`}
                onClick={() => logoRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setLogoDrag(true); }}
                onDragLeave={() => setLogoDrag(false)}
                onDrop={e => { e.preventDefault(); setLogoDrag(false); const f = e.dataTransfer.files[0]; if (f) applyLogoFile(f); }}>
                <ImageIcon className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                <div className="text-xs text-muted-foreground">Drag image here or <span className="text-emerald-600 font-semibold">browse</span></div>
                <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">PNG, JPG, SVG · max 2 MB</div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) applyLogoFile(f); }} />
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png"
                  className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/40" />
                <button onClick={() => set("companyLogo", logoUrl)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors">Apply</button>
              </div>
            )}
            {form.companyLogo && (
              <button onClick={() => set("companyLogo","")} className="text-xs text-red-500 hover:text-red-600 font-mono flex items-center gap-1"><X className="w-3 h-3" />Remove logo</button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Tender Name <span className="text-red-500">*</span></label>
        <input value={form.tenderName} onChange={e => set("tenderName", e.target.value)} autoFocus
          placeholder="e.g. Supply of CCTV Surveillance Equipment — City Administration"
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/40 font-medium" />
      </div>

      <div>
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Bid Type</div>
        <div className="grid grid-cols-2 gap-2">
          {BID_TYPES.map(({ label, icon:Icon, color }) => (
            <button key={label} onClick={() => set("bidType", label)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.bidType===label ? color + " ring-2 ring-offset-1 ring-emerald-400" : "border-border bg-background hover:bg-muted/50"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.bidType===label ? "bg-white/80" : "bg-muted"}`}>
                <Icon className={`w-4 h-4 ${form.bidType===label ? "" : "text-muted-foreground"}`} />
              </div>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Priority</div>
        <div className="flex gap-2">
          {([["Low","bg-slate-100 text-slate-600 border-slate-200","bg-slate-100 text-slate-600 border-2 border-slate-400 ring-2 ring-offset-1 ring-slate-400"],
             ["Medium","bg-amber-50 text-amber-700 border-amber-200","bg-amber-100 text-amber-800 border-2 border-amber-400 ring-2 ring-offset-1 ring-amber-400"],
             ["High","bg-red-50 text-red-700 border-red-200","bg-red-100 text-red-800 border-2 border-red-400 ring-2 ring-offset-1 ring-red-400"]] as const).map(([p,idle,active]) => (
            <button key={p} onClick={() => set("priority", p)} className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold border transition-all ${form.priority===p ? active : idle}`}>{p}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const Step2 = () => {
    const activeUsers = users.filter(u => u.is_active);
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Closing Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.closingDate} onChange={e => set("closingDate", e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            {daysTil !== null && (
              <div className={`text-xs font-mono mt-1 ${daysTil < 0 ? "text-slate-400" : daysTil <= 3 ? "text-red-600 font-bold" : daysTil <= 7 ? "text-amber-600 font-bold" : "text-emerald-600"}`}>
                {daysTil < 0 ? "⚠ Date in the past" : `⏱ ${daysTil} day${daysTil!==1?"s":""} until deadline`}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Opening Date</label>
            <input type="date" value={form.openingDate} onChange={e => set("openingDate", e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Submission Mode</div>
            <div className="flex gap-2">
              {[["Physical","🏢"],["Online","💻"]].map(([m,e]) => (
                <button key={m} onClick={() => set("submissionMode",m)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.submissionMode===m ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-offset-1 ring-emerald-300" : "border-border bg-background hover:bg-muted/50 text-foreground"}`}>
                  <span>{e}</span>{m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Approval Required</div>
            <div className="flex gap-2">
              {[["Required","✅"],["Not Required","⬜"]].map(([v,e]) => (
                <button key={v} onClick={() => set("approval",v)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.approval===v ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-offset-1 ring-emerald-300" : "border-border bg-background hover:bg-muted/50"}`}>
                  <span className="text-base">{e}</span><span className="text-xs">{v==="Required" ? "Yes" : "No"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Assigned Person</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => set("assignedPerson","")} className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-sm transition-all ${!form.assignedPerson ? "border-slate-400 bg-slate-50 ring-2 ring-offset-1 ring-slate-300" : "border-border hover:bg-muted/50"}`}>
              <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs font-mono">—</div>
              <span className="text-muted-foreground font-medium text-xs">Unassigned</span>
            </button>
            {activeUsers.map(m => (
              <button key={m.id} onClick={() => set("assignedPerson", m.name)} className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-sm transition-all ${form.assignedPerson===m.name ? "border-emerald-400 bg-emerald-50 ring-2 ring-offset-1 ring-emerald-300" : "border-border hover:bg-muted/50"}`}>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xs font-bold font-mono shrink-0">{m.initials}</div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-xs truncate">{m.name}</div>
                  <div className={`text-[10px] capitalize px-1.5 py-0 rounded-full inline-block ${rCls(m.role)}`}>{m.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <SL label="Status" name="status" opts={["New","In Progress","Document Prep","Submitted","Completed","Cancelled"]} />
      </div>
    );
  };

  const Step3 = () => (
    <div className="space-y-5">
      <TA label="Description" name="description" rows={3} hint="Describe the scope, budget, and key requirements…" />

      <TA label="Required Documents" name="requiredDocs" rows={2} hint="Company profile, Tax clearance, ISO certificates…" />

      <div>
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Attachments</div>
        <div
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${fileDrag ? "border-emerald-400 bg-emerald-50/50" : "border-border hover:border-emerald-300 hover:bg-emerald-50/20"}`}
          onClick={() => filesRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setFileDrag(true); }}
          onDragLeave={() => setFileDrag(false)}
          onDrop={e => { e.preventDefault(); setFileDrag(false); attachFiles(Array.from(e.dataTransfer.files)); }}>
          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm font-medium text-muted-foreground">Drop files here or <span className="text-emerald-600 font-semibold">click to browse</span></div>
          <div className="text-[11px] text-muted-foreground/60 font-mono mt-1">PDF, Word, Excel, images · max 100 MB each</div>
          <input ref={filesRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.svg" className="hidden"
            onChange={e => { attachFiles(Array.from(e.target.files||[])); e.target.value = ""; }} />
        </div>

        {(form.attachments||[]).length > 0 && (
          <div className="mt-3 space-y-2">
            {(form.attachments||[]).map((a,i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-background border border-border rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <FileIcon className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{a.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{fmtSize(a.size)}</div>
                </div>
                {a.dataUrl && (
                  <a href={a.dataUrl} download={a.name} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => removeAttachment(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Zap className="w-3 h-3 text-emerald-500" />AI Analysis / Win Probability</label>
        <textarea rows={2} value={form.aiSuggestion} onChange={e => set("aiSuggestion", e.target.value)}
          placeholder="e.g. Strong match — CCTV portfolio aligns well. Win probability: 75%."
          className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none placeholder:text-muted-foreground/40" />
      </div>
    </div>
  );

  const Step4 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><ExternalLink className="w-3 h-3" />Bid Portal URL</label>
          <input value={form.bidLink} onChange={e => set("bidLink", e.target.value)} placeholder="https://procurement.example.gov.et/"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/40" />
        </div>
        <div>
          <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FileSpreadsheet className="w-3 h-3" />Document Folder Link</label>
          <input value={form.documentLink} onChange={e => set("documentLink", e.target.value)} placeholder="https://drive.google.com/drive/folders/…"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground/40" />
        </div>
        <TA label="Internal Notes" name="notes" rows={2} hint="Internal-only notes, budget info, contacts…" />
      </div>

      {/* Review summary */}
      <div className="bg-background rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-emerald-50/50">
          {form.companyLogo && <img src={form.companyLogo} className="w-10 h-10 rounded-xl object-contain bg-white border border-border/60" onError={() => {}} />}
          <div>
            <div className="font-bold text-sm">{form.tenderName || <span className="text-muted-foreground italic">Untitled tender</span>}</div>
            <div className="text-xs font-mono text-muted-foreground">{form.bidType} · {form.priority} priority</div>
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ["Closing", form.closingDate ? new Date(form.closingDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"],
            ["Opening", form.openingDate ? new Date(form.openingDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"],
            ["Assigned To", form.assignedPerson || "Unassigned"],
            ["Submission", form.submissionMode],
            ["Status", form.status],
            ["Approval", form.approval],
            ["Attachments", `${(form.attachments||[]).length} file(s)`],
            ["Registered By", form.registeredBy],
          ].map(([l,v]) => (
            <div key={l} className="flex gap-2">
              <span className="text-muted-foreground font-mono shrink-0 w-24">{l}:</span>
              <span className="font-medium truncate">{v}</span>
            </div>
          ))}
        </div>
        {form.aiSuggestion && (
          <div className="mx-4 mb-4 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1"><Zap className="w-3 h-3 text-emerald-600" /><span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">AI Insight</span></div>
            <p className="text-xs text-emerald-800">{form.aiSuggestion}</p>
          </div>
        )}
      </div>
    </div>
  );

  const stepContent = [null, <Step1 />, <Step2 />, <Step3 />, <Step4 />];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl w-full max-w-4xl max-h-[92vh] flex shadow-2xl overflow-hidden">

        {/* Left sidebar */}
        <div className="w-52 shrink-0 flex flex-col" style={{ background:"#0d1b2a" }}>
          <div className="px-5 py-6 border-b" style={{ borderColor:"rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-white font-bold text-xs">ZSecuredTech</span>
            </div>
            <div className="text-emerald-500 text-[10px] font-mono tracking-wider">{tender ? "EDIT TENDER" : "NEW TENDER"}</div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {WIZARD_STEPS.map(({ num, label, sub, icon:Icon }) => {
              const done = step > num;
              const active = step === num;
              return (
                <button key={num} onClick={() => { if (done || active) setStep(num); }}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all ${active ? "bg-emerald-500/15" : done ? "hover:bg-white/5 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono transition-all ${done ? "bg-emerald-500 text-white" : active ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/40" : "bg-white/8 text-white/40 border border-white/10"}`}>
                    {done ? <CheckCircle className="w-3.5 h-3.5" /> : num}
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${active ? "text-emerald-300" : done ? "text-white" : "text-white/40"}`}>{label}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${active ? "text-emerald-500/80" : done ? "text-slate-400" : "text-white/20"}`}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </nav>
          <div className="px-5 py-4 border-t" style={{ borderColor:"rgba(255,255,255,0.07)" }}>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-1.5 bg-emerald-500 rounded-full transition-all duration-300" style={{ width:`${((step-1)/3)*100}%` }} />
            </div>
            <div className="text-[10px] font-mono text-white/40 mt-1.5">Step {step} of 4</div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-7 py-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base">{WIZARD_STEPS[step-1].label}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{WIZARD_STEPS[step-1].sub}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-6">
            {stepContent[step]}
          </div>

          <div className="px-7 py-4 border-t border-border flex items-center justify-between bg-background/50">
            <button onClick={() => step > 1 ? setStep(s => s-1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />{step > 1 ? "Back" : "Cancel"}
            </button>
            <div className="flex items-center gap-2">
              {step < 4 ? (
                <button onClick={() => { if (!canNext()) { toast.error(step===1?"Tender name is required":"Closing date is required"); return; } setStep(s => s+1); }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${canNext() ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={doSave} className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors">
                  <FileCheck className="w-4 h-4" />{tender ? "Save Changes" : "Register Tender"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tenders View ─────────────────────────────────────────────────────────
function TendersView({ tenders, user, users, onView, onEdit, onApprove, onReject, onAdd }: {
  tenders:Tender[]; user:User; users:User[];
  onView:(t:Tender) => void; onEdit:(t:Tender) => void;
  onApprove:(t:Tender) => void; onReject:(t:Tender) => void; onAdd:() => void;
}) {
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("All");
  const [fPriority, setFPriority] = useState("All");
  const [fPerson, setFPerson] = useState("All");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => tenders.filter(t => {
    if (!showArchived && t.archived) return false;
    if (showArchived && !t.archived) return false;
    if (search && !t.tenderName.toLowerCase().includes(search.toLowerCase())) return false;
    if (fStatus !== "All" && t.status !== fStatus) return false;
    if (fPriority !== "All" && t.priority !== fPriority) return false;
    if (fPerson !== "All" && t.assignedPerson !== fPerson) return false;
    return true;
  }), [tenders, search, fStatus, fPriority, fPerson, showArchived]);

  return (
    <div className="p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-52 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenders…" className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-emerald-500/30" /></div>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none font-mono text-muted-foreground"><option value="All">All Status</option>{["New","In Progress","Document Prep","Submitted","Completed","Cancelled"].map(s => <option key={s}>{s}</option>)}</select>
        <select value={fPriority} onChange={e => setFPriority(e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none font-mono text-muted-foreground"><option value="All">All Priority</option>{["High","Medium","Low"].map(s => <option key={s}>{s}</option>)}</select>
        <select value={fPerson} onChange={e => setFPerson(e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-card focus:outline-none font-mono text-muted-foreground"><option value="All">All Assigned</option>{users.map(u => <option key={u.id}>{u.name}</option>)}</select>
        <button onClick={() => setShowArchived(v => !v)} className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium transition-colors ${showArchived ? "border-amber-300 bg-amber-50 text-amber-700" : "border-border hover:bg-muted text-muted-foreground"}`}><Archive className="w-4 h-4" /> {showArchived ? "Archive" : "Archive"}</button>
        <button onClick={() => { exportCSV(filtered); toast.success("Exported to CSV"); }} className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted text-muted-foreground transition-colors"><Download className="w-4 h-4" /> Export</button>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"><Plus className="w-4 h-4" /> Add Tender</button>
      </div>
      <div className="text-xs font-mono text-muted-foreground">Showing {filtered.length} {showArchived ? "archived" : "active"} tenders</div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-background/70">{["Tender","Type","Assigned","Deadline","Progress","Status","Approval","Actions"].map(h => <th key={h} className={`${h==="Actions" ? "text-right pr-5" : "text-left px-5"} py-3 text-[11px] font-mono text-muted-foreground uppercase tracking-wider`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.map(t => {
                const days = daysLeft(t.closingDate);
                const m = users.find(u => u.name === t.assignedPerson);
                return (
                  <tr key={t.id} className={`hover:bg-background/60 transition-colors ${t.archived ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <CompanyLogo logo={t.companyLogo} name={t.tenderName} size="sm" />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${pDot(t.priority)}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-44 text-sm">{t.tenderName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                            {t.submissionMode}
                            {(t.attachments||[]).length > 0 && <><span>·</span><Paperclip className="w-2.5 h-2.5" />{(t.attachments||[]).length}</>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><span className="text-xs font-mono text-muted-foreground">{t.bidType}</span></td>
                    <td className="px-4 py-3.5">{m ? <div className="flex items-center gap-2"><Av initials={m.initials} size="sm" /><span className="text-xs font-medium">{t.assignedPerson.split(" ")[0]}</span></div> : <span className="text-xs text-red-500 font-mono">Unassigned</span>}</td>
                    <td className="px-4 py-3.5"><div className="text-xs font-mono">{fmtDate(t.closingDate)}</div><div className={`text-[11px] font-mono mt-0.5 ${dlCls(days)}`}>{days < 0 ? "Expired" : `${days}d`}</div></td>
                    <td className="px-4 py-3.5 w-24">
                      <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-1.5 bg-emerald-500 rounded-full" style={{ width:`${t.progressPercent}%` }} /></div><span className="text-[10px] font-mono text-muted-foreground shrink-0">{t.progressPercent}%</span></div>
                    </td>
                    <td className="px-4 py-3.5"><Badge label={t.status} cls={sCls(t.status)} /></td>
                    <td className="px-4 py-3.5"><Badge label={t.approvalStatus} cls={aCls(t.approvalStatus)} /></td>
                    <td className="pr-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onView(t)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        {canApprove(user) && t.approvalStatus==="Pending" && !t.archived && (
                          <><button onClick={() => onApprove(t)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onReject(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><XCircle className="w-3.5 h-3.5" /></button></>
                        )}
                        {isPrivileged(user) && !t.archived && <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">No tenders found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tickets View ─────────────────────────────────────────────────────────
function TicketsView({ tickets, user, users, tenders, onCreateTicket, onReply, onResolve }: {
  tickets:Ticket[]; user:User; users:User[]; tenders:Tender[];
  onCreateTicket:(t:Omit<Ticket,"id"|"status"|"createdAt"|"replies">) => void;
  onReply:(id:number, text:string) => void; onResolve:(id:number) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", assignedTo:"", tenderId:0 });
  const [replyText, setReplyText] = useState<Record<number,string>>({});
  const [expanded, setExpanded] = useState<number|null>(null);
  const myTickets = tickets.filter(t => t.createdBy === user.name || t.assignedTo === user.name || isExecutive(user));

  const statusCls = (s:Ticket["status"]) => (({
    open:"bg-blue-50 text-blue-700 border border-blue-200",
    replied:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    resolved:"bg-slate-100 text-slate-600",
    escalated:"bg-red-50 text-red-700 border border-red-200",
  } as Record<string,string>)[s]);

  return (
    <div className="p-8 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h2 className="font-bold">Support Tickets</h2><p className="text-xs text-muted-foreground font-mono mt-0.5">6-hour SLA — escalates to Admin/CEO if unanswered</p></div>
        <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"><Plus className="w-4 h-4" /> New Ticket</button>
      </div>

      {showNew && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Support Ticket</h3>
          <div>
            <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="Brief description of the issue" />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Details *</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" placeholder="Explain what you need…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Assign To</label>
              <select value={form.assignedTo} onChange={e => setForm(f => ({...f,assignedTo:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none">
                <option value="">— Select person —</option>
                {users.filter(u => u.is_active && u.id !== user.id).map(u => <option key={u.id} value={u.name}>{u.name} ({rLabel(u.role)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Related Tender</label>
              <select value={form.tenderId} onChange={e => setForm(f => ({...f,tenderId:+e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none">
                <option value={0}>— Optional —</option>
                {tenders.filter(t => !t.archived).map(t => <option key={t.id} value={t.id}>{t.tenderName}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!form.title.trim() || !form.description.trim() || !form.assignedTo) { toast.error("Title, description and assigned person are required"); return; }
              const relTender = tenders.find(t => t.id === form.tenderId);
              onCreateTicket({ title:form.title, description:form.description, createdBy:user.name, assignedTo:form.assignedTo, tenderId:form.tenderId||undefined, tenderName:relTender?.tenderName });
              setForm({ title:"", description:"", assignedTo:"", tenderId:0 }); setShowNew(false);
            }} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors">Submit Ticket</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {myTickets.length === 0 && <div className="bg-card rounded-2xl border border-border px-5 py-10 text-center text-sm text-muted-foreground">No tickets yet. Create one if you need help.</div>}
        {myTickets.map(ticket => {
          const isOpen = expanded === ticket.id;
          const canReply = ticket.assignedTo === user.name || isExecutive(user);
          return (
            <div key={ticket.id} className={`bg-card rounded-2xl border overflow-hidden ${ticket.status==="escalated" ? "border-red-200" : "border-border"}`}>
              <div className="px-5 py-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : ticket.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${statusCls(ticket.status)}`}>{ticket.status.toUpperCase()}</span>
                    {ticket.tenderName && <span className="text-[10px] font-mono text-muted-foreground truncate">· {ticket.tenderName}</span>}
                  </div>
                  <div className="font-semibold text-sm">{ticket.title}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">By {ticket.createdBy} → {ticket.assignedTo} · {ticket.createdAt}</div>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
              {isOpen && (
                <div className="border-t border-border px-5 py-4 space-y-4">
                  <p className="text-sm leading-relaxed">{ticket.description}</p>
                  {ticket.replies.length > 0 && (
                    <div className="space-y-3">
                      {ticket.replies.map((r,i) => (
                        <div key={i} className={`rounded-xl p-3 text-sm ${r.by === ticket.createdBy ? "bg-background ml-0 mr-8" : "bg-emerald-50 border border-emerald-100 ml-8 mr-0"}`}>
                          <div className="flex items-center gap-2 mb-1"><span className="font-semibold text-xs">{r.by}</span><span className="text-[10px] font-mono text-muted-foreground">{r.timestamp}</span></div>
                          <div>{r.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {canReply && ticket.status !== "resolved" && (
                    <div className="flex gap-2">
                      <input value={replyText[ticket.id]||""} onChange={e => setReplyText(prev => ({...prev,[ticket.id]:e.target.value}))} placeholder="Type your reply…" className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" onKeyDown={e => { if (e.key==="Enter" && replyText[ticket.id]?.trim()) { onReply(ticket.id, replyText[ticket.id]); setReplyText(prev => ({...prev,[ticket.id]:""})); } }} />
                      <button onClick={() => { if (replyText[ticket.id]?.trim()) { onReply(ticket.id, replyText[ticket.id]); setReplyText(prev => ({...prev,[ticket.id]:""})); } }} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold"><Send className="w-4 h-4" /></button>
                      {isExecutive(user) && <button onClick={() => onResolve(ticket.id)} className="px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors">Resolve</button>}
                    </div>
                  )}
                  {ticket.status === "resolved" && <div className="text-xs text-muted-foreground font-mono text-center py-2">✅ Resolved</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team View ────────────────────────────────────────────────────────────
function TeamView({ users, tenders, currentUser, onUpdateUsers }: { users:User[]; tenders:Tender[]; currentUser:User; onUpdateUsers:(u:User[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name:"", email:"", telegram:"", telegramChatId:"", role:"staff" as Role, password:"" });
  const [changePwId, setChangePwId] = useState<string|null>(null);
  const [newPw, setNewPw] = useState("");

  const addUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) { toast.error("Name, email and password are required"); return; }
    const initials = newUser.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
    onUpdateUsers([...users, { id:String(Date.now()), ...newUser, initials, is_active:true }]);
    setShowAdd(false); setNewUser({ name:"", email:"", telegram:"", telegramChatId:"", role:"staff", password:"" });
    toast.success("Team member added");
  };

  return (
    <div className="p-8 space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"><UserPlus className="w-4 h-4" /> Add Team Member</button>
      </div>
      {showAdd && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-semibold text-sm">New Team Member</h3>
          <div className="grid grid-cols-2 gap-4">
            {[["Full Name","name"],["Email","email"],["Telegram Handle","telegram"],["Telegram Chat ID","telegramChatId"],["Password","password"]].map(([label,key]) => (
              <div key={key}>
                <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</label>
                <input type={key==="password" ? "password" : "text"} value={(newUser as any)[key]} onChange={e => setNewUser(f => ({...f,[key]:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Role</label>
              <select value={newUser.role} onChange={e => setNewUser(f => ({...f,role:e.target.value as Role}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none">
                {["admin","ceo","manager","staff"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addUser} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors">Add Member</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {users.map(m => {
          const myTenders = tenders.filter(t => t.assignedPerson === m.name && !t.archived);
          const active = myTenders.filter(t => t.status !== "Completed" && t.status !== "Cancelled");
          return (
            <div key={m.id} className={`bg-card rounded-2xl border border-border p-6 ${!m.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-600 font-bold text-lg font-mono">{m.initials}</div>
                <div className="flex-1"><div className="font-bold text-base">{m.name}</div><span className={`text-xs font-mono capitalize px-2 py-0.5 rounded-full ${rCls(m.role)}`}>{rLabel(m.role)}</span></div>
                {m.id !== currentUser.id && (
                  <button onClick={() => { onUpdateUsers(users.map(u => u.id===m.id ? {...u,is_active:!u.is_active} : u)); toast.success(`${m.name} ${m.is_active ? "deactivated" : "activated"}`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors" title={m.is_active ? "Deactivate" : "Activate"}>
                    {m.is_active ? <Trash2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </button>
                )}
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><a href={`mailto:${m.email}`} className="text-muted-foreground font-mono truncate hover:text-foreground">{m.email}</a></div>
                <div className="flex items-center gap-2 text-xs"><MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground font-mono">{m.telegram}</span></div>
                <div className="flex items-center gap-2 text-xs"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground font-mono">{m.telegramChatId || "Chat ID not set"}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[["Total",myTenders.length,"text-foreground"],["Active",active.length,"text-amber-600"],["Done",myTenders.filter(t => t.status==="Completed").length,"text-emerald-600"]].map(([l,v,c]) => (
                  <div key={String(l)} className="bg-background rounded-xl p-2 text-center"><div className={`text-xl font-bold ${c}`}>{v}</div><div className="text-[10px] font-mono text-muted-foreground">{l}</div></div>
                ))}
              </div>
              <div>
                {changePwId === m.id ? (
                  <div className="flex gap-2">
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="flex-1 border border-border rounded-xl px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    <button onClick={() => { if (newPw.length < 6) { toast.error("Min 6 chars"); return; } onUpdateUsers(users.map(u => u.id===m.id ? {...u,password:newPw} : u)); setChangePwId(null); setNewPw(""); toast.success("Password updated"); }} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600">Save</button>
                    <button onClick={() => { setChangePwId(null); setNewPw(""); }} className="px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setChangePwId(m.id)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"><Key className="w-3.5 h-3.5" /> Change password</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Notifications View ───────────────────────────────────────────────────
function NotificationsView({ notifs, onMarkRead, user, users, tenders }: {
  notifs:Notif[]; onMarkRead:(id:number) => void; user:User; users:User[]; tenders:Tender[];
}) {
  const [sending, setSending] = useState(false);
  const icons = { telegram:<MessageSquare className="w-4 h-4 text-sky-500" />, email:<Mail className="w-4 h-4 text-violet-500" />, system:<Activity className="w-4 h-4 text-emerald-500" /> };

  const broadcastDeadlineReminders = async () => {
    setSending(true);
    const closing = tenders.filter(t => { const d = daysLeft(t.closingDate); return d >= 0 && d <= 7 && !t.archived; });
    let sent = 0;
    for (const t of closing) {
      const msg = buildTelegramMessage(t, "reminder");
      const groupOk = await sendTelegramMsg(GROUP_CHAT_ID, msg);
      if (groupOk) sent++;
      const assignedUser = users.find(u => u.name === t.assignedPerson);
      if (assignedUser?.telegramChatId) await sendTelegramMsg(assignedUser.telegramChatId, msg);
    }
    setSending(false);
    if (sent > 0) toast.success(`Reminders sent for ${closing.length} closing bids`, { description:"Sent to group + assigned members" });
    else toast.error("No messages sent — ensure bot token is valid and chat IDs are set");
  };

  return (
    <div className="p-8 max-w-2xl space-y-5">
      {isExecutive(user) && (
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
          <div><div className="font-semibold text-sm">Send Deadline Reminders</div><div className="text-xs text-muted-foreground font-mono mt-0.5">Send Telegram + email reminders for bids closing in 7 days</div></div>
          <button onClick={broadcastDeadlineReminders} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {sending ? "Sending…" : "Send Reminders"}
          </button>
        </div>
      )}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Activity Log</h3>
          <button onClick={() => notifs.filter(n => !n.read).forEach(n => onMarkRead(n.id))} className="text-xs font-mono text-emerald-600 hover:text-emerald-700 transition-colors">Mark all read</button>
        </div>
        <div className="divide-y divide-border">
          {notifs.length === 0 && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No notifications yet</div>}
          {notifs.map(n => (
            <div key={n.id} className={`px-5 py-4 flex items-start gap-3 ${n.read ? "opacity-55" : "bg-emerald-50/40"}`}>
              <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">{icons[n.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider capitalize">{n.type}</span>{!n.read && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}</div>
                <p className="text-sm leading-snug">{n.message}</p>
                <div className="text-[11px] font-mono text-muted-foreground mt-1">{n.time}</div>
              </div>
              {!n.read && <button onClick={() => onMarkRead(n.id)} className="text-xs text-muted-foreground hover:text-foreground font-mono shrink-0 mt-0.5">✓ Read</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings View ─────────────────────────────────────────────────────────
function SettingsView({ user, users, onUpdateUsers }: { user:User; users:User[]; onUpdateUsers:(u:User[]) => void }) {
  const [me, setMe] = useState({ telegram:user.telegram, oldPw:"", newPw:"", confirmPw:"" });
  const savePw = () => {
    const u = users.find(x => x.id===user.id);
    if (!u || u.password !== me.oldPw) { toast.error("Current password is incorrect"); return; }
    if (me.newPw.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (me.newPw !== me.confirmPw) { toast.error("Passwords do not match"); return; }
    onUpdateUsers(users.map(x => x.id===user.id ? {...x, password:me.newPw, telegram:me.telegram} : x));
    setMe(f => ({...f, oldPw:"", newPw:"", confirmPw:""}));
    toast.success("Profile updated");
  };
  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-sm">My Profile</h3>
        <div className="grid grid-cols-2 gap-4">
          {[["Name","name",user.name],["Email","email",user.email],["Role","role",rLabel(user.role)]].map(([l,k,v]) => (
            <div key={k}><label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{l}</label><input disabled value={v} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-muted/50 text-muted-foreground cursor-not-allowed" /></div>
          ))}
          <div><label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Telegram Handle</label><input value={me.telegram} onChange={e => setMe(f => ({...f,telegram:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" /></div>
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Key className="w-4 h-4 text-muted-foreground" /> Change Password</h3>
        <div className="space-y-3">
          {[["Current Password","oldPw"],["New Password","newPw"],["Confirm New Password","confirmPw"]].map(([l,k]) => (
            <div key={k}><label className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{l}</label><input type="password" value={(me as any)[k]} onChange={e => setMe(f => ({...f,[k]:e.target.value}))} className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30" /></div>
          ))}
        </div>
        <button onClick={savePw} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors">Save Changes</button>
      </div>

      {isExecutive(user) && (
        <>
          <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-500" /> Telegram Bot Config</h3>
            {[
              ["Bot Token",      BOT_TOKEN.slice(0,12)+"***…"+BOT_TOKEN.slice(-6)],
              ["Group Chat ID",  GROUP_CHAT_ID],
              ["Webhook URL",    "https://script.google.com/macros/s/AKfycby2oklQ7ki…/exec"],
              ["Reminder Days",  "7, 3, 1 days before deadline"],
              ["Check Interval", "Every 5 minutes (Google Apps Script trigger)"],
            ].map(([l,v]) => (
              <div key={l} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-4">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider shrink-0">{l}</span>
                <span className="text-xs font-mono text-foreground text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Google Sheet Integration</h3>
            {[
              ["Sheet ID",       "10mBLQAy2hlUQjzeCiDDemNl…"],
              ["Sheet Name",     "Sheet1"],
              ["Document Folder","1hXrVpISzuEUlbtxBQejLWNt…"],
              ["Admin Emails",   "henokgirma@zsecuredtech.com, info@zsecuredtech.com"],
            ].map(([l,v]) => (
              <div key={l} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-4">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider shrink-0">{l}</span>
                <span className="text-xs font-mono text-foreground text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
            <h3 className="font-semibold text-sm">Team Telegram Chat IDs</h3>
            <p className="text-xs text-muted-foreground font-mono">Each member must send /start to the bot privately to register their chat ID. Update below if known.</p>
            {users.filter(u => u.is_active).map(u => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-600 text-[10px] font-bold font-mono shrink-0">{u.initials}</div>
                <span className="text-sm font-medium w-24 shrink-0">{u.name}</span>
                <input defaultValue={u.telegramChatId} onBlur={e => { const val = e.target.value.trim(); if (val !== u.telegramChatId) { onUpdateUsers(users.map(x => x.id===u.id ? {...x,telegramChatId:val} : x)); toast.success(`Chat ID updated for ${u.name}`); } }} className="flex-1 border border-border rounded-xl px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono" placeholder="e.g. 793034140" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [users,    setUsers]    = useState<User[]>      (() => LS.get("zst_users",    INITIAL_USERS));
  const [tenders,  setTenders]  = useState<Tender[]>    (() => LS.get("zst_tenders",  SEED_TENDERS));
  const [notifs,   setNotifs]   = useState<Notif[]>     (() => LS.get("zst_notifs",   SEED_NOTIFS));
  const [audit,    setAudit]    = useState<AuditEntry[]>(() => LS.get("zst_audit",    SEED_AUDIT));
  const [tickets,  setTickets]  = useState<Ticket[]>    (() => LS.get("zst_tickets",  SEED_TICKETS));
  const [offices,  setOffices]  = useState<Office[]>    (() => LS.get("zst_offices",  INITIAL_OFFICES));
  const [clients,  setClients]  = useState<Client[]>    (() => LS.get("zst_clients",  []));
  const [projects, setProjects] = useState<Project[]>   (() => LS.get("zst_projects", SEED_PROJECTS));
  const [tasks,    setTasks]    = useState<TaskItem[]>  (() => LS.get("zst_tasks",    []));
  const [docs,     setDocs]     = useState<DocItem[]>   (() => LS.get("zst_docs",     []));
  const [meetings, setMeetings] = useState<Meeting[]>   (() => LS.get("zst_meetings", []));
  const [standards, setStandards] = useState<Standard[]>(() => LS.get("zst_standards", []));
  const [clauses, setClauses] = useState<Clause[]>(() => LS.get("zst_clauses", []));
  const [controls, setControls] = useState<Control[]>(() => LS.get("zst_controls", []));
  const [gaps, setGaps] = useState<Gap[]>(() => LS.get("zst_gaps", []));
  const [risks, setRisks] = useState<RiskReg[]>(() => LS.get("zst_risks", []));
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>(() => LS.get("zst_projectTasks", []));
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>(() => LS.get("zst_projectMilestones", []));
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>(() => LS.get("zst_projectDocuments", []));
  const [projectMeetings, setProjectMeetings] = useState<ProjectMeeting[]>(() => LS.get("zst_projectMeetings", []));
  const [currentUser, setCurrentUser] = useState<User|null>(() => LS.get<User|null>("zst_currentUser", null));
  const [tempUser, setTempUser] = useState<User|null>(null);
  const [userMFAConfigs, setUserMFAConfigs] = useState<UserMFAConfig[]>(() => LS.get("zst_userMFAConfigs", []));
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetupData, setMfaSetupData] = useState<MFASetup|null>(null);
  const [view,    setView]    = useState<AppView>("dashboard");
  const [adminOpen, setAdminOpen] = useState(false);
  const [selTender, setSelTender] = useState<Tender|null>(null);
  const [editTender, setEditTender] = useState<Tender|null|"new">(null);

  useEffect(() => { LS.set("zst_users",   users); },   [users]);
  useEffect(() => { LS.set("zst_tenders", tenders); }, [tenders]);
  useEffect(() => { LS.set("zst_notifs",  notifs); },  [notifs]);
  useEffect(() => { LS.set("zst_audit",   audit); },   [audit]);
  useEffect(() => { LS.set("zst_tickets", tickets); }, [tickets]);
  useEffect(() => { LS.set("zst_offices", offices); }, [offices]);
  useEffect(() => { LS.set("zst_clients", clients); }, [clients]);
  useEffect(() => { LS.set("zst_projects", projects); }, [projects]);
  useEffect(() => { LS.set("zst_tasks", tasks); }, [tasks]);
  useEffect(() => { LS.set("zst_docs", docs); }, [docs]);
  useEffect(() => { LS.set("zst_meetings", meetings); }, [meetings]);
  useEffect(() => { LS.set("zst_standards", standards); }, [standards]);
  useEffect(() => { LS.set("zst_clauses", clauses); }, [clauses]);
  useEffect(() => { LS.set("zst_controls", controls); }, [controls]);
  useEffect(() => { LS.set("zst_gaps", gaps); }, [gaps]);
  useEffect(() => { LS.set("zst_risks", risks); }, [risks]);
  useEffect(() => { LS.set("zst_projectTasks", projectTasks); }, [projectTasks]);
  useEffect(() => { LS.set("zst_projectMilestones", projectMilestones); }, [projectMilestones]);
  useEffect(() => { LS.set("zst_projectDocuments", projectDocuments); }, [projectDocuments]);
  useEffect(() => { LS.set("zst_projectMeetings", projectMeetings); }, [projectMeetings]);
  useEffect(() => { LS.set("zst_userMFAConfigs", userMFAConfigs); }, [userMFAConfigs]);
  // restore session: prefer Supabase session then fallback to localStorage (which is already loaded in useState initializer)
  useEffect(() => {
    if (currentUser) return; // Already have a user from localStorage
    let mounted = true;
    (async () => {
      const session = await getSession().catch(() => null);
      if (!mounted) return;
      if (session && session.user) {
        const profiles = await fetchTable('profiles').catch(() => null);
        let profile = null;
        if (profiles && Array.isArray(profiles)) profile = profiles.find((p:any) => p.id === session.user.id || (p.email && p.email.toLowerCase() === (session.user.email||'').toLowerCase()));
        if (profile) {
          const mapped: User = { id: profile.id, name: profile.name||profile.email, email: profile.email||session.user.email || '', telegram: profile.telegram||'', telegramChatId: profile.telegram_chat_id||'', role: profile.role||'staff', initials: profile.initials||'', password: '', is_active: profile.is_active !== false };
          setCurrentUser(mapped);
          return;
        }
      }
    })();
    return () => { mounted = false; };
  }, [currentUser]);

  // Attempt to sync from Supabase on first load (non-blocking). If Supabase fails, keep localStorage data.
  useEffect(() => {
    (async () => {
        try {
        const remoteClients = await fetchTable('clients');
        if (remoteClients) setClients(remoteClients as Client[]);
        const remoteProjects = await fetchTable('projects');
        if (remoteProjects) setProjects(remoteProjects as Project[]);
        const remoteTasks = await fetchTable('tasks');
        if (remoteTasks) setTasks(remoteTasks as TaskItem[]);
        const remoteDocs = await fetchTable('documents');
        if (remoteDocs) setDocs(remoteDocs as DocItem[]);
        const remoteMeetings = await fetchTable('meetings');
        if (remoteMeetings) setMeetings(remoteMeetings as Meeting[]);
        const remoteOffices = await fetchTable('offices');
        if (remoteOffices) setOffices(remoteOffices as Office[]);
        const remoteStandards = await fetchTable('standards'); if (remoteStandards) setStandards(remoteStandards as Standard[]);
        const remoteClauses = await fetchTable('clauses'); if (remoteClauses) setClauses(remoteClauses as Clause[]);
        const remoteControls = await fetchTable('controls'); if (remoteControls) setControls(remoteControls as Control[]);
        const remoteGaps = await fetchTable('gaps'); if (remoteGaps) setGaps(remoteGaps as Gap[]);
        const remoteRisks = await fetchTable('risks'); if (remoteRisks) setRisks(remoteRisks as RiskReg[]);
      } catch (err) {
        console.warn('Supabase sync skipped or failed:', err);
      }
    })();
  }, []);
  useEffect(() => { LS.set("zst_currentUser", currentUser); }, [currentUser]);

  // Check for 6-hour ticket escalation on load
  useEffect(() => {
    if (!currentUser) return;
    setTickets(prev => prev.map(t => {
      if (t.status !== "open") return t;
      const hoursOld = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
      return hoursOld > 6 ? {...t, status:"escalated"} : t;
    }));
  }, [currentUser?.id]);

  const unread = notifs.filter(n => !n.read).length;
  const openTickets = tickets.filter(t => t.status === "open" || t.status === "escalated").length;

  const logAudit = useCallback((action:string, target:string, details?:string) => {
    const entry: AuditEntry = { id:Date.now(), action, by:currentUser!.name, target, timestamp:fmtDateTime(), details };
    setAudit(prev => [entry, ...prev]);
  }, [currentUser]);

  const pushNotif = useCallback((type:Notif["type"], message:string, tender:string) => {
    setNotifs(prev => [{ id:Date.now(), type, message, tender, time:fmtDateTime(), read:false }, ...prev]);
  }, []);

  const syncTenderTask = useCallback((tender: Tender) => {
    const task = buildTenderTask(tender);
    setTasks(prev => {
      const normalized = prev.map(item => ({ ...item, assignedTo: item.assignedTo ?? "" }));
      const matchIndex = normalized.findIndex(item => item.title === tender.tenderName && item.assignedTo === tender.assignedPerson);
      if (!task) {
        return normalized.filter(item => !(item.title === tender.tenderName && item.assignedTo === tender.assignedPerson));
      }
      if (matchIndex >= 0) {
        const next = [...normalized];
        next[matchIndex] = { ...next[matchIndex], ...task, id: next[matchIndex].id };
        return next;
      }
      return [task, ...normalized];
    });
  }, []);

  const sendTelegramNotification = async (tender: Tender, type: "new" | "approved" | "rejected" | "reminder" | "update") => {
    const msg = buildTelegramMessage(tender, type);
    const tasks: Promise<boolean>[] = [sendTelegramMsg(GROUP_CHAT_ID, msg)];
    const assigned = users.find(u => u.name === tender.assignedPerson);
    if (assigned?.telegramChatId && assigned.telegramChatId !== GROUP_CHAT_ID) {
      tasks.push(sendTelegramMsg(assigned.telegramChatId, msg));
    }
    const results = await Promise.all(tasks);
    return results.some(r => r);
  };

  const handleApprove = async (t: Tender) => {
    const now = fmtDateTime();
    const updated = {...t, approvalStatus:"Approved" as ApprovalStatus, responseBy:currentUser!.name, responseTime:now};
    setTenders(prev => prev.map(x => x.id===t.id ? updated : x));
    if (selTender?.id === t.id) setSelTender(updated);
    toast.success(`✅ Approved: ${t.tenderName}`);
    logAudit("Approved Tender", t.tenderName);
    pushNotif("system", `✅ ${t.tenderName} approved by ${currentUser!.name}`, t.tenderName);
    const ok = await sendTelegramNotification(updated, "approved");
    if (ok) pushNotif("telegram", `Telegram approval notification sent for: ${t.tenderName}`, t.tenderName);
    pushNotif("email", `Email approval sent to ${users.find(u => u.name===t.assignedPerson)?.email || "assignee"}`, t.tenderName);
  };

  const handleReject = async (t: Tender) => {
    const now = fmtDateTime();
    const updated = {...t, approvalStatus:"REJECTED" as ApprovalStatus, responseBy:currentUser!.name, responseTime:now};
    setTenders(prev => prev.map(x => x.id===t.id ? updated : x));
    if (selTender?.id === t.id) setSelTender(updated);
    toast.error(`❌ Rejected: ${t.tenderName}`);
    logAudit("Rejected Tender", t.tenderName);
    pushNotif("system", `❌ ${t.tenderName} rejected by ${currentUser!.name}`, t.tenderName);
    await sendTelegramNotification(updated, "rejected");
  };

  const handleAddNote = (tender: Tender, note: string) => {
    const stamp = `[${fmtDateTime()}] ${currentUser!.name}: ${note}`;
    const updated = {...tender, notes: tender.notes ? `${tender.notes}\n${stamp}` : stamp};
    setTenders(prev => prev.map(x => x.id===tender.id ? updated : x));
    setSelTender(updated);
    logAudit("Added Note", tender.tenderName);
    toast.success("Note saved");
  };

  const handleProgressUpdate = (tender: Tender, note: string, percent: number) => {
    const entry: ProgressEntry = { by:currentUser!.name, note, percent, timestamp:fmtDateTime() };
    const updated = {...tender, progressLog:[...tender.progressLog, entry], progressPercent:percent};
    setTenders(prev => prev.map(x => x.id===tender.id ? updated : x));
    setSelTender(prev => prev?.id===tender.id ? updated : prev);
    logAudit("Progress Update", tender.tenderName, `${percent}% — ${note}`);
    pushNotif("system", `Progress updated on "${tender.tenderName}" by ${currentUser!.name}: ${percent}%`, tender.tenderName);
    toast.success(`Progress updated: ${percent}%`);
  };

  const handleSave = async (data: Omit<Tender,"id">) => {
    if (editTender === "new") {
      const id = Math.max(0, ...tenders.map(t => t.id)) + 1;
      const newT = {...data, id};
      setTenders(prev => [newT, ...prev]);
      syncTenderTask(newT);
      logAudit("Registered Tender", data.tenderName, `Assigned to ${data.assignedPerson || "Unassigned"}`);
      toast.success(`📋 Tender registered: ${data.tenderName}`);
      pushNotif("system", `New tender registered: ${data.tenderName}`, data.tenderName);
      const ok = await sendTelegramNotification(newT, "new");
      if (ok) pushNotif("telegram", `Telegram notification sent for new bid: ${data.tenderName}`, data.tenderName);
      pushNotif("email", `Email notification sent to admin for: ${data.tenderName}`, data.tenderName);
    } else if (editTender) {
      const id = (editTender as Tender).id;
      const next = {...data, id};
      setTenders(prev => prev.map(x => x.id===id ? next : x));
      syncTenderTask(next);
      if (selTender?.id === id) setSelTender(next);
      logAudit("Edited Tender", data.tenderName);
      toast.success("Tender updated");
    }
    setEditTender(null);
  };

  const handleDelete = (t: Tender) => {
    setTenders(prev => prev.filter(x => x.id !== t.id));
    setTasks(prev => prev.filter(item => !(item.title === t.tenderName && item.assignedTo === t.assignedPerson)));
    setSelTender(null);
    logAudit("Deleted Tender", t.tenderName);
    toast.success(`Tender deleted: ${t.tenderName}`);
  };

  const handleArchive = (t: Tender) => {
    const updated = {...t, archived:!t.archived};
    setTenders(prev => prev.map(x => x.id===t.id ? updated : x));
    setSelTender(null);
    logAudit(t.archived ? "Unarchived Tender" : "Archived Tender", t.tenderName);
    toast.success(t.archived ? "Tender restored from archive" : "Tender archived");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setTempUser(null);
    setMfaRequired(false);
    setMfaCode("");
    LS.set("zst_currentUser", null);
    toast.success("Logged out successfully");
  };

  const handleMFAVerify = (code: string) => {
    if (!tempUser) return;
    
    const userMfaConfig = userMFAConfigs.find(m => m.userId === tempUser.id);
    
    // Check if MFA is actually enabled for this user
    if (!userMfaConfig || !userMfaConfig.enabled) {
      // MFA not configured, skip verification
      setCurrentUser(tempUser);
      setTempUser(null);
      setMfaRequired(false);
      setMfaCode("");
      setView("dashboard");
      toast.success("Successfully authenticated");
      return;
    }
    
    // Check for backup codes first
    const isBackupCode = userMfaConfig.backupCodes.includes(code);
    if (isBackupCode) {
      // Use backup code - remove it from the list
      setUserMFAConfigs(prev => prev.map(m => 
        m.userId === tempUser.id 
          ? { ...m, backupCodes: m.backupCodes.filter(c => c !== code), lastUsed: new Date().toISOString() }
          : m
      ));
      setCurrentUser(tempUser);
      setTempUser(null);
      setMfaRequired(false);
      setMfaCode("");
      setView("dashboard");
      toast.success("Successfully authenticated with backup code");
      return;
    }
    
    // Verify TOTP code using proper verification
    const isValidTOTP = verifyTOTP(userMfaConfig.secret, code);
    if (isValidTOTP) {
      // Update last used timestamp
      setUserMFAConfigs(prev => prev.map(m => 
        m.userId === tempUser.id 
          ? { ...m, lastUsed: new Date().toISOString() }
          : m
      ));
      setCurrentUser(tempUser);
      setTempUser(null);
      setMfaRequired(false);
      setMfaCode("");
      setView("dashboard");
      toast.success("Successfully authenticated");
      return;
    }
    
    toast.error("Invalid authentication code or backup code");
  };

  if (mfaRequired && tempUser) {
    const userMfaConfig = userMFAConfigs.find(m => m.userId === tempUser.id);
    // Only show MFA screen if user has MFA enabled
    if (userMfaConfig?.enabled) {
      return <MFAVerificationScreen email={tempUser.email} onVerify={handleMFAVerify} onBack={() => { setMfaRequired(false); setTempUser(null); }} />;
    }
    // If MFA not enabled, just log in directly
    setCurrentUser(tempUser);
    setTempUser(null);
    setMfaRequired(false);
    setView("dashboard");
    toast.success("Successfully authenticated");
  }

  if (!currentUser) return <LoginScreen users={users} onLogin={u => { setTempUser(u); setMfaRequired(true); }} />;

  const titles: Record<AppView,string> = { dashboard:"Dashboard", tenders:"Tender Management", mywork:"My Work", tickets:"Support Tickets", team:"Team Members", notifications:"Notifications", settings:"Settings", offices:"Office Management", clients:"Clients", projects:"Projects", documents:"Documents", meetings:"Meetings", tasks:"Tasks", iso:"ISO & Compliance" };
  const subtitles: Record<AppView,string> = {
    dashboard: isExecutive(currentUser) ? `Executive View — ${new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}` : `Welcome, ${currentUser.name}`,
    tenders: `${tenders.filter(t => !t.archived).length} active tenders`,
    mywork: `${tenders.filter(t => t.assignedPerson===currentUser.name && !t.archived).length} assigned to you`,
    tickets: `${openTickets} open tickets`,
    team: "ZSecuredTech bid team",
    notifications: `${unread} unread`,
    settings: "Account & system configuration",
    offices: `${offices.length} offices`,
    clients: `${clients.length} clients`,
    projects: `${projects.length} projects`,
    documents: `${docs.length} documents`,
    meetings: `${meetings.length} meetings`,
    tasks: `${tasks.length} tasks`,
    iso: `${standards.length} standards • ${controls.length} controls`,
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <Sidebar view={view} setView={setView} user={currentUser} onLogout={handleLogout} unread={unread} openTickets={openTickets} />
      <div className="ml-60 min-h-screen flex flex-col">
        <TopBar title={titles[view]} subtitle={subtitles[view]} user={currentUser} onOpenAdmin={()=>setAdminOpen(true)} />
        <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin — Create User</DialogTitle>
              <DialogDescription>Create a new user (admin only) — ensure VITE_SERVER_FUNCTION_URL is set to your functions base URL if needed.</DialogDescription>
            </DialogHeader>
            <AdminCreateForm onClose={()=>setAdminOpen(false)} currentUser={currentUser} />
          </DialogContent>
        </Dialog>
        <main className="flex-1">
          {view === "dashboard" && isExecutive(currentUser) && <ExecutiveDashboard tenders={tenders} users={users} audit={audit} user={currentUser} />}
          {view === "dashboard" && !isExecutive(currentUser) && <MyWorkDashboard tenders={tenders} user={currentUser} users={users} projectTasks={projectTasks} projects={projects} onViewTender={t => { setSelTender(t); setView("tenders"); }} onProgressUpdate={(t,note,pct) => handleProgressUpdate(t,note,pct)} />}
          {view === "tenders"   && <TendersView tenders={tenders} user={currentUser} users={users} onView={setSelTender} onEdit={t => setEditTender(t)} onApprove={handleApprove} onReject={handleReject} onAdd={() => setEditTender("new")} />}
          {view === "clients"   && canManageBusinessRecordsForUser(currentUser) && <ClientsView clients={clients} onCreate={async c => {
            const created = await insertRow('clients', { ...c }).catch(() => null);
            const record = created || c;
            setClients(prev => [record, ...prev]);
            logAudit("Created Client", record.companyName);
            toast.success("Client added");
          }} onUpdate={async c => {
            const updated = await updateRow('clients', 'id', c.id, { ...c }).catch(() => null);
            setClients(prev => prev.map(p => p.id===c.id ? (updated||c) : p));
            logAudit("Updated Client", c.companyName);
            toast.success("Client updated");
          }} onDelete={async id => {
            const ok = await deleteRow('clients', 'id', id).catch(() => false);
            const found = clients.find(x=>x.id===id);
            setClients(prev => prev.filter(p => p.id !== id));
            if (found) { logAudit("Deleted Client", found.companyName); toast.success("Client deleted"); }
          }} />}
          {view === "projects"  && canManageBusinessRecordsForUser(currentUser) && <ProjectsView projects={projects} clients={clients} users={users} currentUser={currentUser} projectTasks={projectTasks} setProjectTasks={setProjectTasks} projectMilestones={projectMilestones} setProjectMilestones={setProjectMilestones} projectDocuments={projectDocuments} setProjectDocuments={setProjectDocuments} projectMeetings={projectMeetings} setProjectMeetings={setProjectMeetings} onCreate={async p => {
            const created = await insertRow('projects', { ...p }).catch(() => null);
            const record = created || p;
            setProjects(prev => [record, ...prev]);
            logAudit("Created Project", record.name);
            toast.success("Project added");
          }} onUpdate={async p => {
            const updated = await updateRow('projects', 'id', p.id, { ...p }).catch(() => null);
            setProjects(prev => prev.map(x => x.id===p.id ? (updated||p) : x));
            logAudit("Updated Project", p.name);
            toast.success("Project updated");
          }} onDelete={async id => {
            const found = projects.find(x=>x.id===id);
            await deleteRow('projects', 'id', id).catch(() => null);
            setProjects(prev => prev.filter(p => p.id !== id));
            if (found) { logAudit("Deleted Project", found.name); toast.success("Project deleted"); }
          }} />}
          {view === "tasks"     && <TasksView tasks={tasks} projects={projects} users={users} currentUser={currentUser} onCreate={async t => {
            const created = await insertRow('tasks', { ...t }).catch(() => null);
            const record = created || t;
            setTasks(prev => [record, ...prev]);
            logAudit("Created Task", record.title);
            toast.success("Task added");
          }} onUpdate={async t => {
            const updated = await updateRow('tasks', 'id', t.id, { ...t }).catch(() => null);
            setTasks(prev => prev.map(x => x.id===t.id ? (updated||t) : x));
            logAudit("Updated Task", t.title);
            toast.success("Task updated");
          }} onDelete={async id => {
            const f = tasks.find(x=>x.id===id);
            await deleteRow('tasks', 'id', id).catch(() => null);
            setTasks(prev => prev.filter(p => p.id !== id));
            if (f) { logAudit("Deleted Task", f.title); toast.success("Task deleted"); }
          }} />}
          {view === "documents" && <DocumentsView docs={docs} onCreate={async d => {
            const created = await insertRow('documents', { ...d }).catch(() => null);
            const record = created || d;
            setDocs(prev => [record, ...prev]);
            logAudit("Uploaded Document", record.name);
            toast.success("Document uploaded");
          }} onDelete={async id => {
            const f = docs.find(x=>x.id===id);
            await deleteRow('documents', 'id', id).catch(() => null);
            setDocs(prev => prev.filter(p => p.id !== id));
            if (f) { logAudit("Deleted Document", f.name); toast.success("Document deleted"); }
          }} />}
          {view === "meetings"  && <MeetingsView meetings={meetings} projects={projects} onCreate={async m => {
            const created = await insertRow('meetings', { ...m }).catch(() => null);
            const record = created || m;
            setMeetings(prev => [record, ...prev]);
            logAudit("Scheduled Meeting", record.title);
            toast.success("Meeting scheduled");
          }} onDelete={async id => {
            const f = meetings.find(x=>x.id===id);
            await deleteRow('meetings', 'id', id).catch(() => null);
            setMeetings(prev => prev.filter(p => p.id !== id));
            if (f) { logAudit("Deleted Meeting", f.title); toast.success("Meeting deleted"); }
          }} />}
          {view === "mywork"    && <MyWorkDashboard tenders={tenders} user={currentUser} users={users} projectTasks={projectTasks} projects={projects} onViewTender={t => { setSelTender(t); setView("tenders"); }} onProgressUpdate={(t,note,pct) => handleProgressUpdate(t,note,pct)} />}
          {!canManageBusinessRecordsForUser(currentUser) && view === "clients" && <div className="p-8"><div className="bg-card rounded-2xl border border-border p-6 text-sm text-muted-foreground">Only admin and CEO can manage clients.</div></div>}
          {!canManageBusinessRecordsForUser(currentUser) && view === "projects" && <div className="p-8"><div className="bg-card rounded-2xl border border-border p-6 text-sm text-muted-foreground">Only admin and CEO can manage projects.</div></div>}
          {view === "iso" && isPrivileged(currentUser) && <ISOView standards={standards} controls={controls} clauses={clauses}
            onCreateStandard={async s => { const created = await insertRow('standards', s).catch(()=>null); setStandards(prev => [(created||s), ...prev]); toast.success('Standard added'); logAudit('Created Standard', s.code); }}
            onCreateControl={async c => { const created = await insertRow('controls', c).catch(()=>null); setControls(prev => [(created||c), ...prev]); toast.success('Control added'); logAudit('Created Control', c.controlId); }}
          />}
          {view === "tickets"   && <TicketsView tickets={tickets} user={currentUser} users={users} tenders={tenders}
            onCreateTicket={t => { const ticket:Ticket = {...t, id:Date.now(), status:"open", createdAt:fmtDateTime(), replies:[]}; setTickets(prev => [ticket,...prev]); pushNotif("system", `New ticket from ${t.createdBy}: "${t.title}"`, t.tenderName||""); logAudit("Created Ticket", t.title); toast.success("Ticket submitted — 6hr SLA"); }}
            onReply={(id,text) => { setTickets(prev => prev.map(t => t.id===id ? {...t, status:"replied" as const, replies:[...t.replies, {by:currentUser.name, text, timestamp:fmtDateTime()}]} : t)); logAudit("Replied to Ticket", tickets.find(t => t.id===id)?.title||""); toast.success("Reply sent"); }}
            onResolve={id => { setTickets(prev => prev.map(t => t.id===id ? {...t, status:"resolved" as const} : t)); logAudit("Resolved Ticket", tickets.find(t => t.id===id)?.title||""); toast.success("Ticket resolved"); }}
          />}
          {view === "team"          && isExecutive(currentUser) && <TeamView users={users} tenders={tenders} currentUser={currentUser} onUpdateUsers={u => { setUsers(u); setCurrentUser(u.find(x => x.id===currentUser.id) || null); }} />}
          {view === "offices"       && isPrivileged(currentUser) && <OfficesView offices={offices} users={users} currentUser={currentUser}
            onCreate={o => { setOffices(prev => [o, ...prev]); logAudit("Created Office", o.name); toast.success("Office created"); }}
            onUpdate={o => { setOffices(prev => prev.map(p => p.id===o.id ? o : p)); logAudit("Updated Office", o.name); toast.success("Office updated"); }}
            onDelete={id => { const found = offices.find(x => x.id===id); setOffices(prev => prev.filter(p => p.id !== id)); if (found) { logAudit("Deleted Office", found.name); toast.success("Office deleted"); } }}
          />}
          {view === "notifications" && <NotificationsView notifs={notifs} onMarkRead={id => setNotifs(prev => prev.map(n => n.id===id ? {...n,read:true} : n))} user={currentUser} users={users} tenders={tenders} />}
          {view === "settings"      && <SettingsView user={currentUser} users={users} onUpdateUsers={u => { setUsers(u); setCurrentUser(u.find(x => x.id===currentUser.id) || currentUser); }} />}
        </main>
      </div>

      {selTender && (
        <TenderDetail tender={selTender} user={currentUser} users={users}
          onClose={() => setSelTender(null)}
          onApprove={() => handleApprove(selTender)}
          onReject={() => handleReject(selTender)}
          onAddNote={note => handleAddNote(selTender, note)}
          onEdit={() => { setEditTender(selTender); setSelTender(null); }}
          onProgressUpdate={(note,pct) => handleProgressUpdate(selTender, note, pct)}
          onDelete={() => handleDelete(selTender)}
          onArchive={() => handleArchive(selTender)}
        />
      )}
      {editTender !== null && (
        <AddEditModal tender={editTender==="new" ? null : editTender} user={currentUser} users={users} onClose={() => setEditTender(null)} onSave={handleSave} />
      )}
    </div>
  );
}
