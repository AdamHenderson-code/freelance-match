/**
 * Freelance Match — Phases 2–4 extension
 * Phase 2: Saved searches, templates, favorites/blocks, open shifts, exports
 * Phase 3: Credentials, reviews, badges, company, email, admin users
 * Phase 4: Demo API, Stripe simulation, smarter ranking, booker notes
 */
const FMPhases = {
  _shiftApplyPending: null,

  mergeFeatureData(App) {
    const d = App.featureData;
    const defaults = {
      savedSearches: [],
      shiftTemplates: [],
      favorites: [],
      blocks: [],
      shiftApplications: [],
      bookerNotes: {},
      credentials: { certs: [], insurance: { provider: '', expiry: '' }, equipment: [] },
      reviews: [],
      verificationBadges: {},
      company: { name: '', members: [] },
      emailPrefs: { inquiries: true, responses: true, messages: true, reminders: true },
      emailOutbox: [],
      apiSession: null,
      stripeEvents: [],
      displayCurrency: 'GBP',
    };
    Object.assign(d, { ...defaults, ...d });
    if (!d.credentials.certs) d.credentials.certs = [];
  },

  save(App) {
    FMFeatures.save(App);
  },

  /* ---- Phase 2: Saved searches ---- */

  saveCurrentSearch(App) {
    const name = prompt('Name this search:', 'My crew search');
    if (!name) return;
    const criteria = App.state.lastSearchCriteria || {
      skills: [...App.state.bookerSearch.skills],
      requiredDates: [document.getElementById('booker-date-start')?.value].filter(Boolean),
      location: (document.getElementById('booker-location')?.value || '').toLowerCase(),
      maxRate: Number(document.getElementById('booker-max-rate')?.value || 1000),
    };
    App.featureData.savedSearches.unshift({
      id: 'search-' + Date.now(),
      name,
      criteria: JSON.parse(JSON.stringify(criteria)),
      alertEnabled: true,
      lastMatchCount: 0,
      createdAt: new Date().toISOString(),
    });
    this.save(App);
    App.toast('Search saved', 'success');
    if (App.state.bookerTab === 'saved') this.renderSavedSearches(App);
  },

  runSavedSearch(App, id) {
    const s = App.featureData.savedSearches.find((x) => x.id === id);
    if (!s) return;
    App.state.bookerSearch.skills = [...s.criteria.skills];
    const start = document.getElementById('booker-date-start');
    if (start && s.criteria.requiredDates?.[0]) start.value = s.criteria.requiredDates[0];
    const loc = document.getElementById('booker-location');
    if (loc) loc.value = s.criteria.location || '';
    const rate = document.getElementById('booker-max-rate');
    if (rate) rate.value = s.criteria.maxRate || 1000;
    App.setBookerTab('search');
    App.renderBookerSkills();
    App.runBookerSearch();
  },

  checkSearchAlerts(App) {
    App.featureData.savedSearches.forEach((s) => {
      if (!s.alertEnabled || !s.criteria?.skills?.length) return;
      const count = App.matchEngineers(s.criteria).length;
      if (count > s.lastMatchCount && s.lastMatchCount > 0) {
        App.addNotification({
          type: 'search_alert',
          role: 'booker',
          title: 'New matches for saved search',
          message: `"${s.name}" now has ${count} engineer${count !== 1 ? 's' : ''} (was ${s.lastMatchCount})`,
        });
        this.simulateEmail(App, 'search_alert', `New matches for "${s.name}": ${count} engineers`);
      }
      s.lastMatchCount = count;
    });
    this.save(App);
  },

  renderSavedSearches(App) {
    const el = document.getElementById('booker-tab-saved');
    if (!el) return;
    const list = App.featureData.savedSearches;
    el.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div><h2 class="text-xl font-semibold text-white">Saved searches</h2>
        <p class="text-sm text-gray-400 mt-1">Re-run filters or get alerts when new engineers match.</p></div>
        <button type="button" onclick="FMPhases.saveCurrentSearch(window.App)" class="px-4 py-2 bg-teal hover:bg-teal-dark text-white text-sm font-semibold rounded-lg">Save current search</button>
      </div>
      ${list.length ? list.map((s) => `
        <div class="bg-slate rounded-xl border border-white/10 p-4 mb-3 flex flex-wrap justify-between gap-3">
          <div>
            <p class="font-medium text-white">${App.escapeHtml(s.name)}</p>
            <p class="text-xs text-gray-500 mt-1">${s.criteria.skills?.join(', ')} · max £${s.criteria.maxRate} · ${s.lastMatchCount} matches last check</p>
          </div>
          <div class="flex gap-2 items-center">
            <label class="text-xs text-gray-400 flex items-center gap-1">
              <input type="checkbox" ${s.alertEnabled ? 'checked' : ''} onchange="FMPhases.toggleSearchAlert('${s.id}',this.checked)" class="rounded text-teal" /> Alerts
            </label>
            <button type="button" onclick="FMPhases.runSavedSearch(window.App,'${s.id}')" class="px-3 py-1.5 text-xs bg-teal/20 text-teal-light rounded-lg">Run</button>
            <button type="button" onclick="FMPhases.deleteSavedSearch('${s.id}')" class="px-3 py-1.5 text-xs text-red-400">Delete</button>
          </div>
        </div>`).join('') : '<p class="text-sm text-gray-500">No saved searches yet. Run a search and click Save current search.</p>'}`;
  },

  toggleSearchAlert(id, on) {
    const App = window.App;
    const s = App.featureData.savedSearches.find((x) => x.id === id);
    if (s) { s.alertEnabled = on; this.save(App); }
  },

  deleteSavedSearch(id) {
    const App = window.App;
    App.featureData.savedSearches = App.featureData.savedSearches.filter((x) => x.id !== id);
    this.save(App);
    this.renderSavedSearches(App);
  },

  /* ---- Phase 2: Templates & duplicate ---- */

  duplicateProject(App, projectId) {
    const src = App.getProjectById(projectId);
    if (!src) return;
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: 'proj-' + Date.now(),
      name: src.name + ' (copy)',
      createdAt: new Date().toISOString(),
      shifts: (src.shifts || []).map((s) => ({ ...s, id: 'shift-' + Date.now() + Math.random().toString(36).slice(2, 5), documents: [] })),
    };
    App.state.projects.unshift(copy);
    App.state.selectedProjectId = copy.id;
    App.saveProjects();
    App.renderBookerProjects();
    App.toast('Project duplicated', 'success');
  },

  duplicateShift(App, projectId, shiftId) {
    const project = App.getProjectById(projectId);
    const shift = App.getShiftById(projectId, shiftId);
    if (!project || !shift) return;
    project.shifts.push({
      ...JSON.parse(JSON.stringify(shift)),
      id: 'shift-' + Date.now(),
      title: shift.title + ' (copy)',
      documents: [],
      createdAt: new Date().toISOString(),
    });
    App.saveProjects();
    App.renderBookerProjects();
    App.toast('Shift duplicated', 'success');
  },

  saveShiftTemplate(App, projectId) {
    const project = App.getProjectById(projectId);
    if (!project?.shifts?.length) {
      App.toast('Add shifts first', 'error');
      return;
    }
    const name = prompt('Template name:', project.name + ' template');
    if (!name) return;
    App.featureData.shiftTemplates.unshift({
      id: 'tpl-' + Date.now(),
      name,
      category: project.category,
      shifts: project.shifts.map((s) => ({
        title: s.title, startTime: s.startTime, endTime: s.endTime,
        skills: [...s.skills], details: s.details, maxRate: s.maxRate,
      })),
      createdAt: new Date().toISOString(),
    });
    this.save(App);
    App.toast('Template saved', 'success');
  },

  applyTemplate(App, templateId, projectId) {
    const tpl = App.featureData.shiftTemplates.find((t) => t.id === templateId);
    const project = App.getProjectById(projectId);
    if (!tpl || !project) return;
    const base = new Date();
    base.setDate(base.getDate() + 1);
    tpl.shifts.forEach((s, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      project.shifts.push({
        id: 'shift-' + Date.now() + i,
        ...s,
        date: App.formatDate(d),
        documents: [],
        createdAt: new Date().toISOString(),
      });
    });
    App.saveProjects();
    App.renderBookerProjects();
    App.toast(`Added ${tpl.shifts.length} shifts from template`, 'success');
  },

  bulkAddWeek(App, projectId) {
    const project = App.getProjectById(projectId);
    if (!project) return;
    const shift = project.shifts?.[project.shifts.length - 1];
    if (!shift) {
      App.toast('Add one shift first to use as a template', 'error');
      return;
    }
    const base = App.parseDate(shift.date);
    for (let i = 1; i <= 6; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      project.shifts.push({
        ...JSON.parse(JSON.stringify(shift)),
        id: 'shift-' + Date.now() + i,
        date: App.formatDate(d),
        title: shift.title.replace(/\d+/, String(i + 1)) || `Day ${i + 1} — ${shift.title}`,
        documents: [],
      });
    }
    App.saveProjects();
    App.renderBookerProjects();
    App.toast('Added 6 more shifts (week block)', 'success');
  },

  /* ---- Phase 2: Favorites & blocks ---- */

  toggleFavorite(App, engineerId) {
    const f = App.featureData.favorites;
    const i = f.indexOf(engineerId);
    if (i >= 0) f.splice(i, 1);
    else f.push(engineerId);
    this.save(App);
    App.toast(i >= 0 ? 'Removed from favorites' : 'Added to favorites', 'info');
  },

  toggleBlock(App, engineerId) {
    const b = App.featureData.blocks;
    const i = b.indexOf(engineerId);
    if (i >= 0) b.splice(i, 1);
    else b.push(engineerId);
    this.save(App);
    App.toast(i >= 0 ? 'Unblocked' : 'Blocked', 'info');
  },

  isFavorite(App, id) { return App.featureData.favorites.includes(id); },
  isBlocked(App, id) { return App.featureData.blocks.includes(id); },

  favBlockHtml(App, engineerId) {
    const fav = this.isFavorite(App, engineerId);
    const blk = this.isBlocked(App, engineerId);
    return `<button type="button" onclick="FMPhases.toggleFavorite(window.App,'${engineerId}')" class="p-1.5 text-sm ${fav ? 'text-pink-400' : 'text-gray-500 hover:text-pink-300'}" title="Favorite">♥</button>
      <button type="button" onclick="FMPhases.toggleBlock(window.App,'${engineerId}')" class="p-1.5 text-sm ${blk ? 'text-red-400' : 'text-gray-500 hover:text-red-300'}" title="Block">⊘</button>`;
  },

  /* ---- Phase 2: Open shifts ---- */

  getOpenShifts(App) {
    const rows = [];
    App.state.projects.forEach((project) => {
      (project.shifts || []).forEach((shift) => {
        const booked = App.state.inquiries.some(
          (i) => i.projectId === project.id && i.shiftId === shift.id && ['booked', 'completed', 'confirmed'].includes(i.status)
        );
        if (!booked) {
          rows.push({ project, shift });
        }
      });
    });
    return rows.sort((a, b) => `${a.shift.date}`.localeCompare(b.shift.date));
  },

  resolveApp(App) {
    return App || (typeof window !== 'undefined' && window.App);
  },

  bindShiftApplyModal() {
    if (this._shiftApplyModalBound) return;
    this._shiftApplyModalBound = true;
    const modal = document.getElementById('shift-apply-modal');
    const form = document.getElementById('shift-apply-form');
    const close = () => this.closeShiftApplyModal();
    document.getElementById('shift-apply-close')?.addEventListener('click', close);
    document.getElementById('shift-apply-cancel')?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitShiftApplication();
    });
  },

  bindOpenShiftsPanel() {
    const panel = document.getElementById('eng-tab-open-shifts');
    if (!panel || panel.dataset.applyBound) return;
    panel.dataset.applyBound = '1';
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shift-apply]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      this.openShiftApplyModal(this.resolveApp(), btn.dataset.projectId, btn.dataset.shiftId);
    });
  },

  openShiftApplyModal(App, projectId, shiftId) {
    App = this.resolveApp(App);
    if (!App) return;
    const project = App.getProjectById(projectId);
    const shift = App.getShiftById(projectId, shiftId);
    if (!project || !shift) {
      App.toast('Shift not found — it may have been filled or removed', 'error');
      return;
    }
    const already = (App.featureData.shiftApplications || []).some(
      (a) => a.engineerId === 'user-me' && a.projectId === projectId && a.shiftId === shiftId
    );
    if (already) {
      App.toast('You have already applied for this shift', 'info');
      return;
    }
    this._shiftApplyPending = { projectId, shiftId };
    const summary = document.getElementById('shift-apply-summary');
    const message = document.getElementById('shift-apply-message');
    if (summary) {
      summary.innerHTML = `Applying for <strong class="text-white">${App.escapeHtml(shift.title)}</strong> on <strong class="text-white">${App.escapeHtml(project.name)}</strong> · ${App.formatShiftRange(shift)}`;
    }
    if (message) {
      message.value = `Interested in ${shift.title} on ${App.formatDateDisplay(shift.date)}.`;
    }
    const modal = document.getElementById('shift-apply-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    document.body.style.overflow = 'hidden';
    message?.focus();
  },

  closeShiftApplyModal() {
    this._shiftApplyPending = null;
    const modal = document.getElementById('shift-apply-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    document.body.style.overflow = '';
  },

  submitShiftApplication() {
    const App = this.resolveApp();
    const pending = this._shiftApplyPending;
    if (!App || !pending) return;
    const project = App.getProjectById(pending.projectId);
    const shift = App.getShiftById(pending.projectId, pending.shiftId);
    if (!project || !shift) {
      App.toast('Shift not found — it may have been filled or removed', 'error');
      this.closeShiftApplyModal();
      return;
    }
    const msg = document.getElementById('shift-apply-message')?.value?.trim() || '';
    if (!App.featureData.shiftApplications) App.featureData.shiftApplications = [];
    App.featureData.shiftApplications.push({
      id: 'app-' + Date.now(),
      projectId: pending.projectId,
      shiftId: pending.shiftId,
      engineerId: 'user-me',
      engineerName: App.state.userProfile?.name || 'Engineer',
      message: msg,
      at: new Date().toISOString(),
      status: 'pending',
    });
    this.save(App);
    App.addNotification({
      type: 'shift_application',
      role: 'booker',
      title: 'Shift application received',
      message: `${App.state.userProfile?.name || 'An engineer'} applied for ${shift.title}`,
    });
    this.simulateEmail(App, 'shift_application', `New application for ${shift.title}`);
    App.toast('Application sent', 'success');
    this.closeShiftApplyModal();
    this.renderOpenShifts(App);
  },

  applyToShift(App, projectId, shiftId) {
    this.openShiftApplyModal(App, projectId, shiftId);
  },

  renderOpenShifts(App) {
    const el = document.getElementById('eng-tab-open-shifts');
    if (!el) return;
    const rows = this.getOpenShifts(App);
    const myApps = App.featureData.shiftApplications.filter((a) => a.engineerId === 'user-me');
    el.innerHTML = `
      <h2 class="text-xl font-semibold text-white mb-2">Open shifts</h2>
      <p class="text-sm text-gray-400 mb-6">Browse unfilled shifts and express interest directly.</p>
      ${rows.length ? rows.map(({ project, shift }) => {
        const applied = myApps.some((a) => a.projectId === project.id && a.shiftId === shift.id);
        return `<article class="bg-slate rounded-xl border border-white/10 p-5 mb-3">
          <p class="font-medium text-white">${App.escapeHtml(shift.title)}</p>
          <p class="text-sm text-teal-light/80">${App.escapeHtml(project.name)}</p>
          <p class="text-xs text-gray-500 mt-1">${App.formatShiftRange(shift)} · ${(shift.skills || []).join(', ')}</p>
          ${shift.details ? `<p class="text-sm text-gray-400 mt-2 line-clamp-2">${App.escapeHtml(shift.details)}</p>` : ''}
          <button type="button" data-shift-apply data-project-id="${App.escapeHtml(project.id)}" data-shift-id="${App.escapeHtml(shift.id)}" ${applied ? 'disabled' : ''}
            class="mt-3 px-4 py-2 text-sm font-semibold rounded-lg ${applied ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-teal hover:bg-teal-dark text-white'}">${applied ? 'Applied' : 'Apply'}</button>
        </article>`;
      }).join('') : '<p class="text-sm text-gray-500">No open shifts right now. Bookers create projects in the Booker Portal.</p>'}`;
  },

  /* ---- Phase 2: Exports ---- */

  exportCrewPack(App, projectId) {
    const project = App.getProjectById(projectId);
    if (!project) return;
    const lines = ['Project,Crew Sheet Export', `Name,${project.name}`, `Location,${project.location || ''}`, ''];
    lines.push('Shift,Date,Start,End,Role,Status,Engineer,Rate');
    (project.shifts || []).forEach((shift) => {
      (shift.skills || ['']).forEach((skill) => {
        const inq = App.state.inquiries.find(
          (i) => i.projectId === project.id && i.shiftId === shift.id && ['booked', 'completed', 'confirmed'].includes(i.status)
        );
        const eng = inq ? App.getAllSearchableEngineers().find((e) => e.id === inq.engineerId) : null;
        const rate = inq?.counterOffer?.amount || inq?.rateOffer?.amount || '';
        lines.push([shift.title, shift.date, shift.startTime, shift.endTime, skill, inq?.status || 'open', eng?.name || '', rate].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
      });
    });
    this.downloadText(lines.join('\n'), `crew-pack-${project.name.replace(/\s+/g, '-')}.csv`, 'text/csv');
    App.toast('Crew pack exported', 'success');
  },

  exportICal(App, role) {
    const events = [];
    App.state.inquiries.forEach((inq) => {
      if (!['booked', 'completed', 'confirmed'].includes(inq.status)) return;
      if (role === 'engineer' && inq.engineerId !== 'user-me') return;
      const start = inq.sentAt?.slice(0, 10).replace(/-/g, '') || '20260701';
      events.push(`BEGIN:VEVENT\nUID:${inq.id}@freelancematch\nDTSTART;VALUE=DATE:${start}\nSUMMARY:${inq.projectName || inq.dates}\nDESCRIPTION:${inq.message?.slice(0, 100)}\nEND:VEVENT`);
    });
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Freelance Match//EN\n${events.join('\n')}\nEND:VCALENDAR`;
    this.downloadText(ics, `freelance-match-${role}.ics`, 'text/calendar');
    App.toast('Calendar exported', 'success');
  },

  downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /* ---- Phase 3: Credentials ---- */

  renderCredentials(App) {
    const el = document.getElementById('eng-tab-credentials');
    if (!el) return;
    const c = App.state.userProfile.credentials || App.featureData.credentials;
    if (!App.state.userProfile.credentials) App.state.userProfile.credentials = c;
    el.innerHTML = `
      <div class="space-y-6">
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Certifications</h3>
          <div id="cred-certs-list" class="space-y-2 mb-4">${(c.certs || []).map((cert, i) => `
            <div class="flex gap-2 items-center p-3 bg-navy rounded-lg text-sm">
              <span class="flex-1 text-gray-300">${App.escapeHtml(cert.name)} ${cert.expiry ? '· exp ' + cert.expiry : ''}</span>
              <button type="button" onclick="FMPhases.removeCert(${i})" class="text-xs text-red-400">Remove</button>
            </div>`).join('') || '<p class="text-sm text-gray-500">No certifications added.</p>'}</div>
          <button type="button" onclick="FMPhases.addCert()" class="px-4 py-2 text-sm bg-teal/20 text-teal-light rounded-lg">+ Add certification</button>
        </div>
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Insurance</h3>
          <div class="grid sm:grid-cols-2 gap-4">
            <input type="text" id="cred-ins-provider" value="${App.escapeHtml(c.insurance?.provider || '')}" placeholder="Provider" class="px-3 py-2 bg-navy border border-white/10 rounded-lg text-white text-sm" />
            <input type="date" id="cred-ins-expiry" value="${c.insurance?.expiry || ''}" class="px-3 py-2 bg-navy border border-white/10 rounded-lg text-white text-sm" />
          </div>
        </div>
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Equipment owned</h3>
          <textarea id="cred-equipment" rows="3" class="w-full px-3 py-2 bg-navy border border-white/10 rounded-lg text-white text-sm" placeholder="e.g. RF kit, DiGiCo SD7, flypack…">${App.escapeHtml((c.equipment || []).join('\n'))}</textarea>
        </div>
        <button type="button" onclick="FMPhases.saveCredentials(window.App)" class="px-6 py-3 bg-teal hover:bg-teal-dark text-white font-semibold rounded-xl">Save credentials</button>
      </div>`;
  },

  addCert() {
    const App = window.App;
    const name = prompt('Certification name:', 'e.g. IRATA Level 3');
    if (!name) return;
    const expiry = prompt('Expiry date (YYYY-MM-DD, optional):', '');
    const c = App.state.userProfile.credentials || App.featureData.credentials;
    c.certs.push({ name, expiry: expiry || '' });
    this.renderCredentials(App);
  },

  removeCert(i) {
    const App = window.App;
    const c = App.state.userProfile.credentials || App.featureData.credentials;
    c.certs.splice(i, 1);
    this.renderCredentials(App);
  },

  saveCredentials(App) {
    const c = App.state.userProfile.credentials || { certs: [], insurance: {}, equipment: [] };
    c.insurance = {
      provider: document.getElementById('cred-ins-provider')?.value || '',
      expiry: document.getElementById('cred-ins-expiry')?.value || '',
    };
    c.equipment = (document.getElementById('cred-equipment')?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
    App.state.userProfile.credentials = c;
    App.featureData.credentials = c;
    if (App.state.userProfile.saved) App.saveUserProfileToStorage();
    this.save(App);
    App.toast('Credentials saved', 'success');
  },

  renderBadgesHtml(App, engineerId) {
    const badges = App.featureData.verificationBadges[engineerId] || [];
    return badges.map((b) => `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-teal/20 text-teal-light border border-teal/30">${App.escapeHtml(b)}</span>`).join(' ');
  },

  /* ---- Phase 3: Reviews ---- */

  promptReview(App, inquiryId) {
    const inq = App.state.inquiries.find((i) => i.id === inquiryId);
    if (!inq || inq.status !== 'completed') return;
    const reliability = prompt('Reliability (1-5):', '5');
    const skill = prompt('Technical skill (1-5):', '5');
    const communication = prompt('Communication (1-5):', '5');
    const comment = prompt('Comment (optional):', '');
    if (!reliability) return;
    App.featureData.reviews.push({
      id: 'rev-' + Date.now(),
      inquiryId,
      engineerId: inq.engineerId,
      bookerId: inq.bookerId,
      reliability: Number(reliability),
      skill: Number(skill),
      communication: Number(communication),
      comment: comment || '',
      at: new Date().toISOString(),
    });
    this.save(App);
    App.toast('Review submitted', 'success');
  },

  getEngineerReviewSummary(App, engineerId) {
    const revs = App.featureData.reviews.filter((r) => r.engineerId === engineerId);
    if (!revs.length) return null;
    const avg = (k) => (revs.reduce((s, r) => s + r[k], 0) / revs.length).toFixed(1);
    return { count: revs.length, reliability: avg('reliability'), skill: avg('skill'), communication: avg('communication') };
  },

  /* ---- Phase 3: Company ---- */

  renderCompany(App) {
    const el = document.getElementById('booker-tab-company');
    if (!el) return;
    const co = App.featureData.company;
    if (!co.name && App.state.bookerProfile?.company) co.name = App.state.bookerProfile.company;
    el.innerHTML = `
      <h2 class="text-xl font-semibold text-white mb-6">Production company</h2>
      <div class="bg-slate rounded-2xl border border-white/10 p-6 space-y-4 max-w-2xl">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Company name</label>
          <input type="text" id="co-name" value="${App.escapeHtml(co.name || '')}" class="w-full px-4 py-2.5 bg-navy border border-white/10 rounded-lg text-white" />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-2">Team members</label>
          <div id="co-members" class="space-y-2 mb-3">${(co.members || []).map((m, i) => `
            <div class="flex gap-2 text-sm p-2 bg-navy rounded-lg">
              <span class="flex-1 text-gray-300">${App.escapeHtml(m.email)} · <span class="text-teal-light">${m.role}</span></span>
              <button type="button" onclick="FMPhases.removeMember(${i})" class="text-red-400 text-xs">Remove</button>
            </div>`).join('') || '<p class="text-xs text-gray-500">No team members yet.</p>'}</div>
          <button type="button" onclick="FMPhases.addMember()" class="text-sm text-teal hover:underline">+ Add member</button>
        </div>
        <button type="button" onclick="FMPhases.saveCompany(window.App)" class="px-6 py-2.5 bg-teal hover:bg-teal-dark text-white font-semibold rounded-xl">Save company</button>
      </div>`;
  },

  addMember() {
    const App = window.App;
    const email = prompt('Member email:');
    if (!email) return;
    const role = prompt('Role (admin / booker / viewer):', 'booker') || 'booker';
    App.featureData.company.members = App.featureData.company.members || [];
    App.featureData.company.members.push({ email: email.toLowerCase(), role });
    this.renderCompany(App);
  },

  removeMember(i) {
    const App = window.App;
    App.featureData.company.members.splice(i, 1);
    this.renderCompany(App);
  },

  saveCompany(App) {
    App.featureData.company.name = document.getElementById('co-name')?.value?.trim() || '';
    if (App.state.bookerProfile) App.state.bookerProfile.company = App.featureData.company.name;
    App.saveBookerProfileToStorage();
    this.save(App);
    App.toast('Company saved', 'success');
  },

  /* ---- Phase 3: Email simulation ---- */

  simulateEmail(App, type, body) {
    if (!App.featureData.emailPrefs) return;
    const prefs = App.featureData.emailPrefs;
    if (type.includes('inquiry') && !prefs.inquiries) return;
    if (type.includes('message') && !prefs.messages) return;
    const entry = { type, body, to: App.accessSession?.email || 'demo@booker.com', at: new Date().toISOString(), status: 'sent' };
    App.featureData.emailOutbox.unshift(entry);
    if (App.featureData.emailOutbox.length > 50) App.featureData.emailOutbox.length = 50;
    this.save(App);
  },

  /* ---- Phase 3: Admin ---- */

  renderAdminUsers(App) {
    const el = document.getElementById('admin-users-panel');
    if (!el) return;
    const engineers = App.getAllSearchableEngineers();
    const bookers = App.state.bookerRegistry || [];
    const inqCount = (id, role) => App.state.inquiries.filter((i) => (role === 'engineer' ? i.engineerId === id : i.bookerId === id)).length;
    el.innerHTML = `
      <h2 class="text-lg font-semibold text-white mb-4">User directory</h2>
      <div class="grid lg:grid-cols-2 gap-6">
        <div>
          <p class="text-xs text-gray-500 uppercase mb-2">Engineers (${engineers.length})</p>
          <div class="space-y-2 max-h-64 overflow-y-auto">${engineers.slice(0, 20).map((e) => `
            <div class="p-3 bg-navy/50 rounded-lg text-sm flex justify-between">
              <span class="text-gray-300">${App.escapeHtml(e.name)} <span class="text-gray-600">· ${inqCount(e.id, 'engineer')} inquiries</span></span>
              <button type="button" onclick="FMPhases.adminBadge('${e.id}')" class="text-xs text-teal">Badge</button>
            </div>`).join('')}</div>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase mb-2">Bookers (${bookers.length})</p>
          <div class="space-y-2 max-h-64 overflow-y-auto">${bookers.map((b) => `
            <div class="p-3 bg-navy/50 rounded-lg text-sm text-gray-300">${App.escapeHtml(b.name)} · ${App.escapeHtml(b.company || '')} · <span class="text-teal-light">${b.subscription?.status || 'none'}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="mt-6">
        <p class="text-xs text-gray-500 uppercase mb-2">Email outbox (simulated)</p>
        <div class="max-h-32 overflow-y-auto text-xs text-gray-500">${(App.featureData.emailOutbox || []).slice(0, 10).map((e) => `
          <div class="py-1 border-b border-white/5">${new Date(e.at).toLocaleString('en-GB')} → ${App.escapeHtml(e.to)}: ${App.escapeHtml(e.body?.slice(0, 60))}</div>`).join('') || 'No emails sent yet.'}</div>
      </div>`;
  },

  adminBadge(engineerId) {
    const App = window.App;
    const badge = prompt('Badge label (e.g. ID verified, References checked):');
    if (!badge) return;
    App.featureData.verificationBadges[engineerId] = App.featureData.verificationBadges[engineerId] || [];
    if (!App.featureData.verificationBadges[engineerId].includes(badge)) {
      App.featureData.verificationBadges[engineerId].push(badge);
    }
    this.save(App);
    App.toast('Badge assigned', 'success');
    this.renderAdminUsers(App);
  },

  /* ---- Phase 4: API session ---- */

  ensureApiSession(App) {
    if (App.featureData.apiSession?.expiresAt && new Date() < new Date(App.featureData.apiSession.expiresAt)) return;
    App.featureData.apiSession = {
      token: 'fm_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      userId: App.state.currentRole === 'booker' ? 'demo-booker' : 'user-me',
      role: App.state.currentRole || 'guest',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    this.save(App);
  },

  /* ---- Phase 4: Stripe ---- */

  logStripeEvent(App, event, data) {
    App.featureData.stripeEvents.unshift({ event, data, at: new Date().toISOString() });
    if (App.featureData.stripeEvents.length > 30) App.featureData.stripeEvents.length = 30;
    this.save(App);
  },

  renderStripeLog(App) {
    const el = document.getElementById('admin-stripe-log');
    if (!el) return;
    el.innerHTML = `<h2 class="text-lg font-semibold text-white mb-4">Stripe webhooks (simulated)</h2>
      <div class="space-y-2 text-sm">${(App.featureData.stripeEvents || []).map((e) => `
        <div class="p-3 bg-navy/50 rounded-lg"><span class="text-teal font-mono text-xs">${e.event}</span>
        <span class="text-gray-500 ml-2">${new Date(e.at).toLocaleString('en-GB')}</span>
        <pre class="text-xs text-gray-600 mt-1 overflow-x-auto">${App.escapeHtml(JSON.stringify(e.data || {}, null, 0).slice(0, 120))}</pre></div>`).join('') || '<p class="text-gray-500">No webhook events yet. Complete a subscription to simulate.</p>'}</div>`;
  },

  /* ---- Phase 4: Smarter ranking ---- */

  locationScore(bookerLoc, engLoc) {
    if (!bookerLoc || !engLoc) return 0;
    const b = bookerLoc.toLowerCase();
    const e = engLoc.toLowerCase();
    if (e.includes(b) || b.includes(e.split(',')[0])) return 15;
    const uk = ['london', 'manchester', 'bristol', 'edinburgh', 'leeds', 'uk'];
    if (uk.some((c) => b.includes(c) && e.includes(c))) return 8;
    return 0;
  },

  rankScore(App, eng, criteria) {
    let score = eng.matchScore || 0;
    score *= 10;
    if (FMPhases.isFavorite(App, eng.id)) score += 20;
    score += FMPhases.locationScore(criteria.location, eng.location);
    const past = App.state.inquiries.filter((i) => i.engineerId === eng.id && i.bookerId === 'demo-booker' && i.status === 'completed').length;
    score += past * 5;
    if (eng.lastActiveAt) {
      const days = (Date.now() - new Date(eng.lastActiveAt)) / 86400000;
      if (days < 7) score += 10;
    }
    const rev = FMPhases.getEngineerReviewSummary(App, eng.id);
    if (rev) score += Number(rev.skill) * 2;
    return score;
  },

  /* ---- Phase 4: Booker notes ---- */

  editBookerNote(App, engineerId) {
    const current = App.featureData.bookerNotes[engineerId] || '';
    const note = prompt('Private note (only you see this):', current);
    if (note === null) return;
    if (note) App.featureData.bookerNotes[engineerId] = note;
    else delete App.featureData.bookerNotes[engineerId];
    this.save(App);
    if (App.state.bookerSearch.hasSearched) App.renderBookerResults(App.state.bookerSearch.lastResults || []);
  },

  /* ---- Engineer settings tab ---- */

  renderSettings(App) {
    const el = document.getElementById('eng-tab-settings');
    if (!el) return;
    this.ensureApiSession(App);
    const prefs = App.featureData.emailPrefs;
    const session = App.featureData.apiSession;
    el.innerHTML = `
      <div class="space-y-6 max-w-xl">
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="font-semibold text-white mb-3">Email notifications (simulated)</h3>
          ${['inquiries', 'responses', 'messages', 'reminders'].map((k) => `
            <label class="flex items-center gap-2 text-sm text-gray-300 mb-2">
              <input type="checkbox" ${prefs[k] ? 'checked' : ''} onchange="FMPhases.setEmailPref('${k}',this.checked)" class="rounded text-teal" />
              ${k.charAt(0).toUpperCase() + k.slice(1)}
            </label>`).join('')}
        </div>
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="font-semibold text-white mb-2">Calendar export</h3>
          <button type="button" onclick="FMPhases.exportICal(window.App,'engineer')" class="px-4 py-2 text-sm bg-teal/20 text-teal-light rounded-lg">Download .ics (confirmed gigs)</button>
        </div>
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="font-semibold text-white mb-2">API session (demo)</h3>
          <p class="text-xs text-gray-500 font-mono break-all">${session ? session.token : '—'}</p>
          <p class="text-xs text-gray-600 mt-2">Sync-ready token for a future backend. Expires ${session ? new Date(session.expiresAt).toLocaleString('en-GB') : '—'}</p>
        </div>
      </div>`;
  },

  setEmailPref(key, val) {
    const App = window.App;
    App.featureData.emailPrefs[key] = val;
    this.save(App);
  },

  /* ---- UI injection ---- */

  injectUI() {
    const engTabs = document.querySelector('[data-view="engineer"] .flex.flex-wrap.gap-2.mb-8');
    if (engTabs) {
      [['open-shifts', 'Open Shifts'], ['credentials', 'Credentials'], ['settings', 'Settings']].forEach(([tab, label]) => {
        if (!engTabs.querySelector(`[data-etab="${tab}"]`)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.etab = tab;
          btn.className = 'portal-tab px-4 py-2.5 text-sm font-semibold rounded-lg transition-all text-gray-400 hover:text-white';
          btn.textContent = label;
          btn.setAttribute('onclick', `App.setEngineerTab('${tab}')`);
          engTabs.appendChild(btn);
        }
      });
    }
    const engSection = document.querySelector('[data-view="engineer"] section');
    if (engSection) {
      ['open-shifts', 'credentials', 'settings'].forEach((tab) => {
        if (!document.getElementById(`eng-tab-${tab}`)) {
          const panel = document.createElement('div');
          panel.id = `eng-tab-${tab}`;
          panel.className = 'eng-tab-panel hidden';
          engSection.appendChild(panel);
        }
      });
    }

    const bookerTabs = document.querySelector('#booker-portal-features .flex.flex-wrap.gap-2.mb-8');
    if (bookerTabs) {
      [['saved', 'Saved Searches'], ['company', 'Company']].forEach(([tab, label]) => {
        if (!bookerTabs.querySelector(`[data-btab="${tab}"]`)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.btab = tab;
          btn.className = 'booker-tab px-4 py-2.5 text-sm font-semibold rounded-lg transition-all text-gray-400 hover:text-white';
          btn.textContent = label;
          btn.setAttribute('onclick', `App.setBookerTab('${tab}')`);
          bookerTabs.appendChild(btn);
        }
      });
    }
    const portalFeatures = document.getElementById('booker-portal-features');
    if (portalFeatures) {
      ['saved', 'company'].forEach((tab) => {
        if (!document.getElementById(`booker-tab-${tab}`)) {
          const panel = document.createElement('div');
          panel.id = `booker-tab-${tab}`;
          panel.className = 'booker-tab-panel hidden';
          portalFeatures.appendChild(panel);
        }
      });
    }

    const adminDash = document.getElementById('admin-dashboard');
    if (adminDash && !document.getElementById('admin-users-panel')) {
      const users = document.createElement('div');
      users.id = 'admin-users-panel';
      users.className = 'bg-slate rounded-2xl border border-white/10 p-6';
      const stripe = document.createElement('div');
      stripe.id = 'admin-stripe-log';
      stripe.className = 'bg-slate rounded-2xl border border-white/10 p-6';
      const logSection = adminDash.querySelector('#admin-access-log')?.closest('.bg-slate');
      if (logSection) {
        adminDash.insertBefore(stripe, logSection);
        adminDash.insertBefore(users, stripe);
      }
    }

    const subForm = document.getElementById('subscription-form');
    if (subForm && !document.getElementById('stripe-card-demo')) {
      const card = document.createElement('div');
      card.id = 'stripe-card-demo';
      card.className = 'space-y-3';
      card.innerHTML = `
        <p class="text-xs text-gray-400 uppercase tracking-wider">Payment (Stripe — simulated)</p>
        <input type="text" placeholder="Card number" value="4242 4242 4242 4242" class="w-full px-4 py-2.5 bg-navy border border-white/10 rounded-lg text-white text-sm font-mono" readonly />
        <div class="grid grid-cols-2 gap-3">
          <input type="text" placeholder="MM/YY" value="12/28" class="px-4 py-2.5 bg-navy border border-white/10 rounded-lg text-white text-sm" readonly />
          <input type="text" placeholder="CVC" value="123" class="px-4 py-2.5 bg-navy border border-white/10 rounded-lg text-white text-sm" readonly />
        </div>`;
      subForm.insertBefore(card, subForm.querySelector('button[type=submit]'));
    }
  },

  /* ---- Patches ---- */

  patchApp(App) {
    const self = this;

    const origSetEngTab = App.setEngineerTab.bind(App);
    App.setEngineerTab = function (tab) {
      origSetEngTab(tab);
      document.querySelectorAll('.eng-tab-panel').forEach((el) => el.classList.add('hidden'));
      document.getElementById(`eng-tab-${tab}`)?.classList.remove('hidden');
      if (tab === 'open-shifts') self.renderOpenShifts(App);
      if (tab === 'credentials') self.renderCredentials(App);
      if (tab === 'settings') self.renderSettings(App);
    };

    const origSetBookerTab = App.setBookerTab.bind(App);
    App.setBookerTab = function (tab) {
      origSetBookerTab(tab);
      ['dashboard', 'search', 'projects', 'saved', 'company'].forEach((t) => {
        document.getElementById(`booker-tab-${t}`)?.classList.toggle('hidden', tab !== t);
      });
      document.querySelectorAll('.booker-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.btab === tab);
        btn.classList.toggle('text-gray-400', btn.dataset.btab !== tab);
      });
      if (tab === 'saved') self.renderSavedSearches(App);
      if (tab === 'company') self.renderCompany(App);
    };

    const origMatch = App.matchEngineers.bind(App);
    App.matchEngineers = function (criteria) {
      let results = origMatch(criteria);
      results = results.filter((e) => !self.isBlocked(App, e.id));
      results = results.map((e) => ({ ...e, _rank: self.rankScore(App, e, criteria) }));
      if (App.state.bookerSearch?.sortBy === 'relevance') {
        results.sort((a, b) => (b._rank || 0) - (a._rank || 0));
      }
      return results;
    };

    const origAdvance = App.advanceInquiry.bind(App);
    App.advanceInquiry = function (id, status) {
      origAdvance(id, status);
      if (status === 'completed') {
        setTimeout(() => self.promptReview(App, id), 500);
      }
      self.simulateEmail(App, 'inquiry_' + status, `Inquiry ${status}`);
    };

    const origCompleteSub = App.completeSubscription.bind(App);
    App.completeSubscription = function () {
      origCompleteSub();
      self.logStripeEvent(App, 'checkout.session.completed', {
        planId: App.bookerSubscription?.planId,
        email: App.bookerSubscription?.email,
        amount: App.bookerSubscription?.amount,
      });
      self.logStripeEvent(App, 'customer.subscription.created', { status: 'active' });
      self.simulateEmail(App, 'subscription', 'Subscription activated');
    };

    const origAdminDash = App.renderAdminDashboard.bind(App);
    App.renderAdminDashboard = function () {
      origAdminDash();
      self.renderAdminUsers(App);
      self.renderStripeLog(App);
    };

    const origProjectDetail = App.renderProjectDetail.bind(App);
    App.renderProjectDetail = function () {
      origProjectDetail();
      const project = App.getProjectById(App.state.selectedProjectId);
      const header = document.querySelector('#booker-project-detail .bg-slate.rounded-2xl');
      if (project && header && !header.querySelector('.fm-project-actions')) {
        const actions = header.querySelector('.flex.flex-wrap.gap-2.shrink-0');
        if (actions) {
          const extra = document.createElement('div');
          extra.className = 'fm-project-actions flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0';
          extra.innerHTML = `
            <button type="button" onclick="FMPhases.duplicateProject(window.App,'${project.id}')" class="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-300 hover:text-white">Duplicate</button>
            <button type="button" onclick="FMPhases.bulkAddWeek(window.App,'${project.id}')" class="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-300 hover:text-white">+ Week</button>
            <button type="button" onclick="FMPhases.saveShiftTemplate(window.App,'${project.id}')" class="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-300 hover:text-white">Save template</button>
            <button type="button" onclick="FMPhases.exportCrewPack(window.App,'${project.id}')" class="px-3 py-1.5 text-xs bg-teal/20 text-teal-light rounded-lg">Export crew pack</button>
            <button type="button" onclick="FMPhases.exportICal(window.App,'booker')" class="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-300">Export .ics</button>`;
          actions.appendChild(extra);
        }
      }
      document.querySelectorAll('[data-shift-id]').forEach((card) => {
        const sid = card.dataset.shiftId;
        const pid = App.state.selectedProjectId;
        const editBtn = card.querySelector('button[onclick*="openShiftModal"]');
        if (editBtn && !card.querySelector('.fm-dup-shift')) {
          const dup = document.createElement('button');
          dup.type = 'button';
          dup.className = 'fm-dup-shift text-xs text-gray-400 hover:text-teal ml-2';
          dup.textContent = 'Duplicate';
          dup.onclick = () => self.duplicateShift(App, pid, sid);
          editBtn.parentNode.insertBefore(dup, editBtn.nextSibling);
        }
      });
    };

    const origRenderResults = App.renderBookerResults.bind(App);
    App.renderBookerResults = function (results) {
      origRenderResults(results);
      const grid = document.getElementById('booker-results');
      if (!grid) return;
      grid.querySelectorAll('article').forEach((card, i) => {
        const eng = results[i];
        if (!eng) return;
        if (!card.querySelector('.fm-fav-block')) {
          const wrap = document.createElement('div');
          wrap.className = 'fm-fav-block absolute top-3 right-3 flex items-center gap-0.5';
          wrap.innerHTML = self.favBlockHtml(App, eng.id);
          card.style.position = 'relative';
          const existing = card.querySelector('.fm-shortlist-btn');
          if (existing) existing.style.right = '4.5rem';
          card.appendChild(wrap);
        }
        const note = App.featureData.bookerNotes[eng.id];
        const badges = self.renderBadgesHtml(App, eng.id);
        const rev = self.getEngineerReviewSummary(App, eng.id);
        const meta = card.querySelector('.min-w-0');
        if (meta && !meta.querySelector('.fm-eng-meta')) {
          const div = document.createElement('div');
          div.className = 'fm-eng-meta mt-1';
          div.innerHTML = `${badges ? `<div class="flex gap-1 flex-wrap mb-1">${badges}</div>` : ''}
            ${rev ? `<p class="text-xs text-amber-200/80">★ ${rev.skill} skill · ${rev.count} reviews</p>` : ''}
            ${eng.lastActiveAt ? `<p class="text-xs text-gray-600">Active ${new Date(eng.lastActiveAt).toLocaleDateString('en-GB')}</p>` : ''}
            ${note ? `<p class="text-xs text-gray-500 italic mt-1">Note: ${App.escapeHtml(note)}</p>` : ''}
            <button type="button" onclick="FMPhases.editBookerNote(window.App,'${eng.id}')" class="text-[10px] text-teal hover:underline mt-1">Edit note</button>`;
          meta.appendChild(div);
        }
      });
    };

    const origAddNotif = App.addNotification.bind(App);
    App.addNotification = function (opts) {
      origAddNotif(opts);
      if (opts.role === 'booker') self.simulateEmail(App, opts.type || 'notification', opts.message || opts.title);
    };

    const origRenderBookerPortal = App.renderBookerPortal.bind(App);
    App.renderBookerPortal = function () {
      origRenderBookerPortal();
      const tab = App.state.bookerTab;
      ['saved', 'company'].forEach((t) => {
        document.getElementById(`booker-tab-${t}`)?.classList.toggle('hidden', tab !== t);
      });
      if (tab === 'saved') self.renderSavedSearches(App);
      if (tab === 'company') self.renderCompany(App);
    };

    const origRenderEngPortal = App.renderEngineerPortal.bind(App);
    App.renderEngineerPortal = function () {
      origRenderEngPortal();
      if (App.state.engineerTab === 'open-shifts') self.renderOpenShifts(App);
      if (App.state.engineerTab === 'credentials') self.renderCredentials(App);
      if (App.state.engineerTab === 'settings') self.renderSettings(App);
    };

    const origInit = App.init.bind(App);
    App.init = function () {
      origInit();
      self.checkSearchAlerts(App);
      self.ensureApiSession(App);
    };
  },

  install(App) {
    if (App._phasesInstalled) return;
    App._phasesInstalled = true;
    this.mergeFeatureData(App);
    this.injectUI();
    this.bindShiftApplyModal();
    this.bindOpenShiftsPanel();
    this.patchApp(App);
  },
};

if (typeof window !== 'undefined') window.FMPhases = FMPhases;

if (typeof App !== 'undefined' && typeof FMFeatures !== 'undefined') {
  FMPhases.install(App);
}