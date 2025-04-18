import { Get } from "./utils/Get.js";
import { MediaDB } from "./utils/DB.js";
import { Settings } from "./utils/Settings.js";

const MediaQueue = {

  db: null,
  paths: null,
  minWidth: 0,

  async init() {
    this.paths = new Set();
    this.db = new MediaDB();
    await this.db.init();
    await this.db.clear();
  },

  setMinWidth(minWidth) {
    this.minWidth = minWidth;
  },

  async resolve(url) {
    const path = Utils.getOriginalFilename(url);
    if (!path) return;
    if (!this.paths.has(path)) {
      this.paths.add(path);
      const blob = await Get.getBlobUrlBg(url);
      if (blob) {
        Channel.resolve(url, path, blob);
      }
    }
  },

  async insert(path, info) {
    if (Object.keys(info).length === 1) {
      this.paths.delete(path);
      return;
    }
    await this.db.add({
      path,
      ...info,
    })
    await Channel.notify();
  },

  async download(target_dir, medias) {
    const timestamp = Date.now();
    for (let i = 0; i < medias.length; i++) {
      const media = medias[i];
      await Utils.downloadMedia(target_dir, media.path, media.blob, i, timestamp);
      Channel.process(i + 1, medias.length);
    }
  },

  async downloadSelect(target_dir, ids) {
    const medias = await this.db.getByIds(ids);
    await this.download(target_dir, medias);
  },

  async downloadAll(target_dir) {
    const medias = await this.db.getByPage(this.minWidth);
    await this.download(target_dir, medias);
  },

  async count() {
    return await this.db.getCount(this.minWidth);
  },

  async clear() {
    this.db.clear();
    this.paths.clear();
  },

}

