const MAX_HISTORY = 240;
const state = {
  tx: {},
  rx: {},
  history: [],
  records: [],
  ports: { TX: null, RX: null },
  readers: { TX: null, RX: null },
  demoTimer: null,
  demoTick: 0,
};

const $ = (id) => document.getElementById(id);
const ui = {
  connectTX: $('connect-tx'), connectRX: $('connect-rx'), demo: $('demo-toggle'),
  txCard: $('tx-card'), rxCard: $('rx-card'), txBadge: $('tx-badge'), rxBadge: $('rx-badge'),
  txLight: $('tx-light'), rxLight: $('rx-light'), measure: $('measure-state'), comm: $('comm-state'),
  link: $('link-state'), page: $('page-state'), baud: $('baud-value'), test: $('test-state'),
  testCaption: $('test-caption'), txCount: $('tx-count'), rxCount: $('rx-count'), lost: $('lost-count'),
  crc: $('crc-count'), lastSeq: $('last-seq'), lossRate: $('loss-rate'), lossGauge: $('loss-gauge'),
  qualityGrade: $('quality-grade'), canvas: $('light-chart'), empty: $('chart-empty'),
  sampleCount: $('sample-count'), lastUpdate: $('last-update'), log: $('event-log'),
  systemStatus: $('system-status'), clock: $('clock'), browserSupport: $('browser-support'),
  pulse: document.querySelector('.pulse'), window: $('time-window'), toast: $('toast'),
};

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 2800);
}

function addLog(source, message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  entry.innerHTML = `<time>${now}</time><span>${source}</span><p></p>`;
  entry.querySelector('p').textContent = message;
  ui.log.prepend(entry);
  while (ui.log.children.length > 8) ui.log.lastElementChild.remove();
}

function connected(role, yes) {
  const button = role === 'TX' ? ui.connectTX : ui.connectRX;
  const badge = role === 'TX' ? ui.txBadge : ui.rxBadge;
  button.classList.toggle('active', yes);
  button.lastChild.textContent = yes ? `断开${role === 'TX' ? '发射端' : '接收端'}` : `连接${role === 'TX' ? '发射端' : '接收端'}`;
  badge.textContent = yes ? '已连接' : '未连接';
  badge.classList.toggle('online', yes);
  updateSystemStatus();
}

function updateSystemStatus() {
  const serialCount = Number(Boolean(state.ports.TX)) + Number(Boolean(state.ports.RX));
  const active = serialCount > 0 || Boolean(state.demoTimer);
  ui.systemStatus.textContent = state.demoTimer ? '演示数据运行中' : serialCount ? `已连接 ${serialCount} 个串口` : '等待设备连接';
  ui.pulse.classList.toggle('online', active);
}

function testCaption(value) {
  return ({ IDLE: '等待开始测试', RUNNING: '60秒通信测试进行中', SETTLING: '正在核对最终帧数', DONE: '测试已经完成', ABORTED: '测试已中止' })[value] || '等待状态更新';
}

function processRecord(data, expectedRole = null) {
  if (!data || data.v !== 1 || !['TX', 'RX'].includes(data.role)) return;
  const role = data.role;
  if (expectedRole && expectedRole !== role) addLog('提示', `${expectedRole}接口收到${role}数据，已自动识别`);
  if (data.event === 'boot') {
    addLog(role, `板卡启动，串口 ${data.serial_baud} bps`);
    return;
  }

  state[role.toLowerCase()] = data;
  const now = Date.now();
  const previous = state.history.at(-1) || {};
  state.history.push({
    time: now,
    tx: role === 'TX' ? Number(data.light) : previous.tx,
    rx: role === 'RX' ? Number(data.light) : previous.rx,
  });
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.records.push({ receivedAt: new Date().toISOString(), ...data });
  if (state.records.length > 5000) state.records.shift();
  render();
}

