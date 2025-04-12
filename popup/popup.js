import { Path } from "../utils/Paths.js";
import { Images } from "../utils/Images.js";
import { Settings } from "../utils/Settings.js";
import { MediaDB } from "../utils/DB.js";

document.addEventListener("alpine:init", () => {

  let port = null;

  Alpine.data("WebImageDownloaderPopup", () => ({

    messages: null,

    db: null,
    count: 0,
    minWidth: 0,

    medias: [],
    selectedMedias: new Set(),

    currentPage: 1,

    loading: true,
    renderedCount: 0,
    loadingProgressBar: null,

    downloading: false,
    downloadProgressBar: null,
    downloadedCount: 0,
    showDownloadPrompt: false,

    pathOptions: null,

    get showMediaGrid() {
      return !this.loading && this.count;
    },

    get showPrompt() {
      return !this.loading && !this.count;
    },

    async init() {
      this.initMessages();
      this.db = new MediaDB();
      await this.db.init();
      await Settings.init();
      this.initRefData();
      this.connect();
    },

    initRefData() {
      this.pathOptions = Alpine.$data(this.$refs.pathOptions.firstElementChild);
      this.loadingProgressBar = Alpine.$data(this.$refs.loadingProgressBar.firstElementChild);
      this.loadingProgressBar.name = 'loading-progress';
      this.downloadProgressBar = Alpine.$data(this.$refs.downloadProgressBar.firstElementChild);
      this.downloadProgressBar.name = 'download-progress';
    },

    initMessages() {
      this.messages = {
        title: chrome.i18n.getMessage('extName'),
        downloadTo: chrome.i18n.getMessage('downloadTo'),
        saveSelected: chrome.i18n.getMessage('saveSelected'),
        saveAll: chrome.i18n.getMessage('saveAll'),
        clean: chrome.i18n.getMessage('clean'),
        previous: chrome.i18n.getMessage('previous'),
        next: chrome.i18n.getMessage('next'),
        previewLoading: chrome.i18n.getMessage('previewLoading'),
        noMediaDetected: chrome.i18n.getMessage('noMediaDetected'),
        filterByWidth: chrome.i18n.getMessage('filterByWidth'),
        apply: chrome.i18n.getMessage('apply'),
        downloading: chrome.i18n.getMessage('downloading'),
        downloadComplete: chrome.i18n.getMessage('downloadComplete'),
      };
    },

    connect(retries = 5) {
      if (port) {
        return;
      }
      try {
        port = chrome.runtime.connect({ name: "popup" });
        port.onDisconnect.addListener(() => {
          port = null;
          console.info("Port disconnected");
          setTimeout(() => this.connect(), 1000);
        });
        port.onMessage.addListener(async (message) => {
          switch (message.action) {
            case 'resolve':
              const info = await Images.getInfo(message.blob);
              this.postMessage({
                action: 'resolve',
                path: message.path,
                info: {
                  url: message.url,
                  ...info,
                },
              });
              break;
            case 'sync':
              this.minWidth = message.minWidth;
              break;
            case 'count':
              if (!message.count) {
                setTimeout(() => {
                  this.loadingProgressBar.setProgress(1, 1);
                }, 100);
              }
              if (this.count != message.count) {
                this.count = message.count;
                await this.update(1);
              }
              break;
            case 'process':
              this.downloadProgressBar.setProgress(message.current, message.total);
              break;
            case "heartbeat":
              break;
            default:
              break;
          }
        });
      } catch (error) {
        console.info('failed to connect background, ' + error);
        if (retries > 0) {
          setTimeout(() => this.connect(retries - 1), 1000);
        } else {
          console.error('[FATAL] failed to connect to backgound')
        }
      }
    },

    get selectedCount() {
      return this.selectedMedias.size;
    },

    get loadNextAvailable() {
      return this.count > Settings.options.pageSize * this.currentPage;
    },

    get loadPreviousAvailable() {
      return this.currentPage > 1;
    },

    get saveSelectedDisabled() {
      return !this.selectedMedias.size || this.downloading;
    },

    get saveAllDisabled() {
      return !this.count || this.downloading;
    },

    get cleanDisabled() {
      return !this.count || this.downloading;
    },

    async update(page) {
      this.currentPage = page;
      this.medias = await this.db.getByPage(this.minWidth, (page - 1) * Settings.options.pageSize, Settings.options.pageSize);
    },

    async loadNext() {
      await this.update(this.currentPage + 1)
    },

    async loadPrevious() {
      await this.update(this.currentPage - 1);
    },

    handleProcessComplete(event) {
      switch (event.detail.name) {
        case 'loading-progress':
          this.loading = false;
          break;
        case 'download-progress':
          this.downloading = false;
          this.downloadedCount = event.detail.count;
          this.showDownloadPrompt = true;
          this.selectedMedias.clear();
          break;
        default:
          break;
      }
    },

    openSettings() {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    },

    openDownloads() {
      chrome.tabs.create({ url: 'chrome://downloads/' });
    },

    postMessage(message) {
      if (port) {
        try {
          port.postMessage(message);
        } catch (error) {
          console.error('failed to post message: ' + error);
        }
      }
    },

    closeDownloadPrompt() {
      this.showDownloadPrompt = false;
    },

    setMinWidth(event) {
      this.selectedMedias.clear();
      this.minWidth = parseInt(event.target.value);
      this.postMessage({
        action: "filter",
        minWidth: this.minWidth,
      })
    },

    saveSelected() {
      this.downloadProgressBar.resetProcess();
      this.downloading = true;
      this.postMessage({
        action: "save",
        medias: Array.from(this.selectedMedias),
        target_dir: this.pathOptions.targetDirectory,
      });
    },

    saveAll() {
      this.downloadProgressBar.resetProcess();
      this.downloading = true;
      this.postMessage({
        action: "save-all",
        target_dir: this.pathOptions.targetDirectory,
      });
    },

    clean() {
      this.medias = [];
      this.selectedMedias.clear();
      this.currentPage = 1;
      this.loading = false;
      this.renderedCount = 0;
      this.postMessage({ action: "clean" });
    },

    clearPaths() {
      this.selectedPaths = [];
    },

  }));

  Alpine.data("Paths", () => ({

    urlPaths: [],
    selectedPaths: [],

    customPaths: [],

    async init() {
      await this.initPathListener();
    },

    async initPathListener() {
      chrome.tabs.onUpdated.addListener(async (_tabId, _changeInfo, tab) => {
        this.urlPaths = Path.getPathSegments(tab.url);
      });
      chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, async (tab) => {
          this.urlPaths = Path.getPathSegments(tab.url);
        });
      });
      chrome.windows.onFocusChanged.addListener(
        async (windowId) => {
          if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            const tab = await this.getActivatedTab(windowId);
            if (tab) {
              this.urlPaths = Path.getPathSegments(tab.url);
            }
          }
        },
        { windowTypes: ['normal'] }
      );
      chrome.windows.getLastFocused(
        { windowTypes: ['normal'] },
        async (window) => {
          const tab = await this.getActivatedTab(window.id);
          if (tab) {
            this.urlPaths = Path.getPathSegments(tab.url);
          }
        }
      );
    },

    async getActivatedTab(windowId) {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, windowId }, (tabs) => {
          if (tabs.length === 0) return resolve(null);
          resolve(tabs[0]);
        });
      });
    },

    get paths() {
      return this.urlPaths.concat(this.customPaths);
    },

    get targetDirectory() {
      return this.selectedPaths.join("/");
    },

  }));

  Alpine.data("Path", () => ({

    classes_normal: 'bg-gray-300 text-gray-700',
    classes_selected: 'bg-orange-300 text-orange-700',

    init() {
    },

    get selected() {
      return this.selectedPaths.includes(this.path);
    },

    get classes() {
      return this.selected ? this.classes_selected : this.classes_normal;
    },

    toggleSelection() {
      if (!this.selected) {
        this.selectedPaths.push(this.path);
      }
    }

  }));

  Alpine.data("Image", () => ({

    init() {
      this.renderedCount++;
      this.loadingProgressBar.setProgress(this.renderedCount, Math.min(Settings.options.pageSize, this.count));
    },

    get selected() {
      return this.selectedMedias.has(this.image.id);
    },

    toggleSelection() {
      if (this.selectedMedias.has(this.image.id)) {
        this.selectedMedias.delete(this.image.id);
      } else {
        this.selectedMedias.add(this.image.id);
      }
    }

  }));

  Alpine.data("AddButton", () => ({

    adding: false,
    pathValue: '',

    init() {
    },

    toggleAdding() {
      this.adding = !this.adding;
    },

    get showAddButton() {
      return !this.adding;
    },

    get showCommitButton() {
      return this.adding;
    },

    setPathValue(event) {
      this.pathValue = event.target.value;
    },

    commitAdding() {
      if (this.pathValue && !this.customPaths.includes(this.pathValue) && !this.urlPaths.includes(this.pathValue)) {
        this.customPaths.push(this.pathValue);
        this.toggleAdding();
        this.pathValue = '';
      }
    }
  }));

  Alpine.data("ProgressBar", () => ({

    name: null,
    progress: 0,

    get status() {
      return `${this.progress}%`;
    },

    get width() {
      return { width: this.status };
    },

    resetProcess() {
      this.progress = 0;
    },

    calcProgress(current, total) {
      return Math.floor((current / total) * 100);
    },

    setProgress(current, total) {
      const progress = this.calcProgress(current, total);
      setTimeout(() => {
        this.progress = Math.min(100, progress)
        if (progress === 100) {
          setTimeout(() => {
            this.$dispatch('progress-complete', { name: this.name, count: total })
          }, 300);
        }
      }, 10 * progress);
    },

  }));

});