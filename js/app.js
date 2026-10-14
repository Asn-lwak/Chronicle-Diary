class DiaryApp {
            constructor() {
                this.entries = [];
                this.settings = {
                    pin: null,
                    activeJournal: 'Personal',
                    customMoods: [],
                    customFeelings: []
                };
                this._realEntries = [];
                this._decoyEntries = [];
                this.isDecoyActive = false;
                this.decoyPin = null;
                Object.defineProperty(this, 'entries', {
                    configurable: true,
                    get: () => this.isDecoyActive ? this._decoyEntries : this._realEntries,
                    set: (value) => {
                        if (this.isDecoyActive) this._decoyEntries = Array.isArray(value) ? value : [];
                        else this._realEntries = Array.isArray(value) ? value : [];
                    }
                });
                this.currentEditingId = null;
                this.filterStarred = false;
                this.activeGalleryFilter = 'all';
                this.pinInput = '';
                this.mediaRecorder = null;
                this.audioChunks = [];
                this.audioStream = null;
                this.audioTimerInterval = null;
                this.audioStartedAt = 0;
                this.audioElapsedBeforePause = 0;
                this.currentEntryAudio = [];
                this.currentEntryLocation = '';
                this.currentEntryFeelings = [];
                this.currentEntryPhotos = [];
                this.currentEntrySketches = [];
                this.cameraStream = null;
                this.cameraFacingMode = 'environment';
                this.cameraBusy = false;
                this.calendarDate = new Date();
                this.selectedCalendarDate = null;
                this.sketchUndoStack = [];
                this.sketchRedoStack = [];
                this.sketchLastSnapshot = null;

                this.moodsList = [
                    { emoji: '😃', label: 'Joyful' },
                    { emoji: '😌', label: 'Peaceful' },
                    { emoji: '🚀', label: 'Motivated' },
                    { emoji: '💡', label: 'Inspired' },
                    { emoji: '☕', label: 'Cozy' },
                    { emoji: '😢', label: 'Melancholy' },
                    { emoji: '🌧️', label: 'Rainy' },
                    { emoji: '✨', label: 'Grateful' }
                ];

                this.feelingsList = [
                    { emoji: '😊', label: 'Happy' }, { emoji: '🥰', label: 'Loved' }, { emoji: '😌', label: 'Calm' },
                    { emoji: '😎', label: 'Confident' }, { emoji: '🤩', label: 'Excited' }, { emoji: '🥹', label: 'Touched' },
                    { emoji: '😔', label: 'Sad' }, { emoji: '😢', label: 'Lonely' }, { emoji: '😤', label: 'Frustrated' },
                    { emoji: '😡', label: 'Angry' }, { emoji: '😰', label: 'Anxious' }, { emoji: '😴', label: 'Tired' },
                    { emoji: '🤔', label: 'Thoughtful' }, { emoji: '🥱', label: 'Bored' }, { emoji: '🙏', label: 'Grateful' },
                    { emoji: '💪', label: 'Proud' }, { emoji: '🌱', label: 'Hopeful' }, { emoji: '💭', label: 'Nostalgic' },
                    { emoji: '❤️', label: 'Affectionate' }, { emoji: '✨', label: 'Inspired' }
                ];

                // Custom moods/feelings are loaded from settings after init().

                this.init();
            }

            init() {
                this.loadFromStorage();
                this.checkPinOnStartup();
                this.updateSettingsUI();
                this.switchTab('entries');
                this.initSketchpad();

                // App Switcher Privacy Shield
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        document.getElementById('privacy-shield').classList.remove('hidden');
                    }
                });
            }

            loadFromStorage() {
                try {
                    const savedEntries = localStorage.getItem('chronicle_entries');
                    const savedDecoyEntries = localStorage.getItem('chronicle_entries_decoy');
                    const savedSettings = localStorage.getItem('chronicle_settings');
                    const savedDecoyPin = localStorage.getItem('chronicle_decoy_pin');
                    if (savedEntries) this._realEntries = JSON.parse(savedEntries);
                    if (savedDecoyEntries) this._decoyEntries = JSON.parse(savedDecoyEntries);
                    if (savedSettings) this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                    this.settings.customMoods = Array.isArray(this.settings.customMoods) ? this.settings.customMoods : [];
                    this.settings.customFeelings = Array.isArray(this.settings.customFeelings) ? this.settings.customFeelings : [];
                    this.decoyPin = savedDecoyPin || null;
                } catch (e) {
                    console.error("Storage load error", e);
                }
            }

            saveToStorage() {
                try {
                    localStorage.setItem('chronicle_entries', JSON.stringify(this._realEntries));
                    localStorage.setItem('chronicle_entries_decoy', JSON.stringify(this._decoyEntries));
                    localStorage.setItem('chronicle_settings', JSON.stringify(this.settings));
                    if (this.decoyPin) localStorage.setItem('chronicle_decoy_pin', this.decoyPin);
                    else localStorage.removeItem('chronicle_decoy_pin');
                } catch (e) {
                    this.showModal("Storage Error", "Could not save data to browser local storage.");
                }
            }

            // --- Passcode Security (6-digit PIN) ---
            checkPinOnStartup() {
                if ((this.settings.pin && this.settings.pin.length === 6) || (this.decoyPin && this.decoyPin.length === 6)) {
                    document.getElementById('lock-screen').classList.remove('hidden');
                }
            }

            pressPin(digit) {
                if (this.pinInput.length < 6) {
                    this.pinInput += digit;
                    this.updatePinDots();
                    if (this.pinInput.length === 6) {
                        this.verifyPin();
                    }
                }
            }

            backspacePin() {
                this.pinInput = this.pinInput.slice(0, -1);
                this.updatePinDots();
            }

            clearPin() {
                this.pinInput = '';
                this.updatePinDots();
            }

            updatePinDots() {
                const dots = document.getElementById('pin-dots').children;
                for (let i = 0; i < dots.length; i++) {
                    if (i < this.pinInput.length) {
                        dots[i].classList.add('bg-diary-800', 'border-diary-800');
                    } else {
                        dots[i].classList.remove('bg-diary-800', 'border-diary-800');
                    }
                }
            }

            verifyPin() {
                if (this.settings.pin && this.pinInput === this.settings.pin) {
                    this.isDecoyActive = false;
                    document.getElementById('lock-screen').classList.add('hidden');
                    this.pinInput = '';
                    this.updatePinDots();
                    this.renderEntries();
                    return;
                }
                if (this.decoyPin && this.pinInput === this.decoyPin) {
                    this.isDecoyActive = true;
                    document.getElementById('lock-screen').classList.add('hidden');
                    this.pinInput = '';
                    this.updatePinDots();
                    this.renderEntries();
                    return;
                }
                document.getElementById('pin-error').innerText = 'Incorrect 6-digit PIN';
                setTimeout(() => { 
                    this.pinInput = ''; 
                    this.updatePinDots(); 
                    document.getElementById('pin-error').innerText = ''; 
                }, 1000);
            }

            unlockPrivacyShield() {
                // The visibility shield is only a visual cover. If PIN protection
                // is enabled, require the PIN before revealing the journal again.
                document.getElementById('privacy-shield').classList.add('hidden');
                const hasPin = (this.settings.pin && this.settings.pin.length === 6) ||
                               (this.decoyPin && this.decoyPin.length === 6);
                if (hasPin) {
                    this.pinInput = '';
                    this.updatePinDots();
                    document.getElementById('pin-error').innerText = '';
                    document.getElementById('lock-screen').classList.remove('hidden');
                }
            }

            lockAppNow() {
                if (!((this.settings.pin && this.settings.pin.length === 6) || (this.decoyPin && this.decoyPin.length === 6))) {
                    this.showModal('Set a PIN First', 'Enable your main PIN or configure a decoy PIN in Settings before locking the app.');
                    return;
                }
                this.pinInput = '';
                this.updatePinDots();
                document.getElementById('pin-error').innerText = '';
                document.getElementById('lock-screen').classList.remove('hidden');
            }

            saveDecoyPin() {
                const input = document.getElementById('new-decoy-input');
                const val = input.value.trim();
                if (!/^\d{6}$/.test(val)) {
                    this.showModal('Decoy PIN Error', 'Decoy PIN must be exactly 6 numeric digits.');
                    return;
                }
                if (this.settings.pin && val === this.settings.pin) {
                    this.showModal('Decoy PIN Error', 'Your decoy PIN must be different from your main PIN.');
                    return;
                }
                this.decoyPin = val;
                input.value = '';
                this.saveToStorage();
                this.updateSettingsUI();
                this.showModal('Decoy PIN Saved', 'Entering this PIN at the lock screen will open the separate decoy journal.');
            }

            disableDecoyPin() {
                this.decoyPin = null;
                this.isDecoyActive = false;
                this.saveToStorage();
                this.updateSettingsUI();
                this.showModal('Decoy Disabled', 'The decoy journal PIN has been disabled.');
            }

            togglePinSecurity() {
                const newPin = prompt("Enter a new 6-digit PIN code (or leave empty to disable):");
                if (newPin === null) return;
                if (newPin === "") {
                    this.settings.pin = null;
                    this.showModal("Security", "PIN security disabled.");
                } else if (newPin.length === 6 && !isNaN(newPin)) {
                    this.settings.pin = newPin;
                    this.showModal("Security", "6-Digit PIN security enabled successfully.");
                } else {
                    this.showModal("Error", "PIN must be exactly 6 numeric digits.");
                }
                this.saveToStorage();
                this.updateSettingsUI();
            }

            updateSettingsUI() {
                const statusText = document.getElementById('pin-status-text');
                const btn = document.getElementById('pin-toggle-btn');
                if (statusText && btn) {
                    if (this.settings.pin) {
                        statusText.innerText = "Status: Enabled 🔒";
                        btn.innerText = "Change/Disable PIN";
                    } else {
                        statusText.innerText = "Status: Disabled 🔓";
                        btn.innerText = "Enable PIN";
                    }
                }
                const decoyStatus = document.getElementById('decoy-status-text');
                if (decoyStatus) decoyStatus.innerText = this.decoyPin ? 'Enabled 🕶️' : 'Disabled';
            }

            // --- Navigation & Tabs ---
            switchTab(tabId) {
                const tabs = ['entries', 'calendar', 'analytics', 'gallery', 'settings'];
                tabs.forEach(t => {
                    const el = document.getElementById(`tab-${t}`);
                    if (el) el.classList.add('hidden');
                    
                    // Desktop Nav
                    const dBtn = document.getElementById(`nav-${t}`);
                    if (dBtn) {
                        dBtn.className = "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-diary-700 hover:bg-diary-200";
                    }
                    // Mobile Nav
                    const mBtn = document.getElementById(`m-nav-${t}`);
                    if (mBtn) {
                        mBtn.className = "flex flex-col items-center gap-1 text-diary-400 text-xs font-medium py-1";
                    }
                });

                const activeTabEl = document.getElementById(`tab-${tabId}`);
                if (activeTabEl) activeTabEl.classList.remove('hidden');

                const activeDBtn = document.getElementById(`nav-${tabId}`);
                if (activeDBtn) {
                    activeDBtn.className = "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all bg-diary-800 text-white shadow-sm";
                }

                const activeMBtn = document.getElementById(`m-nav-${tabId}`);
                if (activeMBtn) {
                    activeMBtn.className = "flex flex-col items-center gap-1 text-diary-800 text-xs font-semibold py-1";
                }

                if (tabId === 'entries') this.renderEntries();
                if (tabId === 'calendar') this.renderCalendar();
                if (tabId === 'analytics') this.updateAnalytics();
                if (tabId === 'gallery') this.renderGallery('all');
                if (tabId === 'settings') this.updateSettingsUI();

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            switchJournal(journalName) {
                this.settings.activeJournal = journalName;
                this.saveToStorage();
                this.renderEntries();
            }

            // --- Dashboard & Entries ---
            getLocalDateString(date = new Date()) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            getLocalTimeString(date = new Date()) {
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            }

            getEntryTime(entry) {
                if (entry && typeof entry.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) return entry.time;
                if (entry && entry.createdAt) {
                    const created = new Date(entry.createdAt);
                    if (!Number.isNaN(created.getTime())) return this.getLocalTimeString(created);
                }
                return '';
            }

            formatEntryTime(time) {
                if (!time) return 'Time not set';
                const [hours, minutes] = time.split(':').map(Number);
                const date = new Date();
                date.setHours(hours, minutes, 0, 0);
                return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            }

            renderEntries() {
                const container = document.getElementById('entries-container');
                const emptyState = document.getElementById('empty-state');
                const searchQuery = document.getElementById('search-input').value.toLowerCase();
                this.populateMoodDropdown();
                const moodFilter = document.getElementById('mood-filter').value;

                container.innerHTML = '';

                let filtered = this.entries;

                if (this.filterStarred) {
                    filtered = filtered.filter(e => e.starred);
                }

                if (moodFilter) {
                    filtered = filtered.filter(e => e.mood === moodFilter);
                }

                if (searchQuery) {
                    const query = searchQuery.trim();
                    const lower = value => String(value ?? '').toLowerCase();
                    const matchesQuery = e => {
                        // Search operators: tag:, mood:, date:, before:, after:, location:, has:
                        const colon = query.indexOf(':');
                        const operator = colon > 0 ? query.slice(0, colon).toLowerCase() : '';
                        const value = colon > 0 ? query.slice(colon + 1).trim() : '';

                        if (operator === 'tag') {
                            const tag = lower(value).replace(/^#/, '');
                            return !!tag && Array.isArray(e.tags) && e.tags.some(t => lower(t).includes(tag));
                        }
                        if (operator === 'mood') {
                            const mood = lower(value);
                            return !!mood && lower(e.mood).includes(mood);
                        }
                        if (operator === 'date') {
                            // Accept YYYY, YYYY-MM, or YYYY-MM-DD.
                            return !!value && String(e.date || '').startsWith(value);
                        }
                        if (operator === 'before') {
                            return !!value && !!e.date && e.date < value;
                        }
                        if (operator === 'after') {
                            return !!value && !!e.date && e.date > value;
                        }
                        if (operator === 'location') {
                            return !!value && lower(e.location).includes(lower(value));
                        }
                        if (operator === 'has') {
                            const kind = lower(value);
                            if (kind === 'photo' || kind === 'photos' || kind === 'image') return !!(e.photos && e.photos.length);
                            if (kind === 'audio' || kind === 'recording') return !!(e.audio && e.audio.length);
                            if (kind === 'sketch' || kind === 'drawing') return !!(e.sketches && e.sketches.length);
                            if (kind === 'media' || kind === 'attachment') return !!((e.photos && e.photos.length) || (e.audio && e.audio.length) || (e.sketches && e.sketches.length));
                            return false;
                        }

                        const haystack = [
                            e.title,
                            this.contentToPlainText(e.content),
                            ...(Array.isArray(e.tags) ? e.tags : []),
                            e.location,
                            e.mood,
                            ...(Array.isArray(e.feelings) ? e.feelings : [])
                        ].map(lower).join(' ');
                        return haystack.includes(lower(query));
                    };
                    filtered = filtered.filter(matchesQuery);
                }

                // Update Header Stats
                document.getElementById('stat-total').innerText = filtered.length;
                if (filtered.length > 0) {
                    document.getElementById('stat-mood').innerText = filtered[0].mood || '✨';
                } else {
                    document.getElementById('stat-mood').innerText = '✨';
                }

                const hour = new Date().getHours();
                let greeting = "Good evening";
                if (hour < 12) greeting = "Good morning";
                else if (hour < 18) greeting = "Good afternoon";
                document.getElementById('welcome-heading').innerText = greeting + ", Writer";

                if (filtered.length === 0) {
                    emptyState.classList.remove('hidden');
                    return;
                } else {
                    emptyState.classList.add('hidden');
                }

                filtered.forEach(entry => {
                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-3xl p-6 border border-diary-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group';

                    const formattedDate = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                    let tagsHtml = '';
                    if (entry.tags && entry.tags.length > 0) {
                        tagsHtml = entry.tags.slice(0, 3).map(t => `<span class="px-2.5 py-0.5 bg-diary-100 text-diary-700 text-xs font-medium rounded-md">#${t}</span>`).join('');
                    }

                    card.innerHTML = `
                        <div class="cursor-pointer" onclick="app.viewEntryDetails('${entry.id}')">
                            <div class="flex justify-between items-center mb-4">
                                <span class="text-2xl p-2 bg-diary-50 rounded-2xl border border-diary-100">${entry.mood || '✨'}</span>
                                <div class="flex items-center gap-2">
                                    <button onclick="event.stopPropagation(); app.toggleStar('${entry.id}')" class="text-diary-400 hover:text-amber-500">
                                        <i class="${entry.starred ? 'fa-solid fa-star text-amber-500' : 'fa-regular fa-star'}"></i>
                                    </button>
                                    <span class="text-xs font-semibold text-diary-500 tracking-wide text-right">${formattedDate}<br><span class="font-normal normal-case"><i class="fa-regular fa-clock mr-1"></i>${this.escapeHtml(this.formatEntryTime(this.getEntryTime(entry)))}</span></span>
                                </div>
                            </div>
                            <h4 class="text-xl font-serif font-bold text-diary-900 mb-2 group-hover:text-diary-600 transition-colors line-clamp-1">${this.escapeHtml(entry.title)}</h4>
                            <div class="rich-content-preview text-diary-600 text-sm line-clamp-3 mb-4 leading-relaxed">${this.renderRichContent(entry.content)}</div>
                        </div>
                        <div class="flex items-center justify-between pt-4 border-t border-diary-100">
                            <div class="flex flex-wrap gap-1">${tagsHtml}</div>
                            <button onclick="app.confirmDelete('${entry.id}')" class="text-xs text-rose-500 hover:underline">Delete</button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }

            toggleStarredFilter() {
                this.filterStarred = !this.filterStarred;
                const btn = document.getElementById('starred-filter-btn');
                if (this.filterStarred) {
                    btn.classList.add('border-amber-400', 'bg-amber-50');
                } else {
                    btn.classList.remove('border-amber-400', 'bg-amber-50');
                }
                this.renderEntries();
            }

            toggleStar(id) {
                const entry = this.entries.find(e => e.id === id);
                if (entry) {
                    entry.starred = !entry.starred;
                    this.saveToStorage();
                    this.renderEntries();
                }
            }

            confirmDelete(id) {
                this.showModal("Delete Entry", "Are you sure you want to delete this memory?", () => {
                    this.entries = this.entries.filter(e => e.id !== id);
                    this.saveToStorage();
                    this.renderEntries();
                    this.renderCalendar();
                    this.updateAnalytics();
                    this.renderGallery('all');
                    this.showModal("Deleted", "The entry has been removed.");
                }, true);
            }

            // --- Editor Workspace ---
            openEditor(id = null, dateOverride = null) {
                this.currentEditingId = id;
                this.currentEntryPhotos = [];
                this.currentEntrySketches = [];
                this.currentEntryAudio = [];
                this.currentEntryFeelings = [];
                document.getElementById('entry-media-preview').innerHTML = '';
                document.getElementById('feelings-picker')?.classList.add('hidden');

                this.populateMoodDropdown();
                this.populateSplitReferenceDropdown();

                if (id) {
                    const entry = this.entries.find(e => e.id === id);
                    if (entry) {
                        document.getElementById('entry-title-input').value = entry.title;
                        document.getElementById('entry-date-input').value = entry.date || this.getLocalDateString();
                        document.getElementById('entry-time-input').value = this.getEntryTime(entry) || this.getLocalTimeString();
                        document.getElementById('entry-content-input').innerHTML = this.loadEditorContent(entry.content);
                        document.getElementById('entry-tags-input').value = entry.tags ? entry.tags.join(', ') : '';
                        document.getElementById('entry-mood-select').value = entry.mood || '😃';
                        this.currentEntryPhotos = entry.photos || [];
                        this.currentEntrySketches = entry.sketches || [];
                        this.currentEntryAudio = Array.isArray(entry.audio) ? entry.audio : (entry.audio ? [entry.audio] : []);
                        this.currentEntryLocation = entry.location || '';
                        this.currentEntryFeelings = entry.feelings || [];
                        this.updateEntryLocationUI();
                        this.renderFeelingsOptions();
                        this.renderMediaPreviews();
                    }
                } else {
                    document.getElementById('entry-title-input').value = '';
                    const now = new Date();
                    document.getElementById('entry-date-input').value = dateOverride || this.getLocalDateString(now);
                    document.getElementById('entry-time-input').value = this.getLocalTimeString(now);
                    document.getElementById('entry-content-input').innerHTML = '';
                    document.getElementById('entry-tags-input').value = '';
                    this.currentEntryLocation = '';
                    this.updateEntryLocationUI();
                    this.currentEntryFeelings = [];
                    this.renderFeelingsOptions();
                }

                this.updateEditorCounters();
                this.sketchUndoStack = [];
                this.sketchRedoStack = [];
                document.getElementById('editor-modal').classList.remove('hidden');
            }

            minimizeEditor() {
                const modal = document.getElementById('editor-modal');
                if (!modal || modal.classList.contains('hidden')) return;
                modal.classList.add('hidden');
                const restoreBtn = document.getElementById('restore-entry-btn');
                if (restoreBtn) { restoreBtn.classList.remove('hidden'); restoreBtn.classList.add('flex'); }
            }

            restoreEditor() {
                const modal = document.getElementById('editor-modal');
                if (modal) modal.classList.remove('hidden');
                const restoreBtn = document.getElementById('restore-entry-btn');
                if (restoreBtn) { restoreBtn.classList.add('hidden'); restoreBtn.classList.remove('flex'); }
            }

            closeEditor() {
                document.getElementById('editor-modal').classList.add('hidden');
                const restoreBtn = document.getElementById('restore-entry-btn');
                if (restoreBtn) { restoreBtn.classList.add('hidden'); restoreBtn.classList.remove('flex'); }
                this.currentEditingId = null;
            }

            populateMoodDropdown() {
                const select = document.getElementById('entry-mood-select');
                select.innerHTML = '';
                [...this.moodsList, ...(this.settings.customMoods || [])].forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.emoji;
                    opt.textContent = `${m.emoji} ${m.label}`;
                    select.appendChild(opt);
                });

                const filter = document.getElementById('mood-filter');
                if (filter) {
                    const existing = new Set([...filter.options].map(o => o.value));
                    (this.settings.customMoods || []).forEach(m => {
                        if (!existing.has(m.emoji)) {
                            const opt = document.createElement('option');
                            opt.value = m.emoji;
                            opt.textContent = `${m.emoji} ${m.label}`;
                            filter.appendChild(opt);
                        }
                    });
                }
            }

            addCustomMood() {
                const emoji = prompt('Choose an emoji for your custom mood:', '🌟');
                if (!emoji || !emoji.trim()) return;
                const label = prompt('Name this mood:', 'My Mood');
                if (!label || !label.trim()) return;
                const mood = { emoji: emoji.trim(), label: label.trim() };
                const all = [...this.moodsList, ...(this.settings.customMoods || [])];
                if (all.some(m => m.emoji === mood.emoji && m.label.toLowerCase() === mood.label.toLowerCase())) return;
                this.settings.customMoods = [...(this.settings.customMoods || []), mood];
                this.saveToStorage();
                this.populateMoodDropdown();
                document.getElementById('entry-mood-select').value = mood.emoji;
            }

            addCustomFeeling() {
                const emoji = prompt('Choose an emoji for your custom feeling:', '💫');
                if (!emoji || !emoji.trim()) return;
                const label = prompt('Name this feeling:', 'My Feeling');
                if (!label || !label.trim()) return;
                const feeling = { emoji: emoji.trim(), label: label.trim() };
                const all = [...this.feelingsList, ...(this.settings.customFeelings || [])];
                if (all.some(f => f.emoji === feeling.emoji && f.label.toLowerCase() === feeling.label.toLowerCase())) return;
                this.settings.customFeelings = [...(this.settings.customFeelings || []), feeling];
                this.saveToStorage();
                this.renderFeelingsOptions();
                this.currentEntryFeelings.push(feeling.emoji);
                this.renderFeelingsOptions();
            }

            renderFeelingsOptions() {
                const container = document.getElementById('feelings-options');
                if (!container) return;
                container.innerHTML = [...this.feelingsList, ...(this.settings.customFeelings || [])].map((f, i) => {
                    const selected = this.currentEntryFeelings.includes(f.emoji);
                    return `<button type="button" onclick="app.toggleFeeling('${f.emoji}')" class="px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${selected ? 'bg-diary-800 text-white border-diary-800' : 'bg-white text-diary-700 border-diary-200'}">${f.emoji} ${f.label}</button>`;
                }).join('');
            }

            toggleFeelingsPicker() {
                const picker = document.getElementById('feelings-picker');
                picker.classList.toggle('hidden');
                this.renderFeelingsOptions();
            }

            toggleFeeling(emoji) {
                if (this.currentEntryFeelings.includes(emoji)) {
                    this.currentEntryFeelings = this.currentEntryFeelings.filter(f => f !== emoji);
                } else {
                    this.currentEntryFeelings.push(emoji);
                }
                this.renderFeelingsOptions();
            }

            updateEntryLocationUI() {
                const el = document.getElementById('entry-location-text');
                if (el) el.textContent = this.currentEntryLocation || 'Location not set';
            }

            async useCurrentLocation() {
                const status = document.getElementById('entry-location-text');
                if (!navigator.geolocation) {
                    this.showModal('Location unavailable', 'This browser does not support location services.');
                    return;
                }
                if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                    this.showModal('Location needs HTTPS', 'Browser location access usually requires HTTPS, localhost, or 127.0.0.1.');
                    return;
                }
                if (status) status.textContent = 'Finding location…';
                navigator.geolocation.getCurrentPosition((pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    // Keep location handling fully offline: save coordinates instead of calling an online reverse-geocoding service.
                    this.currentEntryLocation = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
                    this.updateEntryLocationUI();
                    this.showModal('Location saved', 'Your coordinates were saved locally. Chronicle stays offline, so it does not look up a city name online.');
                }, (err) => {
                    this.currentEntryLocation = '';
                    this.updateEntryLocationUI();
                    let message = 'Location access was not granted.';
                    if (err && err.code === 2) message = 'Your device could not determine your location.';
                    if (err && err.code === 3) message = 'Location request timed out. Please try again.';
                    this.showModal('Location unavailable', message);
                }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
            }

            formatText(command, value = null) {
                const editor = document.getElementById('entry-content-input');
                editor.focus();
                try {
                    document.execCommand(command, false, value);
                } catch (error) {
                    console.warn('Text formatting command is not supported:', command, error);
                }
                this.updateEditorCounters();
            }

            undoText() {
                document.getElementById('entry-content-input').focus();
                document.execCommand('undo', false, null);
                this.updateEditorCounters();
            }

            redoText() {
                document.getElementById('entry-content-input').focus();
                document.execCommand('redo', false, null);
                this.updateEditorCounters();
            }

            contentToPlainText(content) {
                if (!content) return '';
                const parsed = new DOMParser().parseFromString(String(content), 'text/html');
                return (parsed.body.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n');
            }

            sanitizeRichHtml(html) {
                const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE']);
                const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
                const cleanNode = (node) => {
                    [...node.childNodes].forEach(child => {
                        if (child.nodeType === Node.COMMENT_NODE) {
                            child.remove();
                            return;
                        }
                        if (child.nodeType !== Node.ELEMENT_NODE) return;
                        if (!allowedTags.has(child.tagName)) {
                            child.replaceWith(...child.childNodes);
                            return;
                        }
                        [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
                        cleanNode(child);
                    });
                };
                cleanNode(parsed.body);
                return parsed.body.innerHTML;
            }

            loadEditorContent(content) {
                if (!content) return '';
                // New entries contain rich HTML. Older entries are plain text/Markdown.
                if (/<\/?(b|strong|i|em|u|s|strike|h2|h3|p|div|br|ul|ol|li|blockquote|pre|code)(?:\s|>|\/)/i.test(content)) {
                    return this.sanitizeRichHtml(content);
                }
                const escaped = this.escapeHtml(String(content));
                return escaped.split(/\r?\n/).map(line => {
                    if (/^###\s/.test(line)) return `<h3>${line.replace(/^###\s/, '')}</h3>`;
                    if (/^##?\s/.test(line)) return `<h2>${line.replace(/^##?\s/, '')}</h2>`;
                    if (/^-\s/.test(line)) return `<ul><li>${line.replace(/^-\s/, '')}</li></ul>`;
                    if (/^&gt;\s/.test(line)) return `<blockquote>${line.replace(/^&gt;\s/, '')}</blockquote>`;
                    return line
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
                }).join('<br>');
            }

            renderRichContent(content) {
                return this.loadEditorContent(content);
            }

            updateEditorCounters() {
                const editor = document.getElementById('entry-content-input');
                const text = editor ? editor.innerText || '' : '';
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                const chars = text.length;
                const readTime = Math.ceil(words / 200);

                document.getElementById('word-count').innerText = `${words} words`;
                document.getElementById('char-count').innerText = `${chars} characters`;
                document.getElementById('read-time').innerText = `${readTime} min read`;
            }

            saveCurrentEntry() {
                const title = document.getElementById('entry-title-input').value.trim();
                const content = this.sanitizeRichHtml(document.getElementById('entry-content-input').innerHTML).trim();
                const plainContent = this.contentToPlainText(content).trim();
                const rawTags = document.getElementById('entry-tags-input').value.trim();
                const mood = document.getElementById('entry-mood-select').value;
                const now = new Date();
                const entryDate = document.getElementById('entry-date-input').value || this.getLocalDateString(now);
                const entryTime = document.getElementById('entry-time-input').value || this.getLocalTimeString(now);
                const tags = rawTags ? rawTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];

                if (!plainContent && !title) {
                    this.showModal("Error", "Cannot save an empty entry.");
                    return;
                }

                const todayStr = new Date().toISOString().split('T')[0];

                if (this.currentEditingId) {
                    const entry = this.entries.find(e => e.id === this.currentEditingId);
                    if (entry) {
                        entry.title = title || 'Untitled';
                        entry.content = content;
                        entry.tags = tags;
                        entry.mood = mood;
                        entry.feelings = [...this.currentEntryFeelings];
                        entry.date = entryDate;
                        entry.time = entryTime;
                        entry.photos = this.currentEntryPhotos;
                        entry.sketches = this.currentEntrySketches;
                        entry.audio = [...this.currentEntryAudio];
                        entry.location = this.currentEntryLocation || '';
                        entry.updatedAt = new Date().toISOString();
                    }
                } else {
                    const newEntry = {
                        id: 'entry_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        journal: this.settings.activeJournal,
                        date: entryDate,
                        time: entryTime,
                        title: title || 'Untitled',
                        content,
                        tags,
                        mood,
                        feelings: [...this.currentEntryFeelings],
                        photos: this.currentEntryPhotos,
                        sketches: this.currentEntrySketches,
                        audio: [...this.currentEntryAudio],
                        location: this.currentEntryLocation || '',
                        starred: false,
                        createdAt: new Date().toISOString()
                    };
                    this.entries.unshift(newEntry);
                }

                this.saveToStorage();
                this.closeEditor();
                this.renderEntries();
                this.renderCalendar();
                this.updateAnalytics();
                this.renderGallery('all');
                this.showModal("Success", "Diary entry saved securely.");
            }

            // --- Split Screen Dual View ---
            toggleSplitScreen() {
                const pane = document.getElementById('split-screen-pane');
                pane.classList.toggle('hidden');
            }

            populateSplitReferenceDropdown() {
                const select = document.getElementById('split-reference-select');
                select.innerHTML = '<option value="">Select past entry...</option>';
                this.entries.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e.id;
                    opt.textContent = `${e.date} - ${e.title}`;
                    select.appendChild(opt);
                });
            }

            loadSplitReference(id) {
                const refContent = document.getElementById('split-reference-content');
                if (!id) {
                    refContent.innerText = 'Select an entry above to view side-by-side.';
                    return;
                }
                const entry = this.entries.find(e => e.id === id);
                if (entry) {
                    refContent.innerHTML = `<h4 class="font-serif font-bold text-diary-900 mb-2">${this.escapeHtml(entry.title || 'Untitled')}</h4><div class="text-diary-700 rich-entry-content">${this.renderRichContent(entry.content)}</div>`;
                }
            }

            // --- Focus Mode ---
            toggleFocusMode() {
                const modal = document.getElementById('editor-container');
                const header = document.getElementById('editor-header');
                const toolbar = document.getElementById('editor-toolbar');
                const exitBtn = document.getElementById('focus-exit-btn');

                modal.classList.toggle('fixed');
                modal.classList.toggle('inset-0');
                modal.classList.toggle('max-w-5xl');
                modal.classList.toggle('h-[95vh]');
                modal.classList.toggle('h-screen');
                modal.classList.toggle('rounded-3xl');

                header.classList.toggle('hidden');
                toolbar.classList.toggle('hidden');
                exitBtn.classList.toggle('hidden');
            }

            // --- In-app camera ---
            async openCameraModal() {
                const modal = document.getElementById('camera-modal');
                const message = document.getElementById('camera-message');
                const captureBtn = document.getElementById('camera-capture-btn');
                if (!modal) return;
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                document.body.classList.add('camera-open');
                if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                    message.textContent = 'This browser cannot open an in-app camera here. Try HTTPS in a supported browser, or use Gallery to attach a photo.';
                    captureBtn.disabled = true;
                    return;
                }
                message.textContent = 'Requesting camera access…';
                captureBtn.disabled = true;
                try {
                    await this.startCameraStream();
                } catch (error) {
                    console.warn('Chronicle camera could not start:', error);
                    const messages = {
                        NotAllowedError: 'Camera permission was denied. Allow camera access in your browser settings, then try again.',
                        PermissionDeniedError: 'Camera permission was denied. Allow camera access in your browser settings, then try again.',
                        NotFoundError: 'No camera was found on this device. You can still attach photos from Gallery.',
                        NotReadableError: 'The camera may already be in use by another app. Close that app and try again.',
                        OverconstrainedError: 'This camera mode is unavailable. Try switching cameras or use Gallery.'
                    };
                    message.textContent = messages[error && error.name] || 'Could not open the camera. Check browser permissions and try again, or use Gallery.';
                    captureBtn.disabled = true;
                }
            }

            async startCameraStream() {
                this.stopCameraStream();
                const video = document.getElementById('camera-video');
                const message = document.getElementById('camera-message');
                const captureBtn = document.getElementById('camera-capture-btn');
                const constraints = {
                    audio: false,
                    video: { facingMode: { ideal: this.cameraFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.cameraStream = stream;
                video.srcObject = stream;
                await video.play();
                message.textContent = 'Camera ready! Frame your photo and tap Capture photo.';
                captureBtn.disabled = false;
                const switchBtn = document.getElementById('camera-switch-btn');
                if (switchBtn) switchBtn.disabled = false;
            }

            async switchCamera() {
                if (this.cameraBusy) return;
                this.cameraBusy = true;
                const message = document.getElementById('camera-message');
                const captureBtn = document.getElementById('camera-capture-btn');
                captureBtn.disabled = true;
                this.cameraFacingMode = this.cameraFacingMode === 'environment' ? 'user' : 'environment';
                const previousFacingMode = this.cameraFacingMode === 'environment' ? 'user' : 'environment';
                try {
                    await this.startCameraStream();
                } catch (error) {
                    this.cameraFacingMode = previousFacingMode;
                    try {
                        await this.startCameraStream();
                        message.textContent = 'This device could not switch to the other camera, so the original camera is still active.';
                    } catch (fallbackError) {
                        message.textContent = 'Could not switch cameras or restart the previous camera. Close and reopen the camera, or use Gallery.';
                        captureBtn.disabled = true;
                    }
                } finally {
                    this.cameraBusy = false;
                }
            }

            captureCameraPhoto() {
                const video = document.getElementById('camera-video');
                const canvas = document.getElementById('camera-canvas');
                const message = document.getElementById('camera-message');
                if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
                    message.textContent = 'The camera is not ready yet. Please wait a moment and try again.';
                    return;
                }
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                    const photoData = canvas.toDataURL('image/jpeg', 0.9);
                    this.currentEntryPhotos.push(photoData);
                    this.renderMediaPreviews();
                    message.textContent = 'Photo attached! You can capture another or close the camera.';
                } catch (error) {
                    console.error('Could not capture camera photo:', error);
                    message.textContent = 'Could not save this photo. Please try again or use Gallery.';
                }
            }

            stopCameraStream() {
                if (this.cameraStream) {
                    this.cameraStream.getTracks().forEach(track => track.stop());
                    this.cameraStream = null;
                }
                const video = document.getElementById('camera-video');
                if (video) video.srcObject = null;
                const captureBtn = document.getElementById('camera-capture-btn');
                if (captureBtn) captureBtn.disabled = true;
            }

            closeCameraModal() {
                this.stopCameraStream();
                const modal = document.getElementById('camera-modal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
                document.body.classList.remove('camera-open');
            }

            // --- Media Attachments (Photos, Voice, Sketches) ---
            attachPhoto(event) {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                let remaining = files.length;
                files.forEach(file => {
                    if (!file.type.startsWith('image/')) { remaining--; return; }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.currentEntryPhotos.push(e.target.result);
                        remaining--;
                        if (remaining === 0) this.renderMediaPreviews();
                    };
                    reader.onerror = () => { remaining--; if (remaining === 0) this.renderMediaPreviews(); };
                    reader.readAsDataURL(file);
                });
                event.target.value = '';
            }

            renderMediaPreviews() {
                const container = document.getElementById('entry-media-preview');
                container.innerHTML = '';

                this.currentEntryPhotos.forEach((photo, idx) => {
                    container.innerHTML += `<div class="relative w-16 h-16 rounded-xl overflow-hidden border border-diary-200"><img src="${photo}" class="w-full h-full object-cover"><button onclick="app.currentEntryPhotos.splice(${idx},1);app.renderMediaPreviews();" class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">×</button></div>`;
                });

                this.currentEntrySketches.forEach((sketch, idx) => {
                    container.innerHTML += `<div class="relative w-16 h-16 rounded-xl overflow-hidden border border-diary-200"><img src="${sketch}" class="w-full h-full object-cover"><button onclick="app.currentEntrySketches.splice(${idx},1);app.renderMediaPreviews();" class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">×</button></div>`;
                });

                const audioList = Array.isArray(this.currentEntryAudio) ? this.currentEntryAudio : (this.currentEntryAudio ? [this.currentEntryAudio] : []);
                audioList.forEach((audio, idx) => {
                    container.innerHTML += `<div class="flex items-center gap-2 p-2 rounded-xl bg-diary-100 text-xs font-semibold text-diary-800 w-full sm:w-auto"><i class="fa-solid fa-microphone text-rose-500"></i><span>Voice ${idx + 1}</span><audio controls preload="metadata" src="${audio}" class="max-w-[12rem] flex-1"></audio><button onclick="app.currentEntryAudio.splice(${idx},1);app.renderMediaPreviews();" class="text-rose-500 ml-1">×</button></div>`;
                });
            }

            // --- Vector Sketchpad ---
            initSketchpad() {
                const canvas = document.getElementById('sketch-canvas');
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let drawing = false;
                let lastX = 0;
                let lastY = 0;

                const resizeCanvas = () => {
                    const rect = canvas.getBoundingClientRect();
                    const dpr = Math.max(1, window.devicePixelRatio || 1);
                    const old = document.createElement('canvas');
                    old.width = canvas.width; old.height = canvas.height;
                    old.getContext('2d').drawImage(canvas, 0, 0);
                    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
                    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#382e22';
                    if (old.width && old.height) ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, rect.width, rect.height);
                };

                const point = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
                };

                canvas.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    drawing = true;
                    canvas.setPointerCapture?.(e.pointerId);
                    const p = point(e); lastX = p.x; lastY = p.y;
                    ctx.beginPath(); ctx.moveTo(lastX, lastY);
                });
                canvas.addEventListener('pointermove', (e) => {
                    if (!drawing) return;
                    e.preventDefault();
                    const p = point(e);
                    ctx.lineTo(p.x, p.y); ctx.stroke();
                    lastX = p.x; lastY = p.y;
                });
                const stop = (e) => {
                    if (drawing) this.captureSketchState();
                    drawing = false;
                    try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
                };
                canvas.addEventListener('pointerup', stop);
                canvas.addEventListener('pointercancel', stop);
                canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') drawing = false; });
                window.addEventListener('resize', () => { if (!document.getElementById('sketchpad-modal').classList.contains('hidden')) resizeCanvas(); });
                resizeCanvas();
                this.sketchUndoStack = [];
                this.sketchRedoStack = [];
                this.captureSketchState();
            }

            captureSketchState() {
                const canvas = document.getElementById('sketch-canvas');
                if (!canvas) return;
                const snapshot = canvas.toDataURL('image/png');
                if (snapshot === this.sketchLastSnapshot) return;
                this.sketchUndoStack.push(snapshot);
                if (this.sketchUndoStack.length > 80) this.sketchUndoStack.shift();
                this.sketchRedoStack = [];
                this.sketchLastSnapshot = snapshot;
            }

            restoreSketchState(snapshot) {
                const canvas = document.getElementById('sketch-canvas');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (!snapshot) {
                    this.sketchLastSnapshot = canvas.toDataURL('image/png');
                    return;
                }
                const image = new Image();
                image.onload = () => {
                    const rect = canvas.getBoundingClientRect();
                    ctx.drawImage(image, 0, 0, rect.width || canvas.width, rect.height || canvas.height);
                    this.sketchLastSnapshot = canvas.toDataURL('image/png');
                };
                image.src = snapshot;
            }

            undoSketch() {
                if (this.sketchUndoStack.length <= 1) return;
                const current = this.sketchUndoStack.pop();
                this.sketchRedoStack.push(current);
                this.restoreSketchState(this.sketchUndoStack[this.sketchUndoStack.length - 1]);
            }

            redoSketch() {
                if (!this.sketchRedoStack.length) return;
                const snapshot = this.sketchRedoStack.pop();
                this.sketchUndoStack.push(snapshot);
                this.restoreSketchState(snapshot);
            }

            clearSketch() {
                const canvas = document.getElementById('sketch-canvas');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                this.captureSketchState();
            }

            openSketchpadModal() {
                const modal = document.getElementById('sketchpad-modal');
                modal.classList.remove('hidden');
                requestAnimationFrame(() => {
                    window.dispatchEvent(new Event('resize'));
                    this.sketchUndoStack = [];
                    this.sketchRedoStack = [];
                    this.sketchLastSnapshot = null;
                    this.captureSketchState();
                });
            }

            closeSketchpadModal() {
                document.getElementById('sketchpad-modal').classList.add('hidden');
            }

            saveSketchToEntry() {
                const canvas = document.getElementById('sketch-canvas');
                const dataUrl = canvas.toDataURL();
                this.currentEntrySketches.push(dataUrl);
                this.renderMediaPreviews();
                this.closeSketchpadModal();
                this.clearSketch();
            }

            // --- Voice Recording ---
            formatAudioTime(seconds) {
                const total = Math.max(0, Math.floor(seconds));
                const mins = Math.floor(total / 60).toString().padStart(2, '0');
                const secs = (total % 60).toString().padStart(2, '0');
                return `${mins}:${secs}`;
            }

            updateAudioTimer() {
                const timer = document.getElementById('audio-timer');
                if (!timer) return;
                let elapsed = this.audioElapsedBeforePause;
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    elapsed += (Date.now() - this.audioStartedAt) / 1000;
                }
                timer.textContent = this.formatAudioTime(elapsed);
            }

            resetAudioUI() {
                clearInterval(this.audioTimerInterval);
                this.audioTimerInterval = null;
                this.audioElapsedBeforePause = 0;
                this.audioStartedAt = 0;
                const status = document.getElementById('audio-status');
                const pauseBtn = document.getElementById('audio-pause-btn');
                const recBtn = document.getElementById('audio-rec-btn');
                if (status) status.classList.add('hidden');
                if (pauseBtn) { pauseBtn.classList.add('hidden'); pauseBtn.style.display = 'none'; pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause'; }
                if (recBtn) { recBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Record'; recBtn.classList.remove('bg-rose-50','text-rose-700'); }
                this.updateAudioTimer();
            }

            async toggleAudioRecording() {
                // The main Record button becomes Stop while recording. Stop must also
                // finalize a paused recording instead of accidentally resuming it.
                if (this.mediaRecorder && (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused')) {
                    this.mediaRecorder.stop();
                    return;
                }

                try {
                    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                        throw new Error('secure-context');
                    }
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
                        throw new Error('unsupported');
                    }

                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                    });
                    this.audioStream = stream;
                    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
                    const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
                    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
                    this.audioChunks = [];
                    this.audioElapsedBeforePause = 0;
                    this.audioStartedAt = Date.now();

                    this.mediaRecorder.ondataavailable = e => {
                        if (e.data && e.data.size) this.audioChunks.push(e.data);
                    };
                    this.mediaRecorder.onerror = e => {
                        console.error('MediaRecorder error:', e);
                    };
                    this.mediaRecorder.onstop = () => {
                        clearInterval(this.audioTimerInterval);
                        this.audioTimerInterval = null;
                        if (this.audioStream) this.audioStream.getTracks().forEach(track => track.stop());
                        this.audioStream = null;
                        const type = this.mediaRecorder?.mimeType || mimeType || 'audio/webm';
                        const blob = new Blob(this.audioChunks, { type });
                        const reader = new FileReader();
                        reader.onload = e => {
                            this.currentEntryAudio.push(e.target.result);
                            this.renderMediaPreviews();
                            this.resetAudioUI();
                        };
                        reader.readAsDataURL(blob);
                    };

                    this.mediaRecorder.start(250);
                    const status = document.getElementById('audio-status');
                    const pauseBtn = document.getElementById('audio-pause-btn');
                    const recBtn = document.getElementById('audio-rec-btn');
                    if (status) status.classList.remove('hidden');
                    if (pauseBtn) { pauseBtn.classList.remove('hidden'); pauseBtn.style.display = 'inline-flex'; }
                    if (recBtn) { recBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop'; recBtn.classList.add('bg-rose-50','text-rose-700'); }
                    this.audioTimerInterval = setInterval(() => this.updateAudioTimer(), 250);
                    this.updateAudioTimer();
                } catch (err) {
                    console.error('Microphone access error:', err);
                    let message = 'Chronicle could not access your microphone.';
                    if (err.message === 'secure-context') {
                        message = 'Microphone recording needs a secure app/site connection on phones. This will work properly once Chronicle is installed as an app or opened through HTTPS.';
                    } else if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                        message = 'Microphone access was blocked. Check your browser or app microphone permission, then try again.';
                    } else if (err.name === 'NotFoundError') {
                        message = 'No microphone was found on this device.';
                    } else if (err.name === 'NotReadableError') {
                        message = 'The microphone is currently being used by another app.';
                    } else if (err.message === 'unsupported') {
                        message = 'This browser does not provide microphone recording for this page.';
                    }
                    this.showModal('Microphone Access', message);
                }
            }

            toggleAudioPause() {
                if (!this.mediaRecorder) return;
                const pauseBtn = document.getElementById('audio-pause-btn');
                const status = document.getElementById('audio-status');
                if (this.mediaRecorder.state === 'recording') {
                    this.audioElapsedBeforePause += (Date.now() - this.audioStartedAt) / 1000;
                    this.mediaRecorder.pause();
                    clearInterval(this.audioTimerInterval);
                    if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
                    if (status) status.innerHTML = 'Ⅱ Paused <span id="audio-timer">' + this.formatAudioTime(this.audioElapsedBeforePause) + '</span>';
                } else if (this.mediaRecorder.state === 'paused') {
                    this.mediaRecorder.resume();
                    this.audioStartedAt = Date.now();
                    if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
                    if (status) status.innerHTML = '● Recording voice note... <span id="audio-timer">' + this.formatAudioTime(this.audioElapsedBeforePause) + '</span>';
                    this.audioTimerInterval = setInterval(() => this.updateAudioTimer(), 250);
                }
            }

            // --- Calendar Heatmap ---
            renderCalendar() {
                const grid = document.getElementById('calendar-grid');
                const monthYear = document.getElementById('calendar-month-year');
                grid.innerHTML = '';

                const year = this.calendarDate.getFullYear();
                const month = this.calendarDate.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                monthYear.innerText = `${monthsNames[month]} ${year}`;

                for (let i = 0; i < firstDay; i++) {
                    grid.appendChild(document.createElement('div'));
                }

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEntries = this.entries.filter(e =>
                        e.date === dateStr &&
                        (e.journal || 'Personal') === this.settings.activeJournal
                    );
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isToday = dateStr === todayStr;

                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = `h-20 sm:h-24 rounded-2xl border p-2 flex flex-col justify-between items-center text-xs transition-all active:scale-95 hover:shadow-sm ${
                        isToday ? 'border-diary-800 ring-2 ring-diary-200' : 'border-diary-200'
                    } ${dayEntries.length ? 'bg-diary-100/70' : 'bg-white hover:bg-diary-50'}`;

                    const moods = dayEntries.slice(0, 3).map(e => e.mood || '✨').join(' ');
                    cell.innerHTML = `
                        <span class="font-bold ${isToday ? 'text-diary-900' : 'text-diary-800'}">${day}</span>
                        <span class="text-sm sm:text-base leading-none">${moods}</span>
                        <span class="text-[9px] text-diary-500">${dayEntries.length ? `${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'}` : 'Add'}</span>
                    `;
                    cell.onclick = () => this.openCalendarDate(dateStr);
                    grid.appendChild(cell);
                }
            }

            openCalendarDate(dateStr) {
                this.selectedCalendarDate = dateStr;
                const entries = this.entries.filter(e => e.date === dateStr);

                if (!entries.length) {
                    this.openEditor(null, dateStr);
                    return;
                }

                const [y, m, d] = dateStr.split('-');
                const title = document.getElementById('calendar-date-title');
                title.innerText = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                });

                const list = document.getElementById('calendar-date-entries');
                list.innerHTML = entries.map(entry => `
                    <button type="button" onclick="app.viewEntryDetails('${entry.id}')"
                        class="w-full text-left p-4 rounded-2xl border border-diary-200 bg-diary-50 hover:bg-diary-100 transition-all">
                        <div class="flex items-center justify-between gap-3">
                            <span class="font-serif font-bold text-diary-900 truncate">${this.escapeHtml(entry.title || 'Untitled')}</span>
                            <span>${entry.mood || '✨'}</span>
                        </div>
                        <div class="text-xs text-diary-600 mt-1 line-clamp-2 rich-content-preview">${this.renderRichContent(entry.content || '')}</div>
                    </button>
                `).join('');

                document.getElementById('calendar-date-modal').classList.remove('hidden');
                document.getElementById('calendar-date-modal').classList.add('flex');
            }

            viewEntryDetails(id) {
                const entry = this.entries.find(e => e.id === id);
                if (!entry) return;
                this.closeCalendarDateModal();
                document.getElementById('detail-entry-title').innerText = entry.title || 'Untitled';
                const detailDate = entry.date ? new Date(`${entry.date}T00:00:00`).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not set';
                document.getElementById('detail-entry-date').innerHTML = `<i class="fa-regular fa-calendar mr-1"></i>${this.escapeHtml(detailDate)} <span class="mx-1">·</span><i class="fa-regular fa-clock mr-1"></i>${this.escapeHtml(this.formatEntryTime(this.getEntryTime(entry)))}`;
                const moodInfo = [...this.moodsList, ...(this.settings.customMoods || [])].find(m => m.emoji === entry.mood);
                document.getElementById('detail-entry-mood').innerText = `${entry.mood || '✨'} ${moodInfo ? moodInfo.label : 'Mood'}`;
                document.getElementById('detail-entry-location').innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i>${this.escapeHtml(entry.location || 'Location not set')}`;
                const feelings = entry.feelings || [];
                document.getElementById('detail-entry-feelings').innerHTML = feelings.length
                    ? feelings.map(f => `<span class="px-3 py-2 rounded-xl bg-diary-50 border border-diary-200 text-xs font-semibold">${this.escapeHtml(f)}</span>`).join('')
                    : '<span class="text-xs text-diary-500">No extra feelings selected.</span>';
                document.getElementById('detail-entry-content').innerHTML = entry.content ? this.renderRichContent(entry.content) : '(No written content)';
                const tags = entry.tags || [];
                const tagWrap = document.getElementById('detail-entry-tags-wrap');
                tagWrap.classList.toggle('hidden', !tags.length);
                document.getElementById('detail-entry-tags').innerHTML = tags.map(t => `<span class="px-2.5 py-1 rounded-lg bg-diary-100 text-xs text-diary-700">#${this.escapeHtml(t)}</span>`).join('');
                const media = document.getElementById('detail-entry-media');
                const photos = entry.photos || [];
                const sketches = entry.sketches || [];
                media.innerHTML = [...photos, ...sketches].map(src => `<img src="${src}" class="w-full aspect-square object-cover rounded-2xl border border-diary-200 cursor-pointer" onclick="app.openMediaLightbox('${src}')">`).join('');
                const audioList = Array.isArray(entry.audio) ? entry.audio : (entry.audio ? [entry.audio] : []);
                audioList.forEach((audio, idx) => { media.innerHTML += `<div class="col-span-full flex items-center gap-2 p-3 rounded-2xl bg-diary-50 border border-diary-200"><i class="fa-solid fa-microphone text-rose-500"></i><span class="text-xs font-semibold">Voice ${idx + 1}</span><audio controls src="${audio}" class="flex-1 min-w-0"></audio></div>`; });
                document.getElementById('detail-entry-edit-btn').onclick = () => { this.closeEntryDetail(); this.openEditor(entry.id); };
                const modal = document.getElementById('entry-detail-modal');
                modal.classList.remove('hidden'); modal.classList.add('flex');
            }

            closeEntryDetail() {
                const modal = document.getElementById('entry-detail-modal');
                modal.classList.add('hidden'); modal.classList.remove('flex');
            }

            closeCalendarDateModal() {
                const modal = document.getElementById('calendar-date-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }

            addEntryForCalendarDate() {
                const date = this.selectedCalendarDate;
                this.closeCalendarDateModal();
                if (date) this.openEditor(null, date);
            }

            changeMonth(dir) {
                this.calendarDate.setMonth(this.calendarDate.getMonth() + dir);
                this.renderCalendar();
            }

            // --- Analytics Dashboard ---
            updateAnalytics() {
                const journalEntries = this.entries;
                document.getElementById('stat-total-entries').innerText = journalEntries.length;

                let totalWords = journalEntries.reduce((acc, curr) => {
                    const plain = this.contentToPlainText(curr.content || '').trim();
                    return acc + (plain ? plain.split(/\s+/).length : 0);
                }, 0);
                document.getElementById('stat-words').innerText = totalWords;

                // Streak calculation
                let streak = 0;
                let today = new Date();
                for (let i = 0; i < 365; i++) {
                    const dStr = today.toISOString().split('T')[0];
                    if (journalEntries.some(e => e.date === dStr)) {
                        streak++;
                        today.setDate(today.getDate() - 1);
                    } else if (i === 0) {
                        today.setDate(today.getDate() - 1);
                        continue;
                    } else {
                        break;
                    }
                }
                document.getElementById('stat-streak').innerText = `${streak} days`;

                // On This Day
                const todayMD = new Date().toISOString().slice(5, 10);
                const pastEntry = this.entries.find(e => e.date && e.date.slice(5, 10) === todayMD && e.date.slice(0, 4) !== new Date().toISOString().slice(0, 4));
                const otdContainer = document.getElementById('on-this-day-content');
                if (pastEntry) {
                    otdContainer.innerHTML = `<h4 class="font-serif font-bold text-diary-900 mb-1">${this.escapeHtml(pastEntry.title || 'Untitled')} (${this.escapeHtml(pastEntry.date || '')})</h4><div class="rich-entry-content">${this.renderRichContent(pastEntry.content)}</div>`;
                } else {
                    otdContainer.innerText = 'No past entries found for this calendar date in previous years.';
                }
            }

            // --- Media Gallery ---
            renderGallery(type) {
                this.activeGalleryFilter = type;
                const grid = document.getElementById('gallery-grid');
                grid.innerHTML = '';

                let items = [];
                this.entries.forEach(e => {
                    if (e.photos && (type === 'all' || type === 'photo')) {
                        e.photos.forEach(p => items.push({ type: 'photo', src: p, date: e.date }));
                    }
                    if (e.sketches && (type === 'all' || type === 'sketch')) {
                        e.sketches.forEach(s => items.push({ type: 'sketch', src: s, date: e.date }));
                    }
                });

                if (items.length === 0) {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-diary-500 text-xs">No media files found in this journal.</div>`;
                    return;
                }

                items.forEach(item => {
                    grid.innerHTML += `<button type="button" onclick="app.openMediaLightbox('${item.src.replace(/'/g, "\\'")}')" class="bg-white rounded-2xl overflow-hidden aspect-square border border-diary-200 shadow-sm active:scale-[0.98] transition-transform"><img src="${item.src}" class="w-full h-full object-cover" loading="lazy"></button>`;
                });
            }

            openMediaLightbox(src) {
                document.getElementById('media-lightbox-image').src = src;
                document.getElementById('media-lightbox').classList.remove('hidden');
                document.getElementById('media-lightbox').classList.add('flex');
            }

            closeMediaLightbox() {
                const box = document.getElementById('media-lightbox');
                box.classList.add('hidden');
                box.classList.remove('flex');
                document.getElementById('media-lightbox-image').src = '';
            }

            filterGallery(type) {
                document.querySelectorAll('.gallery-filter').forEach(b => {
                    b.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-diary-100 text-diary-800 gallery-filter";
                });
                event.target.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-diary-800 text-white gallery-filter";
                this.renderGallery(type);
            }

            // --- Data Backup & Restore ---
            exportData() {
                try {
                    // Keep device passcodes out of the portable backup.
                    const safeSettings = { ...this.settings, pin: null };
                    const dataBackup = {
                        app: "Chronicle",
                        version: "3.0",
                        exportDate: new Date().toISOString(),
                        entries: this._realEntries,
                        decoyEntries: this._decoyEntries,
                        settings: safeSettings,
                        backupNotes: "Diary entries and embedded media are included. Device security PINs are not included."
                    };
                    const blob = new Blob([JSON.stringify(dataBackup, null, 2)], { type: "application/json;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.href = url;
                    downloadAnchor.download = `chronicle_diary_backup_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    this.showModal("Backup Created", "Your backup file includes diary entries and their embedded photos, sketches, and voice recordings. Keep this file private. Your device security PIN is not included.");
                } catch (err) {
                    console.error("Backup export failed:", err);
                    this.showModal("Export Failed", "Chronicle couldn't create the backup. Your entries have not been changed. If your diary contains lots of media, check available device storage and try again.");
                }
            }

            getImportFingerprint(entry) {
                // Compare all meaningful entry context while ignoring the storage ID and
                // last-edited timestamp. Keep createdAt so separately created memories remain distinct.
                const normalized = { ...entry };
                delete normalized.id;
                delete normalized.updatedAt;
                const stableStringify = (value) => {
                    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
                    if (value && typeof value === 'object') {
                        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
                    }
                    return JSON.stringify(value);
                };
                return stableStringify(normalized);
            }

            createImportedEntryId(usedIds) {
                let id;
                do {
                    id = 'entry_import_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
                } while (usedIds.has(id));
                return id;
            }

            importData(event) {
                const input = event.target;
                const file = input.files && input.files[0];
                if (!file) return;

                // Reset the picker so the same file can be selected again after an error.
                const reader = new FileReader();
                reader.onerror = () => {
                    this.showModal("Import Failed", "Chronicle couldn't read that file. Please try again.");
                    input.value = "";
                };
                reader.onload = (e) => {
                    let parsed;
                    try {
                        parsed = JSON.parse(e.target.result);
                    } catch (err) {
                        this.showModal("Invalid Backup", "This file isn't valid JSON. Choose a Chronicle JSON backup.");
                        input.value = "";
                        return;
                    }

                    const isChronicleBackup = parsed &&
                        typeof parsed === "object" &&
                        Array.isArray(parsed.entries) &&
                        (!("decoyEntries" in parsed) || Array.isArray(parsed.decoyEntries)) &&
                        (!parsed.app || parsed.app === "Chronicle");

                    if (!isChronicleBackup) {
                        this.showModal("Invalid Backup", "The file doesn't have the expected Chronicle backup structure. Nothing has been changed.");
                        input.value = "";
                        return;
                    }

                    const incomingEntries = parsed.entries;
                    const incomingDecoyEntries = Array.isArray(parsed.decoyEntries) ? parsed.decoyEntries : [];
                    const validEntries = (list) => list.every(entry =>
                        entry && typeof entry === "object" && !Array.isArray(entry)
                    );
                    if (!validEntries(incomingEntries) || !validEntries(incomingDecoyEntries)) {
                        this.showModal("Invalid Backup", "Some diary entries in this file have an invalid format. Nothing has been changed.");
                        input.value = "";
                        return;
                    }

                    const mediaCount = (list) => list.reduce((count, entry) => {
                        const values = Object.values(entry);
                        return count + values.filter(value =>
                            typeof value === "string" && /^(data:image\/|data:audio\/|data:video\/)/i.test(value)
                        ).length;
                    }, 0);
                    const entryCount = incomingEntries.length + incomingDecoyEntries.length;
                    const mediaItems = mediaCount(incomingEntries) + mediaCount(incomingDecoyEntries);

                    this.showModal(
                        "Merge This Backup?",
                        `This backup contains ${entryCount} total entries and approximately ${mediaItems} embedded media item(s). Chronicle will KEEP your current entries and add entries from the backup that aren't already present. Exact duplicates will be skipped. If an entry has the same ID but different content or context, it will be added as a separate entry with a new ID. Your current device security PIN will be preserved.`,
                        () => {
                            try {
                                // Merge separately into the real and decoy journals. This is idempotent:
                                // importing the same backup again won't add the same entries repeatedly.
                                const mergeEntries = (existingList, incomingList) => {
                                    const merged = [...existingList];
                                    const usedIds = new Set(merged.map(entry => entry && entry.id).filter(Boolean));
                                    const fingerprints = new Set(merged.map(entry => this.getImportFingerprint(entry)));
                                    let added = 0;
                                    let skipped = 0;
                                    let conflicts = 0;

                                    incomingList.forEach(sourceEntry => {
                                        const fingerprint = this.getImportFingerprint(sourceEntry);
                                        if (fingerprints.has(fingerprint)) {
                                            skipped++;
                                            return;
                                        }

                                        const entry = { ...sourceEntry };
                                        if (entry.id && usedIds.has(entry.id)) {
                                            // Same ID, different entry context: preserve both by assigning a new ID.
                                            entry.id = this.createImportedEntryId(usedIds);
                                            conflicts++;
                                        } else if (!entry.id) {
                                            entry.id = this.createImportedEntryId(usedIds);
                                        }

                                        merged.push(entry);
                                        if (entry.id) usedIds.add(entry.id);
                                        fingerprints.add(fingerprint);
                                        added++;
                                    });

                                    return { entries: merged, added, skipped, conflicts };
                                };

                                const realResult = mergeEntries(this._realEntries, incomingEntries);
                                const decoyResult = mergeEntries(this._decoyEntries, incomingDecoyEntries);
                                this._realEntries = realResult.entries;
                                this._decoyEntries = decoyResult.entries;

                                // Import preferences, but never overwrite this device's security PIN.
                                if (parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings)) {
                                    const currentPin = this.settings.pin;
                                    this.settings = { ...this.settings, ...parsed.settings, pin: currentPin };
                                }
                                this.saveToStorage();
                                this.renderEntries();
                                this.updateSettingsUI();
                                this.renderCalendar();
                                this.renderGallery('all');

                                const addedTotal = realResult.added + decoyResult.added;
                                const skippedTotal = realResult.skipped + decoyResult.skipped;
                                const conflictTotal = realResult.conflicts + decoyResult.conflicts;
                                this.showModal(
                                    "Import Complete — Entries Merged",
                                    `Added ${addedTotal} new entr${addedTotal === 1 ? 'y' : 'ies'}. Skipped ${skippedTotal} exact duplicate${skippedTotal === 1 ? '' : 's'}. ${conflictTotal} entry conflict${conflictTotal === 1 ? ' was' : 's were'} kept as separate entr${conflictTotal === 1 ? 'y' : 'ies'} with new IDs. Your existing entries and device PIN were preserved.`
                                );
                            } catch (err) {
                                console.error("Backup import/merge failed:", err);
                                this.showModal("Import Failed", "Chronicle couldn't merge this backup into browser storage. Your original backup file remains unchanged. If storage is full, export a backup and free some device storage before trying again.");
                            } finally {
                                input.value = "";
                            }
                        },
                        true
                    );
                };
                reader.readAsText(file, "UTF-8");
            }

            confirmClearAll() {
                this.showModal("Danger: Clear All", "Are you completely sure? This will delete all entries from your browser storage. Make sure you exported a backup first!", () => {
                    this.entries = [];
                    this.settings.pin = null;
                    this.saveToStorage();
                    this.renderEntries();
                    this.updateSettingsUI();
                    this.showModal("Cleared", "All journal entries have been wiped.");
                }, true);
            }

            showModal(title, message, confirmCallback = null, showCancel = false) {
                document.getElementById('modal-title').innerText = title;
                document.getElementById('modal-message').innerText = message;
                const confirmBtn = document.getElementById('modal-confirm-btn');
                const cancelBtn = document.getElementById('modal-cancel-btn');

                if (showCancel) {
                    cancelBtn.classList.remove('hidden');
                } else {
                    cancelBtn.classList.add('hidden');
                }

                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

                newConfirmBtn.onclick = () => {
                    this.closeModal();
                    if (confirmCallback) confirmCallback();
                };

                document.getElementById('custom-modal').classList.remove('hidden');
            }

            closeModal() {
                document.getElementById('custom-modal').classList.add('hidden');
            }

            escapeHtml(text) {
                if (!text) return '';
                return text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
        }

        let app;
        window.onload = () => {
            app = new DiaryApp();
        };
