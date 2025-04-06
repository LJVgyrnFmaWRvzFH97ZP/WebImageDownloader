import { Settings } from "./utils/Settings.js";

const ImageQueue = {

  urls: null,
  paths: null,

  init() {
    this.urls = [];
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

  download(target_dir, urls, blobs) {
    const timestamp = Date.now();
    urls.forEach((url, index) => {
      Utils.downloadImage(target_dir, url, blobs[index], index, timestamp);
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
            ImageQueue.download(message.target_dir, message.urls, message.blobs);
            this.finish();
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
    const filename = urlObj.pathname.split('/').filter(Boolean).join('_');
    return filename;
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
    const fileparts = this.getOriginalFilename(url).split('.');
    const originalImageName = fileparts[0];
    const ext = '.' + fileparts.slice(-1)[0];
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

  getRootDomain(domain) {
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  },

  extractDomain(url) {
    return new URL(url).hostname;
  },

  downloadImage(target_dir, url, blob, index, timestamp) {
    const filename = this.resolveFilename(Settings.options.filename, url, index, timestamp)
    const filepath = target_dir ? target_dir + '/' + filename : filename;
    chrome.downloads.download({
      url: blob,
      filename: filepath,
      conflictAction: "overwrite",
      saveAs: false
    });
  },

}

const Intercepter = {

  listener: null,
  seenDomains: new Set(),

  init() {
    this.updateListener(Settings.formats, Settings.options.customUrlPatterns);
    this.watchFormats();
  },

  addRefererRule(ruleId, domain, referer) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{
            header: "referer",
            operation: "set",
            value: `https://${domain}`
          }]
        },
        condition: {
          urlFilter: `*://${domain}/*`,
          resourceTypes: ["xmlhttprequest", "image", "script", "sub_frame"]
        }
      }]
    }, () => {
      console.log(`[DNR] Rule added: ${ruleId}. [${domain}] with Referer → ${referer}`);
    });
  },

  checkRerferRule(url) {
    const domain = Utils.extractDomain(url);
    const referer = Utils.getRootDomain(domain);
    if (this.seenDomains.has(domain)) return null;
    this.seenDomains.add(domain);
    const ruleId = this.seenDomains.size;
    return { ruleId, domain, referer };
  },

  getListener() {
    return (details) => {
      ImageQueue.insert(details.url);
      const refererRule = this.checkRerferRule(details.url);
      if (refererRule) {
        this.addRefererRule(refererRule.ruleId, refererRule.domain, refererRule.referer);
      }
    }
  },

  updateListener(formats, customUrlPatterns) {
    if (this.listener) {
      chrome.webRequest.onBeforeSendHeaders.removeListener(this.listener);
    }
    this.listener = this.getListener();
    const urls = formats.map(ext => `*://*/*.${ext.toLowerCase()}*`);
    const customUrls = customUrlPatterns !== "" ? customUrlPatterns.split(',') : [];
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.listener,
      { urls: urls.concat(customUrls) },
      ["requestHeaders"]
    );
  },

  watchFormats() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.webImageDownloaderSettings) {
        this.updateListener(
          changes.webImageDownloaderSettings.newValue.formats,
          changes.webImageDownloaderSettings.newValue.options.customUrlPatterns);
      }
    });
  },

  destroy() {
    if (this.listener) {
      chrome.webRequest.onBeforeRequest.removeListener(this.listener);
    }
  },

}

const Task = {
  async init() {
    await Settings.init();
    ImageQueue.init();
    Channel.init();
    Intercepter.init();
  }
}

Task.init();