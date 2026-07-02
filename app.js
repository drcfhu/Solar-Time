const $ = id => document.getElementById(id);
const state = { lat: null, lon: null };

function pad(n){ return String(Math.floor(Math.abs(n))).padStart(2,'0'); }
function deg2rad(d){ return d*Math.PI/180; }
function rad2deg(r){ return r*180/Math.PI; }
function dayOfYear(d){ const start=new Date(d.getFullYear(),0,0); return Math.floor((d-start)/86400000); }
function fmtTime(date){ return date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
function fmtHM(date){ return date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function minutesToClock(mins, baseDate){ const d=new Date(baseDate); d.setHours(0,0,0,0); d.setMinutes(mins); return d; }
function norm360(x){ return ((x%360)+360)%360; }
function norm180(x){ let y=norm360(x); return y>180?y-360:y; }

function solarCore(date, lat, lon){
  const n = dayOfYear(date);
  const h = date.getHours() + date.getMinutes()/60 + date.getSeconds()/3600;
  const gamma = 2*Math.PI/365 * (n-1 + (h-12)/24);
  const eqtime = 229.18*(0.000075 + 0.001868*Math.cos(gamma) - 0.032077*Math.sin(gamma) - 0.014615*Math.cos(2*gamma) - 0.040849*Math.sin(2*gamma));
  const decl = 0.006918 - 0.399912*Math.cos(gamma) + 0.070257*Math.sin(gamma) - 0.006758*Math.cos(2*gamma) + 0.000907*Math.sin(2*gamma) - 0.002697*Math.cos(3*gamma) + 0.00148*Math.sin(3*gamma);
  const tz = -date.getTimezoneOffset()/60;
  const timeOffset = eqtime + 4*lon - 60*tz;
  const trueSolarMinutes = ((h*60 + timeOffset) % 1440 + 1440) % 1440;
  const hourAngle = trueSolarMinutes/4 < 0 ? trueSolarMinutes/4 + 180 : trueSolarMinutes/4 - 180;
  const latr=deg2rad(lat), har=deg2rad(hourAngle);
  const cosZen = Math.sin(latr)*Math.sin(decl) + Math.cos(latr)*Math.cos(decl)*Math.cos(har);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const altitude = 90 - rad2deg(zen);
  const azDen = Math.cos(latr)*Math.sin(zen);
  let azimuth = 0;
  if (Math.abs(azDen) > 1e-8) {
    let az = rad2deg(Math.acos(((Math.sin(latr)*Math.cos(zen))-Math.sin(decl))/azDen));
    azimuth = hourAngle > 0 ? (az + 180) % 360 : (540 - az) % 360;
  }
  return {eqtime, decl, trueSolarMinutes, hourAngle, altitude, azimuth, tz};
}

function sunriseSunset(date, lat, lon){
  const noon = new Date(date); noon.setHours(12,0,0,0);
  const c = solarCore(noon, lat, lon);
  const latr = deg2rad(lat);
  const zenith = deg2rad(90.833);
  const cosH = (Math.cos(zenith)/(Math.cos(latr)*Math.cos(c.decl)) - Math.tan(latr)*Math.tan(c.decl));
  if (cosH < -1) return { polar: 'midnight sun' };
  if (cosH > 1) return { polar: 'polar night' };
  const H = rad2deg(Math.acos(cosH));
  const solarNoonMin = 720 - 4*lon - c.eqtime + c.tz*60;
  return { sunrise: solarNoonMin - 4*H, sunset: solarNoonMin + 4*H, solarNoon: solarNoonMin };
}

function moonPhase(date){
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000,0,6,18,14,0);
  const days = (date.getTime() - knownNew)/86400000;
  const age = ((days % synodic) + synodic) % synodic;
  const names = [
    [1.84566,'🌑 Újhold'],[5.53699,'🌒 Növő holdsarló'],[9.22831,'🌓 Első negyed'],
    [12.91963,'🌔 Növő hold'],[16.61096,'🌕 Telihold'],[20.30228,'🌖 Fogyó hold'],
    [23.99361,'🌗 Utolsó negyed'],[27.68493,'🌘 Fogyó holdsarló'],[99,'🌑 Újhold']
  ];
  return `${names.find(x=>age<x[0])[1]} (${age.toFixed(1)} nap)`;
}

function update(){
  const now = new Date();
  $('civilTime').textContent = fmtTime(now);
  if (state.lat === null) return;
  const c = solarCore(now, state.lat, state.lon);
  const sr = sunriseSunset(now, state.lat, state.lon);
  const solarClock = minutesToClock(c.trueSolarMinutes, now);
  $('solarTime').textContent = fmtTime(solarClock);
  const civilM = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
  let delta = c.trueSolarMinutes - civilM; if (delta > 720) delta -= 1440; if (delta < -720) delta += 1440;
  $('deltaTime').textContent = `${delta>=0?'+':''}${Math.round(delta)} perc`;
  if (sr.polar) { $('sunrise').textContent = sr.polar; $('sunset').textContent = sr.polar; $('solarNoon').textContent='--'; }
  else { $('sunrise').textContent = fmtHM(minutesToClock(sr.sunrise, now)); $('sunset').textContent = fmtHM(minutesToClock(sr.sunset, now)); $('solarNoon').textContent = fmtHM(minutesToClock(sr.solarNoon, now)); }
  $('altitude').textContent = `${c.altitude.toFixed(1)}°`;
  $('azimuth').textContent = `${c.azimuth.toFixed(0)}°`;
  $('moonPhase').textContent = moonPhase(now);
  $('coords').textContent = `${state.lat.toFixed(5)}, ${state.lon.toFixed(5)}`;
  const afterNoon = sr.solarNoon && (civilM > sr.solarNoon);
  $('beerTime').textContent = afterNoon ? '🍺 Árnyék + sör megfontolandó' : '☀️ Még délelőtti Nap';
  $('shadow').style.transform = `rotate(${norm180(c.hourAngle)}deg)`;
}

function locate(){
  if (!navigator.geolocation) { $('status').textContent = 'Ez a böngésző nem támogatja a helymeghatározást.'; return; }
  $('status').textContent = 'GPS keresés...';
  navigator.geolocation.getCurrentPosition(pos=>{
    state.lat = pos.coords.latitude; state.lon = pos.coords.longitude;
    $('status').textContent = `Hely meghatározva ±${Math.round(pos.coords.accuracy)} m pontossággal.`;
    update();
  }, err=>{
    $('status').textContent = 'Nem kaptam GPS engedélyt vagy jelet. Engedélyezd a helymeghatározást a böngészőben.';
  }, {enableHighAccuracy:true, timeout:15000, maximumAge:60000});
}

$('locateBtn').addEventListener('click', locate);
setInterval(update, 1000);
update();
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
