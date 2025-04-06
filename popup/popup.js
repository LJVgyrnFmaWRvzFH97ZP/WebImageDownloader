import { Path } from "../utils/Paths.js";
import { Images } from "../utils/Images.js";
import { Settings } from "../utils/Settings.js";

document.addEventListener("alpine:init", () => {

  let port = null;

  Settings.init();

  Alpine.data("WebImageDownloaderPopup", () => ({

    images: [],
    imageBlobs: {},
    shownImages: [],
    selectedImages: new Set(),

    urlPaths: [],
    selectedPaths: [],

    customPaths: [],

    showPages: 1,

    async init() {
      this.connect();
      await this.getPaths();
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

    getImageWithBlob(targetImages) {
      const images = Array.from(targetImages);
      const blobs = [];
      for (const image of images) {
        blobs.push(this.imageBlobs[image]);
      }
      return { images, blobs };
    },

    saveSelected() {
      if (port) {
        const selected = this.getImageWithBlob(this.selectedImages);
        port.postMessage({
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
        port.postMessage({
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
      if (port) {
        port.postMessage({ action: "clean" });
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

    src: null,
    width: null,

    async init() {
      await this.getImageSrc();
    },

    async getImageSrc() {
      const { src, width } = await Images.getImageInfo(this.url);
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