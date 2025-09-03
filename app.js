const $ = (sel) => document.querySelector(sel);
const Log = {
  info: (...a) => console.info('[TrailGuard]', ...a),
  warn: (...a) => console.warn('[TrailGuard]', ...a),
  error: (...a) => console.error('[TrailGuard]', ...a),
  debug: (...a) => console.debug('[TrailGuard]', ...a)
};

// Global error hooks for better diagnostics
window.addEventListener('error', (e) => {
  Log.error('Uncaught error', e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  Log.error('Unhandled rejection', e.reason);
});

// Map state (Leaflet + geolocation)
let map = null;
let userMarker = null;
let pathLine = null;
let geoWatchId = null;
let lastPosition = null;
let homeMap = null;
let homeUserMarker = null;
let homePathLine = null;
let homeAccuracyCircle = null;

// Dynamically load Leaflet if not present (fallback across CDNs)
function loadLeaflet() {
  if (typeof window.L !== 'undefined') return Promise.resolve();
  Log.info('Leaflet missing; loading dynamically');
  const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = cssHref;
    document.head.appendChild(l);
  }
  const urls = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
  ];
  return new Promise((resolve, reject) => {
    const tryNext = (i) => {
      if (typeof window.L !== 'undefined') return resolve();
      if (i >= urls.length) return reject(new Error('Leaflet failed to load'));
      const s = document.createElement('script');
      s.src = urls[i];
      s.onload = () => {
        Log.info('Leaflet loaded from', urls[i]);
        resolve();
      };
      s.onerror = () => {
        Log.warn('Leaflet load failed from', urls[i]);
        s.remove();
        tryNext(i + 1);
      };
      document.head.appendChild(s);
    };
    tryNext(0);
  });
}

function ensureBreadcrumbShape() {
  let mutated = false;
  state.breadcrumbs = state.breadcrumbs.map(pt => {
    if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
      mutated = true;
      return { t: pt.t || Date.now(), lat: Number(pt.y), lng: Number(pt.x) };
    }
    return pt;
  });
  if (mutated) localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
}

