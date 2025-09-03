const { useState, useEffect } = React;

const Log = {
  info: (...a) => console.info('[TrailGuard]', ...a),
  warn: (...a) => console.warn('[TrailGuard]', ...a),
  error: (...a) => console.error('[TrailGuard]', ...a),
  debug: (...a) => console.debug('[TrailGuard]', ...a)
};

let map = null;
let userMarker = null;
let pathLine = null;
let geoWatchId = null;
let lastPosition = null;
let homeMap = null;
let homeUserMarker = null;
let homePathLine = null;
let homeAccuracyCircle = null;

function loadLeaflet() {
  if (typeof window.L !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cssHref = 'vendor/leaflet/leaflet.css';
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = cssHref;
      document.head.appendChild(l);
    }
    const urls = [
      'vendor/leaflet/leaflet.js',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
    ];
    const tryNext = (i) => {
      if (typeof window.L !== 'undefined') return resolve();
      if (i >= urls.length) return reject(new Error('Leaflet failed to load'));
      const s = document.createElement('script');
      s.src = urls[i];
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); tryNext(i + 1); };
      document.head.appendChild(s);
    };
    tryNext(0);
  });
}

function ensureGeoWatch(setState) {
  if (geoWatchId || !('geolocation' in navigator)) return;
  geoWatchId = navigator.geolocation.watchPosition((pos) => {
    lastPosition = pos;
    setState((s) => ({ ...s }));
    if (map && userMarker) {
      userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    }
    if (homeMap && homeUserMarker) {
      homeUserMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    }
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
}

function App() {
  const route = useHashRoute();
  const [state, setState] = useState({
    battery: 82,
    solar: true,
    connection: navigator.onLine ? 'Online' : 'Offline',
    family: [
      { name: 'Jake', status: 'Active', last: 'now' },
      { name: 'Sam', status: 'Idle 5m', last: '5m ago' },
      { name: 'Mom', status: 'Signal Lost', last: '20m ago' }
    ],
    breadcrumbs: JSON.parse(localStorage.getItem('tg_breadcrumbs') || '[]')
  });

  useEffect(() => {
    const update = () => setState((s) => ({ ...s, connection: navigator.onLine ? 'Online' : 'Offline' }));
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div id="app">
      <header className="app-header">
        <h1>TrailGuard</h1>
        <span id="status-badge" className="badge">{state.connection}</span>
      </header>
      <main id="view">
        {route === '#/home' && <HomeView state={state} setState={setState} />}
        {route === '#/map' && <MapView state={state} setState={setState} />}
        {route === '#/checkin' && <CheckinView />}
        {route === '#/family' && <FamilyView state={state} setState={setState} />}
        {route === '#/settings' && <SettingsView />}
        {route === '#/sos' && <SosView />}
      </main>
      <nav className="tabbar">
        <button data-route="#/home" className={route === '#/home' ? 'tab active' : 'tab'} onClick={() => location.hash = '#/home'}>Home</button>
        <button data-route="#/map" className={route === '#/map' ? 'tab active' : 'tab'} onClick={() => location.hash = '#/map'}>Map</button>
        <button data-route="#/checkin" className={route === '#/checkin' ? 'tab active' : 'tab'} onClick={() => location.hash = '#/checkin'}>Check-In</button>
        <button data-route="#/family" className={route === '#/family' ? 'tab active' : 'tab'} onClick={() => location.hash = '#/family'}>Family</button>
        <button data-route="#/settings" className={route === '#/settings' ? 'tab active' : 'tab'} onClick={() => location.hash = '#/settings'}>Settings</button>
      </nav>
    </div>
  );
}

function HomeView({ state, setState }) {
  useEffect(() => {
    loadLeaflet().then(() => {
      ensureGeoWatch(setState);
      const initHome = (center) => {
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
        if (!homeUserMarker && lastPosition) {
          const { latitude, longitude } = lastPosition.coords;
          homeUserMarker = L.marker([latitude, longitude]).addTo(homeMap);
        }
        if (!homeAccuracyCircle && lastPosition) {
          const { latitude, longitude, accuracy } = lastPosition.coords;
          homeAccuracyCircle = L.circle([latitude, longitude], {
            radius: Math.max(5, Math.min(200, Number(accuracy || 0))),
            color: '#0f172a22',
            weight: 1
          }).addTo(homeMap);
        }
      };
      if (lastPosition) {
        initHome([lastPosition.coords.latitude, lastPosition.coords.longitude]);
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          lastPosition = pos;
          initHome([pos.coords.latitude, pos.coords.longitude]);
        }, () => initHome([0, 0]));
      } else {
        initHome([0, 0]);
      }
    }).catch(() => {
      const target = document.getElementById('home-map');
      if (target) {
        target.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Map failed to load. Check connection.</div>';
      }
    });
  }, [state.breadcrumbs, setState]);

  return (
    <div>
      <div className="card kv">
        <div>Location</div><div>Trail Ridge (mock)</div>
        <div>Battery</div><div>{state.battery}%</div>
        <div>Connection</div><div>{state.connection}</div>
        <div>Family Connected</div><div>{state.family.length}</div>
      </div>
      <div className="card">
        <button className="btn btn-primary" onClick={() => alert("Check-in sent: I'm OK")}>I'm OK</button>
        <button className="btn btn-outline" style={{ marginLeft: '8px' }} onClick={() => alert('Check-in sent: Delayed')}>Delayed</button>
      </div>
      <div className="card">
        <div className="map-mini"><div id="home-map"></div></div>
        <div className="mini-controls">
          <label className="toggle"><input type="checkbox" id="home-follow" defaultChecked /> Follow</label>
          <button className="btn btn-outline btn-sm" id="home-recenter" onClick={() => { if (homeMap && lastPosition) homeMap.setView([lastPosition.coords.latitude, lastPosition.coords.longitude]); }}>Recenter</button>
        </div>
        <div className="small" id="home-status"></div>
      </div>
      <button className="sos" onClick={() => { location.hash = '#/sos'; }}>SOS</button>
    </div>
  );
}

function MapView({ state, setState }) {
  useEffect(() => {
    loadLeaflet().then(() => {
      const initMap = (center) => {
        if (!map) {
          map = L.map('map');
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);
        }
        map.setView(center, 15);
        const latlngs = state.breadcrumbs.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        if (pathLine) pathLine.setLatLngs(latlngs);
        else pathLine = L.polyline(latlngs, { color: '#10b981' }).addTo(map);
        if (latlngs.length > 1) {
          map.fitBounds(pathLine.getBounds(), { padding: [20, 20] });
        }
      };
      const upsertUserMarker = (pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        if (!userMarker) userMarker = L.marker(latlng, { title: 'You' }).addTo(map);
        else userMarker.setLatLng(latlng);
      };
      const startGeo = () => {
        if (!('geolocation' in navigator)) {
          document.getElementById('crumbcount').textContent = 'Geolocation not supported';
          initMap([0, 0]);
          return;
        }
        document.getElementById('crumbcount').textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition((pos) => {
          lastPosition = pos;
          initMap([pos.coords.latitude, pos.coords.longitude]);
          upsertUserMarker(pos);
          document.getElementById('crumbcount').textContent = `${state.breadcrumbs.length} points saved`;
        }, (err) => {
          document.getElementById('crumbcount').textContent = `Location error: ${err.code}`;
          initMap([0, 0]);
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 });
        if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = navigator.geolocation.watchPosition((pos) => {
          lastPosition = pos;
          upsertUserMarker(pos);
          if (document.getElementById('follow')?.checked) {
            map.setView([pos.coords.latitude, pos.coords.longitude]);
          }
        });
      };
      startGeo();
    });
  }, [state.breadcrumbs]);

  const dropBreadcrumb = () => {
    const now = Date.now();
    if (lastPosition) {
      const { latitude, longitude } = lastPosition.coords;
      const pt = { t: now, lat: latitude, lng: longitude };
      setState((s) => {
        const next = { ...s, breadcrumbs: [...s.breadcrumbs, pt] };
        localStorage.setItem('tg_breadcrumbs', JSON.stringify(next.breadcrumbs));
        return next;
      });
      if (pathLine) {
        const pts = pathLine.getLatLngs();
        pts.push([pt.lat, pt.lng]);
        pathLine.setLatLngs(pts);
      } else if (map) {
        pathLine = L.polyline([[pt.lat, pt.lng]], { color: '#10b981' }).addTo(map);
      }
      if (map) L.circleMarker([pt.lat, pt.lng], { radius: 4, color: '#10b981' }).addTo(map);
      document.getElementById('crumbcount').textContent = `${state.breadcrumbs.length + 1} points saved`;
    } else {
      document.getElementById('crumbcount').textContent = 'No position yet; trying again…';
    }
  };

  return (
    <div>
      <div className="card map-container"><div id="map"></div></div>
      <div className="card">
        <div className="row">
          <button className="btn btn-outline" id="drop" onClick={dropBreadcrumb}>Drop Waypoint</button>
          <label className="toggle"><input type="checkbox" id="follow" defaultChecked /> Follow</label>
        </div>
        <span className="small" id="crumbcount"></span>
      </div>
    </div>
  );
}

