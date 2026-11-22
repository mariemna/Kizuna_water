/**
 * HydroMind — assets/export.js
 * Export Modal & Trigger Logic for CSV & PDF Intervention Reports
 */

(function() {
  'use strict';

  function formatDateIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTodayIso() {
    return formatDateIso(new Date());
  }

  window.openExportModal = function() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;

    const todayStr = getTodayIso();
    const inputDu = document.getElementById('exportDateDu');
    const inputAu = document.getElementById('exportDateAu');

    if (inputDu) {
      inputDu.value = todayStr;
      inputDu.max = todayStr;
    }
    if (inputAu) {
      inputAu.value = todayStr;
      inputAu.max = todayStr;
    }

    // Default to 'today'
    const todayRadio = document.querySelector('input[name="exportPeriod"][value="today"]');
    if (todayRadio) todayRadio.checked = true;

    // Default to 'mesures'
    const mesuresRadio = document.querySelector('input[name="exportFormat"][value="mesures"]');
    if (mesuresRadio) mesuresRadio.checked = true;

    const customRow = document.getElementById('customDateRow');
    if (customRow) customRow.style.display = 'none';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.closeExportModal = function() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.handlePeriodChange = function() {
    const selected = document.querySelector('input[name="exportPeriod"]:checked');
    const customRow = document.getElementById('customDateRow');
    if (!customRow || !selected) return;

    if (selected.value === 'custom') {
      customRow.style.display = 'grid';
    } else {
      customRow.style.display = 'none';
    }
  };

  window.handleExportSubmit = function(event) {
    if (event) event.preventDefault();

    const periodInput = document.querySelector('input[name="exportPeriod"]:checked');
    const formatInput = document.querySelector('input[name="exportFormat"]:checked');
    if (!periodInput || !formatInput) return;

    const period = periodInput.value;
    const format = formatInput.value;

    let du = '';
    let au = '';
    const now = new Date();

    if (period === 'today') {
      du = getTodayIso();
      au = getTodayIso();
    } else if (period === '24h') {
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      du = formatDateIso(yesterday);
      au = getTodayIso();
    } else if (period === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      du = formatDateIso(sevenDaysAgo);
      au = getTodayIso();
    } else if (period === 'custom') {
      const inputDu = document.getElementById('exportDateDu');
      const inputAu = document.getElementById('exportDateAu');
      du = inputDu ? inputDu.value.trim() : '';
      au = inputAu ? inputAu.value.trim() : '';

      if (!du || !au) {
        alert(window.KizunaI18n ? window.KizunaI18n.t('Please specify both start (From) and end (To) dates.') : 'Please specify both start (From) and end (To) dates.');
        return;
      }
      if (du > au) {
        alert(window.KizunaI18n ? window.KizunaI18n.t('Start date must be earlier than or equal to end date.') : 'Start date must be earlier than or equal to end date.');
        return;
      }
    }

    if (format === 'pdf') {
      const reportUrl = 'rapport.php?du=' + encodeURIComponent(du) + '&au=' + encodeURIComponent(au);
      window.open(reportUrl, '_blank');
      closeExportModal();
    } else {
      const exportUrl = 'exporter.php?type=' + encodeURIComponent(format) + '&du=' + encodeURIComponent(du) + '&au=' + encodeURIComponent(au);
      const link = document.createElement('a');
      link.href = exportUrl;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      closeExportModal();
    }
  };

  // Close on backdrop click or Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('exportModal');
      if (modal && modal.style.display !== 'none') {
        closeExportModal();
      }
    }
  });

  document.addEventListener('click', function(e) {
    const modal = document.getElementById('exportModal');
    if (modal && e.target === modal) {
      closeExportModal();
    }
  });

})();