function render() {
  const tx = state.tx;
  const rx = state.rx;
  const hasTX = Number.isFinite(Number(tx.light));
  const hasRX = Number.isFinite(Number(rx.light));

  ui.txLight.textContent = hasTX ? tx.light : '--';
  ui.rxLight.textContent = hasRX ? rx.light : '--';
  ui.measure.textContent = tx.measure ? 'ON' : 'OFF';
  ui.comm.textContent = tx.comm ? 'ON' : 'OFF';
  ui.link.textContent = rx.online ? 'ONLINE' : 'OFFLINE';
  ui.page.textContent = (rx.page || tx.page || '--').toUpperCase();
  ui.baud.textContent = Number(rx.rs485_baud || tx.rs485_baud || 0).toLocaleString() || '--';
  const test = rx.test || tx.test || 'IDLE';
  ui.test.textContent = test;
  ui.testCaption.textContent = testCaption(test);
  ui.txCount.textContent = Number(tx.tx || 0).toLocaleString();
  ui.rxCount.textContent = Number(rx.rx || 0).toLocaleString();
  ui.lost.textContent = Number(rx.lost || 0).toLocaleString();
  ui.crc.textContent = Number(rx.crc || 0).toLocaleString();
  ui.lastSeq.textContent = Number(rx.last_seq || 0).toLocaleString();

  const loss = Number(rx.loss_x100 || 0) / 100;
  ui.lossRate.textContent = loss.toFixed(2);
  ui.lossGauge.style.setProperty('--loss-angle', `${(Math.min(loss * 8, 100) * 3.6).toFixed(2)}deg`);
  const grade = loss === 0 ? 'A+' : loss < 0.5 ? 'A' : loss < 2 ? 'B' : loss < 5 ? 'C' : 'D';
  ui.qualityGrade.textContent = grade;

  ui.txCard.dataset.state = tx.measure ? 'online' : 'idle';
  ui.rxCard.dataset.state = rx.online ? 'online' : 'idle';
  $('flow-sample').textContent = tx.measure ? `光照 ${tx.light}` : '等待测量';
  $('flow-send').textContent = tx.comm ? `已发送 ${tx.tx || 0} 帧` : '等待通信';
  $('flow-receive').textContent = rx.online ? `已接收 ${rx.rx || 0} 帧` : '等待链路';
  $('flow-summary').textContent = test === 'DONE' ? `丢包 ${loss.toFixed(2)}%` : '尚未完成';

  ui.sampleCount.textContent = state.history.length;
  ui.lastUpdate.textContent = `最后更新：${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  ui.empty.classList.toggle('hidden', state.history.length > 1);
  drawChart();
}

function chartData() {
  const limit = Number(ui.window.value);
  return state.history.slice(-limit);
}

function drawChart() {
  const canvas = ui.canvas;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width, h = rect.height, pad = { l: 42, r: 12, t: 12, b: 30 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ph * i / 4;
    ctx.strokeStyle = 'rgba(140,179,216,.13)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#678097';
    ctx.fillText(String(100 - i * 25), pad.l - 9, y);
  }
  for (let i = 0; i <= 8; i++) {
    const x = pad.l + pw * i / 8;
    ctx.strokeStyle = 'rgba(140,179,216,.075)';
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
  }

  const data = chartData();
  const plot = (field, color) => {
    ctx.beginPath();
    let started = false;
    data.forEach((point, index) => {
      const value = Number(point[field]);
      if (!Number.isFinite(value)) return;
      const x = pad.l + (data.length <= 1 ? 0 : index / (data.length - 1)) * pw;
      const y = pad.t + (1 - Math.max(0, Math.min(100, value)) / 100) * ph;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    if (!started) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  plot('tx', '#31e6ff');
  plot('rx', '#ffad42');
}

async function connectSerial(role) {
  if (!('serial' in navigator)) {
    toast('当前浏览器不支持Web Serial，请使用最新版Chrome或Edge');
    return;
  }
  if (state.ports[role]) {
    await disconnectSerial(role);
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    state.ports[role] = port;
    connected(role, true);
    addLog(role, '串口连接成功');
    readSerial(role, port);
  } catch (error) {
    if (error.name !== 'NotFoundError') {
      addLog(role, `连接失败：${error.message}`);
      toast(`串口连接失败：${error.message}`);
    }
  }
}

async function readSerial(role, port) {
  const reader = port.readable.getReader();
  state.readers[role] = reader;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach((line) => {
        if (!line.trim()) return;
        try { processRecord(JSON.parse(line), role); }
        catch { addLog(role, `忽略非JSON内容：${line.slice(0, 50)}`); }
      });
    }
  } catch (error) {
    if (error.name !== 'NetworkError') addLog(role, `读取停止：${error.message}`);
  } finally {
    reader.releaseLock();
    state.readers[role] = null;
  }
}

async function disconnectSerial(role) {
  try {
    if (state.readers[role]) await state.readers[role].cancel();
    if (state.ports[role]) await state.ports[role].close();
  } catch (error) {
    addLog(role, `断开提示：${error.message}`);
  }
  state.ports[role] = null;
  connected(role, false);
  addLog(role, '串口已断开');
}

function toggleDemo() {
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
    ui.demo.textContent = '启动演示';
    ui.demo.classList.remove('active');
    addLog('演示', '模拟数据已停止');
    updateSystemStatus();
    return;
  }
  ui.demo.textContent = '停止演示';
  ui.demo.classList.add('active');
  addLog('演示', '模拟数据已启动');
  state.demoTimer = setInterval(() => {
    state.demoTick += 500;
    const t = state.demoTick / 1000;
    const light = Math.round(46 + 27 * Math.sin(t / 3.8) + 9 * Math.sin(t / 1.1));
    const txCount = Math.floor(state.demoTick / 100);
    const lost = Math.floor(txCount / 173);
    processRecord({ v: 1, role: 'TX', tick: state.demoTick, light, measure: 1, comm: 1, rs485_baud: 38400, test: t < 60 ? 'RUNNING' : 'DONE', tx: txCount, page: 'dashboard' });
    processRecord({ v: 1, role: 'RX', tick: state.demoTick + 20, light: Math.max(0, light + Math.round(Math.random() * 4 - 2)), online: 1, rs485_baud: 38400, test: t < 60 ? 'RUNNING' : 'DONE', rx: txCount - lost, lost, loss_x100: txCount ? Math.floor(lost * 10000 / txCount) : 0, crc: 0, last_seq: Math.max(0, txCount - 1), page: 'curve' });
  }, 500);
  updateSystemStatus();
}

function clearData() {
  state.history = [];
  state.records = [];
  ui.empty.classList.remove('hidden');
  ui.sampleCount.textContent = '0';
  drawChart();
  addLog('系统', '曲线和导出记录已清空');
}

function exportCSV() {
  if (!state.records.length) { toast('当前没有可以导出的数据'); return; }
  const headers = ['receivedAt','role','tick','light','measure','comm','online','rs485_baud','test','tx','rx','lost','loss_x100','crc','last_seq','page'];
  const rows = state.records.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','));
  const blob = new Blob(['\ufeff' + headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `rs485-telemetry-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  addLog('系统', `已导出 ${state.records.length} 条记录`);
}

ui.connectTX.addEventListener('click', () => connectSerial('TX'));
ui.connectRX.addEventListener('click', () => connectSerial('RX'));
ui.demo.addEventListener('click', toggleDemo);
$('clear-data').addEventListener('click', clearData);
$('export-data').addEventListener('click', exportCSV);
ui.window.addEventListener('change', drawChart);
window.addEventListener('resize', drawChart);
setInterval(() => { ui.clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }); }, 1000);

if ('serial' in navigator) {
  ui.browserSupport.textContent = '浏览器支持Web Serial，可连接开发板';
} else {
  ui.browserSupport.textContent = '请使用Chrome或Edge打开以连接串口';
}
drawChart();