function CheckinView() {
  const sendMsg = (text) => alert('Sent: ' + text);
  return (
    <div>
      <div className="card">
        <button className="btn btn-primary" onClick={() => sendMsg("I'm OK")}>I'm OK</button>
        <button className="btn btn-outline" style={{ marginLeft: '8px' }} onClick={() => sendMsg('On my way')}>On My Way</button>
        <button className="btn btn-outline" style={{ marginLeft: '8px' }} onClick={() => sendMsg('Delayed')}>Delayed</button>
      </div>
      <div className="card">
        <input className="input" id="msg" placeholder="Type message (mock only)" />
        <div style={{ marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={() => sendMsg(document.getElementById('msg').value || '(empty)')}>Send</button>
        </div>
      </div>
    </div>
  );
}

function FamilyView({ state, setState }) {
  const remove = (i) => {
    setState((s) => {
      const copy = { ...s, family: s.family.filter((_, idx) => idx !== i) };
      return copy;
    });
  };
  const add = () => {
    const v = document.getElementById('newname').value.trim();
    if (!v) return;
    setState((s) => ({ ...s, family: [...s.family, { name: v, status: 'Active', last: 'now' }] }));
    document.getElementById('newname').value = '';
  };
  return (
    <div className="card">
      <ul className="list">
        {state.family.map((m, i) => (
          <li key={i}>
            <span>{m.name} ({m.status})</span>
            <button className="btn btn-outline" style={{ marginLeft: '8px' }} onClick={() => remove(i)}>Remove</button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '8px' }}>
        <input className="input" id="newname" placeholder="Add member name" />
        <button className="btn btn-primary" id="add" style={{ marginTop: '8px' }} onClick={add}>Add</button>
      </div>
    </div>
  );
}

function SettingsView() {
  useEffect(() => {
    const dark = document.getElementById('dark');
    const handler = (e) => {
      document.body.style.background = e.target.checked ? '#0b1220' : '#f1f5f9';
      document.body.style.color = e.target.checked ? '#e5e7eb' : '#0f172a';
    };
    dark.addEventListener('change', handler);
    return () => dark.removeEventListener('change', handler);
  }, []);
  return (
    <div className="card">
      <div className="row toggle">
        <label>Dark Mode</label>
        <input type="checkbox" id="dark" />
      </div>
      <div className="row"><button className="btn btn-outline" onClick={() => alert('Mock: Pairing mode')}>Pair New Device</button></div>
      <div className="row"><button className="btn btn-outline" onClick={() => alert('Mock: Auto-alerts settings')}>Set Auto-Alerts</button></div>
      <div className="row"><button className="btn btn-outline" onClick={() => alert('Mock: Firmware up to date')}>Check Firmware Updates</button></div>
    </div>
  );
}

function SosView() {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2 style={{ color: '#ef4444' }}>Emergency Mode</h2>
      <p>SOS Activated. Location shared with contacts + 911 (mock).</p>
      <button className="btn btn-danger" onClick={() => { alert('SOS canceled (mock)'); location.hash = '#/home'; }}>Cancel SOS</button>
    </div>
  );
}

function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/home');
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

