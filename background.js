let PORT = null;
let urls = [];
let paths = new Set();

const clean = () => {
  urls = [];
  paths.clear();
}

const finish = () => {
  if (!PORT) return;
  PORT.postMessage({
    action: "finish",
  });
}

const notify = () => {
  if (!PORT) return;
  PORT.postMessage({
    action: "update",
    urls,
  });
}

const getPath = (url) => {
  const file = url.split('/').at(-1).split('?')[0];
  return file;
}

const getAlbumDir = (callback) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;

    const title = tabs[0].title;
    const match = title.match(/\((.*?)\)/);
    const author = match ? match[1] : title;

    const album = url.split('/').slice(-2, -1)[0];
    const album_dir = author + '/' + album;
    callback(album_dir);
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const path = getPath(details.url);
    if (!path) return;
    if (!paths.has(path)) {
      paths.add(path)
      urls.push(details.url);
      notify();
    }
  },
  {
    urls: [
      "*://*/*.jpg*",
      "*://*/*.jpeg*",
    ]
  }
);

chrome.tabs.onRemoved.addListener(() => {
  clean();
  notify();
});

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === 'popup');
  PORT = port;

  port.onMessage.addListener((message) => {
    if (message.action === "save") {
      getAlbumDir((album_dir) => {
        message.urls.forEach((url, index) => {
          const path = getPath(url)
          const filename = `${album_dir}/${path}.jpg`;
          chrome.downloads.download({
            url: url,
            filename: filename,
            conflictAction: "overwrite",
            saveAs: false
          });
        });
      });
      finish();
    } else if (message.action === 'save-all') {
      getAlbumDir((album_dir) => {
        urls.forEach((url, index) => {
          const path = getPath(url)
          const filename = `${album_dir}/${path}.jpg`;
          chrome.downloads.download({
            url: url,
            filename: filename,
            conflictAction: "overwrite",
            saveAs: false
          });
        });
      });
      return;
    } else if (message.action === 'clean') {
      clean();
      notify();
      return;
    }
  });

  port.onDisconnect.addListener(() => {
    PORT = null;
  })

  notify();

});