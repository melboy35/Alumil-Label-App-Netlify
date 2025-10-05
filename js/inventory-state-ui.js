/**
 * Inventory State UI
 * Handles the UI for the inventory state section on admin page
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements in the inventory state section
  const versionEl = document.getElementById('inventory-version');
  const lastUpdatedEl = document.getElementById('inventory-last-updated');
  const storagePath = document.getElementById('inventory-storage-path');
  const cacheStatusDot = document.getElementById('cache-status-dot');
  const cacheStatusText = document.getElementById('cache-status-text');
  const uploadBtn = document.getElementById('upload-inventory-btn');
  const fileInput = document.getElementById('inventory-file-input');
  const selectedFileName = document.getElementById('selected-file-name');
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const statusMessage = document.getElementById('inventory-status-message');
  const statusText = document.getElementById('inventory-status-text');
  const logsEl = document.getElementById('inventory-logs');

  // Format date for display
  const formatDate = (date) => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      return d.toLocaleString();
    } catch (e) {
      return '—';
    }
  };

  // Add a log entry
  const addLogEntry = (message, type = 'info') => {
    if (!logsEl) return;
    
    // Remove "No recent operations" placeholder if present
    const placeholder = logsEl.querySelector('li.text-gray-500');
    if (placeholder) {
      placeholder.remove();
    }
    
    // Create new log entry
    const li = document.createElement('li');
    li.className = type === 'error' ? 'text-red-400' : 
                  type === 'success' ? 'text-green-400' : 'text-blue-400';
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    li.textContent = `[${timeStr}] ${message}`;
    
    // Add to the beginning
    if (logsEl.firstChild) {
      logsEl.insertBefore(li, logsEl.firstChild);
    } else {
      logsEl.appendChild(li);
    }
    
    // Keep only last 5 entries
    while (logsEl.children.length > 5) {
      logsEl.removeChild(logsEl.lastChild);
    }
  };

  // Show status message
  const showStatusMessage = (message, type = 'info') => {
    if (!statusMessage || !statusText) return;
    
    statusText.textContent = message;
    statusMessage.className = 'p-3 rounded-lg border';
    
    // Set appropriate styling based on message type
    if (type === 'error') {
      statusMessage.classList.add('bg-red-900/20', 'border-red-700/30');
      statusText.className = 'text-sm text-red-400';
    } else if (type === 'success') {
      statusMessage.classList.add('bg-green-900/20', 'border-green-700/30');
      statusText.className = 'text-sm text-green-400';
    } else {
      statusMessage.classList.add('bg-blue-900/20', 'border-blue-700/30');
      statusText.className = 'text-sm text-blue-400';
    }
    
    statusMessage.classList.remove('hidden');
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 5000);
    }
  };

  // Update cache status indicator
  const updateCacheStatus = async () => {
    if (!window.inventoryState || !cacheStatusDot || !cacheStatusText) return;
    
    try {
      const counts = await window.inventoryState.getCachedDataCounts();
      
      if (counts.total > 0) {
        // Cache is populated
        cacheStatusDot.className = 'h-2 w-2 rounded-full mr-2 bg-green-500';
        cacheStatusText.textContent = `Active (${counts.profiles} profiles, ${counts.accessories} accessories)`;
        cacheStatusText.className = 'text-blue-300';
      } else if (window.inventoryState.getCurrentState()?.storage_path) {
        // We have a path but no cache - needs downloading
        cacheStatusDot.className = 'h-2 w-2 rounded-full mr-2 bg-yellow-500';
        cacheStatusText.textContent = 'Needs refresh';
        cacheStatusText.className = 'text-yellow-300';
      } else {
        // No cache and no state
        cacheStatusDot.className = 'h-2 w-2 rounded-full mr-2 bg-gray-500';
        cacheStatusText.textContent = 'Not initialized';
        cacheStatusText.className = 'text-gray-400';
      }
    } catch (error) {
      console.error('Error updating cache status:', error);
      cacheStatusDot.className = 'h-2 w-2 rounded-full mr-2 bg-red-500';
      cacheStatusText.textContent = 'Error';
      cacheStatusText.className = 'text-red-400';
    }
  };

  // Update inventory state UI
  const updateInventoryStateUI = () => {
    if (!window.inventoryState) {
      return;
    }
    
    const state = window.inventoryState.getCurrentState();
    
    if (versionEl) {
      versionEl.textContent = state?.version || '—';
    }
    
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = state?.updated_at ? formatDate(state.updated_at) : '—';
    }
    
    if (storagePath) {
      storagePath.textContent = state?.storage_path || '—';
    }
    
    updateCacheStatus();
  };

  // Set up file input handling
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Update selected file name
      if (selectedFileName) {
        selectedFileName.textContent = file.name;
      }
      
      // Process the file
      try {
        showStatusMessage(`Uploading ${file.name}...`, 'info');
        addLogEntry(`Started upload of ${file.name}`);
        
        // Upload file using InventoryStateManager
        const filePath = await window.inventoryState.uploadAndPublish(file);
        
        showStatusMessage(`File ${file.name} uploaded and published successfully!`, 'success');
        addLogEntry(`Uploaded and published ${file.name}`, 'success');
        
        // Reset file input
        fileInput.value = '';
      } catch (error) {
        console.error('Upload error:', error);
        showStatusMessage(`Upload failed: ${error.message}`, 'error');
        addLogEntry(`Upload failed: ${error.message}`, 'error');
      }
    });
  }

  // Set up clear cache button
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      try {
        if (!window.inventoryState) {
          showStatusMessage('Inventory state manager not initialized', 'error');
          return;
        }
        
        if (confirm('Are you sure you want to clear the cache for all users? This will force everyone to re-download the data.')) {
          showStatusMessage('Clearing cache for all users...', 'info');
          addLogEntry('Clearing cache for all users');
          
          await window.inventoryState.triggerCacheClear();
          
          showStatusMessage('Cache cleared for all users successfully!', 'success');
          addLogEntry('Cache cleared for all users', 'success');
          
          // Update UI
          updateCacheStatus();
        }
      } catch (error) {
        console.error('Clear cache error:', error);
        showStatusMessage(`Clear cache failed: ${error.message}`, 'error');
        addLogEntry(`Clear cache failed: ${error.message}`, 'error');
      }
    });
  }

  // Listen for inventory data updates
  window.addEventListener('inventoryDataUpdated', (e) => {
    updateInventoryStateUI();
    
    const detail = e.detail || {};
    addLogEntry(`Data updated (${detail.profiles || 0} profiles, ${detail.accessories || 0} accessories)`);
  });

  // Initialize the UI
  const initUI = async () => {
    // Wait for the inventory state manager to initialize
    if (!window.inventoryState || !window.inventoryState.isInitialized) {
      setTimeout(initUI, 500);
      return;
    }
    
    // Update initial state
    updateInventoryStateUI();
    
    // Add initial log entry
    addLogEntry('Inventory state UI initialized');
  };

  // Start initialization
  initUI();
  
  // Update UI periodically
  setInterval(updateInventoryStateUI, 30000);
});