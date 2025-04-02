import { Settings } from "./utils/Settings.js";

const ImageQueue = {

  urls: null,
  paths: null,

  init() {
    this.urls = [],
      this.paths = new Set();
  },

  get() {
    return this.urls;
  },

  insert(url) {
    const path = Utils.getOriginalFilename(url);
    if (!path) return;
    if (!this.paths.has(path)) {
      this.paths.add(path)
      this.urls.push(url);
      Channel.notify();
    }
  },

  download(_urls) {
    const timestamp = Date.now();
    const urls = _urls ?? this.urls;
    Utils.getDownloadDir((target_dir) => {
      urls.forEach((url, index) => {
        Utils.downloadImage(target_dir, url, index, timestamp);
      });
    });
  },

  clean() {
    this.urls = [];
    this.paths.clear();
  },

}

const Channel = {

  port: null,

  init() {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'popup') {
        return;
      }

      this.port = port;

      port.onMessage.addListener((message) => {
        switch (message.action) {
          case "save":
            ImageQueue.download(message.urls);
            this.finish();
            break;
          case "save-all":
            ImageQueue.download();
            break;
          case "clean":
            ImageQueue.clean();
            this.notify();
            break;
          default:
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        this.port = null;
      })

      this.notify();

    });
  },

  notify() {
    if (!this.port) return;
    this.port.postMessage({
      action: "update",
      urls: ImageQueue.get(),
    });
  },

  finish() {
    if (!this.port) return;
    this.port.postMessage({
      action: "finish",
    });
  },

}

const Utils = {

  getOriginalFilename(url) {
    const urlObj = new URL(url);
    const paths = urlObj.pathname.split('/').filter(Boolean);
    return paths.slice(-1)[0];
  },

  resolveDirectory(option, url) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    return option.replace(/{(.*?)}/g, (match, key) => {
      if (key === "domain") return domain;
      if (key.startsWith("path[")) {
        const pathIndex = parseInt(key.match(/\d+/)?.[0], 10);
        return pathSegments[pathIndex] || `invalid_path_${pathIndex}`;
      }
      return match;
    });
  },

  resolveFilename(option, url, index, timestamp) {
    const urlObj = new URL(url);
    const originalImageName = urlObj.pathname.split('/').filter(Boolean).slice(-1)[0];
    const ext = '.' + originalImageName.split('.').slice(-1)[0];

    return option.replace(/{(.*?)}/g, (match, key) => {
      if (key === "index") return index.toString();
      if (key === "timestamp") return timestamp.toString();
      if (key === "original_image_name") return originalImageName;
      return match;
    }) + ext;
  },

  getRootDirectory() {
    if (Settings.options.rootDirectory) {
      return Settings.options.rootDirectory + '/';
    }
    return '';
  },

  getDownloadDir(download2) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const dir = this.resolveDirectory(Settings.options.directory, tabs[0].url)
      const target_dir = this.getRootDirectory() + dir;
      download2(target_dir);
    });
  },

  downloadImage(target_dir, url, index, timestamp) {
    const filename = this.resolveFilename(Settings.options.filename, url, index, timestamp)
    console.log(filename);
    const filepath = target_dir + '/' + filename;
    console.log(filepath);
    chrome.downloads.download({
      url: url,
      filename: filepath,
      conflictAction: "overwrite",
      saveAs: false
    });
  },

}

const Intercepter = {

  listener: null,

  init() {
    this.updateListener(Settings.formats);
    this.watchFormats();
  },

  getListener() {
    return (details) => {
      ImageQueue.insert(details.url);
    }
  },

  updateListener(formats) {
    if (this.listener) {
      chrome.webRequest.onBeforeRequest.removeListener(this.listener);
    }
    this.listener = this.getListener();
    const urls = formats.map(ext => `*://*/*.${ext.toLowerCase()}*`);
    console.log(urls);
    chrome.webRequest.onBeforeRequest.addListener(this.listener, { urls });
  },

  watchFormats() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.webImageDownloaderSettings) {
        this.updateListener(changes.webImageDownloaderSettings.newValue.formats);
      }
    });
  },

  destroy() {
    if (this.listener) {
      chrome.webRequest.onBeforeRequest.removeListener(this.listener);
    }
  },

}

Settings.init();
ImageQueue.init();
Channel.init();
Intercepter.init();

chrome.tabs.onRemoved.addListener(() => {
  ImageQueue.clean();
  Channel.notify();
  Intercepter.destroy();
});