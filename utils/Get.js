export const Get = {

  async getBlobUrlBg(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const src = await this.blobToDataUrlBg(blob);
      return src;
    } catch (error) {
      console.warn("Error getting video source:", error);
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