// Habillage du module repris de la maquette validée (suivi-carburant-v5) : en-tête, onglets, bandeau de filtres.
// Classes préfixées « ftm- » pour ne rien casser hors du module.
export const SHELL_CSS = `
.ftm { --bg:#FFFFFF; --plane:#F6F8FB; --surface:#FFFFFF; --line:#E6EAF0; --line-2:#F0F2F6; --fg:#0B1220; --fg-2:#4B5768; --fg-3:#7D889B;
  --brand:#0B1F4D; --accent:#1A56C4; --accent-soft:#EAF1FD; --good:#0CA30C; --warn:#FAB219; --crit:#D03B3B; --crit-soft:#FDECEC;
  --shadow:0 1px 2px rgba(11,31,77,.04), 0 8px 24px -16px rgba(11,31,77,.22); color:var(--fg); font-size:14px; line-height:1.45; }
.ftm-top { border-bottom:1px solid var(--line); background:var(--bg); position:sticky; top:0; z-index:20; padding:0 16px; }
.ftm-row1 { display:flex; align-items:center; gap:14px; padding-top:12px; flex-wrap:wrap; }
.ftm-logo { width:30px; height:30px; border-radius:8px; background:var(--brand); display:grid; place-items:center; color:#fff; font-weight:800; font-size:14px; flex:none; }
.ftm-top h1 { margin:0; font-size:18px; font-weight:800; letter-spacing:-.01em; white-space:nowrap; }
.ftm-live { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--fg-2); padding:4px 10px; border:1px solid var(--line); border-radius:999px; background:var(--plane); white-space:nowrap; cursor:help; }
.ftm-pulse { width:8px; height:8px; border-radius:50%; background:var(--good); flex:none; }
.ftm-pulse[data-state="warn"] { background:var(--warn); box-shadow:0 0 0 0 rgba(250,178,25,.6); }
@media (prefers-reduced-motion: no-preference) { .ftm-pulse[data-state="warn"] { animation:ftmPulse 2s infinite; } }
@keyframes ftmPulse { 70% { box-shadow:0 0 0 7px rgba(250,178,25,0); } 100% { box-shadow:0 0 0 0 rgba(250,178,25,0); } }
.ftm-icon { margin-left:auto; width:34px; height:34px; border-radius:10px; border:1px solid var(--line); background:var(--surface); display:grid; place-items:center; cursor:pointer; color:var(--fg-2); }
.ftm-bell { margin-left:auto; display:inline-flex; align-items:center; gap:8px; border:1px solid var(--line); background:var(--surface); border-radius:10px; padding:6px 12px; cursor:pointer; font-weight:700; font-size:13px; color:var(--fg); font-family:inherit; }
.ftm-bell:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.ftm-badge { background:var(--crit); color:#fff; border-radius:999px; font-size:11px; padding:1px 7px; }
.ftm-bell + .ftm-icon { margin-left:0; }
.ftm-cnt { font-size:11px; background:var(--crit-soft); color:var(--crit); border-radius:999px; padding:0 6px; margin-left:4px; }
.ftm-tabs { display:flex; gap:4px; overflow-x:auto; scrollbar-width:none; margin-top:8px; }
.ftm-tabs button { all:unset; color:var(--fg-2); font-weight:600; font-size:13.5px; padding:10px 12px; border-bottom:2px solid transparent; white-space:nowrap; cursor:pointer; }
.ftm-tabs button[aria-current="page"] { color:var(--accent); border-bottom-color:var(--accent); }
.ftm-tabs button:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; border-radius:4px; }
.ftm-slicers { background:var(--plane); border-bottom:1px solid var(--line); padding:12px 16px; display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; }
.ftm-sel { display:grid; gap:2px; flex:0 1 160px; min-width:130px; }
.ftm-sel > span { font-size:10.5px; font-weight:700; color:var(--fg-3); text-transform:uppercase; letter-spacing:.05em; }
.ftm-sel select, .ftm-sel input { height:34px; border:1px solid var(--line); border-radius:8px; background:var(--surface); padding:0 8px; font-size:13px; font-weight:600; color:var(--fg); font-family:inherit; }
.ftm-sel select.on { border-color:var(--accent); background:var(--accent-soft); color:var(--accent); }
.ftm-count { font-size:12px; color:var(--fg-3); align-self:center; white-space:nowrap; }
.ftm-clear { border:none; background:none; color:var(--accent); font-weight:700; font-size:12px; cursor:pointer; white-space:nowrap; align-self:center; padding:0; }
.ftm-main { padding:18px 16px 48px; display:flex; flex-direction:column; gap:16px; }
`;
