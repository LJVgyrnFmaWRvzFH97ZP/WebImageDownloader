import { Path } from "../utils/Paths.js";
import { Images } from "../utils/Images.js";
import { Settings } from "../utils/Settings.js";

document.addEventListener("alpine:init", () => {

  let port = null;

  Alpine.data("WebImageDownloaderPopup", () => ({

    messages: null,

    images: [],
    imageBlobs: {},
    shownImages: [],
    selectedImages: new Set(),

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
            case "update":
              this.images = message.urls;
              break;
            case "finish":
              this.selectedImages.clear();
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

    get visibleImages() {
      return this.shownImages.slice(Math.max(this.shownImages.length - Settings.options.pageSize * this.showPages, 0)).reverse();
    },

    get imageCount() {
      return this.shownImages.length;
    },

    get selectedCount() {
      return this.selectedImages.size;
    },

    get loadMoreAvailable() {
      return this.shownImages.length > Settings.options.pageSize * this.showPages;
    },

    get loadLessAvailable() {
      return this.showPages > 1;
    },

    get saveSelectedDisabled() {
      return !this.selectedImages.size;
    },

    get saveAllDisabled() {
      return !this.shownImages.length;
    },

    get cleanDisabled() {
      return !this.shownImages.length;
    },

    loadMore() {
      this.showPages++;
    },

    loadLess() {
      this.showPages = 1;
    },

    getImageWithBlob(targetImages) {
      const images = Array.from(targetImages);
      const blobs = [];
      for (const image of images) {
        blobs.push(this.imageBlobs[image]);
      }
      return { images, blobs };
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
        const selected = this.getImageWithBlob(this.selectedImages);
        this.postMessage({
          action: "save",
          urls: selected.images,
          blobs: selected.blobs,
          target_dir: this.targetDirectory,
        });
      }
    },

    saveAll() {
      if (port) {
        const selected = this.getImageWithBlob(this.shownImages);
        this.postMessage({
          action: "save",
          urls: selected.images,
          blobs: selected.blobs,
          target_dir: this.targetDirectory,
        });
      }
    },

    clean() {
      this.images = [];
      this.imageBlobs = {};
      this.shownImages = [];
      this.selectedImages.clear();
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

  Alpine.data("ImageTemplate", () => ({

    src: null,
    width: null,

    async init() {
      await this.getImageSrc();
    },

    async getImageSrc() {
      const { src, width } = await Images.getImageInfo(this.url, this.imageBlobs[this.url]);
      this.src = src;
      this.width = width;
      this.imageBlobs[this.url] = src;
      if (this.shown) {
        this.shownImages.push(this.url);
      }
    },

    get shown() {
      return this.width > Settings.options.minimalWidth;
    },

  }));

  Alpine.data("Image", () => ({

    src: null,
    width: null,

    async init() {
      await this.getImageSrc();
    },

    async getImageSrc() {
      const { src, width } = await Images.getImageInfo(this.url, this.imageBlobs[this.url]);
      this.src = src;
      this.width = width;
    },

    get selected() {
      return this.selectedImages.has(this.url);
    },

    toggleSelection() {
      if (this.selectedImages.has(this.url)) {
        this.selectedImages.delete(this.url);
      } else {
        this.selectedImages.add(this.url);
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