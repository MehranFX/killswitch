"use strict";

(function initCountryRulesPage(){
  const ddToggle = document.getElementById('cr_dd_toggle');
  const ddPanel  = document.getElementById('cr_dd_panel');
  const ddSearch = document.getElementById('cr_dd_search');
  const ddList   = document.getElementById('cr_dd_list');
  const savedListEl = document.getElementById('cr_saved_list');
  const statusEl = document.getElementById('message');

  const selectedCodes = new Set();

  const countries = [
    {code:'AF',name:'Afghanistan',flag:'🇦🇫'},{code:'AL',name:'Albania',flag:'🇦🇱'},{code:'DZ',name:'Algeria',flag:'🇩🇿'},
    {code:'AD',name:'Andorra',flag:'🇦🇩'},{code:'AO',name:'Angola',flag:'🇦🇴'},{code:'AR',name:'Argentina',flag:'🇦🇷'},
    {code:'AM',name:'Armenia',flag:'🇦🇲'},{code:'AU',name:'Australia',flag:'🇦🇺'},{code:'AT',name:'Austria',flag:'🇦🇹'},
    {code:'AZ',name:'Azerbaijan',flag:'🇦🇿'},{code:'BH',name:'Bahrain',flag:'🇧🇭'},{code:'BD',name:'Bangladesh',flag:'🇧🇩'},
    {code:'BY',name:'Belarus',flag:'🇧🇾'},{code:'BE',name:'Belgium',flag:'🇧🇪'},{code:'BZ',name:'Belize',flag:'🇧🇿'},
    {code:'BJ',name:'Benin',flag:'🇧🇯'},{code:'BO',name:'Bolivia',flag:'🇧🇴'},{code:'BA',name:'Bosnia & Herzegovina',flag:'🇧🇦'},
    {code:'BW',name:'Botswana',flag:'🇧🇼'},{code:'BR',name:'Brazil',flag:'🇧🇷'},{code:'BG',name:'Bulgaria',flag:'🇧🇬'},
    {code:'KH',name:'Cambodia',flag:'🇰🇭'},{code:'CM',name:'Cameroon',flag:'🇨🇲'},{code:'CA',name:'Canada',flag:'🇨🇦'},
    {code:'CL',name:'Chile',flag:'🇨🇱'},{code:'CN',name:'China',flag:'🇨🇳'},{code:'CO',name:'Colombia',flag:'🇨🇴'},
    {code:'CR',name:'Costa Rica',flag:'🇨🇷'},{code:'HR',name:'Croatia',flag:'🇭🇷'},{code:'CU',name:'Cuba',flag:'🇨🇺'},
    {code:'CY',name:'Cyprus',flag:'🇨🇾'},{code:'CZ',name:'Czechia',flag:'🇨🇿'},{code:'DK',name:'Denmark',flag:'🇩🇰'},
    {code:'DO',name:'Dominican Republic',flag:'🇩🇴'},{code:'EC',name:'Ecuador',flag:'🇪🇨'},{code:'EG',name:'Egypt',flag:'🇪🇬'},
    {code:'SV',name:'El Salvador',flag:'🇸🇻'},{code:'EE',name:'Estonia',flag:'🇪🇪'},{code:'ET',name:'Ethiopia',flag:'🇪🇹'},
    {code:'FI',name:'Finland',flag:'🇫🇮'},{code:'FR',name:'France',flag:'🇫🇷'},{code:'GE',name:'Georgia',flag:'🇬🇪'},
    {code:'DE',name:'Germany',flag:'🇩🇪'},{code:'GH',name:'Ghana',flag:'🇬🇭'},{code:'GR',name:'Greece',flag:'🇬🇷'},
    {code:'GT',name:'Guatemala',flag:'🇬🇹'},{code:'HN',name:'Honduras',flag:'🇭🇳'},{code:'HK',name:'Hong Kong',flag:'🇭🇰'},
    {code:'HU',name:'Hungary',flag:'🇭🇺'},{code:'IS',name:'Iceland',flag:'🇮🇸'},{code:'IN',name:'India',flag:'🇮🇳'},
    {code:'ID',name:'Indonesia',flag:'🇮🇩'},{code:'IR',name:'Iran',flag:'🇮🇷'},{code:'IQ',name:'Iraq',flag:'🇮🇶'},
    {code:'IE',name:'Ireland',flag:'🇮🇪'},{code:'IL',name:'Israel',flag:'🇮🇱'},{code:'IT',name:'Italy',flag:'🇮🇹'},
    {code:'JP',name:'Japan',flag:'🇯🇵'},{code:'JO',name:'Jordan',flag:'🇯🇴'},{code:'KZ',name:'Kazakhstan',flag:'🇰🇿'},
    {code:'KE',name:'Kenya',flag:'🇰🇪'},{code:'KW',name:'Kuwait',flag:'🇰🇼'},{code:'KG',name:'Kyrgyzstan',flag:'🇰🇬'},
    {code:'LA',name:'Laos',flag:'🇱🇦'},{code:'LV',name:'Latvia',flag:'🇱🇻'},{code:'LB',name:'Lebanon',flag:'🇱🇧'},
    {code:'LY',name:'Libya',flag:'🇱🇾'},{code:'LT',name:'Lithuania',flag:'🇱🇹'},{code:'LU',name:'Luxembourg',flag:'🇱🇺'},
    {code:'MY',name:'Malaysia',flag:'🇲🇾'},{code:'MX',name:'Mexico',flag:'🇲🇽'},{code:'MD',name:'Moldova',flag:'🇲🇩'},
    {code:'MN',name:'Mongolia',flag:'🇲🇳'},{code:'MA',name:'Morocco',flag:'🇲🇦'},{code:'MM',name:'Myanmar',flag:'🇲🇲'},
    {code:'NL',name:'Netherlands',flag:'🇳🇱'},{code:'NZ',name:'New Zealand',flag:'🇳🇿'},{code:'NG',name:'Nigeria',flag:'🇳🇬'},
    {code:'KP',name:'North Korea',flag:'🇰🇵'},{code:'NO',name:'Norway',flag:'🇳🇴'},{code:'OM',name:'Oman',flag:'🇴🇲'},
    {code:'PK',name:'Pakistan',flag:'🇵🇰'},{code:'PS',name:'Palestine',flag:'🇵🇸'},{code:'PA',name:'Panama',flag:'🇵🇦'},
    {code:'PE',name:'Peru',flag:'🇵🇪'},{code:'PH',name:'Philippines',flag:'🇵🇭'},{code:'PL',name:'Poland',flag:'🇵🇱'},
    {code:'PT',name:'Portugal',flag:'🇵🇹'},{code:'QA',name:'Qatar',flag:'🇶🇦'},{code:'RO',name:'Romania',flag:'🇷🇴'},
    {code:'RU',name:'Russia',flag:'🇷🇺'},{code:'SA',name:'Saudi Arabia',flag:'🇸🇦'},{code:'RS',name:'Serbia',flag:'🇷🇸'},
    {code:'SG',name:'Singapore',flag:'🇸🇬'},{code:'SK',name:'Slovakia',flag:'🇸🇰'},{code:'SI',name:'Slovenia',flag:'🇸🇮'},
    {code:'ZA',name:'South Africa',flag:'🇿🇦'},{code:'KR',name:'South Korea',flag:'🇰🇷'},
    {code:'ES',name:'Spain',flag:'🇪🇸'},{code:'SE',name:'Sweden',flag:'🇸🇪'},{code:'CH',name:'Switzerland',flag:'🇨🇭'},
    {code:'SY',name:'Syria',flag:'🇸🇾'},{code:'TW',name:'Taiwan',flag:'🇹🇼'},{code:'TH',name:'Thailand',flag:'🇹🇭'},
    {code:'TN',name:'Tunisia',flag:'🇹🇳'},{code:'TR',name:'Turkey',flag:'🇹🇷'},{code:'UA',name:'Ukraine',flag:'🇺🇦'},
    {code:'AE',name:'United Arab Emirates',flag:'🇦🇪'},{code:'GB',name:'United Kingdom',flag:'🇬🇧'},{code:'US',name:'United States',flag:'🇺🇸'},
    {code:'UY',name:'Uruguay',flag:'🇺🇾'},{code:'UZ',name:'Uzbekistan',flag:'🇺🇿'},{code:'VE',name:'Venezuela',flag:'🇻🇪'},
    {code:'VN',name:'Vietnam',flag:'🇻🇳'}
  ];

  function renderList(q=''){
    ddList.innerHTML='';
    const ql = q.trim().toLowerCase();
    countries
      .filter(c=> c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql))
      .forEach(c=>{
        const row = document.createElement('label');
        row.className = 'dd-item';
        const checked = selectedCodes.has(c.code) ? 'checked' : '';
        row.innerHTML = `<input type=\"checkbox\" value=\"${c.code}\" ${checked}> <span>${c.flag}</span> <span>${c.name} (${c.code})</span>`;
        row.querySelector('input').onchange = (ev)=>{
          if (ev.target.checked) selectedCodes.add(c.code); else selectedCodes.delete(c.code);
          updateToggleText();
        };
        ddList.appendChild(row);
      });
  }

  function updateToggleText(){
    if (selectedCodes.size === 0) ddToggle.textContent = 'Choose countries…';
    else ddToggle.textContent = `${selectedCodes.size} selected`;
  }

  if (ddToggle) ddToggle.onclick = ()=>{
    if (ddPanel.style.display==='block') { ddPanel.style.display='none'; return; }
    const rect = ddToggle.getBoundingClientRect();
    ddPanel.style.left = `${Math.round(rect.left)}px`;
    ddPanel.style.top  = `${Math.round(rect.bottom + 4)}px`;
    ddPanel.style.width = `${Math.round(rect.width)}px`;
    ddPanel.style.display = 'block';
  };
  if (ddSearch) ddSearch.oninput = ()=> renderList(ddSearch.value);

  renderList('');
  updateToggleText();

  document.addEventListener('click', (e)=>{
    if (!ddPanel.contains(e.target) && e.target !== ddToggle) ddPanel.style.display='none';
  });

  async function refreshSaved(){
    if (!savedListEl) return;
    const existing = await chrome.storage.local.get(['country_rules']);
    const rules = existing.country_rules || [];
    savedListEl.innerHTML = '';
    rules.forEach((r, idx)=>{
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
      const countriesLabel = (r.countries||[]).join(', ');
      row.innerHTML = `<span style="min-width:120px; font-weight:600;">${r.domain}</span>
                       <span style="color:#6c757d;">${r.mode}</span>
                       <span style="flex:1; color:#6c757d;">${countriesLabel}</span>
                       <a href="#" data-domain="${r.domain}" class="delete">Delete</a>`;
      row.querySelector('.delete').onclick = async (e)=>{
        e.preventDefault();
        const dom = e.target.getAttribute('data-domain');
        const ex = await chrome.storage.local.get(['country_rules']);
        const newRules = (ex.country_rules||[]).filter(rr=> rr.domain !== dom);
        await chrome.storage.local.set({ country_rules: newRules });
        refreshSaved();
      };
      savedListEl.appendChild(row);
    });
  }

  const saveAll = document.getElementById('cr_save_all');
  if (saveAll) saveAll.onclick = async (e)=>{
    e.preventDefault();
    const domain = (document.getElementById('cr_domain_input')?.value || '').trim();
    if (!domain) { if (statusEl) statusEl.textContent = 'Please enter a domain'; return; }
    const mode = (document.querySelector('input[name="cr_mode"]:checked')?.value) || 'whitelist';
    const countriesArr = Array.from(selectedCodes);
    const existing = await chrome.storage.local.get(['country_rules']);
    const rules = existing.country_rules || [];
    const idx = rules.findIndex(r=> r.domain === domain);
    const newRule = { domain, mode, countries: countriesArr };
    if (idx>=0) rules[idx] = newRule; else rules.push(newRule);
    await chrome.storage.local.set({ country_rules: rules });
    if (statusEl) { statusEl.textContent = 'Saved'; setTimeout(()=> statusEl.textContent='', 1500); }
    await refreshSaved();
  };

  refreshSaved();

  document.getElementById('cr_close').onclick = () => window.close();
})();


