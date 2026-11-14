/**
 * Voice4All — Career Development Module Application (`assets/js/voice4all/career/career-app.js`)
 * 
 * WCAG 2.1 AA Compliant Client Controller:
 * - Semantic tab management with ARIA arrow-key keyboard navigation
 * - Opportunities Hub with debounced search, filtering, and detail modal
 * - Grounded Career Guidance Assistant
 * - Learning & Development resources catalog with progress tracking
 * - Step-by-step Interview Accommodation Drafter with copyable templates
 * - Low-bandwidth Telegram & SMS notification controls
 * - High Contrast & Large Text accessibility tools
 */

(function () {
  'use strict';

  // State Management
  const state = {
    lang: 'en',
    activeTab: 'jobs',
    jobs: [],
    resources: [],
    savedJobIds: new Set(),
    completedResourceIds: new Set(),
    selectedJobForDraft: null,
    currentFilters: {
      q: '',
      type: 'all',
      accessible_only: false
    },
    resourceFilters: {
      category: 'all',
      q: ''
    }
  };

  // Translation Dictionaries (English / Amharic)
  const i18n = {
    en: {
      hero_title: 'Career & Professional Development',
      hero_subtitle: 'Explore inclusive virtual assistant opportunities, develop in-demand digital accessibility skills, and draft professional interview accommodations.',
      tab_jobs: 'Opportunities Hub',
      tab_guidance: 'Career Advisor & Q&A',
      tab_resources: 'Learning & Skills Pathways',
      tab_drafter: 'Interview Accommodation Drafter',
      tab_notifications: 'Job Alerts & SMS',
      tab_saved: 'My Portfolio',
      search_placeholder: 'Search roles, skills, or accommodations...',
      all_types: 'All Work Types',
      remote_only: '100% Remote',
      fulltime: 'Full-Time',
      parttime: 'Part-Time',
      accessible_only_label: 'Verified Accessible Workplaces Only',
      honesty_notice_title: 'Simulated Demonstration Opportunities',
      honesty_notice_text: 'All sample job listings and accommodation drafts are simulated for learning and self-advocacy practice. Requests are NOT transmitted to employers.',
      view_details: 'View Details & Accommodations',
      draft_accommodations: 'Draft Accommodations',
      save_job: 'Save Role',
      saved_job: 'Saved',
      no_jobs_found: 'No opportunities found matching your filters.',
      reset_filters: 'Reset Filters',
      ask_advisor_placeholder: 'Ask about roles, accommodations, or VA skills...',
      ask_btn: 'Ask Advisor',
      asking_advisor: 'Consulting career dataset...',
      modules_completed: 'modules completed',
      open_guide: 'Open Study Guide',
      mark_completed: 'Mark Completed',
      completed: 'Completed',
      copy_letter: 'Copy Letter to Clipboard',
      copied_success: 'Copied to clipboard!',
      print_pdf: 'Print / Save PDF'
    },
    am: {
      hero_title: 'የሙያ እና የክህሎት ማበልጸጊያ መድረክ',
      hero_subtitle: 'አካታች የቨርቹዋል ረዳት የሥራ ዕድሎችን ያስሱ፣ ተፈላጊ የዲጂታል ተደራሽነት ክህሎቶችን ያዳብሩ፣ እና የሥራ ቃለ-መጠይቅ ማመቻቸቶችን ያዘጋጁ።',
      tab_jobs: 'የሥራ ዕድሎች ማዕከል',
      tab_guidance: 'የሙያ አማካሪ እና ጥያቄዎች',
      tab_resources: 'የመማሪያ እና የክህሎት መንገዶች',
      tab_drafter: 'የቃለ-መጠይቅ ማመቻቸት አዘጋጅ',
      tab_notifications: 'የሥራ ማሳወቂያዎች እና ኤስኤምኤስ',
      tab_saved: 'የእኔ ፖርትፎሊዮ',
      search_placeholder: 'የሥራ መደቦችን፣ ክህሎቶችን ወይም ማመቻቸቶችን ይፈልጉ...',
      all_types: 'ሁሉም የሥራ ዓይነቶች',
      remote_only: '100% የርቀት ሥራ',
      fulltime: 'ሙሉ ጊዜ',
      parttime: 'የትርፍ ሰዓት',
      accessible_only_label: 'የተረጋገጡ ተደራሽ የሥራ ቦታዎች ብቻ',
      honesty_notice_title: 'የናሙና ማሳያ የሥራ ዕድሎች',
      honesty_notice_text: 'ሁሉም የሥራ ዝርዝሮች እና የማመቻቸት ረቂቆች ለስልጠና እና ራስን ለመግለጽ የተዘጋጁ ናቸው። ጥያቄዎች ለአሰሪዎች አልተላኩም።',
      view_details: 'ዝርዝር እና ማመቻቸቶችን ይመልከቱ',
      draft_accommodations: 'ማመቻቸት አዘጋጅ',
      save_job: 'ሥራውን አስቀምጥ',
      saved_job: 'ተቀምጧል',
      no_jobs_found: 'ከተመረጡት ማጣሪያዎች ጋር የሚስማማ የሥራ ዕድል አልተገኘም።',
      reset_filters: 'ማጣሪያዎችን ዳግም አስጀምር',
      ask_advisor_placeholder: 'ስለ ሥራዎች፣ ማመቻቸቶች ወይም ቪኤ ክህሎቶች ይጠይቁ...',
      ask_btn: 'አማካሪውን ጠይቅ',
      asking_advisor: 'መረጃ እየተፈለገ ነው...',
      modules_completed: 'ክፍሎች ተጠናቀዋል',
      open_guide: 'የጥናት መመሪያውን ክፈት',
      mark_completed: 'እንደተጠናቀቀ ምልክት አድርግ',
      completed: 'ተጠናቋል',
      copy_letter: 'ደብዳቤውን ቅዳ',
      copied_success: 'ተቀድቷል!',
      print_pdf: 'አትም / ፒዲኤፍ አስቀምጥ'
    }
  };

  function t(key) {
    const dict = i18n[state.lang] || i18n.en;
    return dict[key] || i18n.en[key] || key;
  }

  // Live Screen Reader Announcer
  function announce(message) {
    const announcer = document.getElementById('career-live-announcer');
    if (announcer) {
      announcer.textContent = '';
      setTimeout(() => {
        announcer.textContent = message;
      }, 50);
    }
  }

  // Load Saved State from localStorage
  function loadPersistedState() {
    try {
      const savedJobs = localStorage.getItem('v4a_career_saved_jobs');
      if (savedJobs) state.savedJobIds = new Set(JSON.parse(savedJobs));

      const completed = localStorage.getItem('v4a_career_completed_resources');
      if (completed) state.completedResourceIds = new Set(JSON.parse(completed));

      const savedLang = localStorage.getItem('v4a_career_lang');
      if (savedLang) state.lang = savedLang;

      const hc = localStorage.getItem('v4a_career_high_contrast');
      if (hc === 'true') {
        document.body.classList.add('high-contrast');
        const hcBtn = document.getElementById('btn-toggle-hc');
        if (hcBtn) hcBtn.setAttribute('aria-pressed', 'true');
      }

      const lt = localStorage.getItem('v4a_career_large_text');
      if (lt === 'true') {
        document.body.classList.add('large-text');
        const ltBtn = document.getElementById('btn-toggle-lt');
        if (ltBtn) ltBtn.setAttribute('aria-pressed', 'true');
      }
    } catch (e) {
      console.warn('Storage unavailable:', e);
    }
  }

  function persistSavedJobs() {
    try {
      localStorage.setItem('v4a_career_saved_jobs', JSON.stringify([...state.savedJobIds]));
    } catch (e) {}
  }

  function persistCompletedResources() {
    try {
      localStorage.setItem('v4a_career_completed_resources', JSON.stringify([...state.completedResourceIds]));
    } catch (e) {}
  }

  // =========================================================================
  // Tab Navigation with Arrow Keys
  // =========================================================================
  function initTabs() {
    const tabBtns = [...document.querySelectorAll('[role="tab"]')];
    tabBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));

      btn.addEventListener('keydown', (e) => {
        let targetIdx = null;
        if (e.key === 'ArrowRight') targetIdx = (idx + 1) % tabBtns.length;
        else if (e.key === 'ArrowLeft') targetIdx = (idx - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === 'Home') targetIdx = 0;
        else if (e.key === 'End') targetIdx = tabBtns.length - 1;

        if (targetIdx !== null) {
          e.preventDefault();
          tabBtns[targetIdx].focus();
          tabBtns[targetIdx].click();
        }
      });
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('[role="tab"]').forEach((btn) => {
      const isSelected = btn.dataset.tab === tabId;
      btn.setAttribute('aria-selected', String(isSelected));
      btn.tabIndex = isSelected ? 0 : -1;
    });

    document.querySelectorAll('.career-tab-panel').forEach((panel) => {
      const isActive = panel.id === `panel-${tabId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });

    announce(`Switched to ${tabId} tab`);

    if (tabId === 'saved') renderSavedPortfolio();
  }

  // =========================================================================
  // Opportunities Hub (Jobs)
  // =========================================================================
  async function loadJobs() {
    const container = document.getElementById('jobs-grid-container');
    if (!container) return;

    container.innerHTML = `
      <div class="career-card" style="grid-column: 1/-1;">
        <div class="career-loading-shimmer" style="width: 40%;"></div>
        <div class="career-loading-shimmer" style="width: 80%;"></div>
        <div class="career-loading-shimmer" style="width: 60%;"></div>
      </div>
    `;

    try {
      const client = window.Voice4AllCareerClient;
      if (!client) throw new Error('Voice4AllCareerClient is not loaded.');

      const res = await client.searchJobs({
        q: state.currentFilters.q,
        type: state.currentFilters.type,
        accessible_only: state.currentFilters.accessible_only,
        lang: state.lang
      });

      state.jobs = res.jobs || [];
      renderJobsList();
      populateJobSelectorForDraft();
      announce(`Loaded ${state.jobs.length} career opportunities.`);
    } catch (err) {
      container.innerHTML = `
        <div class="career-empty-state" style="grid-column: 1/-1;">
          <i class="fa-solid fa-triangle-exclamation career-empty-icon" style="color: #dc2626;"></i>
          <h3>Failed to load opportunities</h3>
          <p style="color: #64748b;">${err.message || 'Please check your connection.'}</p>
          <button type="button" class="btn-career btn-career-primary" id="btn-retry-jobs">Retry</button>
        </div>
      `;
      document.getElementById('btn-retry-jobs')?.addEventListener('click', loadJobs);
    }
  }

  function renderJobsList() {
    const container = document.getElementById('jobs-grid-container');
    if (!container) return;

    if (state.jobs.length === 0) {
      container.innerHTML = `
        <div class="career-empty-state" style="grid-column: 1/-1;">
          <i class="fa-solid fa-folder-open career-empty-icon"></i>
          <h3>${t('no_jobs_found')}</h3>
          <p style="color: #64748b;">Try adjusting your keyword search or filter settings.</p>
          <button type="button" class="btn-career btn-career-outline" id="btn-reset-filters">${t('reset_filters')}</button>
        </div>
      `;
      document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
      return;
    }

    container.innerHTML = state.jobs.map((job) => {
      const isSaved = state.savedJobIds.has(job.id);
      let typeBadgeClass = 'career-badge-remote';
      if (job.type === 'fulltime') typeBadgeClass = 'career-badge-fulltime';
      else if (job.type === 'parttime') typeBadgeClass = 'career-badge-parttime';

      return `
        <article class="career-card" id="card-${job.id}" aria-labelledby="title-${job.id}">
          <div class="career-card-header">
            <div class="career-card-type-row">
              <span class="career-badge ${typeBadgeClass}">${job.type_label}</span>
              <span class="career-badge career-badge-simulated">Sample Opportunity</span>
            </div>
            <h3 class="career-card-title" id="title-${job.id}">${job.title}</h3>
            <div class="career-card-org">
              <i class="fa-solid fa-building" aria-hidden="true"></i>
              <span>${job.company}</span>
              <span>•</span>
              <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              <span>${job.location}</span>
            </div>
          </div>

          <p class="career-card-desc">${job.description}</p>

          <div class="career-tags-wrap" aria-label="Role highlights">
            ${(job.tags || []).map(tag => `<span class="career-tag-pill">${tag}</span>`).join('')}
          </div>

          <div class="career-card-footer">
            <button type="button" class="btn-career btn-career-primary btn-view-job" data-id="${job.id}">
              <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
              <span>${t('view_details')}</span>
            </button>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn-career btn-career-outline btn-draft-for-job" data-id="${job.id}" title="${t('draft_accommodations')}">
                <i class="fa-solid fa-file-pen" aria-hidden="true"></i>
                <span class="career-sr-only">${t('draft_accommodations')} for ${job.title}</span>
              </button>
              <button type="button" class="btn-career btn-career-outline btn-save-job" data-id="${job.id}" aria-pressed="${isSaved}" title="${isSaved ? t('saved_job') : t('save_job')}">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark" style="${isSaved ? 'color: #2563eb;' : ''}" aria-hidden="true"></i>
                <span class="career-sr-only">${isSaved ? t('saved_job') : t('save_job')} ${job.title}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-view-job').forEach((btn) => {
      btn.addEventListener('click', () => openJobModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-draft-for-job').forEach((btn) => {
      btn.addEventListener('click', () => {
        const jobId = btn.dataset.id;
        openDrafterForJob(jobId);
      });
    });

    container.querySelectorAll('.btn-save-job').forEach((btn) => {
      btn.addEventListener('click', () => toggleSaveJob(btn.dataset.id));
    });
  }

  function resetFilters() {
    state.currentFilters = { q: '', type: 'all', accessible_only: false };
    const searchInput = document.getElementById('job-search-input');
    const typeSelect = document.getElementById('job-type-select');
    const a11yCheck = document.getElementById('job-a11y-check');
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = 'all';
    if (a11yCheck) a11yCheck.checked = false;
    loadJobs();
  }

  function toggleSaveJob(jobId) {
    if (state.savedJobIds.has(jobId)) {
      state.savedJobIds.delete(jobId);
      announce('Opportunity removed from saved portfolio.');
    } else {
      state.savedJobIds.add(jobId);
      announce('Opportunity saved to your career portfolio.');
    }
    persistSavedJobs();
    renderJobsList();
  }

  // Job Modal
  function openJobModal(jobId) {
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    const modal = document.getElementById('job-modal');
    const titleEl = document.getElementById('job-modal-title');
    const bodyEl = document.getElementById('job-modal-body');
    const draftBtn = document.getElementById('btn-modal-draft');

    titleEl.textContent = job.title;
    bodyEl.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
          ${job.company} — ${job.location} (${job.type_label})
        </div>
        <p style="color: #334155; line-height: 1.6;">${job.description}</p>
      </div>

      <div class="career-honesty-banner">
        <i class="fa-solid fa-shield-halved" style="font-size: 18px; margin-top: 2px;" aria-hidden="true"></i>
        <div>
          <strong>Verified Inclusive Workplace Accommodations</strong>
          ${job.accessibilityOrAccommodation}
        </div>
      </div>

      <h4 style="font-size: 15px; font-weight: 700; margin: 18px 0 10px 0;">Interview Accommodations Supported by this Employer:</h4>
      <ul style="padding-left: 20px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        ${(job.interviewAccommodationsOffered || []).map(acc => `<li>${acc}</li>`).join('')}
      </ul>

      <p style="font-size: 12px; color: #64748b; font-style: italic;">
        ${job.sampleOpportunityNotice || 'Simulated demonstration opportunity.'}
      </p>
    `;

    draftBtn.onclick = () => {
      closeJobModal();
      openDrafterForJob(job.id);
    };

    modal.classList.add('open');
    modal.removeAttribute('hidden');
    document.getElementById('job-modal-close').focus();
    trapFocus(modal);
  }

  function closeJobModal() {
    const modal = document.getElementById('job-modal');
    modal.classList.remove('open');
    modal.setAttribute('hidden', 'true');
  }

  // =========================================================================
  // Career Guidance Advisor (Q&A)
  // =========================================================================
  function initGuidanceAdvisor() {
    const askForm = document.getElementById('advisor-ask-form');
    const input = document.getElementById('advisor-question-input');
    const answerContainer = document.getElementById('advisor-answer-container');

    // Prompt pills
    document.querySelectorAll('.btn-prompt-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        input.value = btn.textContent.trim();
        submitQuestion();
      });
    });

    if (askForm) {
      askForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitQuestion();
      });
    }

    async function submitQuestion() {
      const q = input.value.trim();
      if (!q) return;

      const submitBtn = document.getElementById('btn-ask-advisor');
      submitBtn.disabled = true;
      submitBtn.textContent = t('asking_advisor');
      answerContainer.innerHTML = `
        <div class="career-answer-card">
          <div class="career-loading-shimmer" style="width: 50%;"></div>
          <div class="career-loading-shimmer" style="width: 90%;"></div>
          <div class="career-loading-shimmer" style="width: 70%;"></div>
        </div>
      `;

      try {
        const client = window.Voice4AllCareerClient;
        const res = await client.askCareerQuestion(q, state.lang);

        answerContainer.innerHTML = `
          <div class="career-answer-card" role="region" aria-live="polite">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-weight: 700; color: #1e3a8a;">
                <i class="fa-solid fa-robot" aria-hidden="true"></i> Career Advisor Response
              </span>
              <span class="career-badge career-badge-accessible">${res.matchedJobsCount} Matched Opportunities</span>
            </div>
            <div style="white-space: pre-line; line-height: 1.6; color: #1e293b;">${res.answer}</div>

            ${(res.suggestions && res.suggestions.length) ? `
              <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                <span style="font-size: 13px; font-weight: 600; color: #64748b;">Suggested follow-up questions:</span>
                <div class="career-prompt-pills" style="margin-top: 8px;">
                  ${res.suggestions.map(s => `<button type="button" class="btn-prompt-pill follow-up-pill">${s}</button>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;

        answerContainer.querySelectorAll('.follow-up-pill').forEach((pill) => {
          pill.addEventListener('click', () => {
            input.value = pill.textContent.trim();
            submitQuestion();
          });
        });

        announce('Career advisor answered your question.');
      } catch (err) {
        answerContainer.innerHTML = `
          <div class="career-answer-card" style="border-color: #fca5a5; background: #fff5f5;">
            <p style="color: #b91c1c; margin: 0;">Error: ${err.message || 'Unable to answer right now.'}</p>
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = t('ask_btn');
      }
    }
  }

  // =========================================================================
  // Learning & Development Resources
  // =========================================================================
  async function loadResources() {
    const container = document.getElementById('resources-grid-container');
    if (!container) return;

    try {
      const client = window.Voice4AllCareerClient;
      const res = await client.getResources({
        category: state.resourceFilters.category,
        q: state.resourceFilters.q,
        lang: state.lang
      });

      state.resources = res.resources || [];
      renderResourcesList();
      updateLearningProgress();
    } catch (err) {
      console.error('Failed to load learning resources:', err);
    }
  }

  function renderResourcesList() {
    const container = document.getElementById('resources-grid-container');
    if (!container) return;

    if (state.resources.length === 0) {
      container.innerHTML = `
        <div class="career-empty-state" style="grid-column: 1/-1;">
          <i class="fa-solid fa-graduation-cap career-empty-icon"></i>
          <h3>No learning resources found</h3>
          <p style="color: #64748b;">Try selecting another category or resetting the search filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.resources.map((res) => {
      const isCompleted = state.completedResourceIds.has(res.id);

      return `
        <article class="career-card" id="res-card-${res.id}">
          <div class="career-card-header">
            <div class="career-card-type-row">
              <span class="career-badge career-badge-accessible">${res.category_label}</span>
              <span class="career-badge" style="background: #f1f5f9; color: #334155;">
                <i class="fa-regular fa-clock" aria-hidden="true"></i> ${res.duration}
              </span>
            </div>
            <h3 class="career-card-title">${res.title}</h3>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
              Difficulty: <strong>${res.difficulty}</strong>
            </div>
          </div>

          <p class="career-card-desc">${res.summary}</p>

          <div class="career-tags-wrap">
            ${(res.tags || []).map(t => `<span class="career-tag-pill">${t}</span>`).join('')}
          </div>

          <div class="career-card-footer">
            <button type="button" class="btn-career btn-career-primary btn-open-resource" data-id="${res.id}">
              <i class="fa-solid fa-book-open" aria-hidden="true"></i>
              <span>${t('open_guide')}</span>
            </button>
            <label class="career-checkbox-label">
              <input type="checkbox" class="resource-complete-check" data-id="${res.id}" ${isCompleted ? 'checked' : ''}>
              <span>${isCompleted ? t('completed') : t('mark_completed')}</span>
            </label>
          </div>
        </article>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-open-resource').forEach((btn) => {
      btn.addEventListener('click', () => openResourceModal(btn.dataset.id));
    });

    container.querySelectorAll('.resource-complete-check').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) state.completedResourceIds.add(id);
        else state.completedResourceIds.delete(id);

        persistCompletedResources();
        updateLearningProgress();
        renderResourcesList();
        announce(`Module completion updated.`);
      });
    });
  }

  function updateLearningProgress() {
    const total = state.resources.length || 8;
    const completed = state.completedResourceIds.size;
    const pct = Math.min(100, Math.round((completed / total) * 100));

    const bar = document.getElementById('learning-progress-bar');
    const label = document.getElementById('learning-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${completed} of ${total} ${t('modules_completed')} (${pct}%)`;
  }

  function openResourceModal(resourceId) {
    const res = state.resources.find(r => r.id === resourceId);
    if (!res) return;

    const modal = document.getElementById('resource-modal');
    const titleEl = document.getElementById('resource-modal-title');
    const bodyEl = document.getElementById('resource-modal-body');

    titleEl.textContent = res.title;
    bodyEl.innerHTML = `
      <div style="font-size: 14px; color: #64748b; margin-bottom: 16px;">
        Category: <strong>${res.category_label}</strong> | Est. Time: <strong>${res.duration}</strong> | Level: <strong>${res.difficulty}</strong>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #1e3a8a;">
          <i class="fa-solid fa-key" aria-hidden="true"></i> Core Takeaways:
        </h4>
        <ul style="padding-left: 20px; line-height: 1.6; margin: 0; color: #1e293b;">
          ${(res.key_takeaways || []).map(k => `<li>${k}</li>`).join('')}
        </ul>
      </div>

      <h4 style="font-size: 15px; margin-bottom: 8px;">Practical Action Steps:</h4>
      <ol style="padding-left: 20px; line-height: 1.6; margin-bottom: 20px; color: #334155;">
        ${(res.action_steps || []).map(a => `<li>${a}</li>`).join('')}
      </ol>

      <div style="white-space: pre-line; line-height: 1.6; color: #1e293b; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        ${res.guide_content || ''}
      </div>
    `;

    modal.classList.add('open');
    modal.removeAttribute('hidden');
    document.getElementById('resource-modal-close').focus();
    trapFocus(modal);
  }

  function closeResourceModal() {
    const modal = document.getElementById('resource-modal');
    modal.classList.remove('open');
    modal.setAttribute('hidden', 'true');
  }

  // =========================================================================
  // Interview Accommodation Drafter
  // =========================================================================
  function populateJobSelectorForDraft() {
    const select = document.getElementById('drafter-job-select');
    if (!select) return;

    select.innerHTML = `
      <option value="">-- Choose a target role --</option>
      ${state.jobs.map(j => `<option value="${j.id}">${j.title} (${j.company})</option>`).join('')}
      <option value="custom">Other / Custom Remote Opportunity</option>
    `;

    select.onchange = () => {
      const selectedId = select.value;
      if (selectedId && selectedId !== 'custom') {
        const job = state.jobs.find(j => j.id === selectedId);
        updateDrafterChecklistForJob(job);
      } else {
        updateDrafterChecklistForJob(null);
      }
    };
  }

  function updateDrafterChecklistForJob(job) {
    const container = document.getElementById('drafter-checklist-container');
    if (!container) return;

    const standardAccommodations = [
      'Advance interview questions provided in writing (24 to 48 hours prior)',
      'Live human captions and real-time transcript during video calls',
      'Camera-optional interview format (audio-only or text-first)',
      'Extended response time for assessments and live coding/administrative tests (1.5x)',
      'Verification of screen reader compatibility on interview testing platform',
      'Text-chat interview option (instead of video/phone call)',
      'Sign language interpreter or remote CART captioner presence'
    ];

    const offered = job?.interviewAccommodationsOffered || [];
    const allOptions = [...new Set([...offered, ...standardAccommodations])];

    container.innerHTML = allOptions.map((acc, idx) => {
      const isOfferedByEmployer = offered.includes(acc);
      return `
        <label class="drafter-checkbox-item">
          <input type="checkbox" name="accommodation_item" value="${acc}" ${isOfferedByEmployer ? 'checked' : ''}>
          <div>
            <strong>${acc}</strong>
            ${isOfferedByEmployer ? `<span class="career-badge career-badge-accessible" style="margin-left: 6px;">Pre-approved by Employer</span>` : ''}
          </div>
        </label>
      `;
    }).join('');
  }

  function openDrafterForJob(jobId) {
    switchTab('drafter');
    const select = document.getElementById('drafter-job-select');
    if (select) {
      select.value = jobId;
      const job = state.jobs.find(j => j.id === jobId);
      updateDrafterChecklistForJob(job);
    }
  }

  function initDrafterForm() {
    const form = document.getElementById('drafter-form');
    const outputContainer = document.getElementById('drafter-output-container');
    const previewEl = document.getElementById('draft-letter-preview');

    updateDrafterChecklistForJob(null);

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const select = document.getElementById('drafter-job-select');
        const jobId = select.value || 'v4a-job-001';
        const job = state.jobs.find(j => j.id === jobId) || {
          id: 'v4a-custom',
          title: 'Virtual Assistant',
          company: 'Prospective Employer'
        };

        const selectedAccommodations = [...document.querySelectorAll('input[name="accommodation_item"]:checked')].map(c => c.value);
        if (selectedAccommodations.length === 0) {
          alert('Please select at least one accommodation to prepare your draft.');
          return;
        }

        const details = document.getElementById('drafter-details-input').value.trim();
        const email = document.getElementById('drafter-email-input').value.trim() || 'learner@savanna.example.org';

        const submitBtn = document.getElementById('btn-generate-draft');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating Self-Advocacy Letter...';

        try {
          const client = window.Voice4AllCareerClient;
          const draftRes = await client.draftAccommodationRequest({
            job_id: job.id,
            job_title: job.title,
            accommodations: selectedAccommodations,
            details,
            contact_email: email,
            language: state.lang
          });

          const formattedLetter = client.formatSelfAdvocacyEmail(draftRes);
          previewEl.textContent = formattedLetter;
          outputContainer.style.display = 'block';

          // Display Honesty Notice
          document.getElementById('draft-id-display').textContent = draftRes.draftId;
          document.getElementById('draft-notice-display').textContent = draftRes.deliveryNotice;

          // Checklist
          const checklistUl = document.getElementById('draft-checklist-ul');
          if (checklistUl) {
            checklistUl.innerHTML = (draftRes.interviewChecklist || []).map(item => `<li>${item}</li>`).join('');
          }

          announce('Accommodation request draft generated successfully.');
          outputContainer.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          alert('Failed to generate draft: ' + err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Generate Official Self-Advocacy Draft';
        }
      });
    }

    document.getElementById('btn-copy-draft')?.addEventListener('click', () => {
      const text = previewEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const notice = document.getElementById('copy-status-notice');
        notice.textContent = t('copied_success');
        setTimeout(() => notice.textContent = '', 3000);
      });
    });

    document.getElementById('btn-print-draft')?.addEventListener('click', () => {
      window.print();
    });
  }

  // =========================================================================
  // Job Alerts & Notifications (Telegram & SMS)
  // =========================================================================
  function initNotifications() {
    const tgStatusBadge = document.getElementById('tg-status-badge');
    const tgBtn = document.getElementById('btn-test-telegram');
    const tgResult = document.getElementById('telegram-result-box');

    // Check status
    async function checkTelegram() {
      try {
        const client = window.Voice4AllCareerClient;
        const status = await client.getTelegramStatus();
        if (tgStatusBadge) {
          if (status.isAvailable) {
            tgStatusBadge.textContent = 'Active Bot Gateway';
            tgStatusBadge.className = 'career-badge career-badge-fulltime';
          } else {
            tgStatusBadge.textContent = 'Simulated Demo Mode';
            tgStatusBadge.className = 'career-badge career-badge-simulated';
          }
        }
      } catch (e) {}
    }
    checkTelegram();

    if (tgBtn) {
      tgBtn.addEventListener('click', async () => {
        tgBtn.disabled = true;
        tgResult.style.display = 'block';
        tgResult.innerHTML = '<div class="career-loading-shimmer" style="width: 60%;"></div>';

        try {
          const client = window.Voice4AllCareerClient;
          const targetJob = state.jobs[0]?.id || 'v4a-job-001';
          const res = await client.testTelegramAlert(targetJob);

          if (res.isLiveDelivery) {
            tgResult.innerHTML = `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; color: #166534;">
                <strong>✅ Live Alert Dispatched!</strong> Message ID: ${res.messageId} to Telegram.
              </div>
            `;
          } else {
            tgResult.innerHTML = `
              <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; color: #92400e;">
                <strong>⚠️ Telegram Simulation Mode Notice:</strong>
                <p style="margin: 4px 0 8px 0; font-size: 13px;">${res.message}</p>
                <div style="background: #0f172a; color: #fff; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">
${res.formattedMessage || ''}
                </div>
              </div>
            `;
          }
        } catch (e) {
          tgResult.innerHTML = `<div style="color: red;">Error: ${e.message}</div>`;
        } finally {
          tgBtn.disabled = false;
        }
      });
    }

    // SMS Preview & Segment Counter
    const smsSelect = document.getElementById('sms-job-select');
    const smsPreviewBox = document.getElementById('sms-preview-text');
    const smsCounter = document.getElementById('sms-char-counter');
    const smsBtn = document.getElementById('btn-send-test-sms');
    const smsResult = document.getElementById('sms-result-box');

    async function updateSmsPreview() {
      const jobId = smsSelect?.value || 'v4a-job-001';
      try {
        const client = window.Voice4AllCareerClient;
        const preview = await client.previewSMSAlert(jobId, state.lang);
        if (smsPreviewBox) smsPreviewBox.textContent = preview.message;
        if (smsCounter) {
          smsCounter.textContent = `${preview.characterCount} chars | ${preview.segmentCount} SMS segment(s) (${preview.encoding})`;
          smsCounter.style.color = preview.isSingleSegment ? '#15803d' : '#b45309';
        }
      } catch (e) {}
    }

    if (smsSelect) {
      smsSelect.onchange = updateSmsPreview;
      updateSmsPreview();
    }

    if (smsBtn) {
      smsBtn.addEventListener('click', async () => {
        const phone = document.getElementById('sms-phone-input').value.trim() || '+251911000000';
        const jobId = smsSelect?.value || 'v4a-job-001';

        smsBtn.disabled = true;
        smsResult.style.display = 'block';
        smsResult.innerHTML = '<div class="career-loading-shimmer" style="width: 50%;"></div>';

        try {
          const client = window.Voice4AllCareerClient;
          const res = await client.sendTestSMS(jobId, phone, state.lang);

          smsResult.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; color: #166534;">
              <strong>${res.statusNotice || 'Simulated SMS Dispatched'}</strong>
              <p style="margin: 4px 0 0 0; font-size: 13px;">Recipient: ${res.phoneNumber} | Segments: ${res.segmentCount} | ${res.deliveryNotice}</p>
            </div>
          `;
        } catch (e) {
          smsResult.innerHTML = `<div style="color: red;">Error: ${e.message}</div>`;
        } finally {
          smsBtn.disabled = false;
        }
      });
    }
  }

  // =========================================================================
  // My Saved Items / Portfolio
  // =========================================================================
  function renderSavedPortfolio() {
    const container = document.getElementById('saved-portfolio-container');
    if (!container) return;

    const savedJobs = state.jobs.filter(j => state.savedJobIds.has(j.id));
    const completedResources = state.resources.filter(r => state.completedResourceIds.has(r.id));

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="career-card">
          <h3 style="font-size: 18px; margin: 0 0 14px 0; color: #1e3a8a;">
            <i class="fa-solid fa-bookmark" aria-hidden="true"></i> Saved Opportunities (${savedJobs.length})
          </h3>
          ${savedJobs.length === 0 ? `
            <p style="color: #64748b; font-size: 14px;">No roles saved yet. Click the bookmark icon on any opportunity card to save it here.</p>
          ` : `
            <ul style="padding-left: 20px; line-height: 1.6; margin: 0;">
              ${savedJobs.map(j => `
                <li style="margin-bottom: 8px;">
                  <strong>${j.title}</strong> at ${j.company} (${j.location})
                  <button type="button" class="btn-career btn-career-outline" style="padding: 2px 8px; font-size: 12px; margin-left: 8px;" onclick="openJobModal('${j.id}')">View</button>
                </li>
              `).join('')}
            </ul>
          `}
        </div>

        <div class="career-card">
          <h3 style="font-size: 18px; margin: 0 0 14px 0; color: #15803d;">
            <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Completed Skills Modules (${completedResources.length})
          </h3>
          ${completedResources.length === 0 ? `
            <p style="color: #64748b; font-size: 14px;">No modules marked as completed yet. Complete guides in the Learning & Skills Pathways tab.</p>
          ` : `
            <ul style="padding-left: 20px; line-height: 1.6; margin: 0;">
              ${completedResources.map(r => `
                <li style="margin-bottom: 8px;">
                  <strong>${r.title}</strong> (${r.category_label})
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Accessibility Toolbar & Controls
  // =========================================================================
  function initA11yToolbar() {
    const hcBtn = document.getElementById('btn-toggle-hc');
    const ltBtn = document.getElementById('btn-toggle-lt');
    const langBtn = document.getElementById('btn-toggle-lang');

    if (hcBtn) {
      hcBtn.addEventListener('click', () => {
        const isHc = document.body.classList.toggle('high-contrast');
        hcBtn.setAttribute('aria-pressed', String(isHc));
        localStorage.setItem('v4a_career_high_contrast', String(isHc));
        announce(isHc ? 'High contrast mode enabled' : 'High contrast mode disabled');
      });
    }

    if (ltBtn) {
      ltBtn.addEventListener('click', () => {
        const isLt = document.body.classList.toggle('large-text');
        ltBtn.setAttribute('aria-pressed', String(isLt));
        localStorage.setItem('v4a_career_large_text', String(isLt));
        announce(isLt ? 'Large text enabled' : 'Large text disabled');
      });
    }

    if (langBtn) {
      langBtn.addEventListener('click', () => {
        state.lang = state.lang === 'en' ? 'am' : 'en';
        localStorage.setItem('v4a_career_lang', state.lang);
        langBtn.textContent = state.lang === 'en' ? 'አማርኛ' : 'English';
        applyLanguageStrings();
        loadJobs();
        loadResources();
        announce(`Language switched to ${state.lang === 'en' ? 'English' : 'Amharic'}`);
      });
    }
  }

  function applyLanguageStrings() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (key) el.placeholder = t(key);
    });
  }

  // Focus Trapping for Accessible Dialogs
  function trapFocus(modalEl) {
    const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKey(e) {
      if (e.key === 'Escape') {
        modalEl.classList.remove('open');
        modalEl.setAttribute('hidden', 'true');
        modalEl.removeEventListener('keydown', handleKey);
        return;
      }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    modalEl.addEventListener('keydown', handleKey);
  }

  // =========================================================================
  // Initialization
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    loadPersistedState();
    initTabs();
    initA11yToolbar();
    initGuidanceAdvisor();
    initDrafterForm();
    initNotifications();

    // Filters event listeners
    const searchInput = document.getElementById('job-search-input');
    const typeSelect = document.getElementById('job-type-select');
    const a11yCheck = document.getElementById('job-a11y-check');

    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.currentFilters.q = searchInput.value.trim();
          loadJobs();
        }, 300);
      });
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        state.currentFilters.type = typeSelect.value;
        loadJobs();
      });
    }

    if (a11yCheck) {
      a11yCheck.addEventListener('change', () => {
        state.currentFilters.accessible_only = a11yCheck.checked;
        loadJobs();
      });
    }

    // Resource category pills
    document.querySelectorAll('.btn-resource-cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-resource-cat-pill').forEach(b => b.classList.remove('btn-career-primary'));
        btn.classList.add('btn-career-primary');
        state.resourceFilters.category = btn.dataset.cat;
        loadResources();
      });
    });

    const resSearch = document.getElementById('resource-search-input');
    if (resSearch) {
      resSearch.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.resourceFilters.q = resSearch.value.trim();
          loadResources();
        }, 300);
      });
    }

    // Modal close buttons
    document.getElementById('job-modal-close')?.addEventListener('click', closeJobModal);
    document.getElementById('resource-modal-close')?.addEventListener('click', closeResourceModal);

    // Initial data load
    loadJobs();
    loadResources();
  });

  // Expose global methods for modal trigger shortcuts
  window.openJobModal = openJobModal;
  window.openResourceModal = openResourceModal;

})();