const Channel = {

  port: null,

  init() {
    chrome.runtime.onConnect.addListener(async (port) => {
      if (port.name !== 'popup') {
        return;
      }

      this.port = port;

      port.onMessage.addListener(async (message) => {
        switch (message.action) {
          case "resolve":
            await MediaQueue.insert(message.path, message.info);
            break;
          case "filter":
            MediaQueue.setMinWidth(message.minWidth);
            await Channel.notify();
            break;
          case "save":
            await MediaQueue.downloadSelect(message.target_dir, message.medias);
            break;
          case "save-all":
            await MediaQueue.downloadAll(message.target_dir);
            break;
          case "clean":
            await MediaQueue.clear();
            await this.notify();
            break;
          default:
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        this.port = null;
      })

      this.heartbeat();

      this.syncFilter(MediaQueue.minWidth);

      await this.notify();

    });
  },

  postMessage(message) {
    if (!this.port) return;
    try {
      this.port.postMessage(message);
    } catch (error) {
      console.error('failed to post message: ' + error);
    }
  },

  heartbeat() {
    setInterval(() => {
      this.postMessage({ action: 'heartbeat' });
    }, 25000);
  },

  process(current, total) {
    this.postMessage({
      action: 'process',
      current,
      total,
    })
  },

  resolve(url, path, blob) {
    this.postMessage({
      action: "resolve",
      url,
      path,
      blob,
    });
  },

  syncFilter(minWidth) {
    this.postMessage({
      action: "sync",
      minWidth,
    })
  },

  async notify() {
    const count = await MediaQueue.count();
    this.postMessage({
      action: "count",
      count,
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

  resolveFilename(option, path, index, timestamp) {
    const fileparts = path.split('.');
    const originalMediaName = fileparts[0];
    const ext = '.' + fileparts.slice(-1)[0];
    return option.replace(/{(.*?)}/g, (match, key) => {
      if (key === "index") return index.toString();
      if (key === "timestamp") return timestamp.toString();
      if (key === "original_image_name") return originalMediaName;
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  chromeDownload(url, filename) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename,
        conflictAction: "overwrite",
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  },

  async downloadMedia(target_dir, path, url, index, timestamp) {
    const filename = this.resolveFilename(Settings.options.filename, path, index, timestamp)
    const filepath = target_dir ? target_dir + '/' + filename : filename;
    try {
      const downloadId = await this.chromeDownload(url, filepath);
      return new Promise((resolve) => {
        const listener = (delta) => {
          if (delta.id === downloadId && delta.state?.current === "complete") {
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          }
          if (delta.id === downloadId && delta.state?.current === "interrupted") {
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          }
        };
        chrome.downloads.onChanged.addListener(listener);
      });
    } catch (error) {
      console.warn(`failed to download ${url}, ${error}`);
      return;
    }
  },

}

const Intercepter = {

  listener: null,
  seenDomains: new Set(),

  formatListener: null,

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
          resourceTypes: ["xmlhttprequest", "media", "script", "sub_frame"]
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
    return async (details) => {
      const refererRule = this.checkRerferRule(details.url);
      if (refererRule) {
        this.addRefererRule(refererRule.ruleId, refererRule.domain, refererRule.referer);
      }
      await MediaQueue.resolve(details.url);
    }
  },

  getFilterUrls(formats, customUrlPatterns) {
    const urls = formats.map(ext => `*://*/*.${ext.toLowerCase()}*`);
    const customUrls = customUrlPatterns !== "" ? customUrlPatterns.split(',') : [];
    return urls.concat(customUrls);
  },

  updateListener(formats, customUrlPatterns) {
    if (this.listener) {
      chrome.webRequest.onBeforeSendHeaders.removeListener(this.listener);
    }
    this.listener = this.getListener();
    const urls = this.getFilterUrls(formats, customUrlPatterns);
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.listener,
      { urls },
      ["requestHeaders"]
    );
  },

  getFormatListener() {
    return (changes) => {
      if (changes.webImageDownloaderSettings) {
        this.updateListener(
          changes.webImageDownloaderSettings.newValue.formats,
          changes.webImageDownloaderSettings.newValue.options.customUrlPatterns);
      }
    };
  },

  watchFormats() {
    if (this.formatListener) {
      chrome.storage.onChanged.removeListener(this.listener);
    }
    this.formatListener = this.getFormatListener();
    chrome.storage.onChanged.addListener(this.formatListener);
  },

  destroy() {
    if (this.formatListener) {
      chrome.storage.onChanged.removeListener(this.formatListener);
      this.formatListener = null;
    }
    if (this.listener) {
      chrome.webRequest.onBeforeSendHeaders.removeListener(this.listener);
      this.listener = null;
    }
  },

}

const Popup = {

  width: 320,
  height: 600,
  screen: null,
  popupWindowId: null,

  async init() {
    this.screen = await this.getScreenSize();
    chrome.action.onClicked.addListener(() => { this.openPopup() });
    chrome.windows.onRemoved.addListener((windowId) => { this.closePopup(windowId) });
  },

  async openPopup() {
    if (this.popupWindowId) {
      chrome.windows.update(this.popupWindowId, { focused: true });
    } else {
      await Settings.init();
      Intercepter.init();
      chrome.windows.create({
        url: "popup/popup.html",
        type: "popup",
        width: this.width,
        height: this.height,
        left: this.screen.left + this.screen.width - this.width,
        top: this.screen.top + Math.floor((this.screen.height - this.height) / 2)
      }, (newWindow) => {
        this.popupWindowId = newWindow.id;
      });
    }
  },

  closePopup(windowId) {
    if (windowId === this.popupWindowId) {
      Intercepter.destroy();
      this.popupWindowId = null;
    }
  },

  async getScreenSize() {
    return new Promise((resolve) => chrome.system.display.getInfo((displays) => {
      const display = displays[0];
      resolve(display.workArea);
    }));
  },

}

const Task = {
  async init() {
    await MediaQueue.init();
    Channel.init();
    await Popup.init();
  }
}

Task.init();