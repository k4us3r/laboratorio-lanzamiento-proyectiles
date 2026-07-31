const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && !url.pathname.includes(".")) {
      const fallback = new URL("/index.html", request.url);
      response = await env.ASSETS.fetch(new Request(fallback, request));
    }

    return response;
  }
};

export default worker;
