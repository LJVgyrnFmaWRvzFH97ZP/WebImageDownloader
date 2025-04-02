import { Images } from "../utils/Images.js";
import { Settings } from "../utils/Settings.js";

document.addEventListener("alpine:init", () => {

  let port = null;

  Settings.init();

  Alpine.data("WebImageDownloaderPopup", () => ({

    images: [],
    selectedImages: new Set(),

    showPages: 1,

    async init() {
      this.connect();
    },

    connect() {
      port = chrome.runtime.connect({ name: "popup" });
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
    },

    get visibleImages() {
      return this.images.slice(Math.max(this.images.length - 20 * this.showPages, 0)).reverse();
    },

    get imageCount() {
      return this.images.length;
    },

    get selectedCount() {
      return this.selectedImages.size;
    },

    get loadMoreAvailable() {
      return this.images.length > Settings.options.pageSize * this.showPages;
    },

    get loadLessAvailable() {
      return this.showPages > 1;
    },

    loadMore() {
      this.showPages++;
    },

    loadLess() {
      this.showPages = 1;
    },

    saveSelected() {
      if (port) {
        port.postMessage({ action: "save", urls: Array.from(this.selectedImages) });
      }
    },

    saveAll() {
      if (port) {
        port.postMessage({ action: "save-all" });
      }
    },

    clean() {
      this.selectedImages.clear();
      if (port) {
        port.postMessage({ action: "clean" });
      }
    },

  }));

  Alpine.data("Image", () => ({

    src: null,
    width: null,

    async init() {
      await this.getImageSrc();
    },

    async getImageSrc() {
      const { src, width } = await Images.getImageInfo(this.url);
      this.src = src;
      this.width = width;
    },

    get shown() {
      return this.width > Settings.options.minimalWidth;
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
});