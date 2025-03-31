document.addEventListener("alpine:init", () => {

  let port = null;

  Alpine.data("WebImageDownloaderPopup", () => ({

    images: [],
    selectedImages: new Set(),

    showPages: 1,

    init() {
      port = chrome.runtime.connect({ name: "popup" });
      port.onMessage.addListener((message) => {
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
      return this.images.length > 20 * this.showPages;
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

    async init() {
      await this.getImageSrc();
    },

    async getImageSrc() {
      try {
        if (this.src) {
          return this.src;
        }
        const response = await fetch(this.url);
        const blob = await response.blob();
        this.src = URL.createObjectURL(blob);
        return this.src;
      } catch (error) {
        console.error("Error getting image source:", error);
        return null;
      }
    },

    async getImageSize() {
      const img = new Image();
      img.src = await this.getImageSrc();
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      return img.width;
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