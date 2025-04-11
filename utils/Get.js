export const Get = {

  async getBlobUrlBg(url, chunkSize = null) {
    try {
      const headers = {};
      if (chunkSize) {
        headers['Range'] = `bytes=0-${chunkSize}`
      }
      const response = await fetch(url, { headers });
      const blob = await response.blob();
      const src = await this.blobToDataUrlBg(blob);
      return src;
    } catch (error) {
      console.warn("Error getting video source: " + error + ' ' + url);
      return null;
    }
  },

  async blobToDataUrlBg(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  },

}