const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const DEFAULT_AWARENESS_SETTINGS = { currentWindowEnabled: false, visionEnabled: false, clipboardEnabled: false, fileManagementEnabled: false, telemetryEnabled: false };
const POWERSHELL_PROBE = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SPPetForeground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
$handle = [SPPetForeground]::GetForegroundWindow()
$builder = New-Object System.Text.StringBuilder 1024
[void][SPPetForeground]::GetWindowText($handle, $builder, $builder.Capacity)
$processIdValue = [uint32]0
[void][SPPetForeground]::GetWindowThreadProcessId($handle, [ref]$processIdValue)
$processName = ''
try { $processName = (Get-Process -Id $processIdValue -ErrorAction Stop).ProcessName } catch {}
[pscustomobject]@{ process = $processName; title = $builder.ToString(); capturedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress
`;

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const defaultProbe = () => new Promise((resolve, reject) => execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', POWERSHELL_PROBE], { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 }, (error, stdout) => { if (error) reject(error); else { try { resolve(JSON.parse(stdout.trim())); } catch { reject(new Error('无法解析当前窗口信息')); } } }));

class SystemAwareness {
  constructor(dataDirectory, probe = defaultProbe) { this.settingsFile = path.join(dataDirectory, 'awareness-settings.json'); this.probe = probe; this.lastWindow = null; fs.mkdirSync(dataDirectory, { recursive: true }); }
  settings() { const value = readJson(this.settingsFile, {}); return Object.fromEntries(Object.keys(DEFAULT_AWARENESS_SETTINGS).map((key) => [key, value[key] === true])); }
  updateSettings(changes) { const before = this.settings(), next = Object.fromEntries(Object.keys(DEFAULT_AWARENESS_SETTINGS).map((key) => [key, changes[key] === undefined ? before[key] : changes[key] === true])); writeJsonAtomic(this.settingsFile, next); if (!next.currentWindowEnabled) this.lastWindow = null; return next; }
  snapshot() { return { settings: this.settings(), currentWindow: this.lastWindow }; }
  async readCurrentWindow() { if (!this.settings().currentWindowEnabled) throw new Error('请先明确启用当前窗口读取权限'); const value = await this.probe(); this.lastWindow = { process: String(value?.process || '').slice(0, 200), title: String(value?.title || '').slice(0, 1000), capturedAt: String(value?.capturedAt || new Date().toISOString()) }; return this.lastWindow; }
}

module.exports = { SystemAwareness, DEFAULT_AWARENESS_SETTINGS };
