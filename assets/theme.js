/**
 * HydroMind — assets/theme.js
 * 3-State Theme Switcher: Light, Dark, Eye Comfort
 * Synchronizes CSS variables, Chart.js, and Leaflet live tiles.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'kizuna_theme';
  const VALID_THEMES = ['light', 'dark', 'comfort'];

  const MAP_TILES = {
    light: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
      }
    },
    comfort: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18
      }
    },
    dark: {
   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
   options: {
     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
     maxZoom: 18
   }
 }
  };

  function getSystemTheme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  function getSavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_THEMES.includes(saved)) {
      return saved;
    }
    return getSystemTheme();
  }

  function updateSwitcherUI(theme) {
    document.querySelectorAll('.theme-switcher button[data-theme-value]').forEach(btn => {
      const isActive = btn.dataset.themeValue === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateChartTheme() {
    if (!window.Chart) return;
    const canvas = document.getElementById('flowChart');
    if (!canvas) return;

    let chartInstance = null;
    if (typeof appState !== 'undefined' && appState.chart) {
      chartInstance = appState.chart;
    } else if (typeof Chart.getChart === 'function') {
      chartInstance = Chart.getChart(canvas);
    }

    if (!chartInstance) return;

    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue('--chart-line').trim() || '#159bd0';
    const fill = styles.getPropertyValue('--chart-fill').trim() || 'rgba(21,155,208,.10)';
    const thresh = styles.getPropertyValue('--chart-threshold').trim() || '#f2a34a';
    const grid = styles.getPropertyValue('--chart-grid').trim() || '#edf1f5';
    const ticks = styles.getPropertyValue('--chart-ticks').trim() || '#9aa9b7';
    const tipBg = styles.getPropertyValue('--chart-tooltip-bg').trim() || '#102b45';
    const tipText = styles.getPropertyValue('--chart-tooltip-text').trim() || '#ffffff';

    if (chartInstance.data && chartInstance.data.datasets && chartInstance.data.datasets.length >= 2) {
      chartInstance.data.datasets[0].borderColor = line;
      chartInstance.data.datasets[0].backgroundColor = fill;
      chartInstance.data.datasets[1].borderColor = thresh;
    }

    if (chartInstance.options) {
      if (chartInstance.options.scales) {
        if (chartInstance.options.scales.x && chartInstance.options.scales.x.ticks) {
          chartInstance.options.scales.x.ticks.color = ticks;
        }
        if (chartInstance.options.scales.y) {
          if (chartInstance.options.scales.y.ticks) chartInstance.options.scales.y.ticks.color = ticks;
          if (chartInstance.options.scales.y.grid) chartInstance.options.scales.y.grid.color = grid;
        }
      }
      if (chartInstance.options.plugins && chartInstance.options.plugins.tooltip) {
        chartInstance.options.plugins.tooltip.backgroundColor = tipBg;
        chartInstance.options.plugins.tooltip.titleColor = tipText;
        chartInstance.options.plugins.tooltip.bodyColor = tipText;
      }
    }

    chartInstance.update('none');
  }

  function updateMapTheme(theme) {
    if (!window.L) return;
    const map = (typeof mapState !== 'undefined' && mapState.map);
    if (!map) return;

    const config = MAP_TILES[theme] || MAP_TILES.light;

    // Remove existing tile layers
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Add new theme tile layer
    const newTiles = L.tileLayer(config.url, config.options).addTo(map);
    newTiles.bringToBack();

    // Update polyline color if present
    const styles = getComputedStyle(document.documentElement);
    const polyColor = styles.getPropertyValue('--map-polyline').trim() || '#087eba';

    map.eachLayer(layer => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        layer.setStyle({ color: polyColor });
      }
    });
  }

  function setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) theme = 'light';
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    updateSwitcherUI(theme);
    updateChartTheme();
    updateMapTheme(theme);

    window.dispatchEvent(new CustomEvent('kizuna-theme-change', { detail: { theme } }));
  }

  function bindSwitcherEvents() {
    document.querySelectorAll('.theme-switcher button[data-theme-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.themeValue);
      });
    });
  }

  // Make public API available
  window.KizunaTheme = {
    getTheme: getSavedTheme,
    setTheme,
    updateChart: updateChartTheme,
    updateMap: updateMapTheme
  };

  // Initial setup when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', currentTheme);
    bindSwitcherEvents();
    updateSwitcherUI(currentTheme);

    // Initial check for chart and map after slight delay to ensure scripts initialized
    setTimeout(() => {
      updateChartTheme();
      updateMapTheme(currentTheme);
    }, 150);

    setTimeout(() => {
      updateChartTheme();
      updateMapTheme(currentTheme);
    }, 600);
  });
})();