function ensureGeoWatch() {
  if (geoWatchId || !('geolocation' in navigator)) return;
  geoWatchId = navigator.geolocation.watchPosition((pos) => {
    lastPosition = pos;
    if (map && userMarker) {
      userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    }
    if (homeMap && homeUserMarker) {
      homeUserMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    }
    // Update home accuracy circle and follow recenter
    if (homeMap) {
      const acc = Math.max(5, Math.min(200, Number(pos.coords.accuracy || 0)));
      if (homeAccuracyCircle) {
        homeAccuracyCircle.setLatLng([pos.coords.latitude, pos.coords.longitude]);
        homeAccuracyCircle.setRadius(acc);
      }
      if (document.getElementById('home-follow')?.checked) {
        homeMap.setView([pos.coords.latitude, pos.coords.longitude]);
      }
      const s = document.getElementById('home-status');
      if (s) s.textContent = `Lat ${pos.coords.latitude.toFixed(5)}, Lng ${pos.coords.longitude.toFixed(5)} (±${Math.round(acc)}m)`;
    }
  }, (err) => {
    Log.warn('Geo watch error', err);
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  Log.info('Started geolocation watch', geoWatchId);
}

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
    Log.info('Render route: home');
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
      <div class="card">
        <div class="map-mini"><div id="home-map"></div></div>
        <div class="mini-controls">
          <label class="toggle"><input type="checkbox" id="home-follow" checked> Follow</label>
          <button class="btn btn-outline btn-sm" id="home-recenter">Recenter</button>
        </div>
        <div class="small" id="home-status"></div>
      </div>
      <button class="sos" id="sos">SOS</button>
    `;
    $("#checkin-ok").addEventListener('click', () => alert("Check-in sent: I'm OK"));
    $("#checkin-delayed").addEventListener('click', () => alert("Check-in sent: Delayed"));
    $("#sos").addEventListener('click', () => location.hash = "#/sos");

    const showFallback = () => {
      const target = document.getElementById('home-map');
      const status = document.getElementById('home-status');
      if (target) {
        target.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Map failed to load. Check connection.</div>';
      }
      if (status) status.textContent = 'Leaflet not loaded; showing placeholder.';
      Log.warn('Home map fallback shown');
    };

    ensureBreadcrumbShape();
    ensureGeoWatch();

    const initHome = (center) => {
      Log.debug('Home map init at', center);
      if (!homeMap) {
        homeMap = L.map('home-map', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(homeMap);
      }
      homeMap.setView(center, 14);
      setTimeout(() => { try { homeMap.invalidateSize(); } catch(e) {} }, 0);
      const latlngs = state.breadcrumbs.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
      if (homePathLine) homePathLine.setLatLngs(latlngs);
      else if (latlngs.length) homePathLine = L.polyline(latlngs, { color: '#10b981' }).addTo(homeMap);
      if (lastPosition) {
        const { latitude, longitude } = lastPosition.coords;
        if (!homeUserMarker) homeUserMarker = L.marker([latitude, longitude]).addTo(homeMap);
        else homeUserMarker.setLatLng([latitude, longitude]);
        const acc = Math.max(5, Math.min(200, Number(lastPosition.coords.accuracy || 0)));
        if (!homeAccuracyCircle) {
          homeAccuracyCircle = L.circle([latitude, longitude], { radius: acc, color: '#60a5fa', fillColor: '#93c5fd', fillOpacity: 0.2, weight: 1 });
          homeAccuracyCircle.addTo(homeMap);
        } else {
          homeAccuracyCircle.setLatLng([latitude, longitude]);
          homeAccuracyCircle.setRadius(acc);
        }
      }
    };

    const startHome = () => {
      if (lastPosition) {
        initHome([lastPosition.coords.latitude, lastPosition.coords.longitude]);
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          lastPosition = pos;
          initHome([pos.coords.latitude, pos.coords.longitude]);
        }, () => initHome([0,0]), { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });
      } else {
        initHome([0, 0]);
      }
    };

    if (typeof window.L === 'undefined') {
      loadLeaflet().then(() => {
        startHome();
        setTimeout(() => { try { homeMap && homeMap.invalidateSize(); } catch(e) {} }, 150);
      }).catch(showFallback);
    } else {
      startHome();
      setTimeout(() => { try { homeMap && homeMap.invalidateSize(); } catch(e) {} }, 150);
    }

    // Home controls
    const homeStatus = document.getElementById('home-status');
    const followEl = document.getElementById('home-follow');
    const recenterBtn = document.getElementById('home-recenter');
    recenterBtn?.addEventListener('click', () => {
      if (lastPosition && homeMap) {
        homeMap.setView([lastPosition.coords.latitude, lastPosition.coords.longitude]);
      }
    });
  }

  if (route === "#/map") {
    Log.info('Render route: map');
    view.innerHTML = `
      <div class="card map-container"><div id="map"></div></div>
      <div class="card">
        <div class="row">
          <button class="btn btn-outline" id="drop">Drop Waypoint</button>
          <label class="toggle"><input type="checkbox" id="follow" checked> Follow</label>
        </div>
        <span class="small" id="crumbcount"></span>
      </div>
    `;

    const startMapView = () => {
      const ensureBreadcrumbShape = () => {
        // Migrate old mock breadcrumb shape {x, y} -> {lat, lng}
        let mutated = false;
        state.breadcrumbs = state.breadcrumbs.map(pt => {
          if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
            mutated = true;
            return { t: pt.t || Date.now(), lat: Number(pt.y), lng: Number(pt.x) };
          }
          return pt;
        });
        if (mutated) localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
      };
      ensureBreadcrumbShape();

      const count = state.breadcrumbs.length;
      $("#crumbcount").textContent = count ? `${count} points saved` : "No points yet";

      // Initialize map if not yet
      const initMap = (center) => {
        Log.debug('Full map init at', center);
        if (!map) {
          map = L.map('map');
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);
        }
        map.setView(center, 15);

        // Draw existing breadcrumb polyline
        const latlngs = state.breadcrumbs.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        if (pathLine) { pathLine.setLatLngs(latlngs); } else { pathLine = L.polyline(latlngs, { color: '#10b981' }).addTo(map); }

        // Fit if many points
        if (latlngs.length > 1) {
          map.fitBounds(pathLine.getBounds(), { padding: [20, 20] });
        }
      };

      const upsertUserMarker = (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        if (!userMarker) {
          userMarker = L.marker(latlng, { title: 'You' }).addTo(map);
        } else {
          userMarker.setLatLng(latlng);
        }
      };

      const followEl = $('#follow');

      // Start geolocation
      const startGeo = () => {
        if (!('geolocation' in navigator)) {
          $("#crumbcount").textContent = 'Geolocation not supported';
          // Fallback center (0,0)
          initMap([0, 0]);
          Log.warn('Geolocation not supported');
          return;
        }

        $("#crumbcount").textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition((pos) => {
          lastPosition = pos;
          initMap([pos.coords.latitude, pos.coords.longitude]);
          upsertUserMarker(pos);
          $("#crumbcount").textContent = `${state.breadcrumbs.length} points saved`;
          Log.info('Initial position', pos.coords);
        }, (err) => {
          $("#crumbcount").textContent = `Location error: ${err.code}`;
          initMap([0, 0]);
          Log.warn('Initial geolocation error', err);
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });

        // Watch updates
        if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = navigator.geolocation.watchPosition((pos) => {
          lastPosition = pos;
          if (!map) initMap([pos.coords.latitude, pos.coords.longitude]);
          upsertUserMarker(pos);
          if (followEl?.checked) map.setView([pos.coords.latitude, pos.coords.longitude]);
        }, (err) => Log.warn('Map watch error', err), { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
        Log.info('Started map geolocation watch', geoWatchId);
      };

      startGeo();

      // Drop Waypoint uses last known position
      $("#drop").addEventListener('click', () => {
        const now = Date.now();
        if (lastPosition) {
          const { latitude, longitude } = lastPosition.coords;
          const pt = { t: now, lat: latitude, lng: longitude };
          state.breadcrumbs.push(pt);
          localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
          $("#crumbcount").textContent = `${state.breadcrumbs.length} points saved`;
          if (pathLine) {
            const pts = pathLine.getLatLngs();
            pts.push([pt.lat, pt.lng]);
            pathLine.setLatLngs(pts);
          } else {
            pathLine = L.polyline([[pt.lat, pt.lng]], { color: '#10b981' }).addTo(map);
          }
          L.circleMarker([pt.lat, pt.lng], { radius: 4, color: '#10b981' }).addTo(map);
        } else {
          $("#crumbcount").textContent = 'No position yet; trying again…';
          startGeo();
        }
      });
    };

    if (typeof window.L === 'undefined') {
      loadLeaflet().then(startMapView).catch(() => {
        $("#crumbcount").textContent = 'Map library failed to load. Check connection and refresh.';
      });
    } else {
      startMapView();
    }

    const ensureBreadcrumbShape = () => {
      // Migrate old mock breadcrumb shape {x, y} -> {lat, lng}
      let mutated = false;
      state.breadcrumbs = state.breadcrumbs.map(pt => {
        if (pt && typeof pt === 'object' && 'x' in pt && 'y' in pt) {
          mutated = true;
          return { t: pt.t || Date.now(), lat: Number(pt.y), lng: Number(pt.x) };
        }
        return pt;
      });
      if (mutated) localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
    };
    ensureBreadcrumbShape();

    const count = state.breadcrumbs.length;
    $("#crumbcount").textContent = count ? `${count} points saved` : "No points yet";

    // Initialize map if not yet
    const initMap = (center) => {
      if (!map) {
        map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
      }
      map.setView(center, 15);

      // Draw existing breadcrumb polyline
      const latlngs = state.breadcrumbs.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
      if (pathLine) { pathLine.setLatLngs(latlngs); } else { pathLine = L.polyline(latlngs, { color: '#10b981' }).addTo(map); }

      // Fit if many points
      if (latlngs.length > 1) {
        map.fitBounds(pathLine.getBounds(), { padding: [20, 20] });
      }
    };

    const upsertUserMarker = (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (!userMarker) {
        userMarker = L.marker(latlng, { title: 'You' }).addTo(map);
      } else {
        userMarker.setLatLng(latlng);
      }
    };

    const followEl = $('#follow');

    // Start geolocation
    const startGeo = () => {
      if (!('geolocation' in navigator)) {
        $("#crumbcount").textContent = 'Geolocation not supported';
        // Fallback center (0,0)
        initMap([0, 0]);
        return;
      }

      $("#crumbcount").textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition((pos) => {
        lastPosition = pos;
        initMap([pos.coords.latitude, pos.coords.longitude]);
        upsertUserMarker(pos);
        $("#crumbcount").textContent = `${state.breadcrumbs.length} points saved`;
      }, (err) => {
        $("#crumbcount").textContent = `Location error: ${err.code}`;
        initMap([0, 0]);
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });

      // Watch updates
      if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = navigator.geolocation.watchPosition((pos) => {
        lastPosition = pos;
        if (!map) initMap([pos.coords.latitude, pos.coords.longitude]);
        upsertUserMarker(pos);
        if (followEl?.checked) map.setView([pos.coords.latitude, pos.coords.longitude]);
      }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    };

    startGeo();

    // Drop Waypoint uses last known position
    $("#drop").addEventListener('click', () => {
      const now = Date.now();
      if (lastPosition) {
        const { latitude, longitude } = lastPosition.coords;
        const pt = { t: now, lat: latitude, lng: longitude };
        state.breadcrumbs.push(pt);
        localStorage.setItem('tg_breadcrumbs', JSON.stringify(state.breadcrumbs));
        $("#crumbcount").textContent = `${state.breadcrumbs.length} points saved`;
        if (pathLine) {
          const pts = pathLine.getLatLngs();
          pts.push([pt.lat, pt.lng]);
          pathLine.setLatLngs(pts);
        } else {
          pathLine = L.polyline([[pt.lat, pt.lng]], { color: '#10b981' }).addTo(map);
        }
        L.circleMarker([pt.lat, pt.lng], { radius: 4, color: '#10b981' }).addTo(map);
      } else {
        $("#crumbcount").textContent = 'No position yet; trying again…';
        startGeo();
      }
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
