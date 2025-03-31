const ImageQueue = {

  urls: [],
  paths: new Set(),

  get() {
    return this.urls;
  },

  insert(url) {
    const path = Utils.getPath(url);
    if (!path) return;
    if (!this.paths.has(path)) {
      this.paths.add(path)
      this.urls.push(url);
      Channel.notify();
    }
  },

  download(_urls) {
    const urls = _urls ?? this.urls;
    Utils.getTargetDir((target_dir) => {
      urls.forEach((url) => {
        Utils.downloadImage(url, target_dir);
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

  getPath(url) {
    const file = url.split('/').at(-1).split('?')[0];
    return file;
  },

  getTargetDir(download2) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const { url, title } = tabs[0];
      const match = title.match(/\((.*?)\)/);
      const author = match ? match[1] : title;
      const album = url.split('/').slice(-2, -1)[0];
      const target_dir = author + '/' + album;
      download2(target_dir);
    });
  },

  downloadImage(url, target_dir) {
    const path = this.getPath(url)
    const filename = `${target_dir}/${path}.jpg`;
    chrome.downloads.download({
      url: url,
      filename: filename,
      conflictAction: "overwrite",
      saveAs: false
    });
  },

}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    ImageQueue.insert(details.url);
  },
  {
    urls: [
      "*://*/*.jpg*",
      "*://*/*.jpeg*",
    ]
  }
);

chrome.tabs.onRemoved.addListener(() => {
  ImageQueue.clean();
  Channel.notify();
});

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === 'popup');

  Channel.port = port;

  port.onMessage.addListener((message) => {
    switch (message.action) {
      case "save":
        ImageQueue.download(message.urls);
        Channel.finish();
        break;
      case "save-all":
        ImageQueue.download();
        break;
      case "clean":
        ImageQueue.clean();
        Channel.notify();
        break;
      default:
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    Channel.port = null;
  })

  Channel.notify();

});