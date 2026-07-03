import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Activity, BarChart3, Factory, RefreshCw, Database, AlertTriangle } from 'lucide-react';
import './styles.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const SHEET_ID = '1duDW-m4eODu5cC-ig-qLwGMMFZuhWjks255G1bLY0k0';
const GID = '1464551640';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const TARGET_DEFAULT = 85;

const aliases = {
  year: ['year', 'ปี'],
  month: ['month', 'เดือน'],
  day: ['day', 'วันที่', 'date'],
  shift: ['shift', 'กะ'],
  line: ['line', 'machine', 'ไลน์', 'เครื่อง', 'process', 'sessionid'],
  output: ['out put (pc)', 'output', 'output (pc)', 'good output', 'good output (pc)'],
  defect: ['defect (pc)', 'defect', 'ng', 'reject'],
  availability: ['%a', 'a', 'availability'],
  performance: ['%p', 'p', 'performance'],
  quality: ['%q', 'q', 'quality'],
  oee: ['%oee', 'oee'],
  planDt: ['plan downtime (min)', 'plan down time (min)', 'plan dt'],
  unplanDt: ['unplan downtime (min)', 'unplan down time (min)', 'unplan dt'],
  waiting: ['waiting (min)', 'waiting'],
  startup: ['start up1 (min)', 'startup', 'start up'],
  setup: ['set up1 (min)', 'set up1 (min)', 'setup', 'set up'],
  minor: ['minor (min)', 'minor'],
  breakdown: ['break down (min)', 'break down loss (min)', 'breakdown'],
};

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quote = !quote;
    else if (ch === ',' && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) {
      if (cell || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; }
      if (ch === '\r' && next === '\n') i++;
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const num = v => {
  const n = Number(String(v ?? '').replace(/,/g, '').replace('%', '').trim());
  return Number.isFinite(n) ? n : 0;
};
const pad2 = v => String(v ?? '').padStart(2, '0');

function headerMap(headers) {
  const h = headers.map(norm);
  const find = (keys) => {
    for (const key of keys) {
      const idx = h.findIndex(x => x === norm(key));
      if (idx >= 0) return idx;
    }
    for (const key of keys) {
      const idx = h.findIndex(x => x.includes(norm(key)));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  return Object.fromEntries(Object.entries(aliases).map(([k, keys]) => [k, find(keys)]));
}

function inferLine(session, lineRaw) {
  const raw = String(lineRaw || session || '').trim();
  const s = raw.toLowerCase();
  if (s.includes('topseal1') || s.includes('top seal1') || s.includes('topseal 1')) return 'TopSeal1';
  if (s.includes('topseal2') || s.includes('top seal2') || s.includes('topseal 2')) return 'TopSeal2';
  if (s.includes('onigiri')) return 'Onigiri';
  if (s.includes('ffs1')) return 'FFS1';
  if (s.includes('ffs2')) return 'FFS2';
  if (s.includes('burger')) return 'Burger';
  if (s.includes('banding1')) return 'Banding1';
  if (s.includes('banding2')) return 'Banding2';
  return raw || 'Unknown';
}

function convert(rows) {
  if (!rows.length) return [];
  const headers = rows[0];
  const m = headerMap(headers);
  return rows.slice(1).map(r => {
    let year = m.year >= 0 ? r[m.year] : '';
    let month = m.month >= 0 ? r[m.month] : '';
    let day = m.day >= 0 ? r[m.day] : '';
    if (String(year).length === 3) year = '2026';
    if (String(year).length === 2) year = `20${year}`;
    const date = `${year || '2026'}-${pad2(month)}-${pad2(day)}`;
    const line = inferLine(m.line >= 0 ? r[m.line] : '', m.line >= 0 ? r[m.line] : '');
    return {
      date,
      year: String(year || '2026'),
      month: pad2(month),
      day: pad2(day),
      shift: m.shift >= 0 ? String(r[m.shift] || '').trim() : '',
      line,
      output: num(m.output >= 0 ? r[m.output] : 0),
      defect: num(m.defect >= 0 ? r[m.defect] : 0),
      availability: num(m.availability >= 0 ? r[m.availability] : 0),
      performance: num(m.performance >= 0 ? r[m.performance] : 0),
      quality: num(m.quality >= 0 ? r[m.quality] : 0),
      oee: num(m.oee >= 0 ? r[m.oee] : 0),
      planDt: num(m.planDt >= 0 ? r[m.planDt] : 0),
      unplanDt: num(m.unplanDt >= 0 ? r[m.unplanDt] : 0),
      waiting: num(m.waiting >= 0 ? r[m.waiting] : 0),
      startup: num(m.startup >= 0 ? r[m.startup] : 0),
      setup: num(m.setup >= 0 ? r[m.setup] : 0),
      minor: num(m.minor >= 0 ? r[m.minor] : 0),
      breakdown: num(m.breakdown >= 0 ? r[m.breakdown] : 0),
    };
  }).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.oee >= 0 && x.line !== 'Unknown');
}

const avg = (arr, key) => arr.length ? arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length : 0;
const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);
const colorStatus = (v, t) => v >= t ? 'green' : v >= 70 ? 'yellow' : 'red';
const statusText = s => s === 'green' ? 'Good' : s === 'yellow' ? 'Watch' : 'Critical';

function App() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('กำลังโหลดข้อมูลจาก Google Sheet / ALL_DATA...');
  const [live, setLive] = useState(false);
  const [target, setTarget] = useState(TARGET_DEFAULT);
  const [filters, setFilters] = useState({ from: '', to: '', month: 'ALL', line: 'ALL', shift: 'ALL' });

  const load = async () => {
    setStatus('กำลังโหลดข้อมูลจาก Google Sheet / ALL_DATA...');
    try {
      const res = await fetch(`${CSV_URL}&cacheBust=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = convert(parseCSV(text));
      if (!parsed.length) throw new Error('ไม่พบข้อมูลที่ใช้ได้ใน ALL_DATA');
      setRows(parsed);
      setLive(true);
      const dates = parsed.map(x => x.date).sort();
      setStatus(`✅ LIVE DATA | ${parsed.length.toLocaleString()} records | วันที่ ${dates[0]} ถึง ${dates[dates.length - 1]} | refresh ${new Date().toLocaleTimeString('th-TH')}`);
    } catch (e) {
      setLive(false);
      setStatus(`❌ NO LIVE DATA: ${e.message} | กรุณาตั้ง Google Sheet เป็น Anyone with the link → Viewer`);
    }
  };

  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, []);

  const months = useMemo(() => [...new Set(rows.map(x => `${x.year}-${x.month}`))].sort(), [rows]);
  const lines = useMemo(() => [...new Set(rows.map(x => x.line))].sort(), [rows]);
  const shifts = useMemo(() => [...new Set(rows.map(x => x.shift).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter(x => {
    if (filters.from && x.date < filters.from) return false;
    if (filters.to && x.date > filters.to) return false;
    if (filters.month !== 'ALL' && `${x.year}-${x.month}` !== filters.month) return false;
    if (filters.line !== 'ALL' && x.line !== filters.line) return false;
    if (filters.shift !== 'ALL' && x.shift !== filters.shift) return false;
    return true;
  }), [rows, filters]);

  const kpi = useMemo(() => ({
    oee: avg(filtered, 'oee'), a: avg(filtered, 'availability'), p: avg(filtered, 'performance'), q: avg(filtered, 'quality'),
    output: sum(filtered, 'output'), defect: sum(filtered, 'defect'), loss: sum(filtered, 'planDt') + sum(filtered, 'unplanDt') + sum(filtered, 'minor') + sum(filtered, 'breakdown'),
  }), [filtered]);

  const byDate = useMemo(() => {
    const map = new Map();
    filtered.forEach(x => { if (!map.has(x.date)) map.set(x.date, []); map.get(x.date).push(x); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, arr]) => ({ date, oee: avg(arr, 'oee') }));
  }, [filtered]);

  const byLine = useMemo(() => lines.map(line => {
    const arr = filtered.filter(x => x.line === line);
    return { line, oee: avg(arr, 'oee'), count: arr.length };
  }).filter(x => x.count).sort((a, b) => b.oee - a.oee), [filtered, lines]);

  const loss = useMemo(() => [
    ['Unplan DT', sum(filtered, 'unplanDt')], ['Plan DT', sum(filtered, 'planDt')], ['Waiting', sum(filtered, 'waiting')],
    ['Startup', sum(filtered, 'startup')], ['Setup', sum(filtered, 'setup')], ['Minor', sum(filtered, 'minor')], ['Breakdown', sum(filtered, 'breakdown')],
  ].sort((a, b) => b[1] - a[1]).slice(0, 6), [filtered]);

  const trendData = {
    labels: byDate.map(x => x.date),
    datasets: [
      { label: 'OEE %', data: byDate.map(x => x.oee.toFixed(1)), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.15)', tension: .35, fill: true, pointRadius: 4 },
      { label: `Target ${target}%`, data: byDate.map(() => target), borderColor: '#fb7185', borderDash: [8, 8], pointRadius: 0 },
    ]
  };
  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#dbeafe' } } }, scales: { x: { ticks: { color: '#9fb3ce', maxRotation: 45, minRotation: 0 }, grid: { color: 'rgba(148,163,184,.12)' } }, y: { suggestedMin: 0, suggestedMax: 100, ticks: { color: '#9fb3ce' }, grid: { color: 'rgba(148,163,184,.12)' } } } };

  const lossData = { labels: loss.map(x => x[0]), datasets: [{ label: 'Minutes', data: loss.map(x => x[1]), backgroundColor: 'rgba(56,189,248,.55)', borderColor: '#38bdf8', borderWidth: 1 }] };

  const status = colorStatus(kpi.oee, target);
  const worstLine = byLine.length ? byLine[byLine.length - 1] : null;
  const topLoss = loss.length ? loss[0] : null;

  return <div className="app">
    <header className="hero">
      <div>
        <div className="eyebrow"><Factory size={18}/> DFM Intelligence Platform</div>
        <h1>OEE Executive Dashboard</h1>
        <p>Google Sheet powered from <b>ALL_DATA</b> • Realtime refresh every 60 sec</p>
      </div>
      <div className={`live ${live ? 'on' : 'off'}`}><Database size={16}/>{live ? 'LIVE DATA' : 'NO LIVE DATA'}</div>
    </header>

    <section className="toolbar">
      <label>Date From<input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})}/></label>
      <label>Date To<input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})}/></label>
      <label>Month<select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})}><option value="ALL">All Months</option>{months.map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Line<select value={filters.line} onChange={e => setFilters({...filters, line: e.target.value})}><option value="ALL">All Lines</option>{lines.map(l => <option key={l}>{l}</option>)}</select></label>
      <label>Shift<select value={filters.shift} onChange={e => setFilters({...filters, shift: e.target.value})}><option value="ALL">All Shifts</option>{shifts.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Target<input type="number" value={target} onChange={e => setTarget(Number(e.target.value)||85)}/></label>
      <button onClick={load}><RefreshCw size={16}/> Refresh Live</button>
      <button className="ghost" onClick={() => setFilters({ from: '', to: '', month: 'ALL', line: 'ALL', shift: 'ALL' })}>All Dates</button>
    </section>
    <div className="status">{status}</div>

    <section className="summary">
      <div className="gauge card"><div className="label">Factory OEE</div><div className="big">{kpi.oee.toFixed(1)}%</div><span className={status}>{statusText(status)}</span><small>Target {target}% • {filtered.length} records</small></div>
      <Kpi title="Availability" value={`${kpi.a.toFixed(1)}%`} badge="Machine time" ok={kpi.a>=70}/>
      <Kpi title="Performance" value={`${kpi.p.toFixed(1)}%`} badge="Speed" ok={kpi.p>=70}/>
      <Kpi title="Quality" value={`${kpi.q.toFixed(1)}%`} badge="Defect control" ok={kpi.q>=98}/>
      <Kpi title="Good Output" value={formatK(kpi.output)} badge="pc" ok/>
      <Kpi title="Loss Time" value={formatK(kpi.loss)} badge="min" ok={kpi.loss<1000}/>
    </section>

    <main className="grid">
      <Panel title="OEE Trend by Date" sub="Daily movement with Date axis" className="wide"><Line data={trendData} options={chartOptions}/></Panel>
      <Panel title="Line Performance" sub="Ranking by OEE"><div className="rank">{byLine.map((x,i)=><div className="rankrow" key={x.line}><b>{i+1}</b><span>{x.line}</span><div><i style={{width:`${Math.min(x.oee,100)}%`}}/></div><strong>{x.oee.toFixed(1)}%</strong></div>)}</div></Panel>
      <Panel title="AI Executive Insight" sub="Auto summary"><div className="insight"><AlertTriangle size={18}/><p>ภาพรวม OEE <b>{kpi.oee.toFixed(1)}%</b> เทียบ Target {target}% สถานะ <b>{statusText(status)}</b>{worstLine && <> จุดที่ควรโฟกัสคือ <b>{worstLine.line}</b> OEE {worstLine.oee.toFixed(1)}%</>}{topLoss && <> และ Loss สูงสุดคือ <b>{topLoss[0]}</b> จำนวน {topLoss[1].toLocaleString()} นาที</>}.</p></div></Panel>
      <Panel title="Top Loss Time" sub="Pareto focus"><Bar data={lossData} options={{...chartOptions, indexAxis:'y'}}/></Panel>
      <Panel title="Daily Traffic Light" sub="Line x Date | Green / Yellow / Red"><Traffic rows={filtered} target={target}/></Panel>
      <Panel title="OEE Records" sub="Raw data preview" className="full"><Raw rows={filtered.slice(0,50)}/></Panel>
    </main>
  </div>;
}
function Kpi({title,value,badge,ok}){ return <div className="card"><div className="label">{title}</div><div className="big">{value}</div><span className={ok?'green':'red'}>{badge}</span></div> }
function Panel({title,sub,children,className=''}){ return <section className={`panel ${className}`}><div className="panelhead"><div><h2>{title}</h2><p>{sub}</p></div></div><div className="panelbody">{children}</div></section> }
function Traffic({rows,target}){ const dates=[...new Set(rows.map(x=>x.date))].sort(); const lines=[...new Set(rows.map(x=>x.line))].sort(); return <div className="traffic"><div className="corner">Line</div>{dates.map(d=><div className="th" key={d}>{d.slice(5)}</div>)}{lines.map(line=><React.Fragment key={line}><div className="lineName">{line}</div>{dates.map(d=>{const arr=rows.filter(x=>x.line===line&&x.date===d); const v=avg(arr,'oee'); const c=arr.length?colorStatus(v,target):'blank'; return <div title={`${line} ${d} OEE ${v.toFixed(1)}%`} className={`dot ${c}`} key={d}></div>})}</React.Fragment>)}</div> }
function Raw({rows}){ return <div className="tablewrap"><table><thead><tr>{['Date','Shift','Line','Output','Defect','%A','%P','%Q','%OEE','Plan DT','Unplan DT','Waiting','Startup','Setup'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.date}</td><td>{r.shift}</td><td>{r.line}</td><td>{r.output}</td><td>{r.defect}</td><td>{r.availability}</td><td>{r.performance}</td><td>{r.quality}</td><td>{r.oee}</td><td>{r.planDt}</td><td>{r.unplanDt}</td><td>{r.waiting}</td><td>{r.startup}</td><td>{r.setup}</td></tr>)}</tbody></table></div> }
function formatK(v){ if(v>=1000000)return `${(v/1000000).toFixed(1)}M`; if(v>=1000)return `${Math.round(v/1000)}K`; return Math.round(v).toLocaleString(); }

createRoot(document.getElementById('root')).render(<App />);
