export const Settings = {

  formats: ["JPEG", "JPG"],

  options: {
    pageSize: 20,
    minimalWidth: 200,
    rootDirectory: '',
    filename: '{timestamp}-{index}-{original_image_name}',
  },

  async init() {
    const settings = await this.loadSettings();
    this.updateOptions(settings);
    this.watchOptions();
  },

  async loadSettings() {
    const settings = await chrome.storage.sync.get("webImageDownloaderSettings");
    return settings.webImageDownloaderSettings || null;
  },

  updateOptions(settings) {
    this.formats = settings?.formats || this.formats;
    Object.keys(this.options).forEach(key => {
      this.options[key] = settings?.options?.[key] || this.options[key];
    })
  },

  watchOptions() {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.webImageDownloaderSettings) {
        this.updateOptions(changes.webImageDownloaderSettings.newValue)
      }
    });
  },

}