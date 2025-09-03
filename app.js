const $ = (sel) => document.querySelector(sel);

const state = {
  battery: 82,
  solar: true,
  connection: navigator.onLine ? "Online" : "Offline",
  family: [
    {name: "Jake", status: "Active", last: "now"},
    {name: "Sam", status: "Idle 5m", last: "5m ago"},
    {name: "Mom", status: "Signal Lost", last: "20m ago"},
  ],
  breadcrumbs: JSON.parse(localStorage.getItem('tg_breadcrumbs')||'[]')
};

function setStatusBadge() {
  const b = $("#status-badge");
  b.textContent = state.connection;
  b.style.background = state.connection === "Online" ? "#10b981" : "#94a3b8";
}

window.addEventListener('online', () => { state.connection = "Online"; setStatusBadge(); });
window.addEventListener('offline', () => { state.connection = "Offline"; setStatusBadge(); });

function render(route) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-route="${route}"]`)?.classList.add('active');

  const view = $("#view");
  if (route === "#/home" || route === "" || route === "#/") {
    view.innerHTML = `
      <div class="card kv">
        <div>Location</div><div>Trail Ridge (mock)</div>
        <div>Battery</div><div>${state.battery}%</div>
        <div>Connection</div><div>${state.connection}</div>
        <div>Family Connected</div><div>${state.family.length}</div>
      </div>
      <div class="card">
        <button class="btn btn-primary" id="checkin-ok">I'm OK</button>
        <button class="btn btn-outline" id="checkin-delayed" style="margin-left:8px">Delayed</button>
      </div>
      <div class="card mapbox">[ Trail Map Preview ]</div>
      <button class="sos" id="sos">SOS</button>
    `;
    $("#checkin-ok").addEventListener('click', () => alert("Check-in sent: I'm OK"));
    $("#checkin-delayed").addEventListener('click', () => alert("Check-in sent: Delayed"));
    $("#sos").addEventListener('click', () => location.hash = "#/sos");
  }

  if (route === "#/map") {
    view.innerHTML = `
      <div class="card mapbox" id="mapbox">[ Breadcrumb Trail (mock) ]</div>
      <div class="card">
        <button class="btn btn-outline" id="drop">Drop Waypoint</button>
        <span class="small" id="crumbcount"></span>
      </div>
    `;
    const count = state.breadcrumbs.length;
    $("#crumbcount").textContent = count ? count + " points saved" : "No points yet";
    $("#drop").addEventListener('click', () => {
      const pt = { t: Date.now(), x: Math.random().toFixed(5), y: Math.random().toFixed(5)};
      state.breadcrumbs.push(pt);
      localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
      $("#crumbcount").textContent = state.breadcrumbs.length + " points saved";
    });
  }

  if (route === "#/checkin") {
    view.innerHTML = `
      <div class="card">
        <button class="btn btn-primary" id="ok">I'm OK</button>
        <button class="btn btn-outline" id="onway" style="margin-left:8px">On My Way</button>
        <button class="btn btn-outline" id="delayed" style="margin-left:8px">Delayed</button>
      </div>
      <div class="card">
        <input class="input" id="msg" placeholder="Type message (mock only)"/>
        <div style="margin-top:8px">
          <button class="btn btn-primary" id="send">Send</button>
        </div>
      </div>
    `;
    const sendMsg = (text) => alert("Sent: " + text);
    $("#ok").addEventListener('click', () => sendMsg("I'm OK"));
    $("#onway").addEventListener('click', () => sendMsg("On my way"));
    $("#delayed").addEventListener('click', () => sendMsg("Delayed"));
    $("#send").addEventListener('click', () => sendMsg($("#msg").value || "(empty)"));
  }

  if (route === "#/family") {
    view.innerHTML = `
      <div class="card">
        <ul class="list" id="famlist"></ul>
        <div style="margin-top:8px">
          <input class="input" id="newname" placeholder="Add member name"/>
          <button class="btn btn-primary" id="add" style="margin-top:8px">Add</button>
        </div>
      </div>
    `;
    const ul = $("#famlist");
    state.family.forEach((m, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${m.name} (${m.status})</span><button class="btn btn-outline" data-i="${i}">Remove</button>`;
      ul.appendChild(li);
    });
    ul.addEventListener('click', (e) => {
      const i = e.target.dataset.i;
      if (i !== undefined) {
        state.family.splice(Number(i), 1);
        render("#/family");
      }
    });
    $("#add").addEventListener('click', () => {
      const v = $("#newname").value.trim();
      if (!v) return;
      state.family.push({name: v, status: "Active", last: "now"});
      render("#/family");
    });
  }

  if (route === "#/settings") {
    view.innerHTML = `
      <div class="card">
        <div class="row toggle">
          <label>Dark Mode</label>
          <input type="checkbox" id="dark"/>
        </div>
        <div class="row"><button class="btn btn-outline" id="pair">Pair New Device</button></div>
        <div class="row"><button class="btn btn-outline" id="alerts">Set Auto-Alerts</button></div>
        <div class="row"><button class="btn btn-outline" id="fw">Check Firmware Updates</button></div>
      </div>
    `;
    $("#dark").addEventListener('change', (e) => {
      document.body.style.background = e.target.checked ? "#0b1220" : "#f1f5f9";
      document.body.style.color = e.target.checked ? "#e5e7eb" : "#0f172a";
    });
    $("#pair").addEventListener('click', () => alert("Mock: Pairing mode"));
    $("#alerts").addEventListener('click', () => alert("Mock: Auto-alerts settings"));
    $("#fw").addEventListener('click', () => alert("Mock: Firmware up to date"));
  }

  if (route === "#/sos") {
    view.innerHTML = `
      <div class="card" style="text-align:center">
        <h2 style="color:#ef4444">Emergency Mode</h2>
        <p>SOS Activated. Location shared with contacts + 911 (mock).</p>
        <button class="btn btn-danger" id="cancel">Cancel SOS</button>
      </div>
    `;
    $("#cancel").addEventListener('click', () => {
      alert("SOS canceled (mock)");
      location.hash = "#/home";
    });
  }
}

function router() {
  const route = location.hash || "#/home";
  render(route);
  setStatusBadge();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.route;
  });
});

window.addEventListener('hashchange', router);
router();
