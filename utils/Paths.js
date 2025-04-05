export const Path = {

  getPathSegments() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return resolve([]);
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          const pathSegments = url.pathname.split('/').filter(Boolean);
          resolve([domain, ...pathSegments]);
        } catch (error) {
          console.log("failed to get path segments");
          return resolve([]);
        }
      });
    });
  },

}