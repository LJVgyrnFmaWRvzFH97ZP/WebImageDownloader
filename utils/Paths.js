export const Path = {

  getPathSegments(_url) {
    try {
      const url = new URL(_url);
      const domain = url.hostname;
      const pathSegments = url.pathname.split('/').filter(Boolean);
      return [domain, ...pathSegments];
    } catch (error) {
      console.log('failed to extract url: ' + _url);
      return [];
    }
  },

}