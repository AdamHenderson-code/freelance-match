/**
 * Freelance Match — Phase 1 features extension
 * 1. Time-aware availability
 * 2. Booking workflow + counter-offers
 * 3. Threaded messages
 * 4. Shortlists & crew sheet
 * 5. Booker dashboard
 */
const FMFeatures = {
  VERSION: 1,
  STORAGE_KEY: 'fm_features',
  TIME_SLOTS: ['morning', 'afternoon', 'evening'],
  SLOT_LABELS: { morning: 'Morning (06–12)', afternoon: 'Afternoon (12–18)', evening: 'Evening (18–24)' },
  SLOT_RANGES: { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] },
  INQUIRY_EXPIRY_HOURS: 48,

  defaultData() {
    return {
      version: 1,
      shortlists: {},
      inquiryMessages: {},
      selectedAvailDate: null,
    };
  },

  load(App) {
    try {
      const raw = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
      return { ...this.defaultData(), ...(raw || {}) };
    } catch {
      return this.defaultData();
    }
  },

  save(App) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(App.featureData));
  },

  install(App) {
    if (App._featuresInstalled) return;
    App._featuresInstalled = true;
    App.featureData = this.load(App);

    this.injectUI();
    this.patchApp(App);

    const origInit = App.init.bind(App);
    App.init = () => {
      origInit();
      this.migrateProfiles(App);
      this.expireInquiries(App);
    };

    const origReset = App.resetDemo.bind(App);
    App.resetDemo = () => {
      localStorage.removeItem(this.STORAGE_KEY);
      origReset();
    };
  },

  /* ---- Data helpers ---- */

  migrateProfiles(App) {
    const ensureSlots = (profile) => {
      if (!profile) return;
      if (!profile.availabilitySlots) profile.availabilitySlots = {};
      (profile.availability || []).forEach((date) => {
        if (!profile.availabilitySlots[date]?.length) {
          profile.availabilitySlots[date] = [...this.TIME_SLOTS];
        }
      });
    };
    ensureSlots(App.state.userProfile);
    App.state.engineers.forEach(ensureSlots);
    App.state.engineers.forEach((e) => {
      if (!e.availabilitySlots) {
        e.availabilitySlots = {};
        (e.availability || []).forEach((d) => {
          e.availabilitySlots[d] = [...this.TIME_SLOTS];
        });
      }
    });
  },

  getSlotsForEngineer(eng, date) {
    if (!eng?.availability?.includes(date)) return [];
    const slots = eng.availabilitySlots?.[date];
    return slots?.length ? slots : [...this.TIME_SLOTS];
  },

  parseTimeToHour(timeStr) {
    if (!timeStr) return 0;
    const [h] = timeStr.split(':').map(Number);
    return h;
  },

  shiftOverlapsSlots(startTime, endTime, slots) {
    if (!slots?.length) return false;
    const startH = this.parseTimeToHour(startTime);
    let endH = this.parseTimeToHour(endTime);
    if (endH <= startH) endH = 24;
    return slots.some((slot) => {
      const [s, e] = this.SLOT_RANGES[slot] || [0, 0];
      return startH < e && endH > s;
    });
  },

  expireInquiries(App) {
    const now = Date.now();
    let changed = false;
    App.state.inquiries.forEach((inq) => {
      if (['pending', 'counter_offered'].includes(inq.status)) {
        const sent = new Date(inq.sentAt).getTime();
        const expiry = inq.expiresAt ? new Date(inq.expiresAt).getTime() : sent + this.INQUIRY_EXPIRY_HOURS * 3600000;
        if (!inq.expiresAt) {
          inq.expiresAt = new Date(sent + this.INQUIRY_EXPIRY_HOURS * 3600000).toISOString();
          changed = true;
        }
        if (now > expiry && inq.status !== 'expired') {
          inq.status = 'expired';
          inq.expiredAt = new Date().toISOString();
          changed = true;
        }
      }
    });
    if (changed) App.saveInquiries();
  },

  shortlistKey(projectId, shiftId) {
    return shiftId ? `${projectId}:${shiftId}` : projectId;
  },

  getShortlist(App, projectId, shiftId) {
    const key = this.shortlistKey(projectId, shiftId);
    return App.featureData.shortlists[key] || [];
  },

  toggleShortlist(App, projectId, shiftId, engineerId) {
    const key = this.shortlistKey(projectId, shiftId);
    const list = App.featureData.shortlists[key] || [];
    const idx = list.indexOf(engineerId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(engineerId);
    App.featureData.shortlists[key] = list;
    this.save(App);
    App.toast(idx >= 0 ? 'Removed from shortlist' : 'Added to shortlist', 'info');
  },

  isShortlisted(App, projectId, shiftId, engineerId) {
    return this.getShortlist(App, projectId, shiftId).includes(engineerId);
  },

  getMessages(App, inquiryId) {
    return App.featureData.inquiryMessages[inquiryId] || [];
  },

  addMessage(App, inquiryId, role, text, fromName) {
    if (!text?.trim()) return;
    const msgs = App.featureData.inquiryMessages[inquiryId] || [];
    msgs.push({
      id: 'msg-' + Date.now(),
      role,
      fromName: fromName || (role === 'engineer' ? 'Engineer' : 'Booker'),
      text: text.trim(),
      at: new Date().toISOString(),
    });
    App.featureData.inquiryMessages[inquiryId] = msgs;
    this.save(App);
  },

  statusMeta(status) {
    const map = {
      pending: { label: 'Pending', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
      accepted: { label: 'Accepted', cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
      counter_offered: { label: 'Counter-offer', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
      confirmed: { label: 'Confirmed', cls: 'bg-teal/20 text-teal-light border-teal/30' },
      booked: { label: 'Booked', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
      completed: { label: 'Completed', cls: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
      declined: { label: 'Declined', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
      cancelled: { label: 'Cancelled', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
      expired: { label: 'Expired', cls: 'bg-gray-500/20 text-gray-500 border-gray-500/30' },
    };
    return map[status] || map.pending;
  },

  workflowActions(App, inq, perspective) {
    const actions = [];
    const id = inq.id;
    if (perspective === 'engineer') {
      if (inq.status === 'pending') {
        actions.push({ label: 'Confirm available', status: 'accepted', cls: 'bg-teal hover:bg-teal-dark text-white' });
        actions.push({ label: 'Counter-offer', action: 'counter', cls: 'bg-purple-600/80 hover:bg-purple-600 text-white' });
        actions.push({ label: 'Decline', status: 'declined', cls: 'bg-white/10 hover:bg-red-500/20 text-gray-300' });
      }
      if (inq.status === 'confirmed') {
        actions.push({ label: 'Mark booked', status: 'booked', cls: 'bg-blue-600 hover:bg-blue-700 text-white' });
      }
      if (inq.status === 'booked') {
        actions.push({ label: 'Mark completed', status: 'completed', cls: 'bg-gray-600 hover:bg-gray-500 text-white' });
      }
    }
    if (perspective === 'booker') {
      if (inq.status === 'accepted') {
        actions.push({ label: 'Confirm booking', status: 'confirmed', cls: 'bg-teal hover:bg-teal-dark text-white' });
      }
      if (inq.status === 'counter_offered') {
        actions.push({ label: 'Accept counter-offer', status: 'confirmed', cls: 'bg-teal hover:bg-teal-dark text-white' });
        actions.push({ label: 'Decline counter', status: 'declined', cls: 'bg-white/10 text-red-300' });
      }
      if (['pending', 'accepted', 'counter_offered', 'confirmed'].includes(inq.status)) {
        actions.push({ label: 'Cancel', status: 'cancelled', cls: 'bg-white/10 text-gray-400' });
      }
    }
    return actions.map((a) => {
      if (a.action === 'counter') {
        return `<button type="button" onclick="FMFeatures.openCounterOffer('${id}')" class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${a.cls}">${a.label}</button>`;
      }
      if (a.status) {
        return `<button type="button" onclick="App.advanceInquiry('${id}','${a.status}')" class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${a.cls}">${a.label}</button>`;
      }
      return '';
    }).join('');
  },

  renderMessageThread(App, inquiryId, canReply, role) {
    const msgs = this.getMessages(App, inquiryId);
    const thread = msgs.map((m) => `
      <div class="flex gap-2 ${m.role === role ? 'flex-row-reverse' : ''}">
        <div class="max-w-[85%] px-3 py-2 rounded-xl text-sm ${m.role === 'engineer' ? 'bg-teal/20 text-gray-200' : 'bg-navy text-gray-300'}">
          <p class="text-[10px] text-gray-500 mb-0.5">${App.escapeHtml(m.fromName)} · ${new Date(m.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          ${App.escapeHtml(m.text)}
        </div>
      </div>`).join('');

    const reply = canReply ? `
      <div class="flex gap-2 mt-3 pt-3 border-t border-white/10">
        <input type="text" id="thread-reply-${inquiryId}" placeholder="Type a message…" class="flex-1 px-3 py-2 bg-navy border border-white/10 rounded-lg text-white text-sm focus:border-teal outline-none"
          onkeydown="if(event.key==='Enter'){event.preventDefault();FMFeatures.sendThreadMessage('${inquiryId}','${role}');}" />
        <button type="button" onclick="FMFeatures.sendThreadMessage('${inquiryId}','${role}')" class="px-4 py-2 bg-teal hover:bg-teal-dark text-white text-sm font-semibold rounded-lg">Send</button>
      </div>` : '';

    return `<div class="mt-4 space-y-2 max-h-48 overflow-y-auto">${thread || '<p class="text-xs text-gray-500">No messages yet.</p>'}</div>${reply}`;
  },

  sendThreadMessage(inquiryId, role) {
    const input = document.getElementById(`thread-reply-${inquiryId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const App = window.App;
    const inq = App.state.inquiries.find((i) => i.id === inquiryId);
    if (!inq) return;
    const fromName = role === 'engineer'
      ? (App.getAllSearchableEngineers().find((e) => e.id === inq.engineerId)?.name || 'Engineer')
      : App.getBookerDisplayName();
    this.addMessage(App, inquiryId, role, text, fromName);
    input.value = '';
    const otherRole = role === 'engineer' ? 'booker' : 'engineer';
    App.addNotification({
      type: 'inquiry_message',
      role: otherRole,
      title: 'New message',
      message: `${fromName}: ${text.slice(0, 80)}`,
      inquiryId,
    });
    if (App.state.currentView === 'engineer' && App.state.engineerTab === 'matches') App.renderMatches();
    if (App.state.currentView === 'booker') App.renderBookerInquiries();
    App.toast('Message sent', 'success');
  },

  openCounterOffer(inquiryId) {
    const App = window.App;
    const inq = App.state.inquiries.find((i) => i.id === inquiryId);
    if (!inq) return;
    const amount = prompt('Enter your counter-offer day rate:', inq.rateOffer?.amount || '450');
    if (!amount) return;
    const num = Number(amount);
    if (!num || num <= 0) {
      App.toast('Enter a valid amount', 'error');
      return;
    }
    const note = prompt('Optional note for the booker:', '') || '';
    inq.status = 'counter_offered';
    inq.counterOffer = {
      amount: num,
      currency: inq.rateOffer?.currency || 'GBP',
      note,
      at: new Date().toISOString(),
    };
    inq.respondedAt = new Date().toISOString();
    if (note) this.addMessage(App, inquiryId, 'engineer', `Counter-offer: £${num}/day. ${note}`, 'Engineer');
    App.saveInquiries();
    App.addNotification({
      type: 'inquiry_counter',
      role: 'booker',
      title: 'Counter-offer received',
      message: `£${num}/day for ${inq.dates}`,
      inquiryId,
    });
    App.renderMatches();
    App.updateMatchBadge();
    App.toast('Counter-offer sent', 'success');
  },

  renderCounterOfferBlock(inq, App) {
    if (!inq.counterOffer) return '';
    const sym = App.currencySymbol(inq.counterOffer.currency);
    return `<div class="mt-3 p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-sm">
      <p class="text-xs text-purple-300 uppercase font-semibold">Counter-offer</p>
      <p class="text-lg font-bold text-white mt-1">${sym}${inq.counterOffer.amount}/day</p>
      ${inq.counterOffer.note ? `<p class="text-gray-400 mt-1">${App.escapeHtml(inq.counterOffer.note)}</p>` : ''}
    </div>`;
  },

  renderExpiryNote(inq) {
    if (!inq.expiresAt || !['pending', 'counter_offered'].includes(inq.status)) return '';
    const exp = new Date(inq.expiresAt);
    return `<p class="text-xs text-gray-500 mt-1">Expires ${exp.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>`;
  },

  /* ---- Availability UI ---- */

  renderSlotPicker(App) {
    const el = document.getElementById('eng-slot-picker');
    if (!el) return;
    const p = App.state.userProfile;
    const date = App.featureData.selectedAvailDate;
    if (!date || !p.availability?.includes(date)) {
      el.innerHTML = '<p class="text-sm text-gray-500">Select an available day on the calendar to set time slots.</p>';
      return;
    }
    const slots = p.availabilitySlots?.[date] || [...this.TIME_SLOTS];
    el.innerHTML = `
      <p class="text-sm text-white font-medium mb-2">${App.formatDateDisplay(date)}</p>
      <div class="flex flex-wrap gap-2">
        ${this.TIME_SLOTS.map((slot) => {
          const on = slots.includes(slot);
          const cls = on
            ? 'bg-teal/30 border-teal text-teal-light'
            : 'border-white/20 text-gray-400 hover:border-white/40';
          return `<button type="button" onclick="FMFeatures.toggleSlot('${date}','${slot}')" class="px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${cls}">${this.SLOT_LABELS[slot]}</button>`;
        }).join('')}
      </div>
      <p class="text-xs text-gray-500 mt-2">Bookers matching shifts will only see you when your slots overlap shift hours.</p>`;
  },

  toggleSlot(date, slot) {
    const App = window.App;
    const p = App.state.userProfile;
    if (!p.availabilitySlots) p.availabilitySlots = {};
    if (!p.availabilitySlots[date]) p.availabilitySlots[date] = [...this.TIME_SLOTS];
    const slots = p.availabilitySlots[date];
    const idx = slots.indexOf(slot);
    if (idx >= 0) {
      if (slots.length <= 1) {
        App.toast('Keep at least one time slot', 'error');
        return;
      }
      slots.splice(idx, 1);
    } else {
      slots.push(slot);
      slots.sort((a, b) => this.TIME_SLOTS.indexOf(a) - this.TIME_SLOTS.indexOf(b));
    }
    App.markDirty();
    this.renderSlotPicker(App);
    if (p.saved) App.saveUserProfileToStorage();
  },

  onCalendarToggle(App, date) {
    App.featureData.selectedAvailDate = date;
    this.renderSlotPicker(App);
  },

  /* ---- Crew sheet ---- */

  renderCrewSheet(App, project) {
    const shifts = project.shifts || [];
    if (!shifts.length) return '';
    const rows = shifts.flatMap((shift) =>
      (shift.skills || []).map((skill) => {
        const key = this.shortlistKey(project.id, shift.id);
        const shortlisted = (App.featureData.shortlists[key] || []).length;
        const booked = App.state.inquiries.filter(
          (i) => i.projectId === project.id && i.shiftId === shift.id && ['booked', 'completed', 'confirmed'].includes(i.status)
        ).length;
        const status = booked > 0 ? '✓ Booked' : shortlisted > 0 ? `${shortlisted} shortlisted` : '— Open';
        const statusCls = booked > 0 ? 'text-green-400' : shortlisted > 0 ? 'text-amber-300' : 'text-gray-500';
        return `<tr class="border-b border-white/5">
          <td class="py-2 text-gray-300 text-sm">${App.escapeHtml(shift.title)}</td>
          <td class="py-2 text-gray-400 text-sm">${App.formatDateDisplay(shift.date)} ${shift.startTime}–${shift.endTime}</td>
          <td class="py-2 text-teal-light text-sm">${App.escapeHtml(skill)}</td>
          <td class="py-2 text-sm font-medium ${statusCls}">${status}</td>
        </tr>`;
      })
    );
    if (!rows.length) return '';
    return `<div class="bg-slate rounded-2xl border border-white/10 p-6 mb-6">
      <h3 class="text-lg font-semibold text-white mb-4">Crew sheet</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead><tr class="text-xs text-gray-500 uppercase">
            <th class="pb-2">Shift</th><th class="pb-2">When</th><th class="pb-2">Role</th><th class="pb-2">Status</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    </div>`;
  },

  /* ---- Dashboard ---- */

  renderDashboard(App) {
    const el = document.getElementById('booker-tab-dashboard');
    if (!el) return;
    const projects = App.state.projects || [];
    const inquiries = App.state.inquiries || [];
    let totalShifts = 0;
    let rolesNeeded = 0;
    let rolesFilled = 0;
    let committedSpend = 0;
    const fillTimes = [];

    projects.forEach((p) => {
      (p.shifts || []).forEach((shift) => {
        totalShifts++;
        const skills = shift.skills || [];
        rolesNeeded += skills.length;
        skills.forEach(() => {
          const booking = inquiries.find(
            (i) => i.projectId === p.id && i.shiftId === shift.id && ['booked', 'completed', 'confirmed'].includes(i.status)
          );
          if (booking) {
            rolesFilled++;
            const rate = booking.counterOffer?.amount || booking.rateOffer?.amount || 0;
            committedSpend += rate;
            if (booking.sentAt && booking.respondedAt) {
              fillTimes.push(new Date(booking.respondedAt) - new Date(booking.sentAt));
            }
          }
        });
      });
    });

    const avgFill = fillTimes.length
      ? Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length / 3600000)
      : null;
    const fillPct = rolesNeeded ? Math.round((rolesFilled / rolesNeeded) * 100) : 0;
    const pendingInqs = inquiries.filter((i) => i.status === 'pending').length;

    el.innerHTML = `
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-slate rounded-xl border border-white/10 p-5">
          <p class="text-xs text-gray-500 uppercase">Projects</p>
          <p class="text-2xl font-bold text-white mt-1">${projects.length}</p>
        </div>
        <div class="bg-slate rounded-xl border border-white/10 p-5">
          <p class="text-xs text-gray-500 uppercase">Shifts</p>
          <p class="text-2xl font-bold text-teal mt-1">${totalShifts}</p>
        </div>
        <div class="bg-slate rounded-xl border border-white/10 p-5">
          <p class="text-xs text-gray-500 uppercase">Roles filled</p>
          <p class="text-2xl font-bold text-white mt-1">${rolesFilled}<span class="text-sm text-gray-500">/${rolesNeeded}</span></p>
          <p class="text-xs text-gray-500 mt-1">${fillPct}% coverage</p>
        </div>
        <div class="bg-slate rounded-xl border border-white/10 p-5">
          <p class="text-xs text-gray-500 uppercase">Committed spend</p>
          <p class="text-2xl font-bold text-teal-light mt-1">£${committedSpend.toLocaleString()}</p>
          <p class="text-xs text-gray-500 mt-1">Confirmed day rates</p>
        </div>
      </div>
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="font-semibold text-white mb-4">Fill performance</h3>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between"><span class="text-gray-400">Pending inquiries</span><span class="text-amber-300 font-medium">${pendingInqs}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Avg. time to respond</span><span class="text-white">${avgFill != null ? `~${avgFill}h` : '—'}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Open roles</span><span class="text-white">${rolesNeeded - rolesFilled}</span></div>
          </div>
        </div>
        <div class="bg-slate rounded-2xl border border-white/10 p-6">
          <h3 class="font-semibold text-white mb-4">Recent bookings</h3>
          ${inquiries.filter((i) => ['booked', 'completed', 'confirmed'].includes(i.status)).slice(0, 5).map((inq) => {
            const eng = App.getAllSearchableEngineers().find((e) => e.id === inq.engineerId);
            return `<div class="py-2 border-b border-white/5 text-sm">
              <span class="text-white">${App.escapeHtml(eng?.name || 'Engineer')}</span>
              <span class="text-gray-500"> · ${App.escapeHtml(inq.projectName || inq.dates)}</span>
              <span class="text-xs text-teal ml-2 capitalize">${inq.status}</span>
            </div>`;
          }).join('') || '<p class="text-sm text-gray-500">No confirmed bookings yet.</p>'}
        </div>
      </div>`;
  },

  shortlistButtonHtml(App, engineerId, projectId, shiftId) {
    const on = this.isShortlisted(App, projectId, shiftId, engineerId);
    const star = on ? '★' : '☆';
    const pid = projectId || '';
    const sid = shiftId || '';
    return `<button type="button" title="Shortlist" onclick="FMFeatures.toggleShortlistUI('${pid}','${sid}','${engineerId}')" class="p-2 text-lg ${on ? 'text-amber-400' : 'text-gray-500 hover:text-amber-300'}">${star}</button>`;
  },

  toggleShortlistUI(projectId, shiftId, engineerId) {
    const App = window.App;
    this.toggleShortlist(App, projectId || 'search', shiftId || '', engineerId);
    if (App.state.currentView === 'booker') {
      if (App.state.bookerTab === 'search' && App.state.bookerSearch.hasSearched) {
        App.renderBookerResults(App.state.bookerSearch.lastResults || []);
      }
      if (App.state.bookerTab === 'projects') App.renderBookerProjects();
    }
  },

  /* ---- UI injection ---- */

  injectUI() {
    const availTab = document.getElementById('eng-tab-availability');
    if (availTab && !document.getElementById('eng-slot-picker')) {
      const picker = document.createElement('div');
      picker.id = 'eng-slot-picker';
      picker.className = 'mt-6 pt-6 border-t border-white/10';
      availTab.querySelector('.bg-slate')?.appendChild(picker);
    }

    const bookerTabs = document.querySelector('#booker-portal-features .flex.flex-wrap.gap-2.mb-8');
    if (bookerTabs && !document.querySelector('[data-btab="dashboard"]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.btab = 'dashboard';
      btn.className = 'booker-tab px-4 py-2.5 text-sm font-semibold rounded-lg transition-all text-gray-400 hover:text-white';
      btn.textContent = 'Dashboard';
      btn.setAttribute('onclick', "App.setBookerTab('dashboard')");
      bookerTabs.insertBefore(btn, bookerTabs.firstChild);
    }

    const portalFeatures = document.getElementById('booker-portal-features');
    if (portalFeatures && !document.getElementById('booker-tab-dashboard')) {
      const panel = document.createElement('div');
      panel.id = 'booker-tab-dashboard';
      panel.className = 'booker-tab-panel hidden';
      portalFeatures.insertBefore(panel, document.getElementById('booker-tab-search'));
    }
  },

  /* ---- App patches ---- */

  patchApp(App) {
    const self = this;

    App.advanceInquiry = function (id, status) {
      const inq = App.state.inquiries.find((i) => i.id === id);
      if (!inq) return;
      const prev = inq.status;
      inq.status = status;
      inq.updatedAt = new Date().toISOString();
      if (['accepted', 'declined', 'counter_offered'].includes(status) && !inq.respondedAt) {
        inq.respondedAt = new Date().toISOString();
      }
      App.saveInquiries();

      const eng = App.getAllSearchableEngineers().find((e) => e.id === inq.engineerId);
      const engName = eng?.name || 'Engineer';
      const labels = {
        accepted: `${engName} confirmed availability`,
        declined: `${engName} declined`,
        confirmed: `Booking confirmed with ${engName}`,
        booked: `${engName} marked as booked`,
        completed: `Gig completed with ${engName}`,
        cancelled: 'Inquiry cancelled',
      };
      if (labels[status]) {
        App.addNotification({
          type: 'inquiry_' + status,
          role: status === 'cancelled' ? 'engineer' : 'booker',
          title: labels[status],
          message: inq.dates,
          inquiryId: id,
        });
      }
      if (prev !== status && inq.engineerId === 'user-me') {
        App.renderMatches();
        App.updateMatchBadge();
      }
      if (App.state.currentView === 'booker') {
        App.renderBookerInquiries();
        if (App.state.bookerTab === 'dashboard') self.renderDashboard(App);
      }
      App.toast(`Status: ${self.statusMeta(status).label}`, 'success');
    };

    const origRespond = App.respondToInquiry.bind(App);
    App.respondToInquiry = function (id, status) {
      origRespond(id, status);
      if (status === 'accepted') {
        const inq = App.state.inquiries.find((i) => i.id === id);
        if (inq) self.addMessage(App, id, 'engineer', 'Confirmed available for these dates.', inq.engineerId === 'user-me' ? App.state.userProfile.name : 'Engineer');
      }
    };

    const origToggleAvail = App.toggleUserAvailability.bind(App);
    App.toggleUserAvailability = function (date) {
      const p = App.state.userProfile;
      const wasAvail = p.availability?.includes(date);
      origToggleAvail(date);
      if (!p.availabilitySlots) p.availabilitySlots = {};
      if (!wasAvail && p.availability.includes(date)) {
        p.availabilitySlots[date] = [...self.TIME_SLOTS];
      } else if (wasAvail) {
        delete p.availabilitySlots[date];
      }
      App.featureData.selectedAvailDate = date;
      self.renderSlotPicker(App);
    };

    const origMarkWeek = App.markWeekAvailable.bind(App);
    App.markWeekAvailable = function () {
      origMarkWeek();
      const p = App.state.userProfile;
      if (!p.availabilitySlots) p.availabilitySlots = {};
      p.availability.forEach((d) => {
        if (!p.availabilitySlots[d]) p.availabilitySlots[d] = [...self.TIME_SLOTS];
      });
      self.renderSlotPicker(App);
    };

    const origMatch = App.matchEngineers.bind(App);
    App.matchEngineers = function (criteria) {
      let results = origMatch(criteria);
      const shiftTimes = criteria.shiftStart && criteria.shiftEnd
        ? { start: criteria.shiftStart, end: criteria.shiftEnd }
        : null;
      if (shiftTimes) {
        const date = criteria.requiredDates?.[0];
        results = results.filter((eng) => {
          const slots = self.getSlotsForEngineer(eng, date);
          return self.shiftOverlapsSlots(shiftTimes.start, shiftTimes.end, slots);
        });
      }
      return results;
    };

    const origGetShiftEng = App.getShiftAvailableEngineers.bind(App);
    App.getShiftAvailableEngineers = function (shift, project) {
      if (!shift.skills?.length) return [];
      return App.matchEngineers({
        skills: shift.skills,
        requiredDates: [shift.date],
        location: (project?.location || '').toLowerCase(),
        maxRate: shift.maxRate || 1000,
        shiftStart: shift.startTime,
        shiftEnd: shift.endTime,
      });
    };

    const origSubmit = App.submitInquiry.bind(App);
    App.submitInquiry = function () {
      const before = App.state.inquiries.length;
      origSubmit();
      if (App.state.inquiries.length > before) {
        const inq = App.state.inquiries[App.state.inquiries.length - 1];
        inq.expiresAt = new Date(Date.now() + self.INQUIRY_EXPIRY_HOURS * 3600000).toISOString();
        self.addMessage(App, inq.id, 'booker', inq.message, inq.bookerName);
        App.saveInquiries();
      }
    };

    const origRenderMatches = App.renderMatches.bind(App);
    App.renderMatches = function () {
      self.expireInquiries(App);
      const el = document.getElementById('eng-matches-list');
      const USER_ID = 'user-me';
      const matches = App.state.inquiries.filter((i) => i.engineerId === USER_ID);
      if (!matches.length) {
        origRenderMatches();
        return;
      }
      el.innerHTML = matches.map((inq) => {
        const meta = self.statusMeta(inq.status || 'pending');
        const actions = self.workflowActions(App, inq, 'engineer');
        return `
          <div class="bg-slate rounded-2xl border border-white/10 p-5 hover:border-teal/30 transition-colors">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-white">${App.escapeHtml(inq.bookerName || 'Crew Booker')}</p>
                <p class="text-sm text-gray-400 mt-1">${App.escapeHtml(inq.dates)}</p>
                ${self.renderExpiryNote(inq)}
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs px-2.5 py-1 rounded-full border capitalize ${meta.cls}">${meta.label}</span>
              </div>
            </div>
            <p class="text-sm text-gray-300 mt-3">${App.escapeHtml(inq.message)}</p>
            ${App.renderRateOfferBlock(inq.rateOffer)}
            ${self.renderCounterOfferBlock(inq, App)}
            ${App.renderShiftContextBlock(inq)}
            ${actions ? `<div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">${actions}</div>` : ''}
            <div class="mt-4">
              <p class="text-xs text-gray-500 uppercase mb-2">Messages</p>
              ${self.renderMessageThread(App, inq.id, !['declined', 'cancelled', 'expired', 'completed'].includes(inq.status), 'engineer')}
            </div>
          </div>`;
      }).join('');
      App.updateMatchBadge();
    };

    const origRenderBookerInq = App.renderBookerInquiries.bind(App);
    App.renderBookerInquiries = function () {
      self.expireInquiries(App);
      const el = document.getElementById('booker-inquiries-list');
      if (!el) return;
      const inquiries = [...App.state.inquiries].reverse();
      if (!inquiries.length) {
        origRenderBookerInq();
        return;
      }
      el.innerHTML = inquiries.map((inq) => {
        const eng = App.getAllSearchableEngineers().find((e) => e.id === inq.engineerId);
        const name = eng?.name || 'Unknown engineer';
        const meta = self.statusMeta(inq.status || 'pending');
        const actions = self.workflowActions(App, inq, 'booker');
        return `<div class="bg-slate rounded-xl border border-white/10 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="font-medium text-white">To: ${App.escapeHtml(name)}</p>
              <p class="text-sm text-gray-400 mt-0.5">${App.escapeHtml(inq.dates)}</p>
              <span class="inline-block text-xs px-2 py-0.5 rounded-full border mt-2 ${meta.cls}">${meta.label}</span>
              ${inq.rateOffer ? `<p class="text-xs text-amber-200 mt-2">${App.escapeHtml(App.formatRateOfferShort(inq.rateOffer))}</p>` : ''}
              ${self.renderCounterOfferBlock(inq, App)}
            </div>
            ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ''}
          </div>
          <div class="mt-4">
            ${self.renderMessageThread(App, inq.id, !['declined', 'cancelled', 'expired', 'completed'].includes(inq.status), 'booker')}
          </div>
        </div>`;
      }).join('');
    };

    const origRenderResults = App.renderBookerResults.bind(App);
    App.renderBookerResults = function (results) {
      origRenderResults(results);
      const grid = document.getElementById('booker-results');
      if (!grid || !results?.length) return;
      grid.querySelectorAll('article').forEach((card, i) => {
        const eng = results[i];
        if (!eng || card.querySelector('.fm-shortlist-btn')) return;
        const btn = document.createElement('div');
        btn.className = 'fm-shortlist-btn absolute top-3 right-3';
        btn.innerHTML = self.shortlistButtonHtml(App, eng.id, 'search', '');
        card.style.position = 'relative';
        card.appendChild(btn);
      });
    };

    const origShiftModalList = App.openShiftEngineersModal.bind(App);
    App.openShiftEngineersModal = function (projectId, shiftId) {
      origShiftModalList(projectId, shiftId);
      const list = document.getElementById('shift-engineers-list');
      if (!list) return;
      const engineers = App.getShiftAvailableEngineers(App.getShiftById(projectId, shiftId), App.getProjectById(projectId));
      list.querySelectorAll('.flex.flex-wrap').forEach((row, i) => {
        const eng = engineers[i];
        if (!eng || row.querySelector('.fm-shortlist-btn')) return;
        const actions = row.querySelector('.flex.gap-2');
        if (actions) {
          const wrap = document.createElement('span');
          wrap.className = 'fm-shortlist-btn';
          wrap.innerHTML = self.shortlistButtonHtml(App, eng.id, projectId, shiftId);
          actions.prepend(wrap);
        }
      });
    };

    const origProjectDetail = App.renderProjectDetail.bind(App);
    App.renderProjectDetail = function () {
      origProjectDetail();
      const project = App.getProjectById(App.state.selectedProjectId);
      const el = document.getElementById('booker-project-detail');
      if (!project || !el) return;
      const crewHtml = self.renderCrewSheet(App, project);
      if (crewHtml) {
        const firstChild = el.firstElementChild;
        if (firstChild && !el.querySelector('[data-crew-sheet]')) {
          const wrap = document.createElement('div');
          wrap.dataset.crewSheet = '1';
          wrap.innerHTML = crewHtml;
          el.insertBefore(wrap, firstChild);
        }
      }
    };

    const origSetBookerTab = App.setBookerTab.bind(App);
    App.setBookerTab = function (tab) {
      origSetBookerTab(tab);
      document.getElementById('booker-tab-dashboard')?.classList.toggle('hidden', tab !== 'dashboard');
      document.getElementById('booker-tab-search')?.classList.toggle('hidden', tab !== 'search');
      document.getElementById('booker-tab-projects')?.classList.toggle('hidden', tab !== 'projects');
      document.querySelectorAll('.booker-tab').forEach((btn) => {
        const active = btn.dataset.btab === tab;
        btn.classList.toggle('active', active);
        btn.classList.toggle('text-gray-400', !active);
      });
      if (tab === 'dashboard') self.renderDashboard(App);
    };

    const origRenderBookerPortal = App.renderBookerPortal.bind(App);
    App.renderBookerPortal = function () {
      origRenderBookerPortal();
      const tab = App.state.bookerTab;
      document.getElementById('booker-tab-dashboard')?.classList.toggle('hidden', tab !== 'dashboard');
      if (tab === 'dashboard') self.renderDashboard(App);
    };

    const origRenderEngPortal = App.renderEngineerPortal.bind(App);
    App.renderEngineerPortal = function () {
      origRenderEngPortal();
      self.renderSlotPicker(App);
    };

    const origSaveProfile = App.saveEngineerProfile.bind(App);
    App.saveEngineerProfile = function () {
      origSaveProfile();
      if (App.state.userProfile.saved) {
        App.touchLastActive(App.state.userProfile);
      }
    };

    App.touchLastActive = function (profile) {
      if (profile) profile.lastActiveAt = new Date().toISOString();
      if (profile?.id === 'user-me') App.saveUserProfileToStorage();
    };

    const origSaveBooker = App.saveBookerProfile.bind(App);
    App.saveBookerProfile = function () {
      origSaveBooker();
    };
  },
};

if (typeof App !== 'undefined') {
  FMFeatures.install(App);
}