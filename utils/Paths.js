export const Path = {

  getPathSegments(_url, title) {
    try {
      const url = new URL(_url);
      const domain = url.hostname;
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const titleSegments = title.split(' ').filter(Boolean);
      return [...new Set([domain, ...pathSegments, ...titleSegments])];
    } catch (error) {
      console.log('failed to extract url: ' + _url);
      return [];
    }
  },

}