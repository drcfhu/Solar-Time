const APP_VERSION = '3.0.0';
const CACHE_BUSTER = '?v=' + APP_VERSION;
const I18N = {
  hu:{title:'Napóra',subtitle:'Valódi helyi napidő GPS alapján',language:'Nyelv',waiting:'GPS helyzetre vár...',locate:'Helyzet frissítése',clock:'Hivatalos idő',solarTime:'Valódi napidő',difference:'Eltérés',altitude:'Napmagasság',azimuth:'Azimut',moon:'Holdfázis',sunrise:'Napkelte',noon:'Valódi dél',sunset:'Napnyugta',daylight:'Nappal hossza',install:'iPhone: Safari → Megosztás → Főképernyőhöz adás.',beerShadow:'Árnyékban megfontolandó.',beerStrong:'Erősen ajánlott! A Nap-sörszög:',gpsOk:'GPS rendben',gpsFail:'A GPS nem elérhető vagy nincs engedélyezve.',waxing:'növő',waning:'fogyó',newMoon:'újhold',fullMoon:'telihold',solWinter:'A Nap ma a legalacsonyabban jár. Holnaptól ismét emelkedik.',solSummer:'A Nap ma érte el legnagyobb delelési magasságát.',equinox:'Ma közelítőleg napéjegyenlőség van.',updateReady:'Új Napóra-verzió érhető el. Frissítéshez zárd be és nyisd meg újra.'},
  it:{title:'Meridiana',subtitle:'Ora solare locale reale da GPS',language:'Lingua',waiting:'In attesa della posizione GPS...',locate:'Aggiorna posizione',clock:'Ora ufficiale',solarTime:'Ora solare reale',difference:'Differenza',altitude:'Altezza solare',azimuth:'Azimut',moon:'Fase lunare',sunrise:'Alba',noon:'Mezzogiorno vero',sunset:'Tramonto',daylight:'Durata del giorno',install:'iPhone: Safari → Condividi → Aggiungi alla schermata Home.',beerShadow:'Da considerare all’ombra.',beerStrong:'Fortemente consigliato! Angolo solare della birra:',gpsOk:'GPS attivo',gpsFail:'GPS non disponibile o non autorizzato.',waxing:'crescente',waning:'calante',newMoon:'luna nuova',fullMoon:'luna piena',solWinter:'Oggi il Sole è al punto più basso. Da domani risale.',solSummer:'Oggi il Sole raggiunge la massima altezza al mezzogiorno vero.',equinox:'Oggi siamo vicino all’equinozio.',updateReady:'È disponibile una nuova versione. Chiudi e riapri l’app per aggiornare.'},
  en:{title:'Sundial',subtitle:'True local solar time by GPS',language:'Language',waiting:'Waiting for GPS position...',locate:'Refresh location',clock:'Official time',solarTime:'True solar time',difference:'Difference',altitude:'Solar altitude',azimuth:'Azimuth',moon:'Moon phase',sunrise:'Sunrise',noon:'True noon',sunset:'Sunset',daylight:'Daylight length',install:'iPhone: Safari → Share → Add to Home Screen.',beerShadow:'Worth considering in the shade.',beerStrong:'Strongly recommended! The Sun beer-angle is:',gpsOk:'GPS OK',gpsFail:'GPS unavailable or permission denied.',waxing:'waxing',waning:'waning',newMoon:'new moon',fullMoon:'full moon',solWinter:'Today the Sun is at its lowest path. From tomorrow it rises again.',solSummer:'Today the Sun reaches its highest true-noon altitude.',equinox:'Today is close to an equinox.',updateReady:'A new Napóra version is available. Close and reopen the app to update.'}
};
let lang = localStorage.getItem('naporaLang') || (navigator.language||'hu').slice(0,2); if(!I18N[lang]) lang='hu';
let pos = null;
const $ = id => document.getElementById(id);
function t(k){ return I18N[lang][k] || I18N.hu[k] || k; }
function applyLang(){ document.documentElement.lang=lang; $('lang').value=lang; document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)}); seasonalMessage(); update(); }
$('lang').addEventListener('change', e=>{ lang=e.target.value; localStorage.setItem('naporaLang',lang); applyLang(); });
$('locate').addEventListener('click', locate);
function pad(n){ return String(Math.floor(Math.abs(n))).padStart(2,'0'); }
function fmtDate(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
function fmtHM(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function fmtDuration(ms){ const m=Math.round(ms/60000); return `${pad(m/60)}:${pad(m%60)}`; }
function dayOfYear(d){ const start=new Date(d.getFullYear(),0,0); return Math.floor((d-start)/86400000); }
function deg(x){ return x*180/Math.PI; } function rad(x){ return x*Math.PI/180; }
function solarDeclEqtime(date){
  const N=dayOfYear(date); const gamma=2*Math.PI/365*(N-1+(date.getHours()-12)/24);
  const eq=229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
  const dec=0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
  return {eq, dec};
}
function sunCalc(date, lat, lon){
  const {eq, dec}=solarDeclEqtime(date); const tz=-date.getTimezoneOffset()/60; const minutes=date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
  const tst=(minutes + eq + 4*lon - 60*tz + 1440)%1440; const ha=rad(tst/4 < 0 ? tst/4+180 : tst/4-180); const phi=rad(lat);
  const zen=Math.acos(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha)); const alt=90-deg(zen);
  let az=deg(Math.atan2(Math.sin(ha), Math.cos(ha)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi)))+180; return {alt, az, eq, dec};
}
function solarEvents(date, lat, lon){
  const noonDate = new Date(date.getFullYear(),date.getMonth(),date.getDate(),12,0,0); const {eq, dec}=solarDeclEqtime(noonDate); const tz=-date.getTimezoneOffset()/60; const phi=rad(lat); const zen=rad(90.833);
  let cosH=(Math.cos(zen)/(Math.cos(phi)*Math.cos(dec))-Math.tan(phi)*Math.tan(dec)); if(cosH>1 || cosH<-1) return null;
  const H=deg(Math.acos(cosH)); const solarNoonMin=720 - 4*lon - eq + 60*tz; const riseMin=solarNoonMin - 4*H; const setMin=solarNoonMin + 4*H;
  function make(m){ const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0); d.setMinutes(m); return d; }
  return {sunrise:make(riseMin), noon:make(solarNoonMin), sunset:make(setMin)};
}
function moonPhase(date){ const lp=2551443; const now=date.getTime()/1000; const newMoon=947182440; const phase=((now-newMoon)%lp+lp)%lp/lp; if(phase<0.03 || phase>0.97) return '🌑 '+t('newMoon'); if(Math.abs(phase-0.5)<0.03) return '🌕 '+t('fullMoon'); const icon=phase<0.25?'🌒':phase<0.5?'🌓':phase<0.75?'🌖':'🌘'; return `${icon} ${Math.round(phase*100)}% ${phase<0.5?t('waxing'):t('waning')}`; }
function seasonalMessage(){ const d=new Date(); const md=(d.getMonth()+1)*100+d.getDate(); let msg=''; if(md>=1220&&md<=1222) msg='❄️ '+t('solWinter'); else if(md>=620&&md<=622) msg='☀️ '+t('solSummer'); else if((md>=319&&md<=322)||(md>=921&&md<=924)) msg='🌍 '+t('equinox'); $('season').textContent=msg; $('season').classList.toggle('show',!!msg); }
function updateDial(sc){ const shadow=$('shadow'), dot=$('sunDot'); const angle=(sc.az+180)%360; const len=Math.max(22, Math.min(50, 52 - sc.alt*0.45)); shadow.style.transform=`rotate(${angle}deg)`; shadow.style.height=len+'%'; const r=42; const a=rad(sc.az-90); dot.style.left=(50+r*Math.cos(a))+'%'; dot.style.top=(50+r*Math.sin(a))+'%'; dot.style.opacity=sc.alt>0?1:.25; }
function update(){ const now=new Date(); $('clock').textContent=fmtDate(now); if(!pos) return; const {latitude:lat, longitude:lon}=pos.coords; const sc=sunCalc(now,lat,lon); const tz=-now.getTimezoneOffset()/60; const correction=sc.eq + 4*lon - 60*tz; const solar=new Date(now.getTime()+correction*60000); $('solarTime').textContent=fmtDate(solar); const sign=correction>=0?'+':'−'; $('diff').textContent=`${sign}${pad(correction/60)}:${pad(correction%60)}`; $('alt').textContent=`${sc.alt.toFixed(1)}°`; $('az').textContent=`${sc.az.toFixed(1)}°`; $('moon').textContent=moonPhase(now); updateDial(sc); const ev=solarEvents(now,lat,lon); if(ev){ $('sunrise').textContent=fmtHM(ev.sunrise); $('noon').textContent=fmtHM(ev.noon); $('sunset').textContent=fmtHM(ev.sunset); $('daylight').textContent=fmtDuration(ev.sunset-ev.sunrise); const beer=$('beer'); const oneHourBefore=new Date(ev.sunset.getTime()-3600000); if(now>=oneHourBefore && now<=ev.sunset){ beer.classList.add('recommended'); beer.innerHTML=`🍺🍺🍺<br>${t('beerStrong')} ${Math.max(sc.alt,0).toFixed(1)}°`; } else { beer.classList.remove('recommended'); beer.innerHTML=`🍺 ${t('beerShadow')}`; } } }
function locate(){ if(!navigator.geolocation){ $('status').textContent=t('gpsFail'); return; } navigator.geolocation.getCurrentPosition(p=>{ pos=p; const la=p.coords.latitude, lo=p.coords.longitude; $('status').textContent=`${t('gpsOk')}: ${la.toFixed(5)}, ${lo.toFixed(5)}`; $('place').textContent=`${la.toFixed(3)}°N · ${lo.toFixed(3)}°E`; update(); }, ()=>{$('status').textContent=t('gpsFail');}, {enableHighAccuracy:true, timeout:12000, maximumAge:60000}); }
async function setupServiceWorker(){ if(!('serviceWorker' in navigator)) return; try{ const reg=await navigator.serviceWorker.register('./service-worker.js'+CACHE_BUSTER); reg.addEventListener('updatefound',()=>{ const nw=reg.installing; if(!nw) return; nw.addEventListener('statechange',()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller){ $('updateBox').textContent='🔄 '+t('updateReady'); $('updateBox').classList.add('show'); } }); }); }catch(e){} }
applyLang(); locate(); seasonalMessage(); setupServiceWorker(); setInterval(update,1000);
