import { Path } from "../utils/Paths.js";
import { Images } from "../utils/Images.js";
import { Settings } from "../utils/Settings.js";

document.addEventListener("alpine:init", () => {

  let port = null;

  Alpine.data("WebImageDownloaderPopup", () => ({

    messages: null,

    medias: [],
    selectedMedias: new Set(),

    urlPaths: [],
    selectedPaths: [],

    customPaths: [],

    showPages: 1,

    async init() {
      this.initMessages();
      await Settings.init();
      await this.getPaths();
      this.connect();
    },

    initMessages() {
      this.messages = {
        title: chrome.i18n.getMessage('extName'),
        downloadTo: chrome.i18n.getMessage('downloadTo'),
        saveSelected: chrome.i18n.getMessage('saveSelected'),
        saveAll: chrome.i18n.getMessage('saveAll'),
        clean: chrome.i18n.getMessage('clean'),
        loadMore: chrome.i18n.getMessage('loadMore'),
        loadLess: chrome.i18n.getMessage('loadLess'),
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
                info,
              });
              break;
            case "update":
              this.medias = message.medias;
              break;
            case "finish":
              this.selectedMedias.clear();
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

    async getPaths() {
      this.urlPaths = await Path.getPathSegments();
    },

    get paths() {
      return this.urlPaths.concat(this.customPaths);
    },

    get targetDirectory() {
      return this.selectedPaths.join("/");
    },

    get visibleMedias() {
      return this.medias.slice(Math.max(this.medias.length - Settings.options.pageSize * this.showPages, 0)).reverse();
    },

    get mediaCount() {
      return this.medias.length;
    },

    get selectedCount() {
      return this.selectedMedias.size;
    },

    get loadMoreAvailable() {
      return this.medias.length > Settings.options.pageSize * this.showPages;
    },

    get loadLessAvailable() {
      return this.showPages > 1;
    },

    get saveSelectedDisabled() {
      return !this.selectedMedias.size;
    },

    get saveAllDisabled() {
      return !this.medias.length;
    },

    get cleanDisabled() {
      return !this.medias.length;
    },

    loadMore() {
      this.showPages++;
    },

    loadLess() {
      this.showPages = 1;
    },

    getSelectedMedias(targetMedias) {
      const medias = this.medias.filter((media) => targetMedias.has(media.path));
      return medias;
    },

    openSettings() {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
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

    saveSelected() {
      if (port) {
        const medias = this.getSelectedMedias(this.selectedMedias);
        this.postMessage({
          action: "save",
          medias: medias,
          target_dir: this.targetDirectory,
        });
      }
    },

    saveAll() {
      if (port) {
        this.postMessage({
          action: "save",
          medias: this.medias,
          target_dir: this.targetDirectory,
        });
      }
    },

    clean() {
      this.medias = [];
      this.selectedMedias.clear();
      this.showPages = 1;
      if (port) {
        this.postMessage({ action: "clean" });
      }
    },

    clearPaths() {
      this.selectedPaths = [];
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

    get selected() {
      return this.selectedMedias.has(this.image.path);
    },

    toggleSelection() {
      if (this.selectedMedias.has(this.image.path)) {
        this.selectedMedias.delete(this.image.path);
      } else {
        this.selectedMedias.add(this.image.path);
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

});