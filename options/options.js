import { Settings } from "../utils/Settings.js";

document.addEventListener("alpine:init", () => {

  Alpine.data("WebImageDownloaderOptions", () => ({

    formats: {
      avaliable: [],
      selected: null,
    },

    options: [
      {
        key: 'pageSize',
        name: "Page Size",
        desc: "Number of images to display each time.",
        placeholder: '',
        type: 'number',
        value: null,
      },
      {
        key: 'minimalWidth',
        name: "Minimal Image Width",
        desc: 'Minimal width of images to detect.',
        placeholder: '',
        type: 'number',
        value: null,
      },
      {
        key: 'filename',
        name: "Filename",
        desc: 'Filename format of the downloaded image.',
        placeholder: '{index}-{timestamp}-{original_image_name} → 1-1693498765-photo1',
        type: 'text',
        value: null,
      },
      {
        key: 'customUrlPatterns',
        name: "Custom URL Patterns",
        desc: 'Define custom patterns (comma-separated) to intercept image URLs.',
        placeholder: 'https://example.com/images/*,https://cdn.com/images/*',
        type: 'text',
        value: null,
      }
    ],

    async init() {
      await Settings.init();
      this.formats.avaliable = Settings.default.formats;
      this.updateOptions();
    },

    updateOptions() {
      this.formats.selected = new Set(Settings.formats);
      this.options.forEach((option) => {
        option.value = Settings.options[option.key];
      });
    },

    async saveSettings() {
      const options = {};
      this.options.forEach((option) => {
        options[option.key] = option.value;
      });
      const settings = {
        formats: Array.from(this.formats.selected),
        options,
      };
      await Settings.saveSettings(settings);
    },

    async resetSettings() {
      const settings = {
        formats: Settings.default.formats,
        options: Settings.default.options,
      }
      await Settings.saveSettings(settings);
      this.updateOptions();
    },

  }));

  Alpine.data("WebImageDownloaderOption", () => ({

    init() {
    },

    setValue(event) {
      if (this.option.type === 'number') {
        this.option.value = parseInt(event.target.value);
      } else {
        this.option.value = event.target.value;
      }
    }

  }));

  Alpine.data("WebImageDownloaderFormat", () => ({

    init() {
    },

    getCheckedStatus() {
      return this.formats.selected?.has(this.format);
    },

    setCheckedStatus(event) {
      if (event.target.checked) {
        this.formats.selected.add(this.format);
      } else {
        this.formats.selected.delete(this.format);
      }
    },

  }));

});